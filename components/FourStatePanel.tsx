"use client";

const REGIME_COLORS: Record<string, string> = {
  crash:        "bg-purple-950/40 border-purple-900/50 text-purple-400",
  bearish:      "bg-red-950/40 border-red-900/50 text-red-400",
  transitional: "bg-yellow-950/40 border-yellow-900/50 text-yellow-400",
  bullish:      "bg-green-950/40 border-green-900/50 text-green-400",
};

const LABELS = ["crash", "bearish", "transitional", "bullish"] as const;

export default function FourStatePanel({ data }: { data: any }) {
  if (!data?.summary || !data?.regime_stats) return null;

  const { summary, regime_stats, transition_matrix } = data;

  return (
    <div className="space-y-4">

      <div className="grid grid-cols-4 gap-3">
        {LABELS.map((label) => {
          const s = regime_stats[label];
          if (!s) return null;
          const colorClass = REGIME_COLORS[label];
          return (
            <div key={label} className={`bt-card rounded p-3 border ${colorClass.split(" ").slice(0,2).join(" ")}`}>
              <p className={`text-xs font-semibold uppercase mb-2 ${colorClass.split(" ")[2]}`}>{label}</p>
              <p className="text-xl font-bold text-white">{s.pct}%</p>
              <p className="text-xs text-gray-500">{s.days} days</p>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Avg return</span>
                  <span className={`font-mono ${s.mean_return >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {s.mean_return > 0 ? "+" : ""}{s.mean_return.toFixed(3)}%
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Volatility</span>
                  <span className="font-mono text-gray-300">{s.volatility.toFixed(3)}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Confidence</span>
                  <span className={`font-mono ${s.avg_confidence >= 0.7 ? "text-green-400" : "text-yellow-400"}`}>
                    {(s.avg_confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {regime_stats.crash && regime_stats.bearish && (
        <div className="bt-card bg-gray-800/30 border border-gray-700/40 rounded p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
            Crash vs bearish — why separation matters
          </p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-600 mb-1">Volatility ratio</p>
              <p className="text-lg font-bold text-purple-400">
                {regime_stats.bearish.volatility > 0
                  ? (regime_stats.crash.volatility / regime_stats.bearish.volatility).toFixed(1)
                  : "—"}×
              </p>
              <p className="text-xs text-gray-500">crash vol vs bearish vol</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Return difference</p>
              <p className={`text-lg font-bold ${
                regime_stats.crash.mean_return < regime_stats.bearish.mean_return ? "text-purple-400" : "text-gray-300"
              }`}>
                {(regime_stats.crash.mean_return - regime_stats.bearish.mean_return).toFixed(3)}%
              </p>
              <p className="text-xs text-gray-500">crash minus bearish daily</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Execution implication</p>
              <p className="text-xs text-purple-300 font-medium mt-1">Crash: halt / min size</p>
              <p className="text-xs text-red-300 font-medium">Bearish: patient limits</p>
            </div>
          </div>
        </div>
      )}

      {transition_matrix && (
        <div className="bt-card bg-gray-800/30 border border-gray-700/40 rounded p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
            Transition matrix — probability of moving between states
          </p>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr>
                  <th className="text-left py-1 pr-3 text-gray-600">From \ To</th>
                  {LABELS.map(l => (
                    <th key={l} className={`py-1 px-2 text-center capitalize ${
                      l === "crash" ? "text-purple-400" :
                      l === "bearish" ? "text-red-400" :
                      l === "transitional" ? "text-yellow-400" : "text-green-400"
                    }`}>{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LABELS.map((rowLabel, i) => (
                  <tr key={rowLabel} className="border-t border-gray-800">
                    <td className={`py-1.5 pr-3 font-medium capitalize ${
                      rowLabel === "crash" ? "text-purple-400" :
                      rowLabel === "bearish" ? "text-red-400" :
                      rowLabel === "transitional" ? "text-yellow-400" : "text-green-400"
                    }`}>{rowLabel}</td>
                    {transition_matrix[i]?.map((val: number, j: number) => (
                      <td key={j} className={`py-1.5 px-2 text-center font-mono ${
                        i === j ? "text-white font-bold" : "text-gray-500"
                      }`}>
                        {(val * 100).toFixed(1)}%
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            Diagonal = probability of staying in same regime. Off-diagonal = transition probability.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bt-card bg-gray-800/30 border border-gray-700/40 rounded p-3">
          <p className="text-xs text-gray-500 mb-1">4-state saving vs TWAP</p>
          <p className={`text-xl font-bold ${summary.saving_pct > 0 ? "text-green-400" : "text-red-400"}`}>
            {summary.saving_pct > 0 ? "-" : "+"}{Math.abs(summary.saving_pct).toFixed(3)}%
          </p>
          <p className="text-xs text-gray-600 mt-1">{summary.n_days} days · {summary.n_states} states</p>
        </div>
        <div className="bt-card bg-purple-950/30 border border-purple-900/40 rounded p-3">
          <p className="text-xs text-gray-500 mb-1">Crash regime exposure</p>
          <p className="text-xl font-bold text-purple-400">{summary.crash_pct}%</p>
          <p className="text-xs text-gray-600 mt-1">{summary.crash_days} days where execution was halted</p>
        </div>
      </div>

    </div>
  );
}