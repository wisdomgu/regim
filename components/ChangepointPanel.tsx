"use client";
import { useEffect, useState, useRef } from "react";

interface LagRow {
  cp_date:     string;
  hmm_date:    string;
  lag_days:    number;
  from_regime: string;
  to_regime:   string;
  pre_vol:     number;
  post_vol:    number;
  vol_jump:    number;
}

interface ChangepointData {
  changepoint_indices: number[];
  changepoint_dates:   string[];
  n_changepoints:      number;
  prob_series:         number[];
  dates:               string[];
  lag_table:           LagRow[];
  summary: {
    avg_lag_days:       number;
    median_lag_days:    number;
    n_matched:          number;
    n_earlier_than_hmm: number;
    n_later_than_hmm:   number;
    n_same_day:         number;
    pct_earlier:        number;
    n_hmm_switches:     number;
    n_cp_detected:      number;
    penalty_used:       number;
  };
}

interface PricePoint {
  date:   string;
  close:  number;
  regime: number;
}

interface Props {
  ticker: string;
  period: string;
  prices: PricePoint[]; 
}

const REGIME_COLORS: Record<string, string> = {
  crash:        "#a855f7",
  bearish:      "#ef4444",
  transitional: "#f59e0b",
  bullish:      "#22c55e",
};

const REGIME_BG: Record<string, string> = {
  crash:        "rgba(168,85,247,0.15)",
  bearish:      "rgba(239,68,68,0.15)",
  transitional: "rgba(245,158,11,0.15)",
  bullish:      "rgba(34,197,94,0.15)",
};

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmt = (v: number, d = 1) => v.toFixed(d);

function ProbChart({
  probSeries,
  dates,
  cpIndices,
  prices,
}: {
  probSeries: number[];
  dates: string[];
  cpIndices: number[];
  prices: PricePoint[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || probSeries.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;
    ctx.clearRect(0, 0, W, H);

    const n = probSeries.length;
    const maxProb = Math.max(...probSeries, 0.01);

    if (prices.length > 0) {
      const closes = prices.map((p) => p.close);
      const minC = Math.min(...closes);
      const maxC = Math.max(...closes);
      const rangeC = maxC - minC || 1;

      ctx.beginPath();
      ctx.strokeStyle = "rgba(100,116,139,0.2)";
      ctx.lineWidth = 1;
      prices.forEach((p, i) => {
        const x = (i / (prices.length - 1)) * W;
        const y = H - ((p.close - minC) / rangeC) * H * 0.6 - H * 0.1;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.fillStyle = "rgba(59,130,246,0.12)";
    probSeries.forEach((p, i) => {
      const x = (i / (n - 1)) * W;
      const y = H - (p / maxProb) * H * 0.85;
      i === 0 ? ctx.moveTo(x, H) : null;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1.5;
    probSeries.forEach((p, i) => {
      const x = (i / (n - 1)) * W;
      const y = H - (p / maxProb) * H * 0.85;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    cpIndices.forEach((idx) => {
      if (idx >= n) return;
      const x = (idx / (n - 1)) * W;
      ctx.beginPath();
      ctx.strokeStyle = "rgba(251,191,36,0.7)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    if (dates.length > 0) {
      ctx.fillStyle = "#475569";
      ctx.font = "10px monospace";
      ctx.fillText(dates[0], 4, H - 4);
      const lastLabel = dates[dates.length - 1];
      ctx.fillText(lastLabel, W - ctx.measureText(lastLabel).width - 4, H - 4);
    }
  }, [probSeries, dates, cpIndices, prices]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "140px", display: "block" }}
    />
  );
}

export default function ChangepointPanel({ ticker, period, prices }: Props) {
  const [data, setData]       = useState<ChangepointData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/changepoint?ticker=${ticker}&period=${period}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [ticker, period]);

  if (loading) return (
    <div className="loading flex flex-col items-center justify-center gap-3 py-10 text-slate-500">
      <div className="w-6 h-6 rounded-full border-2 border-slate-600 border-t-slate-300 animate-spin" />
      <p className="text-xs">Computing Bayesian changepoint detection...</p>
    </div>
  );

  if (error || !data) return (
    <div style={{ fontSize: ".75em", color: "#f87171", marginTop: "1em" }}>
      Changepoint analysis unavailable: {error ?? "no data"}
    </div>
  );

  const s = data.summary;
  const avgLagPositive = s.avg_lag_days > 0;

  return (
    <div style={{ marginTop: "2em" }}>

      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: "1em 0 0 0", fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>
          Bayesian Changepoint Detection <span style={{ fontSize: 12,}}> Pelt Algorithm · Compared vs HMM Viterbi Path</span>
        </h2>
      </div>

      <div className="stats-header" style={{ marginBottom: ".5em" }}>
        <p>
          Ruptures PELT (Penalised Exact Linear Time) detects structural breaks in the return series.
          Detection lag measures how many days earlier changepoints are identified vs HMM Viterbi smoothing.
          Positive lag = changepoint detected before HMM switches.
        </p>
        <p>
          Rolling Bayesian probability P(changepoint in last 21 days) computed via variance-shift evidence.
          Yellow dashed lines mark detected changepoints on the chart below.
        </p>
      </div>

      <div className="vol_forecast" style={{ marginBottom: ".5em" }}>
        <div className="bt-summary-card" style={{ padding: ".75em" }}>
          <div style={{ fontSize: ".7em", color: "#555", marginBottom: ".4em" }}>Avg detection lead</div>
          <div style={{ fontSize: "1.1em", fontWeight: 700, color: avgLagPositive ? "#4ade80" : "#f87171" }}>
            {avgLagPositive ? "+" : ""}{fmt(s.avg_lag_days)} days
          </div>
          <div style={{ fontSize: ".7em", color: "#555", marginTop: ".3em" }}>
            vs Viterbi smoothing
          </div>
        </div>

        <div className="bt-summary-card" style={{ padding: ".75em" }}>
          <div style={{ fontSize: ".7em", color: "#555", marginBottom: ".4em" }}>Earlier than HMM</div>
          <div style={{ fontSize: "1.1em", fontWeight: 700, color: "#4ade80" }}>
            {s.pct_earlier.toFixed(1)}%
          </div>
          <div style={{ fontSize: ".7em", color: "#555", marginTop: ".3em" }}>
            {s.n_earlier_than_hmm} of {s.n_matched} switches
          </div>
        </div>

        <div className="bt-summary-card" style={{ padding: ".75em" }}>
          <div style={{ fontSize: ".7em", color: "#555", marginBottom: ".4em" }}>Changepoints detected</div>
          <div style={{ fontSize: "1.1em", fontWeight: 700, color: "#e2e8f0" }}>
            {s.n_cp_detected}
          </div>
          <div style={{ fontSize: ".7em", color: "#555", marginTop: ".3em" }}>
            vs {s.n_hmm_switches} HMM switches
          </div>
        </div>

        <div className="bt-summary-card" style={{ padding: ".75em" }}>
          <div style={{ fontSize: ".7em", color: "#555", marginBottom: ".4em" }}>Median detection lead</div>
          <div style={{ fontSize: "1.1em", fontWeight: 700, color: "#e2e8f0" }}>
            {s.median_lag_days > 0 ? "+" : ""}{fmt(s.median_lag_days)} days
          </div>
          <div style={{ fontSize: ".7em", color: "#555", marginTop: ".3em" }}>
            PELT penalty {fmt(s.penalty_used, 4)}
          </div>
        </div>
      </div>

      <div className="bt-section" style={{ marginBottom: ".5em" }}>
        <div className="bt-section-head">
          <span style={{ fontSize: ".7em", letterSpacing: ".08em" }}>
            CHANGEPOINT PROBABILITY · PRICE OVERLAY
          </span>
          <div style={{ display: "flex", gap: "1em", fontSize: ".65em", color: "#555" }}>
            <span style={{ display: "flex", alignItems: "center", gap: ".3em" }}>
              <span style={{ display: "inline-block", width: "16px", height: "2px", background: "#3b82f6" }} />
              P(changepoint)
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: ".3em" }}>
              <span style={{ display: "inline-block", width: "16px", height: "2px", background: "rgba(251,191,36,0.7)", borderTop: "2px dashed rgba(251,191,36,0.7)" }} />
              detected switch
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: ".3em" }}>
              <span style={{ display: "inline-block", width: "16px", height: "2px", background: "rgba(100,116,139,0.4)" }} />
              price
            </span>
          </div>
        </div>
        <ProbChart
          probSeries={data.prob_series}
          dates={data.dates}
          cpIndices={data.changepoint_indices}
          prices={prices}
        />
      </div>

      <div className="stats-table-wrap" style={{ marginBottom: ".5em" }}>
        <table className="stats-table">
          <thead>
            <tr>
              <th>CP date</th>
              <th>HMM date</th>
              <th>Lead/lag</th>
              <th>Transition</th>
              <th>Pre-vol</th>
              <th>Post-vol</th>
              <th>Vol jump</th>
            </tr>
          </thead>
          <tbody>
            {data.lag_table.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "#444", padding: "1em", fontSize: ".8em" }}>
                  No matched changepoints — try a longer period (1y)
                </td>
              </tr>
            ) : (
              data.lag_table.map((row, i) => {
                const lagColor = row.lag_days > 0 ? "#4ade80" : row.lag_days < 0 ? "#f87171" : "#888";
                const fromColor = REGIME_COLORS[row.from_regime] ?? "#888";
                const toColor   = REGIME_COLORS[row.to_regime]   ?? "#888";
                return (
                  <tr key={i}>
                    <td><span className="val muted" style={{ fontFamily: "monospace", fontSize: "1em" }}>{row.cp_date}</span></td>
                    <td><span className="val muted" style={{ fontFamily: "monospace", fontSize: "1em" }}>{row.hmm_date}</span></td>
                    <td>
                      <span className="val" style={{ color: lagColor, fontFamily: "monospace" }}>
                        {row.lag_days > 0 ? "+" : ""}{row.lag_days}d
                      </span>
                      {row.lag_days > 0 && (
                        <span style={{ fontSize: ".8em", color: "#4ade80", marginLeft: ".4em" }}>earlier</span>
                      )}
                      {row.lag_days < 0 && (
                        <span style={{ fontSize: ".8em", color: "#f87171", marginLeft: ".4em" }}>later</span>
                      )}
                    </td>
                    <td>
                      <span style={{ color: fromColor, textTransform: "capitalize", fontSize: ".8em" }}>
                        {row.from_regime}
                      </span>
                      <span style={{ color: "#555", margin: "0 .3em" }}>→</span>
                      <span style={{ color: toColor, textTransform: "capitalize", fontSize: ".8em" }}>
                        {row.to_regime}
                      </span>
                    </td>
                    <td><span className="val muted" style={{fontSize: "1em"}}>{pct(row.pre_vol)}</span></td>
                    <td><span className="val muted" style={{fontSize: "1em"}}>{pct(row.post_vol)}</span></td>
                    <td>
                      <span className="val" style={{ color: row.vol_jump > 0 ? "#f87171" : "#4ade80" }}>
                        {row.vol_jump > 0 ? "+" : ""}{pct(row.vol_jump)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="paper-context">
        <p>
          <span style={{ color: "#93c5fd", fontWeight: 700 }}>Key finding · </span>
          Bayesian changepoint detection (PELT) identified regime switches{" "}
          <span style={{ color: avgLagPositive ? "#4ade80" : "#f87171", fontFamily: "monospace", fontWeight: 700 }}>
            {avgLagPositive ? "+" : ""}{fmt(s.avg_lag_days)} days
          </span>{" "}
          earlier than HMM Viterbi path smoothing on average
          ({s.pct_earlier.toFixed(1)}% of transitions detected in advance).
          {s.n_earlier_than_hmm > 0 && (
            <> Earlier detection enables pre-emptive execution strategy adjustment
              before the HMM model confirms a regime switch.</>
          )}
        </p>
      </div>

      <div className="stats-footer">
        PELT: minimises sum of within-segment costs + penalty·n_breakpoints ·
        Penalty = log(n)·σ²·3 (BIC-approximation) ·
        Rolling P(changepoint) uses 21-day variance-shift Bayesian evidence ·
        Lag = HMM switch date − changepoint date (positive = CP earlier)
      </div>

    </div>
  );
}