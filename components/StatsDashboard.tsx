"use client";

interface Summary {
  twap_avg_cost: number;
  regime_avg_cost: number;
  saving_pct: number;
  saving_ci_95: [number, number];
  n_days: number;
  method: string;
  t_test_p_value: number;
  significant: boolean;
  permutation_p_value: number;
  permutation_percentile: number;
  permutation_null_mean: number;
  permutation_null_std: number;
  n_permutations: number;
  bonferroni_corrected_p_values: number;
  n_hypothesis_tests: number;
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

interface MaBaseline {
  saving_pct: number;
  hit_rate: number;
  avg_cost: number;
}

interface IntradaySummary {
  mean_improvement_pct: number;
  mean_is_regime_pct: number;
  mean_is_vwap_pct: number;
  ci_95: [number, number];
  n_fills: number;
  n_slices: number;
  ci_excludes_zero: boolean;
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
  ticker: string;
  period: string;
  summary: Summary | undefined;
  regime_accuracy: RegimeAccuracy | undefined;
  ma_baseline: MaBaseline | undefined;
  intraday_summary: IntradaySummary | undefined;
  stability?: Stability;  
}

function Sig({ p, threshold = 0.05 }: { p: number; threshold?: number }) {
  const sig = p < threshold;
  return (
    <span className={`stats-sig ${sig ? "pass" : "fail"}`}>
      {sig ? `p=${p} ✓` : `p=${p} —`}
    </span>
  );
}

function Row({
  metric, value, pValue, note, highlight
}: {
  metric: string;
  value: string;
  pValue?: number;
  note?: string;
  highlight?: "green" | "red" | "yellow" | "none";
}) {
  return (
    <tr className="border-b border-gray-800/50 hover:bg-gray-800/20">
      <td className="py-3 pr-4 text-gray-400 text-sm">{metric}</td>
      <td><span className={`val ${highlight ?? "muted"}`}>{value}</span></td>
      <td className="py-3 pr-4">
        {pValue !== undefined && <Sig p={pValue} />}
      </td>
      <td className="py-3 text-xs text-gray-600">{note}</td>
    </tr>
  );
}

export default function StatsDashboard({
  ticker, period, summary, regime_accuracy, ma_baseline, intraday_summary, stability
}: Props) {
  if (!summary) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        Run a backtest first to see the statistics dashboard.
      </div>
    );
  }

  const hmm_beats_ma_hitrate = regime_accuracy && ma_baseline
    ? regime_accuracy.overall_hit_rate > ma_baseline.hit_rate
    : null;
  const hmm_beats_ma_saving = ma_baseline
    ? summary.saving_pct > ma_baseline.saving_pct
    : null;

  return (
    <div className="space-y-6">

      <div className="stats-header">
        <p className="text-sm text-blue-300">
          Statistical summary for <span className="font-bold">{ticker}</span> over{" "}
          <span className="font-bold">{period}</span> · {summary.method} ·{" "}
          {summary.n_days} trading days
        </p>
        <p className="text-xs text-blue-500 mt-1">
          All metrics derived from out-of-sample walk-forward labels.
          p-values: ✓ = significant at α=0.05, — = not significant.
        </p>
      </div>

      <div>
      <h3 className="stats-section-label">1 · Execution cost improvement</h3>
        <div className="stats-table-wrap">
          <table className="stats-table">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-2 pr-4 text-xs font-medium pl-4">Metric</th>
                <th className="text-left py-2 pr-4 text-xs font-medium">Value</th>
                <th className="text-left py-2 pr-4 text-xs font-medium">Significance</th>
                <th className="text-left py-2 text-xs font-medium">Note</th>
              </tr>
            </thead>
            <tbody className="pl-4">
              <tr className="border-b border-gray-800/50 hover:bg-gray-800/20">
                <td className="py-3 pr-4 text-gray-400 text-sm pl-4">Cost saving vs TWAP</td>
                <td className={`py-3 pr-4 font-mono text-sm font-bold ${summary.saving_pct > 0 ? "text-green-400" : "text-red-400"}`}>
                  {summary.saving_pct > 0 ? "-" : "+"}{Math.abs(summary.saving_pct).toFixed(3)}%
                </td>
                <td className="py-3 pr-4"><Sig p={summary.t_test_p_value} /></td>
                <td className="stats-note">Paired t-test vs TWAP baseline</td>
              </tr>
              <tr className="border-b border-gray-800/50 hover:bg-gray-800/20">
                <td className="py-3 pr-4 text-gray-400 text-sm pl-4">95% CI lower bound</td>
                <td className={`py-3 pr-4 font-mono text-sm font-bold ${summary.saving_ci_95[0] > 0 ? "text-green-400" : "text-gray-400"}`}>
                  {summary.saving_ci_95[0].toFixed(3)}%
                </td>
                <td className="py-3 pr-4">
              <span className={`stats-sig ${summary.saving_ci_95[0] > 0 ? "pass" : "fail"}`}>
                {summary.saving_ci_95[0] > 0 ? "CI excludes zero ✓" : "CI crosses zero —"}
              </span>
                </td>
                <td className="stats-note">Bootstrap 1000 resamples</td>
              </tr>
              <tr className="border-b border-gray-800/50 hover:bg-gray-800/20">
                <td className="py-3 pr-4 text-gray-400 text-sm pl-4">95% CI upper bound</td>
                <td className="py-3 pr-4 font-mono text-sm text-gray-300">
                  {summary.saving_ci_95[1].toFixed(3)}%
                </td>
                <td className="py-3 pr-4" />
                <td className="stats-note">Bootstrap 1000 resamples</td>
              </tr>
              {summary.permutation_p_value !== undefined && (
                <>
                  <tr className="border-b border-gray-800/50 hover:bg-gray-800/20">
                    <td className="py-3 pr-4 text-gray-400 text-sm pl-4">Permutation test p-value</td>
                    <td className={`py-3 pr-4 font-mono text-sm font-bold ${
                      summary.permutation_p_value < 0.05 ? "text-green-400" : "text-yellow-400"
                    }`}>
                      p={summary.permutation_p_value.toFixed(4)}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`stats-sig ${summary.permutation_p_value < 0.05 ? "pass" : "fail"}`}>
                        {summary.permutation_p_value < 0.05 ? "signal is real ✓" : "not significant —"}
                      </span>
                    </td>
                    <td className="stats-note">
                      Empirical null from {summary.n_permutations} shuffled regime labels
                    </td>
                  </tr>
                  <tr className="border-b border-gray-800/50 hover:bg-gray-800/20">
                    <td className="py-3 pr-4 text-gray-400 text-sm pl-4">Saving vs null distribution</td>
                    <td className={`py-3 pr-4 font-mono text-sm font-bold ${
                      summary.permutation_percentile >= 95 ? "text-green-400" : "text-yellow-400"
                    }`}>
                      {summary.permutation_percentile.toFixed(1)}th percentile
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`stats-sig ${summary.permutation_percentile >= 95 ? "pass" : "fail"}`}>
                        {summary.permutation_percentile >= 95 ? "exceeds 95th pct ✓" : "below threshold —"}
                      </span>
                    </td>
                    <td className="stats-note">
                      Null mean {summary.permutation_null_mean.toFixed(3)}% ± {summary.permutation_null_std.toFixed(3)}%
                    </td>
                  </tr>
                </>
              )}
              {intraday_summary && (
                <tr className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="py-3 pr-4 text-gray-400 text-sm pl-4">Intraday IS improvement</td>
                  <td className={`py-3 pr-4 font-mono text-sm font-bold ${intraday_summary.mean_improvement_pct > 0 ? "text-green-400" : "text-red-400"}`}>
                    {intraday_summary.mean_improvement_pct > 0 ? "+" : ""}{intraday_summary.mean_improvement_pct.toFixed(4)}%
                  </td>
                  <td className="py-3 pr-4">
                  <span className={`stats-sig ${summary.saving_ci_95[0] > 0 ? "pass" : "fail"}`}>
                    {summary.saving_ci_95[0] > 0 ? "CI excludes zero ✓" : "CI crosses zero —"}
                  </span>
                  </td>
                  <td className="stats-note">
                    {intraday_summary.n_fills} fills · CI [{intraday_summary.ci_95[0].toFixed(4)}, {intraday_summary.ci_95[1].toFixed(4)}]
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {regime_accuracy && (
        <div>
          <h3 className="stats-section-label">
            2 · Regime direction accuracy
          </h3>
        <div className="stats-table-wrap">
          <table className="stats-table">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 pr-4 text-xs font-medium pl-4">Metric</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium">Value</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium">Significance</th>
                  <th className="text-left py-2 text-xs font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="py-3 pr-4 text-gray-400 text-sm pl-4">Overall hit rate</td>
                  <td className={`py-3 pr-4 font-mono text-sm font-bold ${regime_accuracy.overall_hit_rate > 50 ? "text-green-400" : "text-yellow-400"}`}>
                    {regime_accuracy.overall_hit_rate}%
                  </td>
                  <td className="py-3 pr-4"><Sig p={regime_accuracy.vs_random_p_value} /></td>
                  <td className="stats-note">Binomial test vs 50% random baseline · {regime_accuracy.total_predictions} predictions</td>
                </tr>
                <tr className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="py-3 pr-4 text-gray-400 text-sm pl-4">Bullish → next day up</td>
                  <td className={`py-3 pr-4 font-mono text-sm font-bold ${regime_accuracy.bullish_hit_rate > 50 ? "text-green-400" : "text-yellow-400"}`}>
                    {regime_accuracy.bullish_hit_rate}%
                  </td>
                  <td className="py-3 pr-4" />
                  <td className="stats-note">{regime_accuracy.bullish_n} bullish signals</td>
                </tr>
                <tr className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="py-3 pr-4 text-gray-400 text-sm pl-4">Bearish → next day down</td>
                  <td className={`py-3 pr-4 font-mono text-sm font-bold ${regime_accuracy.bearish_hit_rate > 50 ? "text-green-400" : "text-yellow-400"}`}>
                    {regime_accuracy.bearish_hit_rate}%
                  </td>
                  <td className="py-3 pr-4" />
                  <td className="stats-note">{regime_accuracy.bearish_n} bearish signals</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {ma_baseline && regime_accuracy && (
        <div>
          <h3 className="stats-section-label">
            3 · HMM vs naive baseline (50/200 MA crossover)
          </h3>
        <div className="stats-table-wrap">
          <table className="stats-table">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 pr-4 text-xs font-medium pl-4">Metric</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium">MA crossover</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium">HMM (ours)</th>
                  <th className="text-left py-2 text-xs font-medium">Edge</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="py-3 pr-4 text-gray-400 text-sm pl-4">Direction hit rate</td>
                  <td className="py-3 pr-4 font-mono text-sm text-gray-300">{ma_baseline.hit_rate}%</td>
                  <td className={`py-3 pr-4 font-mono text-sm font-bold ${hmm_beats_ma_hitrate ? "text-green-400" : "text-red-400"}`}>
                    {regime_accuracy.overall_hit_rate}%
                  </td>
                  <td className={`py-3 font-mono text-sm font-bold ${hmm_beats_ma_hitrate ? "text-green-400" : "text-red-400"}`}>
                    {hmm_beats_ma_hitrate ? "+" : ""}{(regime_accuracy.overall_hit_rate - ma_baseline.hit_rate).toFixed(1)}%
                  </td>
                </tr>
                <tr className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="py-3 pr-4 text-gray-400 text-sm pl-4">Cost saving vs TWAP</td>
                  <td className="py-3 pr-4 font-mono text-sm text-gray-300">
                    {ma_baseline.saving_pct > 0 ? "-" : "+"}{Math.abs(ma_baseline.saving_pct).toFixed(3)}%
                  </td>
                  <td className={`py-3 pr-4 font-mono text-sm font-bold ${hmm_beats_ma_saving ? "text-green-400" : "text-red-400"}`}>
                    {summary.saving_pct > 0 ? "-" : "+"}{Math.abs(summary.saving_pct).toFixed(3)}%
                  </td>
                  <td className={`py-3 font-mono text-sm font-bold ${hmm_beats_ma_saving ? "text-green-400" : "text-red-400"}`}>
                    {hmm_beats_ma_saving ? "+" : ""}{(summary.saving_pct - ma_baseline.saving_pct).toFixed(3)}%
                  </td>
                </tr>
                <tr className="hover:bg-gray-800/20">
                  <td className="py-3 pr-4 text-gray-400 text-sm pl-4">Overall verdict</td>
                  <td className="py-3 pr-4" colSpan={2} />
                  <td className="py-3">
                    {hmm_beats_ma_hitrate && hmm_beats_ma_saving ? (
                      <span className="text-xs text-green-400 font-bold">HMM wins both ✓</span>
                    ) : !hmm_beats_ma_hitrate && !hmm_beats_ma_saving ? (
                      <span className="text-xs text-red-400 font-bold">MA wins both</span>
                    ) : (
                      <span className="text-xs text-yellow-400 font-bold">Mixed result</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stability && (
        <div>
          <h3 className="stats-section-label">4 · Regime stability & transition zones</h3>
          <div className="stats-table-wrap">
            <table className="stats-table">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 pr-4 text-xs font-medium pl-4">Metric</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium">Value</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium">Signal</th>
                  <th className="text-left py-2 text-xs font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="py-3 pr-4 text-gray-400 text-sm pl-4">Transition zone days</td>
                  <td className={`py-3 pr-4 font-mono text-sm font-bold ${stability.pct_transition_days > 30 ? "text-yellow-400" : "text-green-400"}`}>
                    {stability.pct_transition_days}% ({stability.n_transition_days} days)
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`stats-sig ${stability.pct_transition_days <= 30 ? "pass" : "fail"}`}>
                      {stability.pct_transition_days <= 30 ? "stable ✓" : "high uncertainty —"}
                    </span>
                  </td>
                  <td className="stats-note">confidence &lt; {(stability.low_confidence_threshold * 100).toFixed(0)}%</td>
                </tr>
                <tr className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="py-3 pr-4 text-gray-400 text-sm pl-4">High-confidence saving</td>
                  <td className={`py-3 pr-4 font-mono text-sm font-bold ${stability.high_conf_saving_pct > 0 ? "text-green-400" : "text-red-400"}`}>
                    {stability.high_conf_saving_pct > 0 ? "-" : "+"}{Math.abs(stability.high_conf_saving_pct).toFixed(3)}%
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`stats-sig ${stability.saving_lift_bps > 0 ? "pass" : "fail"}`}>
                      {stability.saving_lift_bps > 0 ? `+${stability.saving_lift_bps} bps lift ✓` : `${stability.saving_lift_bps} bps —`}
                    </span>
                  </td>
                  <td className="stats-note">excludes transition zone days</td>
                </tr>
                <tr className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="py-3 pr-4 text-gray-400 text-sm pl-4">Avg confidence — bullish</td>
                  <td className={`py-3 pr-4 font-mono text-sm font-bold ${stability.avg_confidence_by_regime.bullish >= 0.7 ? "text-green-400" : "text-yellow-400"}`}>
                    {(stability.avg_confidence_by_regime.bullish * 100).toFixed(0)}%
                  </td>
                  <td className="py-3 pr-4" />
                  <td className="stats-note">HMM posterior probability</td>
                </tr>
                <tr className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="py-3 pr-4 text-gray-400 text-sm pl-4">Avg confidence — bearish</td>
                  <td className={`py-3 pr-4 font-mono text-sm font-bold ${stability.avg_confidence_by_regime.bearish >= 0.7 ? "text-green-400" : "text-yellow-400"}`}>
                    {(stability.avg_confidence_by_regime.bearish * 100).toFixed(0)}%
                  </td>
                  <td className="py-3 pr-4" />
                  <td className="stats-note">HMM posterior probability</td>
                </tr>
                <tr className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="py-3 pr-4 text-gray-400 text-sm pl-4">Avg confidence — transitional</td>
                  <td className={`py-3 pr-4 font-mono text-sm font-bold ${stability.avg_confidence_by_regime.transitional >= 0.7 ? "text-green-400" : "text-yellow-400"}`}>
                    {(stability.avg_confidence_by_regime.transitional * 100).toFixed(0)}%
                  </td>
                  <td className="py-3 pr-4" />
                  <td className="stats-note">HMM posterior probability</td>
                </tr>
                <tr className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="py-3 pr-4 text-gray-400 text-sm pl-4">Avg confidence — crash</td>
                  <td className={`py-3 pr-4 font-mono text-sm font-bold ${(stability.avg_confidence_by_regime as any).crash >= 0.7 ? "text-green-400" : "text-yellow-400"}`}>
                    {((stability.avg_confidence_by_regime as any).crash * 100).toFixed(0)}%
                  </td>
                  <td className="py-3 pr-4" />
                  <td className="stats-note">HMM posterior probability</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="stats-footer">
        Methodology: 3-state Gaussian HMM · Walk-forward OOS validation · Bootstrap CI (n=1000) ·
        Paired t-test for cost saving · Permutation test (n=1000 shuffled labels) · Binomial test for hit rate ·
        Directly comparable to CTMSTOU paper results (λ=2.90, ω=0.812 events/day)
        Bonferroni correction applied across {summary.n_hypothesis_tests} simultaneous tests
      </div>
    </div>
  );
}