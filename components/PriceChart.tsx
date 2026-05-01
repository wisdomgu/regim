"use client";
import {
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  Line,
} from "recharts";

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
}

function getRegimeBands(prices: PricePoint[]) {
  const bands: { x1: number; x2: number; regime: number }[] = [];
  if (!prices || prices.length === 0) return bands;

  let startIdx = 0;
  let currentRegime = prices[0].regime;

  for (let i = 1; i < prices.length; i++) {
    const regime = typeof prices[i].regime === 'number' ? prices[i].regime : -1;

    if (regime !== currentRegime) {
      bands.push({
        x1: startIdx,
        x2: i - 1,
        regime: currentRegime,
      });
      startIdx = i;
      currentRegime = regime;
    }
  }

  bands.push({
    x1: startIdx,
    x2: prices.length - 1,
    regime: currentRegime,
  });

  return bands;
}

function getRegimeColor(regime: number): string {
  switch (regime) {
    case 0: return "#3b0764"; 
    case 1: return "#450a0a"; 
    case 2: return "#713f12"; 
    case 3: return "#14532d"; 
    default: return "#1f2937";
  }
}

export default function PriceChart({ prices }: Props) {

  const bands = getRegimeBands(prices);

  const indexedPrices = prices.map((p, i) => ({
  ...p,
  idx: i,
}));

  return (
    <ResponsiveContainer width="100%" height={380} className="price-chart">
      <ComposedChart data={indexedPrices} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
      <XAxis
        dataKey="idx"
        tick={{ fill: "#6b7280", fontSize: 11 }}
        tickLine={false}
        interval={Math.floor(prices.length / 6)}
        tickFormatter={(i) => prices[i]?.date}
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
          itemStyle={{ color: "#e5e7eb" }}
          formatter={(value: any, name: any) => {
            if (name === "Close") return [`$${value.toFixed(2)}`, name];
            return [value, name];
          }}
            labelFormatter={(label, payload) => {
              if (payload && payload.length > 0) {
                const point = payload[0].payload as PricePoint;
                const regimeLabel =
                  point.regime === 0 ? "Crash" :
                  point.regime === 1 ? "Bearish" :
                  point.regime === 2 ? "Transitional" :
                  point.regime === 3 ? "Bullish" : "Unknown";
                return `${label} (${regimeLabel})`;
              }
              return label;
            }}
        />

        {bands.map((band, i) => (
          <ReferenceArea
            key={`regime-band-${i}`}
            x1={band.x1}
            x2={band.x2}
            yAxisId={0}
            fill={getRegimeColor(band.regime)}
            fillOpacity={0.2}
            strokeOpacity={0}
          />
        ))}

        <Line
          type="linear"
          dataKey="close"
          stroke="#60a5fa"
          strokeWidth={1.5}
          dot={false}
          name="Close"
          yAxisId={0}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}