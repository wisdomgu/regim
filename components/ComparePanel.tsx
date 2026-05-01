"use client"
import {
  ComposedChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceArea, Legend
} from "recharts"

import { BarChart, Bar, Cell, LabelList } from "recharts"

interface RegimeStat {
  days: number
  pct: number
  ann_vol: number
  mean_daily_return: number
}

interface AssetData {
  n_days: number
  n_switches: number
  avg_duration_days: number
  switches_per_month: number
  regime_stats: {
    crash: RegimeStat
    bearish: RegimeStat
    transitional: RegimeStat
    bullish: RegimeStat
  }
  prices: { date: string; close: number; regime: number }[]
  error?: string
  
}

interface Props {
  data: Record<string, AssetData> | null
  period: string
  tickers: string[]
}

function RegimeChart({ asset, data }: { asset: string; data: AssetData }) {
  
  const prices = data.prices
  const indexedPrices = prices.map((p, i) => ({
  ...p,
  idx: i,
}));
  const bands: { x1: number; x2: number; regime: number }[] = []

  if (indexedPrices.length > 0) {
    let startIdx = 0
    let cur = indexedPrices[0].regime

    for (let i = 1; i < indexedPrices.length; i++) {
      if (indexedPrices[i].regime !== cur) {
        bands.push({ x1: startIdx, x2: i - 1, regime: cur })
        startIdx = i
        cur = indexedPrices[i].regime
      }
    }

    bands.push({
      x1: startIdx,
      x2: indexedPrices.length - 1,
      regime: cur,
    })
  }

  const isCrypto = asset === "BTC-USD"
  const priceFormatter = isCrypto
    ? (v: any) => `$${(v / 1000).toFixed(0)}k`
    : (v: any) => `$${v}`

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-300 mb-3">{asset}</h3>
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={indexedPrices} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="idx"
              tick={{ fill: "#6b7280", fontSize: 10 }}
              tickLine={false}
              interval={Math.floor(prices.length / 4)}
              tickFormatter={(i) => prices[i]?.date}
            />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fill: "#6b7280", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={priceFormatter}
            width={48}
          />
          <Tooltip
            contentStyle={{ 
              backgroundColor: "#1a1a1a", 
              border: "1px solid #fff",
              color: "white"
            }}
            labelStyle={{ color: "#9ca3af", fontSize: 11 }}
            formatter={(v: any) => [`$${v.toLocaleString()}`, "Price"]}
          />
          {bands.map((band, i) => (
            <ReferenceArea
              key={i}
              x1={band.x1}
              x2={band.x2}
              yAxisId={0}
              fill={
        band.regime === 3 ? "#14532d" :
        band.regime === 2 ? "#713f12" :
        band.regime === 1 ? "#450a0a" :
        "#3b0764"
      }
              fillOpacity={0.2}
            />
          ))}
          <Line
            type="linear"
            dataKey="close"
            stroke={isCrypto ? "#f59e0b" : "#60a5fa"}
            strokeWidth={1.5}
            dot={false}
            name="Price"
            yAxisId={0}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function PersistenceChart({ data }: { data: Record<string, AssetData> }) {
  const TICKER_COLORS: Record<string, string> = {
    "SPY":     "#60a5fa",
    "QQQ":     "#818cf8",
    "IWM":     "#a78bfa",
    "BTC-USD": "#f59e0b",
    "ETH-USD": "#fb923c",
    "GLD":     "#fbbf24",
    "TLT":     "#34d399",
    "AAPL":    "#f472b6",
  }

  const chartData = Object.entries(data)
    .filter(([, d]) => !d.error && d.avg_duration_days)
    .map(([ticker, d]) => ({
      ticker,
      duration: d.avg_duration_days,
    }))
    .sort((a, b) => b.duration - a.duration)

  if (chartData.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="ticker"
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: "#6b7280", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}d`}
        />
        <Tooltip
          contentStyle={{ 
            backgroundColor: "#1a1a1a", 
            border: "1px solid #fff",
            color: "white"
          }}
          labelStyle={{ color: "#9ca3af" }}
          itemStyle={{ color: "white" }}
          formatter={(v: any) => [`${v} days`, "Avg duration"]}
        />
        <Bar dataKey="duration" radius={[4, 4, 0, 0]}>
          <LabelList
            dataKey="duration"
            position="top"
            style={{ fill: "#6b7280", fontSize: 10 }}
            formatter={(v: any) => `${v}d`}
          />
          {chartData.map((entry) => (
            <Cell
              key={entry.ticker}
              fill={TICKER_COLORS[entry.ticker] ?? "#6b7280"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}


function StatRow({ label, spy, btc, highlight }: {
  label: string
  spy: string
  btc: string
  highlight?: "btc" | "spy" | null
}) {
  return (
    <div className="compare-stat-row">
      <span className="text-gray-400">{label}</span>
      <span className={`text-right font-mono ${highlight === "spy" ? "text-blue-400" : "text-gray-200"}`}>
        {spy}
      </span>
      <span className={`text-right font-mono ${highlight === "btc" ? "text-amber-400" : "text-gray-200"}`}>
        {btc}
      </span>
    </div>
  )
}

export default function ComparePanel({ data, period, tickers }: Props) {
  
  if (tickers.length < 2) {
    return (
      <div className="text-gray-500 text-sm">
        Select at least 2 assets to compare
      </div>
    )
  }

  if (!data) {
    return (
      <div className="">
      </div>
    )
  }

  const [a, b] = tickers
  const assetA = data[a]
  const assetB = data[b]

  if (!assetA || !assetB || assetA.error || assetB.error) {
    return (
      <div className="text-red-400 text-sm">
        {assetA?.error || assetB?.error || "Failed to load comparison data"}
      </div>
    )
  }

  const aSwitch = assetA.switches_per_month ?? 0
  const bSwitch = assetB.switches_per_month ?? 0

  const faster = aSwitch > bSwitch ? a : b
  const slower = aSwitch > bSwitch ? b : a

  const ratio = (
    Math.max(aSwitch, bSwitch) /
    Math.max(Math.min(aSwitch, bSwitch), 0.01)
  ).toFixed(1)

  return (
    <div className="space-y-8">
      <div className="compare-insight">
        <span className="font-semibold text-blue-400">{faster}</span> switches regimes{" "}
        <span className="text-amber-400 font-semibold">{ratio}×</span> more frequently than{" "}
        <span className="font-semibold text-blue-400">{slower}</span>. This suggests execution
        models must adapt faster for {faster}, while {slower} allows more stable regime-aware strategies.
      </div>

      <div className="compare-charts">
        <div className="compare-chart-card">
          <RegimeChart asset={a} data={assetA} />
        </div>
      <div className="compare-chart-card">
          <RegimeChart asset={b} data={assetB} />
        </div>
      </div>

        <div className="compare-table-card">
          <div className="compare-table-head">
          <span>Metric</span>
          <span className="text-right text-blue-400">{a}</span>
          <span className="text-right text-amber-400">{b}</span>
        </div>

        <StatRow
          label="Regime switches"
          spy={`${assetA.n_switches}`}
          btc={`${assetB.n_switches}`}
          highlight={bSwitch > aSwitch ? "btc" : "spy"}
        />
        <StatRow
          label="Switches per month"
          spy={assetA.switches_per_month?.toFixed(1) ?? "0.0"}
          btc={assetB.switches_per_month?.toFixed(1) ?? "0.0"}
          highlight={bSwitch > aSwitch ? "btc" : "spy"}
        />
        <StatRow
          label="Avg regime duration"
          spy={`${assetA.avg_duration_days}d`}
          btc={`${assetB.avg_duration_days}d`}
          highlight={assetA.avg_duration_days > assetB.avg_duration_days ? "spy" : "btc"}
        />
        <StatRow
          label="% time bullish"
          spy={`${assetA.regime_stats.bullish.pct}%`}
          btc={`${assetB.regime_stats.bullish.pct}%`}
        />
        <StatRow
          label="Bullish ann. vol"
          spy={`${assetA.regime_stats.bullish.ann_vol ?? 0}%`}
          btc={`${assetB.regime_stats.bullish.ann_vol ?? 0}%`}
          highlight={assetB.regime_stats.bullish.ann_vol > assetA.regime_stats.bullish.ann_vol ? "btc" : "spy"}
        />
        <StatRow
          label="Bearish ann. vol"
          spy={`${assetA.regime_stats.bearish.ann_vol ?? 0}%`}
          btc={`${assetB.regime_stats.bearish.ann_vol ?? 0}%`}
          highlight={assetB.regime_stats.bearish.ann_vol > assetA.regime_stats.bearish.ann_vol ? "btc" : "spy"}
        />
        <StatRow
          label="Bearish mean daily return"
          spy={`${assetA.regime_stats.bearish.mean_daily_return}%`}
          btc={`${assetB.regime_stats.bearish.mean_daily_return}%`}
        />
        <StatRow
          label="% time crash"
          spy={`${assetA.regime_stats.crash.pct}%`}
          btc={`${assetB.regime_stats.crash.pct}%`}
        />

        <StatRow
          label="% time transitional"
          spy={`${assetA.regime_stats.transitional.pct}%`}
          btc={`${assetB.regime_stats.transitional.pct}%`}
        />

        <StatRow
          label="Crash ann. vol"
          spy={`${assetA.regime_stats.crash.ann_vol ?? 0}%`}
          btc={`${assetB.regime_stats.crash.ann_vol ?? 0}%`}
        />

        <StatRow
          label="Transitional ann. vol"
          spy={`${assetA.regime_stats.transitional.ann_vol ?? 0}%`}
          btc={`${assetB.regime_stats.transitional.ann_vol ?? 0}%`}
        />
      </div>
      <div className="persistence-card">
        <h3 className="text-sm font-semibold text-gray-300 mb-1">
          Regime persistence across assets
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Average regime duration in days — longer = more persistent regimes = more value from regime-aware execution
        </p>
        <PersistenceChart data={data} />
      </div>
    </div>
  )
}
