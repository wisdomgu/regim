"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import PriceChart from "@/components/PriceChart";
import RegimeBadge from "@/components/RegimeBadge";
import RecommendationCard from "@/components/RecommendationCard";
import BacktestChart from "@/components/BacktestChart";
import PaperComparison from "@/components/PaperComparison";
import TransitionStats from "@/components/TransitionStats";
import ComparePanel from "@/components/ComparePanel";
import IntradayChart from "@/components/IntradayChart";
import TradeLog from "@/components/TradeLog";
import RegimeForecast from "@/components/RegimeForecast";
import StatsDashboard from "@/components/StatsDashboard";
import { Skeleton, SkeletonCard, DashboardSkeleton, BacktestSkeleton, PaperSkeleton, CompareSkeleton, IntradaySkeleton, StatsSkeleton } from "@/components/Skeleton";
import TransactionCosts from "@/components/TransactionCosts";
import ShapPanel from "@/components/ShapPanel";
import PaperTrading from "@/components/PaperTrading";
import { trackEvent } from "@/lib/trackEvent";
import VolForecast from "@/components/VolForecast";
import ChangepointPanel from "@/components/ChangepointPanel";
import MacroAttribution from "@/components/MacroAttribution";

type Tab = "dashboard" | "backtest" | "paper" | "compare" | "intraday" | "stats" | "trade";

const TICKERS = [
  { group: "Indices", items: ["SPY", "QQQ", "IWM"] },
  { group: "Crypto",  items: ["BTC", "ETH"] },
  { group: "Commodities", items: ["GLD"] },
  { group: "Bonds",   items: ["TLT"] },
  { group: "Stock",   items: ["AAPL"] },
];

const PERIODS = ["3mo", "6mo", "1y"];
const PROFILE = ["Retail", "Institutional", "Systematic"];

const tabs = [
  { id: "dashboard", label: "Live regime" },
  { id: "backtest",  label: "Backtest" },
  { id: "paper",     label: "Paper vs reality" },
  { id: "compare",   label: "Comparison" },
  { id: "intraday",  label: "Intraday sim" },
  { id: "stats",     label: "Statistics" },
  { id: "trade",  label: "Paper trading" },
];

const COST_MODEL: Record<string, number> = {
  Retail: 0.0005,
  Institutional: 0.001,
  Systematic: 0.0008,
};

const IMPACT_PENALTY: Record<string, number> = {
  Retail: 0,
  Systematic: 0.002,
  Institutional: 0.005,
};

const THRESHOLD: Record<string, number> = {
  Retail: 0.0002,
  Systematic: 0.0004,
  Institutional: 0.0008,
};

function cacheKey(endpoint: string, ticker: string, period: string) {
  return `${endpoint}::${ticker}::${period}`;
}

function detectRecentSwitch(
  prices: any[]
): { switched: boolean; daysAgo: number; from: string; to: string } | null {
  if (!prices || prices.length < 4) return null;
  const LABEL: Record<number, string> = {
    0: "crash", 1: "bearish", 2: "transitional", 3: "bullish",
  };
  const last = prices[prices.length - 1].regime;
  for (let i = 1; i <= 3; i++) {
    const prev = prices[prices.length - 1 - i]?.regime;
    if (prev !== undefined && prev !== last) {
      return { switched: true, daysAgo: i, from: LABEL[prev] ?? "unknown", to: LABEL[last] ?? "unknown" };
    }
  }
  return null;
}

function RotatePrompt() {
  return (
    <div className="rotate-prompt">
      <div className="rotate-icon">↻</div>
      <p>rotate for dashboard</p>
      <span>this dashboard is best viewed in landscape mode</span>
    </div>
  );
}

type LoadState = "idle" | "loading" | "done" | "error";

export default function Home() {
  const [ticker, setTicker]   = useState("SPY");
  const [period, setPeriod]   = useState("6mo");
  const [profile, setProfile] = useState("Retail");
  const [tab, setTab]         = useState<Tab>("dashboard");

  const [data,             setData]             = useState<any>(null);
  const [backtest,         setBacktest]         = useState<any>(null);
  const [compareData,      setCompare]          = useState<any>(null);
  const [intradayBacktest, setIntradayBacktest] = useState<any>(null);

  const [loadStates, setLoadStates] = useState<Record<Tab, LoadState>>({
    dashboard: "idle",
    backtest:  "idle",
    paper:     "idle",
    compare:   "idle",
    intraday:  "idle",
    stats:     "idle",
    trade:     "idle",
  });

  const [compareTickers, setCompareTickers] = useState<string[]>(["SPY", "BTC"]);

  const cache = useRef<Record<string, any>>({});

  const cachedFetch = useCallback(async (url: string, key: string) => {
    if (cache.current[key]) return cache.current[key];
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    cache.current[key] = json;
    return json;
  }, []);

  const setTabLoad = (t: Tab, state: LoadState) =>
    setLoadStates((prev) => ({ ...prev, [t]: state }));

  const loadDashboard = useCallback(async (t: string, p: string) => {
    await trackEvent({ tab: "dashboard", ticker: t, period: p }); 
    setTabLoad("dashboard", "loading");
    try {
      const key = cacheKey("regime", t, p);
      const regimeData = await cachedFetch(`/api/regime?ticker=${t}&period=${p}`, key);
      if (!regimeData?.prices) throw new Error("Invalid regime data");
      regimeData.prices = regimeData.prices.map((row: any) => ({
        ...row,
        regime: parseInt(row.regime, 10),
      }));
      setData(regimeData);
      setTabLoad("dashboard", "done");
    } catch (e) {
      console.error("Dashboard load failed:", e);
      setTabLoad("dashboard", "error");
    }
  }, [cachedFetch]);

  const loadBacktest = useCallback(async (t: string, p: string) => {
    await trackEvent({ tab: "backtest", ticker: t, period: p });
    if (loadStates.backtest === "loading") return;
    setTabLoad("backtest", "loading");
    try {
      const key = cacheKey("backtest", t, p);
      const backtestData = await cachedFetch(`/api/backtest?ticker=${t}&period=${p}`, key);
      if (!backtestData?.summary || !backtestData?.daily) throw new Error("Invalid backtest data");
      setBacktest(backtestData);
      setTabLoad("backtest", "done");
      setTabLoad("paper", "done");
      setTabLoad("stats", "done");
    } catch (e) {
      console.error("Backtest load failed:", e);
      setTabLoad("backtest", "error");
    }
  }, [cachedFetch, loadStates.backtest]);

  const loadCompare = useCallback(async (p: string) => {
    await trackEvent({ tab: "compare", ticker, period: p });
    if (loadStates.compare === "loading") return;
    setTabLoad("compare", "loading");
    try {
      const key = cacheKey("compare", "all", p);
      const compareD = await cachedFetch(`/api/compare?period=${p}`, key);
      setCompare(compareD);
      setTabLoad("compare", "done");
    } catch (e) {
      console.error("Compare load failed:", e);
      setTabLoad("compare", "error");
    }
  }, [cachedFetch, loadStates.compare]);

  const loadIntraday = useCallback(async (t: string, p: string) => {
    await trackEvent({ tab: "intraday", ticker: t, period: p });
    if (loadStates.intraday === "loading") return;
    setTabLoad("intraday", "loading");
    try {
      const key = cacheKey("intraday", t, p);
      const intradayData = await cachedFetch(`/api/intraday_backtest?ticker=${t}&period=${p}`, key);
      if (intradayData?.summary && intradayData?.fills) {
        setIntradayBacktest(intradayData);
      } else {
        setIntradayBacktest(null);
      }
      setTabLoad("intraday", "done");
    } catch (e) {
      console.error("Intraday load failed:", e);
      setTabLoad("intraday", "error");
    }
  }, [cachedFetch, loadStates.intraday]);

    const loadTrade = useCallback(async () => {
    await trackEvent({ tab: "paper_trading", ticker, period });
    if (loadStates.trade === "loading") return;
    setTabLoad("trade", "loading");
    try {
      setTabLoad("trade", "done");
    } catch (e) {
      console.error("Paper Trading load failed:", e);
      setTabLoad("trade", "error");
    }
  }, [cachedFetch, loadStates.trade]);

  const resetAndLoad = useCallback((t: string, p: string) => {
    const keys = Object.keys(cache.current).filter(
      (k) => k.includes(`::${t}::${p}`) || k.includes(`::all::${p}`)
    );
    keys.forEach((k) => delete cache.current[k]);

    setLoadStates({
      dashboard: "idle",
      backtest:  "idle",
      paper:     "idle",
      compare:   "idle",
      intraday:  "idle",
      stats:     "idle",
      trade: "idle",
    });
    setData(null);
    setBacktest(null);
    setCompare(null);
    setIntradayBacktest(null);
  }, []);

  useEffect(() => {
    if (tab === "paper")  trackEvent({ tab: "paper",  ticker, period });
    if (tab === "stats")  trackEvent({ tab: "stats",  ticker, period });
    if (tab === "dashboard" && loadStates.dashboard === "idle") {
      loadDashboard(ticker, period);
    }
    if ((tab === "backtest" || tab === "paper" || tab === "stats") && loadStates.backtest === "idle") {
      loadBacktest(ticker, period);
    }
    if (tab === "compare" && loadStates.compare === "idle") {
      loadCompare(period);
    }
    if (tab === "intraday" && loadStates.intraday === "idle") {
      loadIntraday(ticker, period);
    }
    if (tab === "stats" && loadStates.intraday === "idle") {
      loadIntraday(ticker, period);
    }
    if (tab === "trade" && loadStates.trade === "idle") {
      loadTrade();
    }
  }, [tab, loadStates, ticker, period, loadDashboard, loadBacktest, loadCompare, loadIntraday, loadTrade]);

  const handleTickerChange = (t: string) => {
    setTicker(t);
    resetAndLoad(t, period);
    setTimeout(() => {
      if (tab === "dashboard") loadDashboard(t, period);
      else if (tab === "backtest" || tab === "paper" || tab === "stats") loadBacktest(t, period);
      else if (tab === "compare") loadCompare(period);
      else if (tab === "intraday") loadIntraday(t, period);
      else if (tab === "trade") loadTrade();
    }, 0);
  };

  const handlePeriodChange = (p: string) => {
    setPeriod(p);
    resetAndLoad(ticker, p);
    setTimeout(() => {
      if (tab === "dashboard") loadDashboard(ticker, p);
      else if (tab === "backtest" || tab === "paper" || tab === "stats") loadBacktest(ticker, p);
      else if (tab === "compare") loadCompare(p);
      else if (tab === "intraday") loadIntraday(ticker, p);
      else if (tab === "trade") loadTrade();
    }, 0);
  };

  const cost          = COST_MODEL[profile] ?? 0;
  const confidence    = data?.current?.confidence ?? 0;
  const expectedSaving = (backtest?.summary?.saving_pct ?? 0) - IMPACT_PENALTY[profile];
  const regime        = data?.current?.regime;
  const netSaving     = expectedSaving - cost;
  const adjustedSaving = netSaving * confidence;

  let useRegimeAware = adjustedSaving > THRESHOLD[profile];
  if (regime === 3 && confidence > 0.55) useRegimeAware = true;
  if (regime === 1 && confidence > 0.6)  useRegimeAware = true;
  if (regime === 0 && confidence > 0.5)  useRegimeAware = true;

  const decision     = useRegimeAware ? "Regime-aware" : "VWAP";
  const decisionColor = decision === "Regime-aware" ? "green" : "gray";

  const isDashboardLoading = loadStates.dashboard === "loading" || loadStates.dashboard === "idle";
  const isTabLoading = (t: Tab) => loadStates[t] === "loading" || loadStates[t] === "idle";

  const RLABEL: Record<number,string> = {0:"crash",1:"bearish",2:"transitional",3:"bullish"};


  return (
    <main className="min-h-screen">
      <section className="dash-header">
        <nav>
          <div className="nav-col">
            <div className="nav-items">
              <p>Market Microstructure & Optimal Execution System</p>
            </div>
            <div className="nav-items">
              <a href="./">regim</a>
              <a href="about">about</a>
              <a href="contact">contact</a>
            </div>
          </div>
          <div className="nav-col">
            <div className="nav-items"><a href="dashboard">dashboard</a></div>
            <div className="nav-items">
              <a href="">github</a>
              <a href="findings">findings</a>
            </div>
            <div className="nav-items"><p>built by satish garg</p></div>
          </div>
        </nav>
        <div className="sub-header"><h1>dashboard</h1></div>
      </section>

      <RotatePrompt />

      <div className="dashboard">
        <div className="selectors">
          <div className="selector">
            {TICKERS.map(({ group, items }) => (
              <div key={group} className="flex items-center gap-2">
                <span>{group}:</span>
                {items.map((t) => (
                  <button
                    key={t}
                    onClick={() => handleTickerChange(t)}
                    className={ticker === t ? "text-white" : "text-gray-400"}
                  >
                    {t}
                  </button>
                ))}
              </div>
            ))}
          </div>

          <div className="selector">
            <span>Time Period:</span>
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                className={period === p ? "text-white" : "text-gray-400"}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="selector">
            <span>Execution Profile:</span>
            {PROFILE.map((prof) => (
              <button
                key={prof}
                onClick={() => setProfile(prof)}
                className={profile === prof ? "text-white" : "text-gray-400"}
              >
                {prof}
              </button>
            ))}
          </div>
        </div>

        {(() => {
          const alert = data?.prices ? detectRecentSwitch(data.prices) : null;
          if (!alert) return null;
          const colorMap: Record<string, string> = {
            bullish:      "bg-green-950 border-green-700 text-green-300",
            bearish:      "bg-red-950 border-red-700 text-red-300",
            transitional: "bg-yellow-950 border-yellow-700 text-yellow-300",
            crash:        "bg-purple-950 border-purple-700 text-purple-300",
          };
          const styles = colorMap[alert.to] ?? "bg-gray-800 border-gray-600 text-gray-300";
          return (
            <div className={`regime-alert mb-4 px-4 py-3 border flex items-center gap-3 ${styles}`}>
              <span className="font-semibold text-sm">Regime switch detected!</span>
              <span className="text-sm ml-2">
                {ticker} switched from{" "}
                <span className="font-mono font-bold capitalize">{alert.from}</span>
                {" → "}
                <span className="font-mono font-bold capitalize">{alert.to}</span>
                {" "}{alert.daysAgo === 1 ? "yesterday" : `${alert.daysAgo} days ago`}
              </span>
            </div>
          );
        })()}

        <div className="tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              className={tab === t.id ? "text-white" : "text-gray-400"}
            >
              {t.label}
              {loadStates[t.id as Tab] === "loading" && (
                <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
              )}
            </button>
          ))}
        </div>

        <div className="actual-dashboard">

          {tab === "compare" && (
            <div className="rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-1 text-gray-200">
                Cross-Asset Regime Structure Comparison
              </h2>
              <p className="text-xs text-gray-500 mb-2">Select 2 assets to compare</p>
              <div className="selector" style={{margin: "1em 0em"}}>
                {TICKERS.flatMap((g) => g.items).map((t) => {
                  const selected = compareTickers.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => {
                        if (selected) {
                          setCompareTickers(compareTickers.filter((x) => x !== t));
                        } else {
                          setCompareTickers(
                            compareTickers.length < 2
                              ? [...compareTickers, t]
                              : [compareTickers[1], t]
                          );
                        }
                      }}
                      className={`px-3 py-1.5 text-sm ${selected ? "text-white" : "text-gray-400"}`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
              {isTabLoading("compare") ? (
                <CompareSkeleton />
              ) : (
                <ComparePanel data={compareData} period={period} tickers={compareTickers} />
              )}
            </div>
          )}

          {tab === "intraday" && (
            <div className="rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-1 text-gray-200">
                Intraday execution simulation - {ticker}
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Order sliced into {intradayBacktest?.summary?.n_slices ?? 6} hourly tranches.
                Regime-aware weights vs VWAP benchmark.
              </p>
              {isTabLoading("intraday") ? (
                <IntradaySkeleton />
              ) : (
                <IntradayChart
                  fills={intradayBacktest?.fills}
                  summary={intradayBacktest?.summary}
                  regime_breakdown={intradayBacktest?.regime_breakdown}
                />
              )}
            </div>
          )}

          {(tab === "dashboard" || tab === "backtest" || tab === "paper" || tab === "stats" || tab === "trade") && (
            <>
              {isDashboardLoading && tab === "dashboard" ? (
                <DashboardSkeleton />
              ) : (
                <>
                  {tab === "dashboard" && data?.current && (
                    <div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <RegimeBadge
                          regime={data.current.regime}
                          color={data.current.color}
                          confidence={data.current.confidence}
                        />
                        <RecommendationCard
                          action={decision}
                          detail={`Expected saving: ${(expectedSaving * 100).toFixed(2)}%, Cost: ${(cost * 100).toFixed(2)}%, Net: ${(netSaving * 100).toFixed(2)}%`}
                          color={decisionColor}
                          regime={data.current.regime}
                        />
                      </div>
                      <div className="price-title p-6">
                        <h2 className="text-lg font-semibold mb-4 text-gray-200">
                          {data.ticker} - Detected market regimes
                        </h2>
                        <PriceChart prices={data.prices} />
                        {data.transition && (
                          <TransitionStats
                            transition={data.transition}
                            regime={data.current.regime}
                          />
                        )}
                        <ShapPanel ticker={ticker} period={period} />
                        <RegimeForecast
                          ticker={ticker}
                          timePeriod={period}
                          currentRegime={data.current.regime}
                          currentConfidence={data.current.confidence}
                        />
                        <ChangepointPanel
                          ticker={ticker}
                          period={period}
                          prices={data.prices}
                        />
                        <MacroAttribution ticker={ticker} period={period} />
                      <VolForecast ticker={ticker} period={period} />
                      </div>
                      {data?.prices && <TradeLog prices={data.prices} ticker={ticker} />}
                    </div>
                  )}

                  {tab === "backtest" && (
                    <div className="p-6">
                      <h2 className="text-lg font-semibold mb-1 text-gray-200">
                        Regime-aware vs TWAP - {ticker} <span style={{fontSize: 12}}>· Signal quality determines edge</span>
                      </h2>
                      <p className="text-sm text-gray-500 mb-6">
                        Out-of-sample walk-forward backtest. Execution at next open after regime signal.
                      </p>
                      {isTabLoading("backtest") ? (
                        <BacktestSkeleton />
                      ) : (
                        <>
                          <BacktestChart
                            daily={backtest?.daily}
                            summary={backtest?.summary}
                            regime_accuracy={backtest?.regime_accuracy}
                            ma_baseline={backtest?.ma_baseline}
                            stability={backtest?.stability}
                          />
                          <h2 className="text-lg font-semibold mt-8 mb-1 text-gray-200">
                            Transaction Cost Breakdown (bps)
                          </h2>
                          <p className="text-sm text-gray-500 mb-6">
                            Decomposition of execution costs into spread, impact, and timing components.
                          </p>
                          <TransactionCosts
                            summary={backtest?.summary}
                            fills={intradayBacktest?.fills}
                          />
                        </>
                      )}
                    </div>
                  )}

                  {tab === "paper" && (
                    <div className="rounded-xl p-6">
                      <h2 className="text-lg font-semibold mb-1 text-gray-200">Paper vs reality</h2>
                      <p className="text-sm text-gray-500 mb-6">
                        Comparing CTMSTOU simulation parameters with real {ticker} market data.
                      </p>
                      {isTabLoading("paper") ? (
                        <PaperSkeleton />
                      ) : backtest?.summary ? (
                        <PaperComparison
                          regimeParams={backtest.regime_params}
                          backtestSaving={backtest.summary.saving_pct}
                          ticker={ticker}
                        />
                      ) : null}
                    </div>
                  )}

                  {tab === "stats" && (
                    <div className="rounded-xl p-6">
                      <h2 className="text-lg font-semibold mb-1 text-gray-200">
                        Statistical summary - {ticker}
                      </h2>
                      <p className="text-sm text-gray-500 mb-6">
                        All key metrics with p-values and confidence intervals in one place.
                      </p>
                      {isTabLoading("stats") ? (
                        <StatsSkeleton />
                      ) : (
                        <StatsDashboard
                          ticker={ticker}
                          period={period}
                          summary={backtest?.summary}
                          regime_accuracy={backtest?.regime_accuracy}
                          ma_baseline={backtest?.ma_baseline}
                          intraday_summary={intradayBacktest?.summary}
                          stability={backtest?.stability}
                        />
                      )}
                    </div>
                  )}

                {tab === "trade" && (
                  <div className="rounded-xl p-6">
                    <h2 className="text-lg font-semibold mb-1 text-gray-200">
                      Paper trading - {ticker}
                    </h2>
                    <p className="text-sm text-gray-500 mb-4">
                      Log simulated trades against live regime signals. Track whether HMM predictions hold out-of-sample.
                    </p>
                    <PaperTrading ticker={ticker} period={period} />
                  </div>
                )}
                </>
              )}
            </>
          )}
        </div>

        <p className="footer">
          Regime detection via 4-state Gaussian HMM · Execution strategy from paper findings · RL failed to learn this automatically
        </p>
      </div>
    </main>
  );
}