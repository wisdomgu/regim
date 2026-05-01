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


interface Props {
  fills: Fill[] | undefined;
  summary: Summary | undefined;
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


export default function TransactionCosts({ fills, summary}: Props) {
  if (!summary || !fills) {
    return (
      <div className="loading flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
        <div
          className="w-6 h-6 rounded-full border-2 border-slate-600 border-t-slate-300 animate-spin"
        />
        <p className="text-xs">Computing Transaction Costs ...</p>
      </div>
    );
  }

  const costs = computeAvgCosts(fills);

  const step = Math.ceil(fills.length / 150);

  const costTimeSeries = fills
    .filter((_, i) => i % step === 0)
    .map(f => ({
      date: f.date,
      Spread: f.spread_cost_bps,
      Temporary: f.temporary_impact_bps,
      Permanent: f.permanent_impact_bps,
      Timing: f.timing_cost_bps,
    }));

  return (
    <div>
      {costs && (
        <div className="cost-breakdown">
          <div className="transaction-cost-stats">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card bg-gray-800 p-4">
              <p className="text-xs text-gray-500 mb-1">Spread</p>
              <p className="text-2xl font-bold text-yellow-400">
                {costs.spread_cost_bps.toFixed(2)}
                <span className="text-sm text-gray-400 ml-1">bps</span>
              </p>
            </div>

            <div className="card bg-gray-800 p-4">
              <p className="text-xs text-gray-500 mb-1">Temporary Impact</p>
              <p className="text-2xl font-bold text-blue-400">
                {costs.temporary_impact_bps.toFixed(2)}
                <span className="text-sm text-gray-400 ml-1">bps</span>
              </p>
            </div>

            <div className="card bg-gray-800 p-4">
              <p className="text-xs text-gray-500 mb-1">Permanent Impact</p>
              <p className="text-2xl font-bold text-purple-400">
                {costs.permanent_impact_bps.toFixed(2)}
                <span className="text-sm text-gray-400 ml-1">bps</span>
              </p>
            </div>

            <div className="card bg-gray-800 p-4">
              <p className="text-xs text-gray-500 mb-1">Timing Cost</p>
              <p className="text-2xl font-bold text-red-400">
                {costs.timing_cost_bps.toFixed(2)}
                <span className="text-sm text-gray-400 ml-1">bps</span>
              </p>
            </div>
          </div>

            <p className="text-xs text-gray-500 mb-1">Total Cost 
              <span className="text-2xl font-bold text-red-400">
                &nbsp;{costs.total_cost_bps.toFixed(2)}&nbsp;
                <span className="text-sm text-gray-400 ml-1">bps</span>
              </span>
            </p>

        </div>

          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={costTimeSeries}>
              <XAxis
                dataKey="date"
                tick={{ fill: "#6b7280", fontSize: 11 }}
                tickLine={false}
                interval="preserveStartEnd"
              />

              <YAxis
                tick={{ fill: "#6b7280", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                label={{ value: "bps", angle: -90, position: "insideLeft" }}
              />

              <Tooltip
                formatter={(v: any) => `${v.toFixed(2)} bps`}
                contentStyle={{
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #fff",
                  color: "white",
                }}
              />

              <Legend />

              <Bar dataKey="Spread" stackId="a" fill="#f59e0b" />
              <Bar dataKey="Temporary" stackId="a" fill="#3b82f6" />
              <Bar dataKey="Permanent" stackId="a" fill="#8b5cf6" />
              <Bar dataKey="Timing" stackId="a" fill="#ef4444" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}