"use client";
import { useEffect, useState } from "react";

interface MacroStat {
  mean: number;
  std:  number;
  min:  number;
  max:  number;
}

interface RegimeMacroStats {
  n_days:          number;
  vix?:            MacroStat;
  unrate?:         MacroStat;
  fedfunds?:       MacroStat;
  t10y2y?:         MacroStat;
  unrate_mom?:     MacroStat;
  fedfunds_change?: MacroStat;
  cpi_yoy?:        MacroStat;
}

interface LogisticResult {
  fitted:       boolean;
  coefficients?: Record<string, number>;
  precision?:   number;
  recall?:      number;
  n_crash_days?: number;
  n_total_days?: number;
  top_predictor?: string;
  reason?:      string;
  note?:        string;
}

interface SnapshotItem {
  label: string;
  value: number;
  unit:  string;
}

interface HistoryPoint {
  date:   string;
  regime: number;
  vix:    number;
  unrate: number;
  t10y2y: number;
}

interface MacroData {
  regime_macro_stats: Record<string, RegimeMacroStats>;
  correlations:       Record<string, number>;
  logistic:           LogisticResult;
  snapshot:           Record<string, SnapshotItem | string>;
  history:            HistoryPoint[];
  key_finding:        string;
  series_meta:        Record<string, { label: string; unit: string }>;
}

interface Props {
  ticker: string;
  period: string;
}

const REGIME_COLORS: Record<string, string> = {
  crash:        "#a855f7",
  bearish:      "#ef4444",
  transitional: "#f59e0b",
  bullish:      "#22c55e",
};

const REGIME_ORDER = ["crash", "bearish", "transitional", "bullish"];

const FEAT_LABELS: Record<string, string> = {
  vix:             "VIX",
  unrate:          "Unemployment %",
  fedfunds:        "Fed Funds Rate",
  t10y2y:          "Yield Curve (10Y-2Y)",
  unrate_mom:      "Unemployment MoM Δ",
  fedfunds_change: "Fed Funds Qtr Δ",
  cpi_yoy:         "CPI YoY",
  indpro:          "Industrial Production",
};

const fmt  = (v: number | undefined, d = 2) => v != null ? v.toFixed(d) : "—";
const fmtC = (v: number) => v > 0 ? `+${v.toFixed(3)}` : v.toFixed(3);

function CorrBar({ value }: { value: number }) {
  const pct   = Math.abs(value) * 100;
  const color = value > 0 ? "#22c55e" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: ".5em" }}>
      <div style={{ width: "80px", height: "4px", background: "#252525", position: "relative" }}>
        <div style={{
          position:  "absolute",
          height:    "100%",
          width:     `${pct}%`,
          background: color,
          left:      value > 0 ? "0" : "auto",
          right:     value < 0 ? "0" : "auto",
        }} />
      </div>
      <span style={{
        fontFamily: "monospace", fontSize: ".75em",
        color: value > 0 ? "#22c55e" : "#ef4444",
      }}>
        {fmtC(value)}
      </span>
    </div>
  );
}

function CoefBar({ value, max }: { value: number; max: number }) {
  const pct   = max > 0 ? Math.abs(value) / max * 100 : 0;
  const color = value > 0 ? "#ef4444" : "#22c55e"; 
  return (
    <div style={{ display: "flex", alignItems: "center", gap: ".5em" }}>
      <div style={{ width: "60px", height: "4px", background: "#252525" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color }} />
      </div>
      <span style={{ fontFamily: "monospace", fontSize: ".75em", color }}>
        {fmtC(value)}
      </span>
    </div>
  );
}

export default function MacroAttribution({ ticker, period }: Props) {
  const [data, setData]       = useState<MacroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/macro_attribution?ticker=${ticker}&period=${period}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [ticker, period]);

  if (loading) return (
    <div className="loading flex flex-col items-center justify-center gap-3 py-10 text-slate-500">
      <div className="w-6 h-6 rounded-full border-2 border-slate-600 border-t-slate-300 animate-spin" />
      <p className="text-xs">Fetching FRED macro data...</p>
    </div>
  );

  if (error || !data) return (
    <div style={{ fontSize: ".75em", color: "#f87171", marginTop: "1em" }}>
      Macro attribution unavailable: {error ?? "no data"}.{" "}
      Check FRED_API_KEY is set in environment variables.
    </div>
  );

  const snap     = data.snapshot;
  const logistic = data.logistic;
  const corrEntries = Object.entries(data.correlations).slice(0, 8);
  const maxCoef = logistic.fitted && logistic.coefficients
    ? Math.max(...Object.values(logistic.coefficients).map(Math.abs))
    : 1;

  const snapItems = Object.entries(snap).filter(
    ([k, v]) => k !== "as_of" && typeof v === "object"
  ) as [string, SnapshotItem][];

  return (
    <div style={{ marginTop: "2em" }}>

      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: "1em 0 0 0", fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>
          Economic Regime Attributions <span style={{ fontSize: 12,}}> FRED Macro Data · Logistic Regression</span>
        </h2>
      </div>

      <div className="stats-header" style={{ marginBottom: ".5em" }}>
        <p>
          Maps statistical HMM regimes to FRED macroeconomic fundamentals.
          Logistic regression identifies which macro variables predict crash regimes.
          Correlations show ordinal relationship between macro state and regime severity (0=crash → 3=bullish).
        </p>
        <p>
          Data as of {typeof snap.as_of === "string" ? snap.as_of : "—"} ·
          Series: Unemployment, Fed Funds Rate, CPI YoY, Yield Curve (10Y-2Y), VIX, Industrial Production
        </p>
      </div>

      <div style={{ fontSize: ".7em", margin: "1em 0 .5em", letterSpacing: ".08em" }}>
        CURRENT MACRO SNAPSHOT
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: ".5em",
        marginBottom: ".5em",
      }}>
        {snapItems.map(([key, item]) => (
          <div key={key} className="bt-summary-card" style={{ padding: ".75em" }}>
            <div style={{ fontSize: ".65em", color: "#555", marginBottom: ".4em" }}>
              {item.label}
            </div>
            <div style={{ fontSize: "1em", fontWeight: 700, fontFamily: "monospace", color: "#e2e8f0" }}>
              {fmt(item.value, key === "t10y2y" || key.includes("_mom") || key.includes("_change") ? 2 : 1)}
              <span style={{ fontSize: ".7em", color: "#555", marginLeft: ".2em" }}>{item.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bt-grid-2" style={{ marginBottom: ".5em" }}>

        <div className="bt-section">
          <div className="bt-section-head">
            <span style={{ fontSize: ".7em", letterSpacing: ".08em" }}>
              MACRO–REGIME CORRELATIONS (ρ)
            </span>
          </div>
          <div style={{ fontSize: ".65em", color: "#555", marginBottom: ".75em", lineHeight: 1.6 }}>
            Ordinal correlation with regime severity (0=crash → 3=bullish).
            Negative = variable rises as conditions worsen.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: ".6em" }}>
            {corrEntries.map(([feat, corr]) => (
              <div key={feat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: ".75em", color: "#888" }}>
                  {FEAT_LABELS[feat] ?? feat}
                </span>
                <CorrBar value={corr} />
              </div>
            ))}
          </div>
        </div>

        <div className="bt-section">
          <div className="bt-section-head">
            <span style={{ fontSize: ".7em", letterSpacing: ".08em" }}>
              CRASH REGIME PREDICTORS
            </span>
          </div>
          {logistic.fitted ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".5em", marginBottom: ".75em" }}>
                <div className="bt-compare-card">
                  <div style={{ fontSize: ".65em", color: "#555", marginBottom: ".3em" }}>Precision</div>
                  <div style={{ fontFamily: "monospace", fontWeight: 700, color: "#4ade80" }}>
                    {logistic.precision != null ? `${(logistic.precision * 100).toFixed(1)}%` : "—"}
                  </div>
                </div>
                <div className="bt-compare-card">
                  <div style={{ fontSize: ".65em", color: "#555", marginBottom: ".3em" }}>Recall</div>
                  <div style={{ fontFamily: "monospace", fontWeight: 700, color: "#4ade80" }}>
                    {logistic.recall != null ? `${(logistic.recall * 100).toFixed(1)}%` : "—"}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: ".65em", color: "#555", marginBottom: ".6em" }}>
                Logistic coefficients — positive = increases crash probability
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: ".6em" }}>
                {Object.entries(logistic.coefficients ?? {}).map(([feat, coef]) => (
                  <div key={feat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: ".75em", color: "#888" }}>
                      {FEAT_LABELS[feat] ?? feat}
                    </span>
                    <CoefBar value={coef} max={maxCoef} />
                  </div>
                ))}
              </div>
              {logistic.note && (
                <div style={{ fontSize: ".65em", color: "#555", marginTop: ".75em", fontStyle: "italic" }}>
                  {logistic.note}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: ".75em", color: "#555", fontStyle: "italic" }}>
              {logistic.reason ?? "Logistic fit unavailable"}
            </div>
          )}
        </div>
      </div>

      <div style={{ fontSize: ".7em", margin: "1em 0 .5em", letterSpacing: ".08em" }}>
        MACRO CONDITIONS BY REGIME (HISTORICAL AVERAGES)
      </div>
      <div className="stats-table-wrap" style={{ marginBottom: ".5em" }}>
        <table className="stats-table">
          <thead>
            <tr>
              <th>Variable</th>
              {REGIME_ORDER.map((r) => (
                <th key={r} style={{ color: REGIME_COLORS[r], textTransform: "capitalize" }}>{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(["vix", "unrate", "fedfunds", "t10y2y", "unrate_mom", "cpi_yoy"] as const).map((feat) => {
              const hasData = REGIME_ORDER.some(
                (r) => data.regime_macro_stats[r]?.[feat as keyof RegimeMacroStats] != null
              );
              if (!hasData) return null;
              return (
                <tr key={feat}>
                  <td style={{ color: "#666" }}>{FEAT_LABELS[feat] ?? feat}</td>
                  {REGIME_ORDER.map((regime) => {
                    const stat = data.regime_macro_stats[regime]?.[feat as keyof RegimeMacroStats] as MacroStat | undefined;
                    return (
                      <td key={regime}>
                        {stat ? (
                          <span className="val" style={{ color: REGIME_COLORS[regime] }}>
                            {fmt(stat.mean, 2)}
                          </span>
                        ) : (
                          <span style={{ color: "#444" }}>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="paper-context">
        <p>
          <span style={{ color: "#93c5fd", fontWeight: 700 }}>Key finding · </span>
          {data.key_finding}
          {logistic.fitted && logistic.top_predictor && (
            <> Top crash predictor:{" "}
              <span style={{ color: "#a855f7", fontWeight: 700 }}>
                {FEAT_LABELS[logistic.top_predictor] ?? logistic.top_predictor}
              </span>
              {logistic.precision != null && (
                <> with{" "}
                  <span style={{ fontFamily: "monospace", color: "#4ade80", fontWeight: 700 }}>
                    {(logistic.precision * 100).toFixed(1)}%
                  </span>{" "}
                  precision in predicting crash regimes.
                </>
              )}
            </>
          )}
        </p>
      </div>

      <div className="stats-footer">
        FRED series: UNRATE · FEDFUNDS · CPIAUCSL · T10Y2Y · VIXCLS · INDPRO ·
        Monthly series forward-filled to daily · Correlations vs ordinal regime label (0=crash → 3=bullish) ·
        Logistic regression with balanced class weights for crash detection
      </div>

    </div>
  );
}