"use client";

import { trackEvent } from "@/lib/trackEvent";
import React, { useEffect, useState } from "react";

interface ShapData {
  shap_values: number[][][];
  base_values: number[];    
  features_today: number[][]; 
  feature_names: string[];
  predicted_state: number;
  state_probs: number[];
  state_labels: string[];
  dates: string[];
  ticker: string;
  current_regime_label: string;
}

interface ShapPanelProps {
  ticker: string;
  period?: string;
}

const REGIME_COLORS: Record<string, string> = {
  crash:        "#a855f7",
  bearish:      "#ef4444",
  transitional: "#f59e0b",
  bullish:      "#22c55e",
};

const FEATURE_LABELS: Record<string, string> = {
  returns:     "Daily Returns",
  volatility:  "Volatility (10d)",
  momentum:    "Momentum (5d)",
  trend:       "Trend vs MA20",
  drawdown:    "Drawdown",
  volume_lead: "Volume Signal",
};

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  returns:     "1-day price change. Negative in crash/bearish, positive in bullish.",
  volatility:  "10-day rolling std. Very high in crash, moderate in transitional.",
  momentum:    "5-day price change. Forward-looking drift indicator.",
  trend:       "Price relative to 20-day MA. Regime direction baseline.",
  drawdown:    "Distance from recent high. Distinguishes grinding bear vs crash.",
  volume_lead: "Lagged volume Z-score. Volume spikes precede regime shifts.",
};

function fmt(n: number | undefined, decimals = 4): string {
  if (n === undefined || n === null || isNaN(n)) return "—";
  return n >= 0 ? `+${n.toFixed(decimals)}` : n.toFixed(decimals);
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function barColor(val: number, stateIdx: number, predicted: number): string {
  if (stateIdx !== predicted) return val >= 0 ? "#374151" : "#1f2937";
  const label = ["crash", "bearish", "transitional", "bullish"][stateIdx];
  return val >= 0
    ? REGIME_COLORS[label] ?? "#22c55e"
    : "#64748b";
}

function RegimeProbBar({ label, prob, isActive }: { label: string; prob: number; isActive: boolean }) {
  const color = REGIME_COLORS[label] ?? "#64748b";
  return (
    <div style={{ marginBottom: 10, padding: "0.5em 1em"}}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span className="text-xs text-grey-400 capitalize">{label}</span>
        <span
          className="text-xs font-mono font-bold"
          style={{ color }}
        >
          {(prob * 100).toFixed(1)}%
        </span>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.07)" }}>
        <div
          style={{
            width: `${prob * 100}%`,
            height: "100%",
            background: color,
            transition: "width 0.4s",
          }}
        />
      </div>
    </div>
  );
}

function ShapBar({
  value,
  maxAbs,
  stateIdx,
  predicted,
}: {
  value: number;
  maxAbs: number;
  stateIdx: number;
  predicted: number;
}) {
  const width = maxAbs > 0 ? Math.abs(value) / maxAbs : 0;
  const isPos = value >= 0;
  const isTarget = stateIdx === predicted;
  const color = barColor(value, stateIdx, predicted);

  return (
    <div className="flex items-center h-3">
      <div className="w-1/2 flex justify-end">
        {!isPos && (
          <div
            className="h-2 rounded-l transition-all duration-500 opacity-80"
            style={{ width: `${width * 100}%`, background: isTarget ? "#64748b" : "#1f2937" }}
          />
        )}
      </div>
      <div className="w-px h-3 bg-slate-600 mx-0.5 flex-shrink-0" />
      <div className="w-1/2 flex justify-start">
        {isPos && (
          <div
            className="h-2 rounded-r transition-all duration-500"
            style={{ width: `${width * 100}%`, background: color }}
          />
        )}
      </div>
    </div>
  );
}

function FeatureRow({
  featureName,
  rawValue,
  shapValues,
  predicted,
  stateLabels,
  maxAbs,
  isExpanded,
  onToggle,
}: {
  featureName: string;
  rawValue: number;
  shapValues: number[];
  predicted: number;
  stateLabels: string[];
  maxAbs: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const targetShap = shapValues[predicted];
  const label = FEATURE_LABELS[featureName] ?? featureName;
  const description = FEATURE_DESCRIPTIONS[featureName] ?? "";
  const regimeColor = REGIME_COLORS[stateLabels[predicted]] ?? "#22c55e";

  return (
    <div
      className="overflow-hidden transition-all duration-200"
      style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)"}}
    >
      <button
        onClick={onToggle}
        className="w-full px-3 py-2.5 flex items-center gap-3 text-left group"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-300 truncate">{label}</span>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              {rawValue !== undefined ? rawValue.toFixed(4) : "—"}
            </span>
          </div>
        </div>

        <div
          className="text-xs font-mono tabular-nums px-1.5 py-0.5 rounded flex-shrink-0"
          style={{
            background: targetShap >= 0
              ? `${regimeColor}22`
              : "rgba(100,116,139,0.2)",
            color: targetShap >= 0 ? regimeColor : "#64748b",
          }}
        >
          {fmt(targetShap, 3)}
        </div>

        <span className="text-slate-600 text-xs group-hover:text-slate-400 transition-colors">
          {isExpanded ? "▲" : "▼"}
        </span>
      </button>

      <div className="px-3 pb-2">
        <ShapBar value={targetShap} maxAbs={maxAbs} stateIdx={predicted} predicted={predicted} />
      </div>

      {isExpanded && (
        <div className="border-t border-slate-700/50 px-3 py-2 space-y-2">
          <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
          <div className="space-y-1.5">
            {stateLabels.map((sl, si) => (
              <div key={sl} className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: REGIME_COLORS[sl] ?? "#64748b" }}
                />
                <span className={`text-xs w-20 capitalize ${si === predicted ? "text-white font-semibold" : "text-slate-500"}`}>
                  {sl}
                </span>
                <div className="flex-1">
                  <ShapBar value={shapValues[si]} maxAbs={maxAbs} stateIdx={si} predicted={predicted} />
                </div>
                <span className="text-xs font-mono text-slate-500 w-14 text-right tabular-nums">
                  {fmt(shapValues[si], 3)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ShapPanel({ ticker, period = "1y" }: ShapPanelProps) {
  const [data, setData] = useState<ShapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"impact" | "feature">("impact");

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    setError(null);
    setData(null);

   fetch(`/api/shap?ticker=${ticker}&period=${period}`)
      .then((r) => {
        if (!r.ok) throw new Error(`API error ${r.status}`);
        return r.json();
      })
      .then((d: ShapData) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [ticker, period]);

  if (loading) {
    return (
      <div className="loading flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
        <div
          className="w-6 h-6 rounded-full border-2 border-slate-600 border-t-slate-300 animate-spin"
        />
        <p className="text-xs">Computing SHAP attributions…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-900/40 bg-red-950/20 p-4 text-xs text-red-400">
        <p className="font-semibold mb-1">SHAP computation failed</p>
        <p className="text-red-500/70">{error}</p>
        <p className="mt-2 text-slate-500">
          Make sure <code className="font-mono">shap</code> is installed:{" "}
          <code className="font-mono">pip install shap</code>
        </p>
      </div>
    );
  }

  if (!data) return null;

  const dayIdx = 0;
  const shapDay = data.shap_values.map(f => f[dayIdx]); 
  const featDay = data.features_today[dayIdx];
  const predicted = data.predicted_state;
  const regimeColor = REGIME_COLORS[data.current_regime_label] ?? "#22c55e";

  const maxAbs = Math.max(...shapDay.flat().map(Math.abs), 0.001);

const featureOrder = data.feature_names
  .map((name, i) => {
    const shapVal = shapDay?.[i]?.[predicted];

    return {
      name,
      idx: i,
      absShap: Math.abs(shapVal ?? 0),
    };
  })
  .sort((a, b) =>
    sortBy === "impact"
      ? b.absShap - a.absShap
      : a.name.localeCompare(b.name)
  );

  const topDriver = featureOrder[0];
  const topShapVal = shapDay[topDriver.idx][predicted];
  const topRawVal = featDay[topDriver.idx];

  return (
    <div className="space-y-4" >

    <div className="rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-1 text-gray-200">
        SHAP <span className="font-bold" style={{fontSize: 11}}>{ticker} · {data.dates[0]}</span>
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        All key metrics with p-values and confidence intervals in one place.
      </p>
    </div>

      <div
        className="stats-table-wrap"
        style={{ background: "#151515", margin: "1em 0em", padding:"0.75em" }}
      >
        <p className="text-l font-medium text-slate-400 mb-2">
          Posterior P(regime | features)
        </p>
        {data.state_labels.map((sl, si) => (
          <RegimeProbBar
            key={sl}
            label={sl}
            prob={data.state_probs[si]}
            isActive={si === predicted}
          />
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-700"
        style={{
          padding: "10px 12px",
          fontSize: 12,
          margin: "1em 0em"
        }}
      >
      
        <span className="font-semibold" style={{ color: regimeColor }}>
          {FEATURE_LABELS[topDriver.name]}
        </span>{" "}
        is the dominant driver (SHAP {fmt(topShapVal, 3)}, raw value{" "}
        {topRawVal.toFixed(4)}), pushing the model toward{" "}
        <span className="font-semibold capitalize" style={{ color: regimeColor }}>
          {data.current_regime_label}
        </span>
        . This aligns with the CTMSTOU paper's λ calibration — high{" "}
        {topDriver.name === "volatility" ? "volatility" : "signal magnitude"} is
        a primary regime transition trigger.
      </div>

      <div className="stats-table-wrap" style={{margin:"1em 0em", padding:"0.75em" }}>
        <table className="stats-table">
          <thead>
            <tr className="border-b border-grey-800">
              <th className="text-left py-2 pl-4 text-xs">Feature</th>
              <th className="text-left py-2 text-xs">Value</th>
              <th className="text-left py-2 text-xs">SHAP</th>
              <th className="text-left py-2 text-xs">Impact</th>
            </tr>
          </thead>

          <tbody>
            {featureOrder.map(({ name, idx }) => {
              const shapVal = shapDay?.[idx]?.[0] ?? 0;
              const rawVal = featDay[idx];
              const label = FEATURE_LABELS[name] ?? name;

              return (
                <tr
                  key={name}
                  className="border-b border-grey-800/50 hover:bg-grey-800/20"
                >
                  <td className="py-3 pl-4 text-grey-400 text-sm">
                    {label}
                  </td>

                  <td className="py-3 font-mono text-sm text-grey-300">
                    {rawVal?.toFixed(4) ?? "—"}
                  </td>

                  <td
                    className={`py-3 font-mono text-sm font-bold ${
                      shapVal > 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {fmt(shapVal, 3)}
                  </td>

                  <td className="py-3 pr-4">
                    <div
                      style={{
                        height: 6,
                        background: "rgba(255,255,255,0.07)",
                      }}
                    >
                      <div
                        style={{
                          width: `${(Math.abs(shapVal) / maxAbs) * 100}%`,
                          height: "100%",
                          background:
                            shapVal > 0 ? "#22c55e" : "#ef4444",
                          transition: "width 0.4s",
                        }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-xs pt-1 border-t border-grey-800" style={{color:"#555"}}>
        <span className="font-medium">Base values</span>{" "}
        (expected P across background):{" "}
        {data.state_labels.map((sl, si) => (
          <span key={sl} className="mr-2">
            <span className="capitalize">{sl}</span>{" "}
            <span className="font-mono">{pct(data.base_values[si])}</span>
          </span>
        ))}
      </div>
    </div>
  );
}