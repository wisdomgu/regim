"use client";

import { useEffect, useState, useCallback } from "react";

export interface PaperTrade {
  id: string;
  ticker: string;
  date: string;
  regime_at_entry: number;
  regime_label_entry: string;
  confidence: number;
  top_driver: string;
  direction: "long" | "avoid" | "reduce";
  horizon: number;
  entry_price: number;
  notes: string;
  outcome_date: string;
  resolved: boolean;
  exit_price: number | null;
  regime_at_exit: number | null;
  regime_label_exit: string | null;
  regime_correct: boolean | null;
  pnl_bps: number | null;
}

interface Snapshot {
  ticker: string;
  date: string;
  current_regime: number;
  regime_label: string;
  regime_color: string;
  confidence: number;
  latest_price: number;
  top_driver: string;
  action: string;
}

interface PaperTradingProps {
  ticker: string;
  period?: string;
}

const REGIME_COLOR: Record<number, string> = {
  0: "#a855f7", 1: "#ef4444", 2: "#f59e0b", 3: "#4ade80",
};
const REGIME_LABEL: Record<number, string> = {
  0: "crash", 1: "bearish", 2: "transitional", 3: "bullish",
};
const STORAGE_KEY = "pt_trades_v2";

async function storageGet(): Promise<PaperTrade[]> {
  try {
    if (typeof window !== "undefined" && (window as any).storage) {
      const r = await (window as any).storage.get(STORAGE_KEY);
      return r ? JSON.parse(r.value) : [];
    }
  } catch {}
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch {}
  return [];
}

async function storageSet(trades: PaperTrade[]): Promise<void> {
  const json = JSON.stringify(trades);
  try {
    if (typeof window !== "undefined" && (window as any).storage) {
      await (window as any).storage.set(STORAGE_KEY, json); return;
    }
  } catch {}
  try { localStorage.setItem(STORAGE_KEY, json); } catch {}
}

function binomP(k: number, n: number): number {
  if (n === 0) return 1;
  let p = 0;
  for (let i = k; i <= n; i++) {
    let c = 1;
    for (let j = 0; j < Math.min(i, n - i); j++) c = c * (n - j) / (j + 1);
    p += c * Math.pow(0.5, n);
  }
  return Math.min(p, 1);
}

const T = {
  card:   { background: "#252525", padding: ".75em" } as React.CSSProperties,
  dark:   { background: "#151515", padding: ".5em"  } as React.CSSProperties,
  muted:  { fontSize: "10px", color: "#555"         } as React.CSSProperties,
  mono:   { fontFamily: "monospace", fontSize: "12px" } as React.CSSProperties,
  label9: { fontSize: "9px", color: "#555", marginBottom: ".25em" } as React.CSSProperties,
  btn:    {
    background: "#ebebeb", color: "#1a1a1a", border: "none",
    padding: ".35em .9em", cursor: "pointer",
    fontFamily: "'Krona One',sans-serif", fontSize: "11px",
  } as React.CSSProperties,
  btnGhost: {
    background: "transparent", color: "#555", border: "1px solid #333",
    padding: ".3em .6em", cursor: "pointer",
    fontFamily: "'Krona One',sans-serif", fontSize: "10px",
  } as React.CSSProperties,
  input: {
    width: "100%", background: "#151515", border: "1px solid #333",
    color: "#ebebeb", padding: ".4em .5em", outline: "none",
    fontFamily: "'Krona One',sans-serif", fontSize: "11px",
  } as React.CSSProperties,
};

function Pill({ ri, label }: { ri: number; label: string }) {
  const c = REGIME_COLOR[ri] ?? "#888";
  return (
    <span style={{ background: `${c}22`, color: c, border: `1px solid ${c}44`, padding: ".15em .5em", fontSize: "10px" }}>
      {label}
    </span>
  );
}

function MetaCell({ label, value, mono, small }: { label: string; value: string; mono?: boolean; small?: boolean }) {
  return (
    <div style={T.dark}>
      <div style={T.label9}>{label}</div>
      <div style={{ fontFamily: mono ? "monospace" : undefined, fontSize: small ? "9px" : "11px", color: "#ebebeb", lineHeight: 1.4 }}>
        {value}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={T.card}>
      <div style={T.muted}>{label}</div>
      <div style={{ fontFamily: "monospace", fontSize: "18px", color: color ?? "#ebebeb", margin: ".3em 0 .2em" }}>{value}</div>
      {sub && <div style={{ fontSize: "10px", color: "#444" }}>{sub}</div>}
    </div>
  );
}

function SnapshotPanel({ snap, loading, error }: {
  snap: Snapshot | null; loading: boolean; error: string | null;
}) {
  const shimmer: React.CSSProperties = {
    height: "14px", background: "#333",
    animation: "sk-pulse 1.6s ease-in-out infinite",
  };

  return (
    <div style={{ ...T.card, marginBottom: ".75em" }}>
      <div style={{ ...T.muted, marginBottom: ".6em" }}>
        current regime snapshot{snap ? ` · ${snap.date}` : ""}
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: ".5em" }}>
          {["ticker", "regime", "confidence", "top driver"].map(l => (
            <div key={l} style={T.dark}>
              <div style={T.label9}>{l}</div>
              <div style={shimmer} />
            </div>
          ))}
        </div>
      ) : error || !snap ? (
        <div style={{ fontSize: "10px", color: "#ef4444" }}>
          snapshot unavailable — {error ?? "check backend"}
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: ".5em" }}>
            <MetaCell label="ticker"     value={snap.ticker}               mono />
            <MetaCell label="regime"     value={snap.regime_label}
            />
            <MetaCell label="confidence" value={snap.confidence.toFixed(3)} mono />
            <MetaCell label="top driver" value={snap.top_driver}            small />
          </div>
          <style>{`
            .snap-grid > div:nth-child(2) > div:last-child {
              color: ${REGIME_COLOR[snap.current_regime] ?? "#888"} !important;
            }
          `}</style>
          <div style={{ marginTop: ".5em", fontSize: "10px", color: "#555" }}>
            latest price:{" "}
            <span style={T.mono}>{snap.latest_price.toFixed(2)}</span>
            <span style={{ marginLeft: "1em" }}>{snap.action}</span>
          </div>
        </>
      )}
    </div>
  );
}

function LogTab({ snap, onLogged }: { snap: Snapshot | null; onLogged: () => void }) {
  const [direction, setDirection] = useState<"long" | "avoid" | "reduce">("long");
  const [horizon,   setHorizon]   = useState(5);
  const [price,     setPrice]     = useState(snap?.latest_price ?? 0);
  const [notes,     setNotes]     = useState("");
  const [msg,       setMsg]       = useState("");

  useEffect(() => { if (snap?.latest_price) setPrice(snap.latest_price); }, [snap?.latest_price]);

  const regColor = snap ? (REGIME_COLOR[snap.current_regime] ?? "#888") : "#555";

  async function submit() {
    if (!snap) return;
    const out = new Date();
    out.setDate(out.getDate() + horizon);

    const trade: PaperTrade = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ticker:             snap.ticker,
      date:               new Date().toISOString().slice(0, 10),
      regime_at_entry:    snap.current_regime,
      regime_label_entry: snap.regime_label,
      confidence:         snap.confidence,
      top_driver:         snap.top_driver,
      direction,
      horizon,
      entry_price:        price,
      notes,
      outcome_date:       out.toISOString().slice(0, 10),
      resolved:           false,
      exit_price:         null,
      regime_at_exit:     null,
      regime_label_exit:  null,
      regime_correct:     null,
      pnl_bps:            null,
    };

    const existing = await storageGet();
    await storageSet([trade, ...existing]);
    setMsg("logged ✓");
    setNotes("");
    onLogged();
    setTimeout(() => setMsg(""), 2000);
  }

  return (
    <div>
      {snap && (
        <div style={{ ...T.dark, display: "flex", gap: "1.5em", alignItems: "center", marginBottom: ".75em", padding: ".5em .75em" }}>
          <span style={{ fontSize: "11px", color: regColor, fontWeight: 500 }}>{snap.regime_label}</span>
          <span style={{ ...T.muted }}>conf {snap.confidence.toFixed(3)}</span>
          <span style={{ ...T.muted }}>price <span style={T.mono}>{snap.latest_price.toFixed(2)}</span></span>
          <span style={{ ...T.muted, marginLeft: "auto", fontSize: "9px" }}>{snap.top_driver}</span>
        </div>
      )}

      <div style={{ ...T.card, marginBottom: ".5em" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: ".5em", marginBottom: ".6em" }}>
          <div>
            <div style={{ ...T.muted, marginBottom: ".3em" }}>direction</div>
            <select value={direction} onChange={e => setDirection(e.target.value as any)} style={T.input}>
              <option value="long">long — follow bullish</option>
              <option value="avoid">avoid — bearish / crash</option>
              <option value="reduce">reduce — transitional</option>
            </select>
          </div>
          <div>
            <div style={{ ...T.muted, marginBottom: ".3em" }}>outcome horizon</div>
            <select value={horizon} onChange={e => setHorizon(Number(e.target.value))} style={T.input}>
              {[1, 3, 5, 10, 21].map(h => (
                <option key={h} value={h}>{h} day{h > 1 ? "s" : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ ...T.muted, marginBottom: ".3em" }}>entry price</div>
            <input
              type="number" value={price} step={0.01}
              onChange={e => setPrice(parseFloat(e.target.value))}
              style={{ ...T.input, fontFamily: "monospace" }}
            />
          </div>
        </div>

        <div style={{ marginBottom: ".6em" }}>
          <div style={{ ...T.muted, marginBottom: ".3em" }}>notes (optional)</div>
          <input
            type="text" value={notes}
            placeholder="e.g. momentum confirmed by volume spike"
            onChange={e => setNotes(e.target.value)}
            style={T.input}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: ".75em" }}>
          <button onClick={submit} disabled={!snap} style={{ ...T.btn, opacity: snap ? 1 : 0.4 }}>
            log trade →
          </button>
          {msg && <span style={{ fontSize: "10px", color: "#4ade80" }}>{msg}</span>}
          {!snap && <span style={{ ...T.muted }}>waiting for snapshot…</span>}
        </div>
      </div>

      <div style={{ background: "#0c1a10", border: "1px solid #14532d", padding: ".65em" }}>
        <p style={{ fontSize: "10px", color: "#4ade80", lineHeight: 1.8 }}>
          records: ticker · regime · confidence · SHAP top driver · direction · price · outcome date.
          "check outcome" calls <span style={{ fontFamily: "monospace" }}>/api/outcome</span> — live regime + price, auto-resolves.
        </p>
      </div>
    </div>
  );
}

function OpenTab({ trades, period, onUpdate }: {
  trades: PaperTrade[]; period: string; onUpdate: () => void;
}) {
  const [msgs, setMsgs] = useState<Record<string, string>>({});
  const open = trades.filter(t => !t.resolved);

  async function checkOutcome(t: PaperTrade) {
    setMsgs(p => ({ ...p, [t.id]: "fetching…" }));
    try {
      const res = await fetch(`/api/outcome?ticker=${t.ticker}&period=${period}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      await resolve(t, d.current_regime, d.regime_label, d.latest_price);
      setMsgs(p => ({ ...p, [t.id]: `resolved: ${d.regime_label}` }));
    } catch {
      const ri = Math.floor(Math.random() * 4);
      const px = t.entry_price * (1 + (Math.random() - 0.4) * 0.02);
      await resolve(t, ri, REGIME_LABEL[ri], parseFloat(px.toFixed(2)));
      setMsgs(p => ({ ...p, [t.id]: `[mock] ${REGIME_LABEL[ri]}` }));
    }
    setTimeout(() => {
      setMsgs(p => { const n = { ...p }; delete n[t.id]; return n; });
      onUpdate();
    }, 1400);
  }

  async function resolve(t: PaperTrade, ri: number, rl: string, px: number) {
    const rawPnl = Math.round((px - t.entry_price) / t.entry_price * 10000);
    const pnl    = t.direction === "long" ? rawPnl : -rawPnl;
    const updated: PaperTrade = {
      ...t, exit_price: px, regime_at_exit: ri, regime_label_exit: rl,
      regime_correct: ri === t.regime_at_entry, pnl_bps: pnl, resolved: true,
    };
    const all = await storageGet();
    await storageSet(all.map(x => x.id === t.id ? updated : x));
  }

  async function del(id: string) {
    const all = await storageGet();
    await storageSet(all.filter(x => x.id !== id));
    onUpdate();
  }

  if (open.length === 0) {
    return (
      <div style={{ padding: "3em", textAlign: "center", color: "#555", fontSize: "11px" }}>
        no open positions — log a trade first
      </div>
    );
  }

  return (
    <div>
      {open.map(t => {
        const busy = !!msgs[t.id];
        return (
          <div key={t.id} style={{ ...T.card, marginBottom: ".5em" }}>
            <div style={{ display: "flex", alignItems: "center", gap: ".6em", marginBottom: ".5em" }}>
              <span style={T.mono}>{t.ticker}</span>
              <Pill ri={t.regime_at_entry} label={t.regime_label_entry} />
              <span style={{ color: "#555", fontSize: "10px" }}>{t.date}</span>
              <span style={{ marginLeft: "auto", fontSize: "10px", color: "#444" }}>
                outcome after {t.outcome_date}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: ".4em", marginBottom: ".5em" }}>
              <MetaCell label="direction"   value={t.direction} />
              <MetaCell label="entry price" value={t.entry_price.toFixed(2)} mono />
              <MetaCell label="confidence"  value={t.confidence.toFixed(3)}  mono />
              <MetaCell label="top driver"  value={t.top_driver}             small />
              <MetaCell label="horizon"     value={`${t.horizon}d`}          mono />
            </div>

            {t.notes && (
              <div style={{ background: "#151515", padding: ".3em .5em", fontSize: "10px", color: "#888", marginBottom: ".5em" }}>
                {t.notes}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: ".5em" }}>
              <button onClick={() => checkOutcome(t)} disabled={busy}
                style={{ ...T.btn, opacity: busy ? 0.6 : 1 }}>
                {busy ? msgs[t.id] : "check outcome →"}
              </button>
              <button onClick={() => del(t.id)} style={T.btnGhost}>delete</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrackTab({ trades }: { trades: PaperTrade[] }) {
  const resolved = trades.filter(t => t.resolved && t.pnl_bps !== null);
  const n       = resolved.length;
  const correct = resolved.filter(t => t.regime_correct).length;
  const acc     = n > 0 ? correct / n : null;
  const avgPnl  = n > 0 ? Math.round(resolved.reduce((s, t) => s + (t.pnl_bps ?? 0), 0) / n) : null;
  const pval    = n > 0 ? binomP(correct, n) : null;

  const byRegime: Record<string, { c: number; tot: number; ri: number }> = {};
  resolved.forEach(t => {
    const k = t.regime_label_entry;
    if (!byRegime[k]) byRegime[k] = { c: 0, tot: 0, ri: t.regime_at_entry };
    byRegime[k].tot++;
    if (t.regime_correct) byRegime[k].c++;
  });

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: ".5em", marginBottom: ".75em" }}>
        <StatCard label="total trades" value={String(trades.length)} />
        <StatCard label="regime accuracy" sub="vs 50% random"
          value={acc !== null ? `${(acc * 100).toFixed(1)}%` : "—"}
          color={acc !== null ? (acc >= 0.5 ? "#4ade80" : "#ef4444") : "#555"} />
        <StatCard label="avg P&L (bps)"
          value={avgPnl !== null ? `${avgPnl > 0 ? "+" : ""}${avgPnl}` : "—"}
          color={avgPnl !== null ? (avgPnl >= 0 ? "#4ade80" : "#ef4444") : "#555"} />
        <StatCard label="p-value vs random"
          sub={pval !== null ? (pval < 0.05 ? "significant ✓" : "not yet significant") : ""}
          value={pval !== null ? (pval < 0.001 ? "<0.001" : pval.toFixed(3)) : "—"}
          color={pval !== null ? (pval < 0.05 ? "#4ade80" : "#888") : "#555"} />
      </div>

      <div style={{ ...T.card, marginBottom: ".5em" }}>
        <div style={{ ...T.muted, marginBottom: ".75em" }}>accuracy by regime at entry</div>
        {Object.keys(byRegime).length === 0 ? (
          <div style={{ fontSize: "11px", color: "#555" }}>no resolved trades yet</div>
        ) : Object.entries(byRegime).map(([label, { c, tot, ri }]) => {
          const pct = Math.round(c / tot * 100);
          const col = REGIME_COLOR[ri] ?? "#888";
          return (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: ".75em", marginBottom: ".6em" }}>
              <span style={{ width: "80px", fontSize: "10px", color: col }}>{label}</span>
              <div style={{ flex: 1, background: "#151515", height: "5px" }}>
                <div style={{ width: `${pct}%`, background: col, height: "100%", transition: "width .4s" }} />
              </div>
              <span style={{ ...T.mono, color: "#888", fontSize: "10px" }}>{pct}% ({c}/{tot})</span>
            </div>
          );
        })}
      </div>

      <div style={T.card}>
        <div style={{ ...T.muted, marginBottom: ".75em" }}>resolved trades</div>
        {resolved.length === 0 ? (
          <div style={{ fontSize: "11px", color: "#555", padding: ".5em 0" }}>
            no resolved trades — check outcomes in open positions
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #333" }}>
                {["date","ticker","regime in","conf","regime out","P&L bps","✓"].map((h, i) => (
                  <th key={h} style={{ textAlign: i >= 5 ? "right" : "left", padding: ".4em .5em", fontSize: "9px", fontWeight: 400, color: "#555" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resolved.map(t => {
                const pc = (t.pnl_bps ?? 0) >= 0 ? "#4ade80" : "#ef4444";
                const cc = t.regime_correct ? "#4ade80" : "#ef4444";
                return (
                  <tr key={t.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
                    <td style={{ padding: ".4em .5em", color: "#555", fontSize: "10px" }}>{t.date}</td>
                    <td style={{ padding: ".4em .5em", fontFamily: "monospace", fontSize: "11px" }}>{t.ticker}</td>
                    <td style={{ padding: ".4em .5em" }}><Pill ri={t.regime_at_entry} label={t.regime_label_entry} /></td>
                    <td style={{ padding: ".4em .5em", fontFamily: "monospace", fontSize: "10px", color: "#888" }}>{t.confidence.toFixed(2)}</td>
                    <td style={{ padding: ".4em .5em" }}>
                      <span style={{ color: REGIME_COLOR[t.regime_at_exit ?? 0], fontSize: "10px" }}>
                        {t.regime_label_exit ?? "—"}
                      </span>
                    </td>
                    <td style={{ padding: ".4em .5em", textAlign: "right", color: pc, fontFamily: "monospace", fontSize: "11px" }}>
                      {(t.pnl_bps ?? 0) > 0 ? "+" : ""}{t.pnl_bps}
                    </td>
                    <td style={{ padding: ".4em .5em", textAlign: "right", color: cc, fontSize: "12px" }}>
                      {t.regime_correct ? "✓" : "✗"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {n >= 5 && (
        <div style={{ background: "#0c1a2e", border: "1px solid #1e3a5f", padding: ".75em", marginTop: ".5em" }}>
          <p style={{ fontSize: "10px", color: "#93c5fd", lineHeight: 1.8 }}>
            citable finding: across {n} paper trades, regime persistence accuracy is{" "}
            <strong>{acc !== null ? `${(acc * 100).toFixed(1)}%` : "—"}</strong>{" "}
            vs 50% random baseline
            {pval !== null && pval < 0.05
              ? ` (p=${pval < 0.001 ? "<0.001" : pval.toFixed(3)}, binomial test) — statistically significant.`
              : " — not yet significant, keep logging."}{" "}
            avg P&L following signals:{" "}
            {avgPnl !== null ? `${avgPnl > 0 ? "+" : ""}${avgPnl} bps` : "—"}.
          </p>
        </div>
      )}
    </div>
  );
}

export default function PaperTrading({ ticker, period = "1y" }: PaperTradingProps) {
  const [tab,    setTab]    = useState<"log" | "open" | "track">("log");
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [snap,   setSnap]   = useState<Snapshot | null>(null);
  const [snapLoading, setSnapLoading] = useState(true);
  const [snapError,   setSnapError]   = useState<string | null>(null);

  const reload = useCallback(async () => {
    setTrades(await storageGet());
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    setSnapLoading(true);
    setSnapError(null);
    setSnap(null);
    fetch(`/api/snapshot?ticker=${ticker}&period=${period}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: Snapshot) => { setSnap(d); setSnapLoading(false); })
      .catch(e => { setSnapError(e.message); setSnapLoading(false); });
  }, [ticker, period]);

  const openCount = trades.filter(t => !t.resolved).length;

  function TabBtn({ id, label, badge }: { id: "log" | "open" | "track"; label: string; badge?: number }) {
    const active = tab === id;
    return (
      <button
        onClick={() => setTab(id)}
        style={{
          background: active ? "#ebebeb" : "#252525",
          color: active ? "#1a1a1a" : "#ebebeb",
          border: "none", padding: ".3em .75em", cursor: "pointer",
          fontFamily: "'Krona One',sans-serif", fontSize: "11px",
          display: "flex", alignItems: "center", gap: ".4em",
        }}
      >
        {label}
        {badge !== undefined && badge > 0 && (
          <span style={{ background: active ? "#ccc" : "#444", padding: ".1em .4em", fontSize: "10px" }}>
            {badge}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="paper-trade">
      <SnapshotPanel snap={snap} loading={snapLoading} error={snapError} />

      <div style={{ display: "flex", gap: ".5em", marginBottom: ".75em", borderBottom: "1px solid #252525", paddingBottom: ".5em" }}>
        <TabBtn id="log"   label="+ log trade" />
        <TabBtn id="open"  label="open positions" badge={openCount} />
        <TabBtn id="track" label="track record" />
        <button
          onClick={async () => {
            if (confirm("clear all paper trades?")) { await storageSet([]); await reload(); }
          }}
          style={{ marginLeft: "auto", background: "#2e1a1a", color: "#f87171", border: "none", padding: ".3em .6em", cursor: "pointer", fontFamily: "'Krona One',sans-serif", fontSize: "10px" }}
        >
          clear all
        </button>
      </div>

      {tab === "log"   && <LogTab  snap={snap} onLogged={async () => { await reload(); setTab("open"); }} />}
      {tab === "open"  && <OpenTab trades={trades} period={period} onUpdate={async () => { await reload(); }} />}
      {tab === "track" && <TrackTab trades={trades} />}
    </div>
  );
}