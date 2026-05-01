"use client";

interface PricePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  regime: number;
}

interface Props {
  prices: PricePoint[];
  ticker?: string;
}
interface Fill {
  date: string;
  regime: number;
  signalRegime: number;
  executionPrice: number;
  twapPrice: number;
  is_pct: number;
  twap_is_pct: number;
  improvement: number;
  cumulativePnL: number;
}

function computeFills(prices: PricePoint[]): Fill[] {
  const fills: Fill[] = [];
  let cumulativePnL = 0;

  for (let i = 2; i < prices.length; i++) {
    const yesterday = prices[i - 1];
    const today = prices[i];
    const signalRegime = yesterday.regime;

    const priorClose = prices[i - 1].close;
    const executionPrice =
      signalRegime === 3 ? today.open                              
      : signalRegime === 2 ? (today.open * 0.6 + priorClose * 0.4) 
      : signalRegime === 1 ? (today.open + priorClose) / 2       
      : today.open * 1.0002;                                      

    const twapPrice = today.open; 

    const arrivalPrice = today.open;
    const is_pct = (executionPrice - arrivalPrice) / arrivalPrice * 100;
    const twap_is_pct = 0; 

    const improvement = twap_is_pct - is_pct;
    cumulativePnL += improvement;

    fills.push({
      date: today.date,
      regime: today.regime,
      signalRegime,
      executionPrice: parseFloat(executionPrice.toFixed(2)),
      twapPrice: parseFloat(twapPrice.toFixed(2)),
      is_pct: parseFloat(is_pct.toFixed(4)),
      twap_is_pct: 0,
      improvement: parseFloat(improvement.toFixed(4)),
      cumulativePnL: parseFloat(cumulativePnL.toFixed(4)),
    });
  }

  return fills.slice(-20).reverse(); 
}

export default function TradeLog({ prices, ticker = "ticker" }: Props) {
  if (!prices || prices.length < 5) return null;

  const fills = computeFills(prices);
  const totalImprovement = fills.reduce((s, f) => s + f.improvement, 0);
  const positiveFills = fills.filter(f => f.improvement > 0).length;

  const downloadCSV = () => {
  const allFills = computeFills(prices); 
  const headers = ["Date", "Signal", "Exec Price", "TWAP Price", "IS vs TWAP (%)", "Cumul P&L (%)"];
  const rows = allFills.map(f => [
    f.date,
    f.signalRegime === 3 ? "Bullish" : f.signalRegime === 2 ? "Transitional" : f.signalRegime === 1 ? "Bearish" : "Crash",
    f.executionPrice,
    f.twapPrice,
    f.improvement.toFixed(4),
    f.cumulativePnL.toFixed(4),
  ]);
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `trade_log_${ticker}_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const REGIME_LABELS = {
  0: "Crash",
  1: "Bearish", 
  2: "Transitional",
  3: "Bullish"
};

const REGIME_COLORS = {
  0: "bg-purple-900/20 text-purple-300",
  1: "bg-red-900/20 text-red-300",
  2: "bg-yellow-900/20 text-yellow-300", 
  3: "bg-green-900/20 text-green-300"
};

  const getSignalStyle = (regime: number) => {
    switch (regime) {
      case 3: return "bg-green-950 text-green-400 border border-green-900";
      case 2: return "bg-yellow-950 text-yellow-400 border border-yellow-900";
      case 1: return "bg-red-950 text-red-400 border border-red-900";
      case 0: default: return "bg-purple-950 text-purple-400 border border-purple-900";
    }
  };

  const getDotStyle = (regime: number) => {
    switch (regime) {
      case 3: return "bg-green-400";
      case 2: return "bg-yellow-400";
      case 1: return "bg-red-400";
      case 0: default: return "bg-purple-400";
    }
  };

  return (
    <div className="trade-log mt-6 p-6">
      <div className="trade-head flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-200">Simulated trade log</h2>
          <p className="mt-0.5">
            Last 20 fills - regime signal from prior day, execution at next open
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={downloadCSV}
            className="px-3 py-1.5 text-gray-300 transition-colors flex items-center gap-1.5"
          >
            ↓ Export CSV
          </button>
          <div className="flex gap-4 text-right">
          </div>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <p className="uppercase tracking-wider">Hit rate</p>
            <p className="text-lg font-bold text-white">
              {Math.round(positiveFills / fills.length * 100)}%
            </p>
          </div>
          <div>
            <p className="uppercase tracking-wider">Cumul. improvement</p>
            <p className={`text-lg font-bold ${totalImprovement > 0 ? "text-green-400" : "text-red-400"}`}>
              {totalImprovement > 0 ? "+" : ""}{totalImprovement.toFixed(3)}%
            </p>
          </div>
        </div>
      </div>

      <div className="logs overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-grey-500 py-2 pr-4 font-medium">Date</th>
              <th className="text-left text-grey-500 py-2 pr-4 font-medium">Signal</th>
              <th className="text-right text-grey-500 py-2 pr-4 font-medium">Exec price</th>
              <th className="text-right text-grey-500 py-2 pr-4 font-medium">TWAP price</th>
              <th className="text-right text-grey-500 py-2 pr-4 font-medium">IS vs TWAP</th>
              <th className="text-right text-grey-500 py-2 font-medium">Cumul. P&L</th>
            </tr>
          </thead>
          <tbody>
            {fills.map((fill, i) => (
              <tr key={i}>
                <td className="py-2.5 pr-4 font-mono text-xs">{fill.date}</td>
                <td className="py-2.5 pr-4">
                  <span className={`signal inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium ${getSignalStyle(fill.signalRegime)}`}>
                    <span className={`w-1.5 h-1.5 ${getDotStyle(fill.signalRegime)}`} />
                      {fill.signalRegime === 3 ? "Bullish"
                        : fill.signalRegime === 2 ? "Transitional"
                        : fill.signalRegime === 1 ? "Bearish"
                        : "Crash"}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-right text-gray-300 font-mono text-xs">
                  ${fill.executionPrice.toLocaleString()}
                </td>
                <td className="py-2.5 pr-4 text-right font-mono text-xs">
                  ${fill.twapPrice.toLocaleString()}
                </td>
                <td className="py-2.5 pr-4 text-right font-mono text-xs">
                  <span className={fill.improvement > 0 ? "text-green-400" : fill.improvement < 0 ? "text-red-400" : "text-grey-500"}>
                    {fill.improvement > 0 ? "+" : ""}{fill.improvement.toFixed(4)}%
                  </span>
                </td>
                <td className="py-2.5 text-right font-mono text-xs">
                  <span className={fill.cumulativePnL > 0 ? "text-green-400" : "text-red-400"}>
                    {fill.cumulativePnL > 0 ? "+" : ""}{fill.cumulativePnL.toFixed(3)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}