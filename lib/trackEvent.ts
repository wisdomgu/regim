import { track } from "@vercel/analytics";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type TrackPayload = {
  tab: string;
  ticker?: string;
  period?: string;
};

let geoCache: { country: string; city: string | null } | null = null;

async function getGeo() {
  if (geoCache) return geoCache;
  try {
    const res = await fetch('/api/geo');
    geoCache = await res.json();
    return geoCache;
  } catch {
    return { country: 'Unknown', city: null };
  }
}

export async function trackEvent(payload: TrackPayload) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || 
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
  track(payload.tab, { ticker: payload.ticker ?? "", period: payload.period ?? "" });

  try {

    const geo = await getGeo();

    await fetch(`${SUPABASE_URL}/rest/v1/tab_events`, {
      method: "POST",
        headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Prefer": "return=minimal",
        },
      body: JSON.stringify({
        tab: payload.tab,
        ticker: payload.ticker ?? null,
        period: payload.period ?? null,
        country: geo?.country   ?? 'Unknown',
        city:    geo?.city      ?? null,
      }),
    });
  } catch (e) {
    console.warn("Supabase track failed:", e);
  }
}
