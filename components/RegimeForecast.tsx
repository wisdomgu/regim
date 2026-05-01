"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface RegimeForecastData {
  transition_matrix: number[][];        
  current_state: number;                  
  current_state_vector: number[];         
  forecast_horizons: number[];            
  forecast_distributions: number[][];    
  ticker: string;
  as_of: string;
}

interface RegimeForecastProps {
  ticker?: string;
  timePeriod?: string;
  currentRegime?: number;
  currentConfidence?: number;
}


const REGIME_LABELS = ["Crash", "Bearish", "Transitional", "Bullish"];
const REGIME_COLORS = {
  Crash:        "#a855f7",
  Bearish:      "#ef4444",
  Transitional: "#f59e0b", 
  Bullish:      "#22c55e",  
} as const;

const HORIZON_LABELS: Record<number, string> = {
  1: "1d", 2: "2d", 3: "3d", 5: "5d", 10: "10d", 21: "21d",
};

function identity4(): number[][] {
  return [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]];
}

function matMul(A: number[][], B: number[][]): number[][] {
  const n = A.length;
  const C = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      for (let k = 0; k < n; k++) C[i][j] += A[i][k] * B[k][j];
  return C;
}

function matPow(A: number[][], n: number): number[][] {
  let result = identity4();
  let base = A.map(r => [...r]);
  while (n > 0) {
    if (n % 2 === 1) result = matMul(result, base);
    base = matMul(base, base);
    n = Math.floor(n / 2);
  }
  return result;
}

function vecMatMul(v: number[], M: number[][]): number[] {
  const n = M[0].length;
  return Array.from({ length: n }, (_, j) =>
    v.reduce((s, vi, i) => s + vi * M[i][j], 0)
  );
}

function computeForecasts(
  transitionMatrix: number[][],
  stateVector: number[],
  horizons: number[]
): number[][] {
  return horizons.map((h) => {
    const Ah = matPow(transitionMatrix, h);
    return vecMatMul(stateVector, Ah);
  });
}

function heatmapCellStyle(prob: number): React.CSSProperties {
  const intensity = Math.round(prob * 255);
  const bg = `rgba(20, ${80 + Math.round(prob * 120)}, ${100 + Math.round(prob * 155)}, ${0.15 + prob * 0.7})`;
  return {
    backgroundColor: bg,
    color: prob > 0.45 ? "#fff" : "#94a3b8",
    fontWeight: prob > 0.45 ? 700 : 400,
  };
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        padding: "14px 18px",
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ?? "#e2e8f0", lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

function TransitionHeatmap({ matrix }: { matrix: number[][] }) {
  const cellStyle: React.CSSProperties = {
    padding: "12px 10px",
    textAlign: "center",
    fontSize: 13,
    transition: "all 0.2s",
  };

  return (
    <div>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
        Transition Matrix — P(next state | current state)
      </div>
      <div style={{ overflowX: "auto" }} className="transition-table">
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 4 }}>
          <thead>
            <tr>
              <th style={{ padding: "6px 10px", fontSize: 10, textAlign: "left" }}>From ↓ / To →</th>
              {REGIME_LABELS.map((l) => (
                <th key={l} style={{ padding: "6px 10px", fontSize: 11, fontWeight: 600, color: REGIME_COLORS[l as keyof typeof REGIME_COLORS], textAlign: "center" }}>
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={i}>
                <td style={{ padding: "6px 10px", fontSize: 12, fontWeight: 600, color: REGIME_COLORS[REGIME_LABELS[i] as keyof typeof REGIME_COLORS] }}>
                  {REGIME_LABELS[i]}
                </td>
                {row.map((prob, j) => (
                  <td key={j} style={{ ...cellStyle, ...heatmapCellStyle(prob) }}>
                    {(prob * 100).toFixed(1)}%
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ForecastLineChart({
  horizons,
  distributions,
}: {
  horizons: number[];
  distributions: number[][];
}) {
  const data = horizons.map((h, idx) => ({
    horizon: HORIZON_LABELS[h] ?? `${h}d`,
    Crash: +(distributions[idx][0] * 100).toFixed(2),
    Bearish: +(distributions[idx][1] * 100).toFixed(2),
    Transitional: +(distributions[idx][2] * 100).toFixed(2),
    Bullish: +(distributions[idx][3] * 100).toFixed(2),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="horizon" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v) => `${v}%`}
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          domain={[0, 100]}
        />
        <Tooltip
          contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", fontSize: 12 }}
          labelStyle={{ color: "#94a3b8" }}
          formatter={(v: any) => [`${v.toFixed(1)}%`]}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Line type="linear" dataKey="Crash" stroke={REGIME_COLORS.Crash} strokeWidth={2} dot={{ r: 3, fill: REGIME_COLORS.Crash }} />
        <Line type="linear" dataKey="Bearish" stroke={REGIME_COLORS.Bearish} strokeWidth={2} dot={{ r: 3, fill: REGIME_COLORS.Bearish }} />
        <Line type="linear" dataKey="Transitional" stroke={REGIME_COLORS.Transitional} strokeWidth={2} dot={{ r: 3, fill: REGIME_COLORS.Transitional }} />
        <Line type="linear" dataKey="Bullish" stroke={REGIME_COLORS.Bullish} strokeWidth={2} dot={{ r: 3, fill: REGIME_COLORS.Bullish }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ProbabilityBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{(value * 100).toFixed(1)}%</span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${value * 100}%`,
            background: color,
            transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </div>
    </div>
  );
}

function buildMockData(ticker: string): RegimeForecastData {
  const matrix: number[][] = [
    [0.70, 0.15, 0.10, 0.05], 
    [0.05, 0.82, 0.10, 0.03],  
    [0.02, 0.10, 0.76, 0.12], 
    [0.01, 0.04, 0.07, 0.88], 
  ];
  const currentState = 3;
  const stateVector = [0.02, 0.05, 0.08, 0.85];
  const horizons = [1, 2, 3, 5, 10, 21];
  const distributions = computeForecasts(matrix, stateVector, horizons);
  return {
    transition_matrix: matrix,
    current_state: currentState,
    current_state_vector: stateVector,
    forecast_horizons: horizons,
    forecast_distributions: distributions,
    ticker,
    as_of: new Date().toISOString().split("T")[0],
  };
}

export default function RegimeForecast({ ticker = "SPY", timePeriod = "6mo", currentRegime, currentConfidence }: RegimeForecastProps) {
  const [data, setData] = useState<RegimeForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedHorizon, setSelectedHorizon] = useState<number>(5);

  const fetchForecast = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/regime_forecast?ticker=${ticker}&period=${timePeriod}`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json: RegimeForecastData = await res.json();
      setData(json);
    } catch (e) {
      console.warn("Regime forecast API unavailable, using mock data:", e);
      setData(buildMockData(ticker));
      setError("Live API unavailable — showing illustrative data");
    } finally {
      setLoading(false);
    }
  }, [ticker, timePeriod]);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
        <div
          className="w-6 h-6 rounded-full border-2 border-slate-600 border-t-slate-300 animate-spin"
        />
        <p className="text-xs">Computing regime forecast ...</p>
      </div>
    );
  }

  if (!data) return null;

  const resolvedState = data.current_state;
  const currentLabel = REGIME_LABELS[resolvedState] ?? "Transitional";
  const currentColor = REGIME_COLORS[currentLabel as keyof typeof REGIME_COLORS];

  const horizonIdx = data.forecast_horizons.indexOf(selectedHorizon);
  const selectedDist = horizonIdx >= 0 ? data.forecast_distributions[horizonIdx] : data.current_state_vector;

  const domIdx = selectedDist.indexOf(Math.max(...selectedDist));
  const domLabel = REGIME_LABELS[domIdx];
  const domColor = REGIME_COLORS[domLabel as keyof typeof REGIME_COLORS];

  const Ainf = matPow(data.transition_matrix, 100);
  const steadyState = Ainf[0]; 

  return (
    <div className="forecast"
    >
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: "1em 0 0 0", fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>
            Regime Forecast Horizon
          </h2>
          <span style={{ fontSize: 12,}}>
            {data.ticker} · as of {data.as_of}
          </span>
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.5 }}>
          P(regime at t+n) = A<sup>n</sup> · current state vector — derived from fitted HMM transition matrix.
          Directly comparable to CTMSTOU calibrated rates (λ=2.90, ω=0.812 events/day).
        </p>
        {error && (
          <div style={{ marginTop: 8, padding: "6px 12px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", fontSize: 11, color: "#f59e0b" }}>
            ⚠ {error}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 24 }}>
        <StatCard
          label="Current regime"
          value={currentLabel}
          sub={`${(currentConfidence * 100).toFixed(0)}% confidence`}
          accent={currentColor}
        />
        <StatCard
          label={`Dominant at ${selectedHorizon}d`}
          value={domLabel}
          sub={`${(selectedDist[domIdx] * 100).toFixed(1)}% probability`}
          accent={domColor}
        />
        <StatCard
          label="Steady-state bullish"
          value={`${(steadyState[3] * 100).toFixed(1)}%`}
          sub="Long-run equilibrium"
          accent="#22c55e"
        />
        <StatCard
          label="Steady-state crash"
          value={`${(steadyState[0] * 100).toFixed(1)}%`}
          sub="Long-run equilibrium"
          accent="#a855f7"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            padding: "18px 16px",
          }}
        >
          <TransitionHeatmap matrix={data.transition_matrix} />
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            padding: "18px 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              State distribution at horizon
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {data.forecast_horizons.map((h) => (
                <button
                  key={h}
                  onClick={() => setSelectedHorizon(h)}
                  style={{
                    padding: "3px 9px",
                    border: selectedHorizon === h ? `1px solid ${currentColor}` : "1px solid rgba(255,255,255,0.1)",
                    background: selectedHorizon === h ? `${currentColor}22` : "transparent",
                    color: selectedHorizon === h ? currentColor : "#64748b",
                    fontSize: 11,
                    cursor: "pointer",
                    fontWeight: selectedHorizon === h ? 700 : 400,
                    transition: "all 0.15s",
                  }}
                >
                  {HORIZON_LABELS[h] ?? `${h}d`}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            {REGIME_LABELS.map((label, i) => (
              <ProbabilityBar
                key={label}
                label={label}
                value={selectedDist[i]}
                color={REGIME_COLORS[label as keyof typeof REGIME_COLORS]}
              />
            ))}
          </div>

          {(() => {
            const entropy = -selectedDist.reduce((s, p) => s + (p > 0 ? p * Math.log2(p) : 0), 0);
            const maxEntropy = Math.log2(4);
            const uncertainty = entropy / maxEntropy;
            return (
              <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.04)", }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11,}}>Forecast uncertainty</span>
                  <span style={{ fontSize: 11, color: uncertainty > 0.6 ? "#f59e0b" : "#64748b" }}>
                    {uncertainty < 0.35 ? "Low" : uncertainty < 0.65 ? "Moderate" : "High"}
                  </span>
                </div>
                <div style={{ height: 4, background: "rgba(255,255,255,0.07)"}}>
                  <div
                    style={{
                      height: "100%",
                      width: `${uncertainty * 100}%`,
                      background: uncertainty > 0.6 ? "#f59e0b" : uncertainty > 0.35 ? "#3b82f6" : "#22c55e",
                      transition: "width 0.5s ease",
                    }}
                  />
                </div>
                <div style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>
                  Shannon entropy {entropy.toFixed(2)} / {maxEntropy.toFixed(2)} bits
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          padding: "18px 16px",
        }}
      >
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
          Regime probability evolution across horizons
        </div>
        <ForecastLineChart
          horizons={data.forecast_horizons}
          distributions={data.forecast_distributions}
        />
        <div style={{ fontSize: 10, marginTop: 8, color:"#555"}}>
         Probabilities converge toward long-run steady-state: 
          Crash {(steadyState[0]*100).toFixed(1)}% · 
          Bearish {(steadyState[1]*100).toFixed(1)}% · 
          Transitional {(steadyState[2]*100).toFixed(1)}% · 
          Bullish {(steadyState[3]*100).toFixed(1)}%
        </div>
      </div>
    </div>
  );
}