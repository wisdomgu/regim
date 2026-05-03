interface RegimeParam {
  regime: string;
  mean_return: number;
  volatility: number;
  momentum: number;
}

interface Props {
  regimeParams: RegimeParam[];
  backtestSaving: number;
  ticker: string;
}

const PAPER_PARAMS = {
  bullish: { mean_return: 0.5, volatility: 50.0, momentum: 0.021 },
  bearish: { mean_return: -0.5, volatility: 50.0, momentum: -0.019 },
  twap_wap: 1.0277,
  regime_rule_wap: 0.9949,
  saving_pct: 3.21,
};

export default function PaperComparison({ regimeParams, backtestSaving, ticker }: Props) {
  const bull    = regimeParams.find((r) => r.regime === "bullish");
  const bear    = regimeParams.find((r) => r.regime === "bearish");
  const transit = regimeParams.find((r) => r.regime === "transitional");

  return (
    <div className="space-y-6">

      <div className="paper-context">
        <p className="text-sm text-blue-300">
          <a href="https://papers.ssrn.com/abstract=6559598" className="text-sm">This paper</a> found that RL agents <span className="font-semibold">failed to exploit regime information</span> even
          when it was in their state — achieving WAP 1.0003 vs the hand-coded rule's 0.9949.
          This dashboard makes that regime signal <span className="font-semibold">explicit</span>, applying it directly on real {ticker} data.
        </p>
      </div>

      <div>
        <h3 className="paper-section-label">
          Regime parameters - simulated vs real
        </h3>
        <div className="overflow-x-auto">
          <table className="paper-table w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-2 pr-6">Metric</th>
                <th className="text-right py-2 pr-6">Paper · bullish</th>
                <th className="text-right py-2 pr-6">Paper · bearish</th>
                <th className="text-right py-2 pr-6">{ticker} · bullish</th>
                <th className="text-right py-2">  {ticker} · bearish</th>
            <th className="text-right py-2 pr-6">{ticker} · transitional</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              <tr>
                <td className="py-3 pr-6 text-gray-300">Mean return (%/day)</td>
                <td className="py-3 pr-6 text-right text-green-400">+{PAPER_PARAMS.bullish.mean_return}</td>
                <td className="py-3 pr-6 text-right text-red-400">{PAPER_PARAMS.bearish.mean_return}</td>
                <td className="py-3 pr-6 text-right text-green-400">
                  {bull ? `${bull.mean_return > 0 ? "+" : ""}${bull.mean_return.toFixed(4)}` : "—"}
                </td>
                <td className="py-3 text-right text-red-400">
                  {bear ? `${bear.mean_return > 0 ? "+" : ""}${bear.mean_return.toFixed(4)}` : "—"}
                </td>
                <td className="py-3 pr-6 text-right text-yellow-400">
                  {transit ? `${transit.mean_return > 0 ? "+" : ""}${transit.mean_return.toFixed(4)}` : "—"}
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-6 text-gray-300">Volatility (%/day)</td>
                <td className="py-3 pr-6 text-right text-gray-300">{PAPER_PARAMS.bullish.volatility}</td>
                <td className="py-3 pr-6 text-right text-gray-300">{PAPER_PARAMS.bearish.volatility}</td>
                <td className="py-3 pr-6 text-right text-gray-300">
                  {bull?.volatility != null ? bull.volatility.toFixed(4) : "—"}
                </td>
                <td className="py-3 text-right text-gray-300">
                  {bear?.volatility != null ? bear.volatility.toFixed(4) : "—"}
                </td>
                <td className="py-3 pr-6 text-right text-gray-300">
                  {transit?.volatility != null ? transit.volatility.toFixed(4) : "—"}
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-6 text-gray-300">Momentum (5d, %)</td>
                <td className="py-3 pr-6 text-right text-gray-300">+{PAPER_PARAMS.bullish.momentum}</td>
                <td className="py-3 pr-6 text-right text-gray-300">{PAPER_PARAMS.bearish.momentum}</td>
                <td className="py-3 pr-6 text-right text-gray-300">
                  {bull?.momentum != null ? `${bull.momentum > 0 ? "+" : ""}${bull.momentum.toFixed(4)}` : "—"}
                </td>
                <td className="py-3 text-right text-gray-300">
                  {bear?.momentum != null ? `${bear.momentum > 0 ? "+" : ""}${bear.momentum.toFixed(4)}` : "—"}
                </td>
                <td className="py-3 pr-6 text-right text-gray-300">
                  {transit?.momentum != null ? `${transit.momentum > 0 ? "+" : ""}${transit.momentum.toFixed(4)}` : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="paper-section-label">
          Execution cost - simulated vs real
        </h3>
        <div className="paper-cost-grid">
          <div className="paper-cost-card">
            <p className="text-xs text-gray-500 mb-2">Paper (CTMSTOU simulation)</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">TWAP WAP</span>
                <span className="text-white font-mono">1.0277 (normalized)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Regime rule WAP</span>
                <span className="text-green-400 font-mono">0.9949 (normalized)</span>
              </div>
              <div className="paper-cost-row paper-cost-divider">
                <span className="text-gray-400">Saving</span>
                <span className="text-green-400 font-mono">3.21%</span>
              </div>
            </div>
          </div>
          <div className="paper-cost-card">
            <p className="text-xs text-gray-500 mb-2">{ticker} real market (daily backtest)</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">TWAP cost</span>
                <span className="text-white font-mono">baseline</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Regime-aware cost</span>
                <span className={`font-mono ${backtestSaving > 0 ? "text-green-400" : "text-red-400"}`}>
                  {backtestSaving > 0 ? "-" : "+"}{Math.abs(backtestSaving).toFixed(3)}% vs TWAP
                </span>
              </div>
              <div className="paper-cost-row paper-cost-divider">
                <span className="text-gray-400">Daily vol (bullish regime)</span>
                <span className="text-gray-300 font-mono">
                  ~{bull ? bull.volatility.toFixed(2) : "—"}%/day
                </span>
              </div>
              <div className="paper-cost-row">
                <span className="text-gray-400">Paper vol (synthetic)</span>
                <span className="text-gray-500 font-mono">~50%/day</span>
              </div>
            </div>
          </div>
        </div>
        <div className="paper-disclaimer">
          <p className="text-xs text-yellow-600">
            <span className="font-semibold text-yellow-500">Why the numbers differ:</span> The paper's
            CTMSTOU model uses normalized prices (~1.0) with σ=50%/day — a synthetic microstructure environment.
            Real {ticker} volatility is ~{bull ? bull.volatility.toFixed(2) : "—"}%/day.
            The regime <span className="italic">direction</span> matches (bullish→urgency saves cost),
            but the magnitude is not directly comparable.
          </p>
        </div>
      </div>
    </div>
  );
}
