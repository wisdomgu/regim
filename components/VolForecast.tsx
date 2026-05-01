"use client";
import { useEffect, useState } from "react";

interface RegimeParams {
  fitted: boolean;
  n_obs: number;
  vol_annualized: number | null;
  vol_5d_forecast: number | null;
  persistence: number | null;
  alpha: number;
  beta: number;
  long_run_vol: number;
  reason?: string;
}

interface VolForecastData {
  current_regime: string;
  horizon_days: number;
  unconditional: {
    fitted: boolean;
    vol_forecast_annualized: number;
    params: { alpha: number; beta: number; persistence: number };
  };
  conditional: {
    fitted: boolean;
    vol_forecast_annualized: number;
    regime: string;
  };
  rmse_reduction_pct: number;
  rmse_unconditional: number;
  rmse_conditional: number;
  regime_params: Record<string, RegimeParams>;
  regime_vols: Record<string, number | null>;
  vol_ratio_crash_bearish: number | null;
  vol_ratio_crash_bullish: number | null;
  rolling_vol_history: number[];
}

const REGIME_COLORS: Record<string, string> = {
  crash:        "#a855f7",
  bearish:      "#ef4444",
  transitional: "#f59e0b",
  bullish:      "#22c55e",
};

const REGIME_ORDER = ["crash", "bearish", "transitional", "bullish"];

const pct  = (v: number | null | undefined) => v != null ? `${(v * 100).toFixed(1)}%` : "—";
const fmt  = (v: number | null | undefined, d = 4) => v != null ? v.toFixed(d) : "—";

interface Props { ticker: string; period: string; }

export default function VolForecast({ ticker, period }: Props) {
  const [data, setData]       = useState<VolForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/vol_forecast?ticker=${ticker}&period=${period}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [ticker, period]);

  if (loading) return (
    <div className="loading flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
      <div className="w-6 h-6 rounded-full border-2 border-slate-600 border-t-slate-300 animate-spin" />
      <p className="text-xs">Computing regime-conditional GARCH...</p>
    </div>
  );

  if (error || !data) return (
    <div style={{ fontSize: ".75em", color: "#f87171", marginTop: "1em" }}>
      Vol forecast unavailable: {error ?? "no data"}
    </div>
  );

  const maxVol = Math.max(...REGIME_ORDER.map((r) => data.regime_vols[r] ?? 0));
  const color  = REGIME_COLORS[data.current_regime] ?? "#888";

  return (
    <div style={{ marginTop: "2em" }}>

      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: "1em 0 0 0", fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>
          Regime Conditional Volatility Forecast <span style={{ fontSize: 12,}}> GARCH(1,1) · {data.horizon_days}-Day Horizon</span>
        </h2>
      </div>

      <div className="stats-header" style={{ marginBottom: ".5em" }}>
        <p>
          Separate GARCH(1,1) fitted per regime state. Conditional forecast uses only observations
          from the current <span style={{ color }}>{data.current_regime}</span> regime.
          Unconditional baseline uses the full return series.
        </p>
        <p>
          RMSE measured against rolling 21-day realised volatility windows — lower is better.
        </p>
      </div>

      <div className="vol_forecast" style={{ marginBottom: ".5em" }}>
        <div className="bt-summary-card" style={{ padding: ".75em" }}>
          <div style={{ fontSize: ".7em", color: "#555", marginBottom: ".4em" }}>Conditional vol forecast</div>
          <div style={{ fontSize: "1.1em", fontWeight: 700, color }}>
            {pct(data.conditional.vol_forecast_annualized)}
          </div>
          <div style={{ fontSize: ".7em", color: "#555", marginTop: ".3em", textTransform: "capitalize" }}>
            {data.current_regime} regime · {data.horizon_days}d ahead
          </div>
        </div>

        <div className="bt-summary-card" style={{ padding: ".75em" }}>
          <div style={{ fontSize: ".7em", color: "#555", marginBottom: ".4em" }}>Unconditional GARCH</div>
          <div style={{ fontSize: "1.1em", fontWeight: 700, color: "#888" }}>
            {pct(data.unconditional.vol_forecast_annualized)}
          </div>
          <div style={{ fontSize: ".7em", color: "#555", marginTop: ".3em" }}>
            Full-series baseline
          </div>
        </div>

        <div className="bt-summary-card" style={{ padding: ".75em" }}>
          <div style={{ fontSize: ".7em", color: "#555", marginBottom: ".4em" }}>RMSE reduction</div>
          <div style={{
            fontSize: "1.1em", fontWeight: 700,
            color: data.rmse_reduction_pct > 0 ? "#4ade80" : "#f87171",
          }}>
            {data.rmse_reduction_pct > 0 ? "+" : ""}{data.rmse_reduction_pct.toFixed(1)}%
          </div>
          <div style={{ fontSize: ".7em", color: "#555", marginTop: ".3em" }}>
            vs unconditional model
          </div>
        </div>

        <div className="bt-summary-card" style={{ padding: ".75em" }}>
          <div style={{ fontSize: ".7em", color: "#555", marginBottom: ".4em" }}>Crash / bearish vol ratio</div>
          <div style={{ fontSize: "1.1em", fontWeight: 700, color: "#a855f7" }}>
            {data.vol_ratio_crash_bearish != null ? `${data.vol_ratio_crash_bearish}×` : "—"}
          </div>
          <div style={{ fontSize: ".7em", color: "#555", marginTop: ".3em" }}>
            Regime separation signal
          </div>
        </div>
      </div>

      <div className="bt-grid-2" style={{ marginBottom: ".5em" }}>

        <div className="bt-section">
          <div className="bt-section-head">
            <span style={{ fontSize: ".7em", letterSpacing: ".08em" }}>ANNUALISED VOL BY REGIME</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: ".75em" }}>
            {REGIME_ORDER.map((regime) => {
              const vol      = data.regime_vols[regime];
              const params   = data.regime_params[regime];
              const c        = REGIME_COLORS[regime];
              const barWidth = vol != null && maxVol > 0 ? `${(vol / maxVol) * 100}%` : "0%";
              const isCurrent = regime === data.current_regime;

              return (
                <div key={regime}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: ".5em" }}>
                      <span style={{ fontSize: ".75em", color: c, textTransform: "capitalize", fontWeight: 700 }}>
                        {regime}
                      </span>
                      {isCurrent && (
                        <span style={{
                          fontSize: ".6em", padding: ".1em .4em",
                          background: "#252525", color: "#888", border: "1px solid #333",
                        }}>
                          current
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "1em", alignItems: "center" }}>
                      {params?.fitted && params.persistence != null && (
                        <span style={{ fontSize: ".65em", color: "#555", fontFamily: "monospace" }}>
                          pers {fmt(params.persistence, 3)}
                        </span>
                      )}
                      {params?.n_obs != null && (
                        <span style={{ fontSize: ".65em", color: "#444" }}>{params.n_obs} obs</span>
                      )}
                      <span style={{ fontSize: ".75em", fontFamily: "monospace", color: "#ccc" }}>
                        {vol != null ? pct(vol) : "—"}
                      </span>
                    </div>
                  </div>
                  <div style={{ height: "3px", background: "#252525" }}>
                    <div style={{
                      height: "100%", width: barWidth,
                      backgroundColor: c, opacity: 0.8,
                      transition: "width .7s cubic-bezier(0.4,0,0.2,1)",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bt-section">
          <div className="bt-section-head">
            <span style={{ fontSize: ".7em", letterSpacing: ".08em" }}>FORECAST ACCURACY COMPARISON</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: ".5em" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".5em" }}>
              <div className="bt-compare-card">
                <div style={{ fontSize: ".65em", color: "#555", marginBottom: ".4em" }}>RMSE unconditional</div>
                <div style={{ fontSize: ".9em", fontFamily: "monospace", color: "#888" }}>
                  {fmt(data.rmse_unconditional, 4)}
                </div>
              </div>
              <div className="bt-compare-card">
                <div style={{ fontSize: ".65em", color: "#555", marginBottom: ".4em" }}>RMSE conditional</div>
                <div style={{
                  fontSize: ".9em", fontFamily: "monospace",
                  color: data.rmse_conditional < data.rmse_unconditional ? "#4ade80" : "#f87171",
                }}>
                  {fmt(data.rmse_conditional, 4)}
                </div>
              </div>
            </div>

            {[
              { label: "5d vol forecast (conditional)", val: data.conditional.vol_forecast_annualized, c: color },
              { label: "5d vol forecast (unconditional)", val: data.unconditional.vol_forecast_annualized, c: "#888" },
            ].map(({ label, val, c: tc }) => (
              <div key={label} style={{
                display: "flex", justifyContent: "space-between",
                padding: ".5em .75em", background: "#252525",
                fontSize: ".75em",
              }}>
                <span style={{ color: "#666" }}>{label}</span>
                <span style={{ fontFamily: "monospace", color: tc, fontWeight: 700 }}>{pct(val)}</span>
              </div>
            ))}

            {data.rmse_reduction_pct !== 0 && (
              <div style={{
                padding: ".5em .75em",
                background: data.rmse_reduction_pct > 0 ? "#0f2e1a" : "#1a0a0a",
                border: `1px solid ${data.rmse_reduction_pct > 0 ? "#14532d" : "#7f1d1d"}`,
                fontSize: ".7em",
                color: data.rmse_reduction_pct > 0 ? "#4ade80" : "#f87171",
                lineHeight: 1.6,
              }}>
                Regime-conditional GARCH{" "}
                {data.rmse_reduction_pct > 0 ? "reduced" : "increased"}{" "}
                5-day vol forecast RMSE by{" "}
                <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
                  {Math.abs(data.rmse_reduction_pct).toFixed(1)}%
                </span>{" "}
                vs unconditional model
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="stats-table-wrap" style={{ marginBottom: ".5em" }}>
        <table className="stats-table">
          <thead>
            <tr>
              <th>Regime</th>
              <th>α (ARCH)</th>
              <th>β (GARCH)</th>
              <th>Persistence</th>
              <th>Long-run vol</th>
              <th>5d forecast</th>
              <th>N obs</th>
            </tr>
          </thead>
          <tbody>
            {REGIME_ORDER.map((regime) => {
              const p = data.regime_params[regime];
              const c = REGIME_COLORS[regime];
              return (
                <tr key={regime}>
                  <td>
                    <span style={{ color: c, textTransform: "capitalize", fontWeight: 700 }}>
                      {regime}
                    </span>
                    {regime === data.current_regime && (
                      <span style={{ color: "#555", marginLeft: ".5em", fontSize: ".8em" }}>←</span>
                    )}
                  </td>
                  {p?.fitted ? (
                    <>
                      <td><span className="val">{fmt(p.alpha, 4)}</span></td>
                      <td><span className="val">{fmt(p.beta,  4)}</span></td>
                      <td>
                        <span className={`val ${p.persistence! > 0.95 ? "yellow" : "muted"}`}>
                          {fmt(p.persistence, 4)}
                        </span>
                      </td>
                      <td><span className="val muted">{pct(p.long_run_vol)}</span></td>
                      <td><span className="val" style={{ color: c }}>{pct(p.vol_5d_forecast)}</span></td>
                      <td><span className="val muted">{p.n_obs}</span></td>
                    </>
                  ) : (
                    <td colSpan={6} style={{ color: "#444", fontStyle: "italic", textAlign: "right", fontSize: ".7em" }}>
                      {p?.reason ?? "not fitted"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data.vol_ratio_crash_bearish != null && (
        <div className="paper-context">
          <p>
            <span style={{ color: "#93c5fd", fontWeight: 700 }}>Key finding · </span>
            Crash regime vol is{" "}
            <span style={{ color: "#a855f7", fontFamily: "monospace", fontWeight: 700 }}>
              {data.vol_ratio_crash_bearish}×
            </span>{" "}
            higher than bearish
            {data.vol_ratio_crash_bullish != null && (
              <> and{" "}
                <span style={{ color: "#a855f7", fontFamily: "monospace", fontWeight: 700 }}>
                  {data.vol_ratio_crash_bullish}×
                </span>{" "}
                higher than bullish
              </>
            )}.
            Regime-conditional GARCH reduced 5-day vol forecast RMSE by{" "}
            <span style={{
              fontFamily: "monospace", fontWeight: 700,
              color: data.rmse_reduction_pct > 0 ? "#4ade80" : "#f87171",
            }}>
              {data.rmse_reduction_pct.toFixed(1)}%
            </span>{" "}
            vs unconditional model — confirming regimes contain forward-looking volatility information
            not captured by full-series GARCH.
          </p>
        </div>
      )}

    </div>
  );
}