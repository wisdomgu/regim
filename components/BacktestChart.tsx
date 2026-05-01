"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";

import { useState } from "react";

interface DailyPoint {
  date: string;
  twap: number;
  regime_aware: number;
  regime: number;
  confidence: number; 
}

interface Summary {
  twap_avg_cost: number;
  regime_avg_cost: number;
  saving_pct: number;
  saving_ci_95: [number, number];
  n_days: number;
  method: string;
  t_test_p_value: number;
  significant: boolean;
}

interface RegimeAccuracy {
  overall_hit_rate: number;
  bullish_hit_rate: number;
  bearish_hit_rate: number;
  bullish_n: number;
  bearish_n: number;
  total_predictions: number;
  vs_random_p_value: number;
  better_than_random: boolean;
}

interface Stability {
  n_transition_days: number;
  pct_transition_days: number;
  low_confidence_threshold: number;
  high_conf_saving_pct: number;
  saving_lift_bps: number;
  avg_confidence_by_regime: {
    bearish: number;
    transitional: number;
    bullish: number;
    crash: number;
  };
}

interface Props {
  daily: DailyPoint[] | undefined;
  summary: Summary | undefined;
  regime_accuracy?: RegimeAccuracy;
  ma_baseline?: MaBaseline;
  stability?: Stability
}

interface MaBaseline {
  saving_pct: number;
  hit_rate: number;
  avg_cost: number;
}

function getRegimeBands(daily: DailyPoint[]) {
  const bands: { start: number; end: number; regime: number }[] = [];
  if (!daily || !daily.length) return bands;

  let start = 0;
  let cur = daily[0].regime;

  for (let i = 1; i < daily.length; i++) {
    if (daily[i].regime !== cur) {
      bands.push({ start, end: i - 1, regime: cur });
      start = i;
      cur = daily[i].regime;
    }
  }

  bands.push({ start, end: daily.length - 1, regime: cur });
  return bands;
}

function computeSharpe(daily: DailyPoint[], useRegime: boolean): number {
  if (daily.length < 2) return 0;
  const returns = daily.slice(1).map((d, i) => {
    const price = useRegime ? d.regime_aware : d.twap;
    const prev  = useRegime ? daily[i].regime_aware : daily[i].twap;
    return (price - prev) / prev;
  });
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.length > 1
  ? returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1)
  : 0;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (mean / std) * Math.sqrt(252);
}

function computeRegimeSharpe(daily: DailyPoint[], regime: number): { twap: number; regime_aware: number } {
  const subset = daily.filter(d => d.regime === regime);
  return {
    twap:         computeSharpe(subset, false),
    regime_aware: computeSharpe(subset, true),
  };
}

export default function BacktestChart({ daily, summary, regime_accuracy, ma_baseline, stability }: Props) {
  const [threshold, setThreshold] = useState(0);

  if (!summary || !daily) {
    return (
      <div className="loading flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
        <div
          className="w-6 h-6 rounded-full border-2 border-slate-600 border-t-slate-300 animate-spin"
        />
        <p className="text-xs">Loading Backtest ...</p>
      </div>
    )
  }
  const filtered = threshold === 0 ? daily : daily.map(d =>
    (d.confidence ?? 1) >= threshold / 100
      ? d
      : { ...d, regime_aware: d.twap }
  );

  const twapAvg = filtered.reduce((s, d) => s + d.twap, 0) / filtered.length;
  const regimeAvg = filtered.reduce((s, d) => s + d.regime_aware, 0) / filtered.length;
  const filteredSaving = twapAvg !== 0
  ? ((twapAvg - regimeAvg) / twapAvg * 100)
  : 0;
  const activeDays = threshold === 0 ? filtered.length : filtered.filter(d => (d.confidence ?? 1) >= threshold / 100).length;

  const sharpeTwap    = computeSharpe(filtered, false);
  const sharpeRegime  = computeSharpe(filtered, true);
  const sharpeCrash   = computeRegimeSharpe(filtered, 0);
  const sharpeBearish = computeRegimeSharpe(filtered, 1);
  const sharpeTransit = computeRegimeSharpe(filtered, 2);
  const sharpeBullish = computeRegimeSharpe(filtered, 3);

  const saved = filteredSaving > 0;

  const thresholdPct = threshold ?? 0;

  const base = threshold === 0 ? daily : filtered;

  const enhanced = base.map((d,i) => {
    const useSignal = threshold === 0
      ? true
      : (d.confidence ?? 1) >= threshold / 100;

    return {
      ...d,
    idx: i,
      useSignal,
      exec_price: useSignal ? d.regime_aware : d.twap,
    };
  });

  const bands = getRegimeBands(enhanced);
  let cum = 0;

  const withPnL = enhanced.map((d, i) => {
    if (i === 0) return { ...d, cum_savings: 0 };

    const saving = d.twap - d.exec_price;
    cum += saving;

    return { ...d, cum_savings: cum };
  });
  return (
    <div>
      <div className="bt-filter" style={{margin: "1em 0em"}}>
        <div className="bt-filter-head">
          <div >
            <p className="text-xs text-gray-400 uppercase tracking-wider">Confidence threshold filter</p>
            <p className="text-xs text-gray-600 mt-0.5">
              Only act on regime signals with confidence ≥ threshold. Below threshold → fall back to TWAP.
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-400">
              {threshold === 0 ? "Off" : `${threshold}%`}
            </p>
            <p className="text-xs text-gray-500">
              {threshold === 0 ? "all signals used" : `${activeDays} / ${daily.length} days active`}
            </p>
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={90}
          step={5}
          value={threshold}
          onChange={e => setThreshold(Number(e.target.value))}
          className="w-full"
          style={{ "--val": (threshold / 90 * 100).toFixed(1) } as React.CSSProperties}
        />
        <div className="flex justify-between text-xs mt-1">
          <span>Off</span>
          <span>50%</span>
          <span>70%</span>
          <span>90%</span>
        </div>

        {threshold > 0 && (
          <div className="bt-filter-grid">
            <div className="bg-gray-800 p-3">
              <p className="text-xs text-gray-500 mb-1">Baseline saving (no filter)</p>
              <p className={`text-sm font-bold ${summary.saving_pct > 0 ? "text-green-400" : "text-red-400"}`}>
                {summary.saving_pct > 0 ? "-" : "+"}{Math.abs(summary.saving_pct).toFixed(3)}%
              </p>
            </div>
            <div className="bg-gray-800 p-3">
              <p className="text-xs mb-1">Filtered saving (≥{threshold}%)</p>
              <p className={`text-sm font-bold ${filteredSaving > 0 ? "text-green-400" : "text-red-400"}`}>
                {filteredSaving > 0 ? "-" : "+"}{Math.abs(filteredSaving).toFixed(3)}%
              </p>
            </div>
            <div className="bg-gray-800 p-3">
              <p className="text-xs mb-1">Active signals</p>
              <p className="text-sm font-bold text-white">
                {activeDays} / {daily.length} days
                <span className=" font-normal text-xs ml-1">
                  ({Math.round(activeDays / daily.length * 100)}%)
                </span>
              </p>
            </div>
          </div>
        )}
      </div>

      {stability && (
        <div className={stability.pct_transition_days >= 80
          ? "paper-disclaimer"
          : summary.significant
          ? "paper-context"
          : "paper-disclaimer"
        } style={{margin:"1em 0"}}>
          <p className="text-xs" style={{ color: stability.pct_transition_days >= 80 ? "#ca8a04" : "#93c5fd" }}>
            <span className="font-semibold" style={{ color: stability.pct_transition_days >= 80 ? "#eab308" : "#60a5fa" }}>
              {stability.pct_transition_days >= 80
                ? "High uncertainty period · "
                : summary.significant
                ? "Statistically significant edge · "
                : "No significant edge detected · "}
            </span>
            {stability.pct_transition_days >= 80 ? (
              <>
                {stability.pct_transition_days.toFixed(0)}% of trading days fall in low-confidence transition zones
                (HMM confidence &lt; {(stability.low_confidence_threshold * 100).toFixed(0)}%).
                The model correctly identifies regime <span className="italic">uncertainty</span> rather than forcing a label —
                this is the expected behavior during low-volatility, directionless markets.
                Try a longer period (1y) or a trending asset (BTC, QQQ) to see the edge in high-confidence regimes.
              </>
            ) : summary.significant ? (
              <>
                Regime-aware execution shows a statistically significant cost improvement over TWAP
                (p = {summary.t_test_p_value}, Bonferroni corrected across {3} simultaneous tests).
                High-confidence signals lift saving by {stability.saving_lift_bps} bps vs unfiltered.
              </>
            ) : (
              <>
                No statistically significant edge over TWAP for this ticker/period combination
                (p = {summary.t_test_p_value}). This is a valid finding — regime signals require
                sufficient regime variation to generate alpha. The{" "}
                <span className="font-semibold">
                  {stability.high_conf_saving_pct > summary.saving_pct ? "high-confidence filter improves" : "transition zone dominates"}
                </span>{" "}
                the result. See finding #3 on the research page.
              </>
            )}
          </p>
        </div>
      )}

      <div className="bt-summary">
        <div className="bt-summary-card p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">TWAP avg cost</p>
          <p className="text-xl font-bold text-white">${twapAvg.toFixed(2)}</p>
        </div>
        <div className="bt-summary-card p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Regime-aware avg cost</p>
          <p className="text-xl font-bold text-white">${regimeAvg.toFixed(2)}</p>
        </div>
        <div className={`p-4 space-y-1 ${saved ? "bg-green-950 border border-green-800" : "bg-red-950 border border-red-800"}`}>
          <p className="text-xs text-gray-400 uppercase tracking-wider">Saving vs TWAP</p>
          <p className={`text-2xl font-bold ${saved ? "text-green-400" : "text-red-400"}`}>
            {saved ? "-" : "+"}{Math.abs(filteredSaving).toFixed(3)}%
          </p>
          <p className="text-xs text-gray-400">
            p = {summary.t_test_p_value} {summary.significant ? "• significant" : "• not significant"}
          </p>
          {summary.saving_ci_95 && (
            <p className="text-xs text-gray-500">
              95% CI: {summary.saving_ci_95[0].toFixed(3)}% → {summary.saving_ci_95[1].toFixed(3)}%
            </p>
          )}
          <p className="text-xs text-gray-500">{summary.n_days} trading days</p>
          <p className="text-xs text-gray-600">{summary.method}</p>
        </div>
      </div>

      {regime_accuracy && (
        <div className="bt-section">
          <div className="bt-section-head">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Regime accuracy — next-day direction</p>
              <p className="text-xs text-gray-600 mt-0.5">Does the walk-forward regime label predict whether tomorrow is up or down?</p>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold ${regime_accuracy.overall_hit_rate > 50 ? "text-green-400" : "text-yellow-400"}`}>
                {regime_accuracy.overall_hit_rate}%
              </p>
              <p className="text-xs text-gray-500">overall hit rate</p>
              <p className="text-xs text-gray-600">{regime_accuracy.total_predictions} predictions</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bt-card bg-green-950/40 border border-green-900/50 p-3">
              <p className="text-xs text-green-500 mb-1">Bullish → next day up</p>
              <p className="text-lg font-bold text-green-400">{regime_accuracy.bullish_hit_rate}%</p>
              <p className="text-xs text-gray-600">{regime_accuracy.bullish_n} bullish signals</p>
            </div>
            <div className="bt-card bg-red-950/40 border border-red-900/50 p-3">
              <p className="text-xs text-red-500 mb-1">Bearish → next day down</p>
              <p className="text-lg font-bold text-red-400">{regime_accuracy.bearish_hit_rate}%</p>
              <p className="text-xs text-gray-600">{regime_accuracy.bearish_n} bearish signals</p>
            </div>
          </div>
        </div>
      )}

      {ma_baseline && regime_accuracy && (
        <div className="bt-section">
          <div className="bt-section-head">
            <p className="text-xs text-gray-500 uppercase tracking-wider">HMM vs naive baseline — 50/200 MA crossover</p>
            <p className="text-xs text-gray-600 mt-0.5">
              Does the 3-state HMM regime detector outperform a simple moving average crossover?
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bt-compare-card">
              <p className="text-xs text-gray-500 mb-3">Direction hit rate</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">MA crossover</span>
                  <span className="font-mono text-sm text-gray-300">{ma_baseline.hit_rate}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">HMM (ours)</span>
                  <span className={`font-mono text-sm font-bold ${
                    regime_accuracy.overall_hit_rate > ma_baseline.hit_rate ? "text-green-400" : "text-red-400"
                  }`}>
                    {regime_accuracy.overall_hit_rate}%
                  </span>
                </div>
                <div className="border-t border-gray-700 pt-2 flex justify-between items-center">
                  <span className="text-xs text-gray-500">Edge</span>
                  <span className={`font-mono text-xs font-bold ${
                    regime_accuracy.overall_hit_rate - ma_baseline.hit_rate > 0 ? "text-green-400" : "text-red-400"
                  }`}>
                    {regime_accuracy.overall_hit_rate - ma_baseline.hit_rate > 0 ? "+" : ""}
                    {(regime_accuracy.overall_hit_rate - ma_baseline.hit_rate).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="bt-compare-card">
              <p className="text-xs text-gray-500 mb-3">Cost saving vs TWAP</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">MA crossover</span>
                  <span className={`font-mono text-sm ${ma_baseline.saving_pct > 0 ? "text-gray-300" : "text-red-400"}`}>
                    {ma_baseline.saving_pct > 0 ? "-" : "+"}{Math.abs(ma_baseline.saving_pct).toFixed(3)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">HMM (ours)</span>
                  <span className={`font-mono text-sm font-bold ${
                    summary.saving_pct > ma_baseline.saving_pct ? "text-green-400" : "text-red-400"
                  }`}>
                    {summary.saving_pct > 0 ? "-" : "+"}{Math.abs(summary.saving_pct).toFixed(3)}%
                  </span>
                </div>
                <div className="border-t border-gray-700 pt-2 flex justify-between items-center">
                  <span className="text-xs text-gray-500">Edge</span>
                  <span className={`font-mono text-xs font-bold ${
                    summary.saving_pct - ma_baseline.saving_pct > 0 ? "text-green-400" : "text-red-400"
                  }`}>
                    {summary.saving_pct - ma_baseline.saving_pct > 0 ? "+" : ""}
                    {(summary.saving_pct - ma_baseline.saving_pct).toFixed(3)}%
                  </span>
                </div>
              </div>
            </div>

            <div className={`bt-card p-3 flex flex-col justify-between ${
              regime_accuracy.overall_hit_rate > ma_baseline.hit_rate && summary.saving_pct > ma_baseline.saving_pct
                ? "bg-green-950/40 border border-green-900/50"
                : regime_accuracy.overall_hit_rate < ma_baseline.hit_rate && summary.saving_pct < ma_baseline.saving_pct
                ? "bg-red-950/40 border border-red-900/50"
                : "bg-yellow-950/40 border border-yellow-900/50"
            }`}>
              <p className="text-xs text-gray-500 mb-2">Verdict</p>
              {regime_accuracy.overall_hit_rate > ma_baseline.hit_rate && summary.saving_pct > ma_baseline.saving_pct ? (
                <>
                  <p className="text-green-400 font-bold text-sm">HMM wins on both metrics</p>
                  <p className="text-xs text-gray-500 mt-1">
                    3-state HMM outperforms naive MA crossover — supports paper's regime-awareness thesis
                  </p>
                </>
              ) : regime_accuracy.overall_hit_rate < ma_baseline.hit_rate && summary.saving_pct < ma_baseline.saving_pct ? (
                <>
                  <p className="text-red-400 font-bold text-sm">MA crossover wins</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Simple baseline outperforms — consider longer period or different asset
                  </p>
                </>
              ) : (
                <>
                  <p className="text-yellow-400 font-bold text-sm">Mixed result</p>
                  <p className="text-xs text-gray-500 mt-1">
                    HMM leads on one metric — regime signal adds partial value
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {stability && (
        <div className="bt-section">
          <div className="bt-section-head">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Regime stability & transition zones</p>
              <p className="text-xs text-gray-600 mt-0.5">
                Days where HMM confidence &lt; {(stability.low_confidence_threshold * 100).toFixed(0)}% — 
                model is uncertain, execution signal unreliable.
              </p>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold ${stability.pct_transition_days > 30 ? "text-yellow-400" : "text-green-400"}`}>
                {stability.pct_transition_days}%
              </p>
              <p className="text-xs text-gray-500">of days in transition zone</p>
              <p className="text-xs text-gray-600">{stability.n_transition_days} days</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-3">
            <div className="bt-card bg-yellow-950/30 border border-yellow-900/40 p-3">
              <p className="text-xs text-yellow-500 mb-2">High-confidence saving</p>
              <p className={`text-lg font-bold ${stability.high_conf_saving_pct > 0 ? "text-green-400" : "text-red-400"}`}>
                {stability.high_conf_saving_pct > 0 ? "-" : "+"}{Math.abs(stability.high_conf_saving_pct).toFixed(3)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {stability.saving_lift_bps > 0 ? "+" : ""}{stability.saving_lift_bps} bps vs unfiltered
              </p>
            </div>

            <div className="bt-card bg-gray-800/40 border border-gray-700/40 p-3 col-span-2">
              <p className="text-xs text-gray-500 mb-2">Avg confidence by regime</p>
              <div className="space-y-2">
                {([
                  ["Bullish",      stability.avg_confidence_by_regime.bullish,      "green"],
                  ["Transitional", stability.avg_confidence_by_regime.transitional,  "yellow"],
                  ["Bearish",      stability.avg_confidence_by_regime.bearish,       "red"],
                  ["Crash",        stability.avg_confidence_by_regime.crash,         "purple"],
                ] as [string, number, string][]).map(([label, conf, color]) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-24">{label}</span>
                    <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${color === "green" ? "bg-green-500" : color === "red" ? "bg-red-500" : color === "yellow" ? "bg-yellow-500" : "bg-purple-500"}`}
                        style={{ width: `${(conf * 100).toFixed(0)}%` }}
                      />
                    </div>
                    <span className={`text-xs font-mono font-bold w-10 text-right ${
                      conf >= 0.7 ? "text-green-400" : conf >= 0.5 ? "text-yellow-400" : "text-red-400"
                    }`}>
                      {(conf * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bt-section">
        <div className="bt-section-head flex items-center justify-between mb-4">
          <div >
            <p className="text-xs text-gray-500 uppercase tracking-wider">Annualised Sharpe ratio</p>
            <p className="text-xs text-gray-600 mt-0.5">Risk-adjusted return — regime-aware vs TWAP. Higher = better.</p>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-xs text-gray-500 mb-1">TWAP</p>
              <p className={`text-xl font-bold ${sharpeTwap > 0 ? "text-gray-300" : "text-red-400"}`}>
                {sharpeTwap.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Regime-aware</p>
              <p className={`text-xl font-bold ${sharpeRegime > sharpeTwap ? "text-green-400" : "text-red-400"}`}>
                {sharpeRegime.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Improvement</p>
              <p className={`text-xl font-bold ${sharpeRegime - sharpeTwap > 0 ? "text-green-400" : "text-red-400"}`}>
                {sharpeRegime - sharpeTwap > 0 ? "+" : ""}{(sharpeRegime - sharpeTwap).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Crash/spike",  data: sharpeCrash,   color: "purple" },
            { label: "Bearish",      data: sharpeBearish, color: "red"    },
            { label: "Transitional", data: sharpeTransit, color: "yellow" },
            { label: "Bullish",      data: sharpeBullish, color: "green"  },
          ].map(({ label, data, color }) => (
            <div key={label} className={`bt-card p-3 ${
              color === "green"  ? "bg-green-950/30 border border-green-900/40"  :
              color === "red"    ? "bg-red-950/30 border border-red-900/40"      :
              color === "purple" ? "bg-purple-950/30 border border-purple-900/40":
                                  "bg-yellow-950/30 border border-yellow-900/40"
            }`}>
              <p className={`text-xs mb-2 font-medium ${
                color === "green"  ? "text-green-500"  :
                color === "red"    ? "text-red-500"    :
                color === "purple" ? "text-purple-500" : "text-yellow-500"
              }`}>{label}</p>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>TWAP</span>
                <span className="font-mono text-gray-300">{data.twap.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>Regime-aware</span>
                <span className={`font-mono font-bold ${data.regime_aware > data.twap ? "text-green-400" : "text-red-400"}`}>
                  {data.regime_aware.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>

      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={enhanced} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
          <XAxis
            dataKey="idx"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(i) => enhanced[i]?.date ?? ""}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fill: "#6b7280", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            contentStyle={{ 
              backgroundColor: "#1a1a1a", 
              border: "1px solid #fff",
              color: "white"
            }}
            labelStyle={{ color: "#9ca3af" }}
            formatter={(value: any, name: any, props: any) => {
              const conf = props?.payload?.confidence;
              const filtered = threshold > 0 && conf !== undefined && conf < threshold / 100;
              return [`$${value.toFixed(2)}${filtered ? " (TWAP fallback)" : ""}`, name];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#9ca3af", paddingTop: 12 }} />
          {bands.map((band, i) => (
            <ReferenceArea
              key={i}
              x1={band.start}
              x2={band.end}
              fill={
                      band.regime === 3 ? "#14532d" :
                      band.regime === 2 ? "#713f12" :
                      band.regime === 1 ? "#450a0a" :
                      "#3b0764"
                    }
              fillOpacity={0.25}
            />
          ))}
          <Line type="linear" dataKey="twap" stroke="#6b7280" strokeWidth={1.5} dot={false} name="TWAP" strokeDasharray="4 2" />
          <Line type="linear" dataKey="exec_price" stroke="#34d399" strokeWidth={1.5} dot={false} name="Regime-aware (filtered)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}