export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/cache";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker") ?? "SPY";
  const period = searchParams.get("period") ?? "6mo";

  const key = `forecast:${ticker}:${period}`;
  const cached = getCached(key);
  if (cached) return NextResponse.json(cached);

  try {
    const res = await fetch(
      `${BACKEND}/api/regime_forecast?ticker=${ticker}&period=${period}`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }
    const data = await res.json();
    setCached(key, data, 60 * 60 * 1000);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Backend unavailable", detail: String(err) },
      { status: 503 }
    );
  }
}