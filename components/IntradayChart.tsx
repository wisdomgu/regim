"use client";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";

interface Fill {
  date: string;
  regime: number;
  is_regime_pct: number;
  is_vwap_pct: number;
  improvement_pct: number;
  total_cost_bps: number;
  spread_cost_bps: number;
  temporary_impact_bps: number;
  permanent_impact_bps: number;
  timing_cost_bps: number;
}

interface Summary {
  mean_improvement_pct: number;
  mean_is_regime_pct: number;
  mean_is_vwap_pct: number;
  ci_95: [number, number];
  n_fills: number;
  n_slices: number;
  ci_excludes_zero: boolean;
}

interface RegimeBreakdown {
  crash?: { n_fills: number; mean_improvement: number; mean_is_regime: number };
  bearish: { n_fills: number; mean_improvement: number; mean_is_regime: number };
  transitional?: { n_fills: number; mean_improvement: number; mean_is_regime: number };
  bullish: { n_fills: number; mean_improvement: number; mean_is_regime: number };
}

interface Props {
  fills: Fill[] | undefined;
  summary: Summary | undefined;
  regime_breakdown: RegimeBreakdown | undefined;
}

function computeAvgCosts(fills: Fill[]) {
  if (!fills || fills.length === 0) return null;

  const sum = fills.reduce(
    (acc, f) => ({
      total: acc.total + f.total_cost_bps,
      spread: acc.spread + f.spread_cost_bps,
      temp: acc.temp + f.temporary_impact_bps,
      perm: acc.perm + f.permanent_impact_bps,
      timing: acc.timing + f.timing_cost_bps,
    }),
    { total: 0, spread: 0, temp: 0, perm: 0, timing: 0 }
  );

  const n = fills.length;

  return {
    total_cost_bps: sum.total / n,
    spread_cost_bps: sum.spread / n,
    temporary_impact_bps: sum.temp / n,
    permanent_impact_bps: sum.perm / n,
    timing_cost_bps: sum.timing / n,
  };
}


export default function IntradayChart({ fills, summary, regime_breakdown}: Props) {
  if (!summary || !fills) {
    return (
    <div className="loading flex flex-col items-center justify-center gap-3 py-10 text-slate-500">
      <div className="w-6 h-6 rounded-full border-2 border-slate-600 border-t-slate-300 animate-spin" />
      <p className="text-xs">Computing Intraday Simulation...</p>
    </div>
    );
  }

  const significant = summary.ci_excludes_zero;

  const chartData = fills.filter((_, i) => i % 2 === 0).map((f) => ({
    date: f.date,
    "Regime-aware IS": parseFloat(f.is_regime_pct.toFixed(3)),
    "VWAP IS": parseFloat(f.is_vwap_pct.toFixed(3)),
    "Improvement": parseFloat(f.improvement_pct.toFixed(3)),
    regime: f.regime,
  }));

  const colorMap = {
  crash: "bg-purple-950/40 border border-purple-900 text-purple-400",
  bearish: "bg-red-950/40 border border-red-900 text-red-400",
  transitional: "bg-yellow-900/30 border border-yellow-700 text-yellow-300",
  bullish: "bg-green-950/40 border border-green-900 text-green-400",
};
const regimeOrder = ["crash", "bearish", "transitional", "bullish"] as const;

  return (
    <div>
        <div className="intraday-summary" style={{margin: "1em 0em"}}>
        <div className="intraday-card">
          <p className="card-label">Avg IS - Regime-aware</p>
          <p className="card-val">
            {summary.mean_is_regime_pct > 0 ? "+" : ""}
            {summary.mean_is_regime_pct.toFixed(3)}%
          </p>
        </div>
        <div className="intraday-card">
          <p className="card-label">Avg IS - VWAP</p>
          <p className="card-val">
            {summary.mean_is_vwap_pct > 0 ? "+" : ""}
            {summary.mean_is_vwap_pct.toFixed(3)}%
          </p>
        </div>
        <div className={`intraday-card ${significant ? "significant" : "uncertain"}`}>
          <p className="card-label">Mean improvement</p>
          <p className="card-val">
            {summary.mean_improvement_pct > 0 ? "+" : ""}
            {summary.mean_improvement_pct.toFixed(3)}%
          </p>
          <p className="card-sub">
            95% CI: [{summary.ci_95[0].toFixed(3)}, {summary.ci_95[1].toFixed(3)}]
          </p>
          {!significant && (
            <>
              <p className={`text-xs mt-1 text-yellow-600`}>
                CI crosses zero — not yet significant
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Try BTC-USD · 1y for a stronger signal
              </p>
            </>
          )}
          {significant && (
            <p className="card-note">
              ✓ CI excludes zero — statistically significant
            </p>
          )}
        </div>
        <div className="intraday-card">
          <p className="card-label">Fills / slices</p>
          <p className="text-xl font-bold text-white">{summary.n_fills}</p>
          <p className="text-xs text-gray-500 mt-1">{summary.n_slices} hourly slices/day</p>
        </div>
      </div>

      {regime_breakdown && (
        <div className="intraday-breakdown">
          {regimeOrder.map((label) => {
            const r = regime_breakdown[label as keyof RegimeBreakdown];
            if (!r || r.n_fills < 5) return null;
            return (
              <div
                key={label}
                className={`intraday-breakdown-card p-4 ${colorMap[label]}`}
              >
                <p className={`text-sm font-semibold mb-2 ${label === "bullish" ? "text-green-400" : "text-red-400"}`}>
                  {label.charAt(0).toUpperCase() + label.slice(1)} regime
                </p>
                <p className="brow">Fills: <span className="text-white">{r.n_fills}</span></p>
                <p className="brow">
                  Avg IS: <span className="text-white">{r.mean_is_regime > 0 ? "+" : ""}{r.mean_is_regime.toFixed(3)}%</span>
                </p>
                <p className="brow">
                  Improvement vs VWAP: <span className={r.mean_improvement > 0 ? "text-green-400" : "text-red-400"}>
                    {r.mean_improvement > 0 ? "+" : ""}{r.mean_improvement.toFixed(3)}%
                  </span>
                </p>
              </div>
            );
          })}
        </div>
      )}

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tick={{ fill: "#6b7280", fontSize: 11 }}
            tickLine={false}
            interval={Math.floor(chartData.length / 6)}
          />
          <YAxis
            tick={{ fill: "#6b7280", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{ 
              backgroundColor: "#1a1a1a", 
              border: "1px solid #fff",
              color: "white"
            }}
            labelStyle={{ color: "#9ca3af" }}
            formatter={(v: any) => `${v.toFixed(3)}%`}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#9ca3af", paddingTop: 12 }} />
          <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3" />
          <Bar dataKey="Improvement" fill="#34d399" opacity={0.4} name="Improvement vs VWAP" />
          <Line type="linear" dataKey="Regime-aware IS" stroke="#34d399" strokeWidth={1.5} dot={false} />
          <Line type="linear" dataKey="VWAP IS" stroke="#6b7280" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
        </ComposedChart>
      </ResponsiveContainer>

      <p className="intraday-footnote">
        Implementation shortfall = (executed price − arrival price) / arrival price.
        Negative IS = bought below arrival price (good). Regime-aware weights:
        front-load in bullish, back-load in bearish.
      </p>
    </div>
  );
}
