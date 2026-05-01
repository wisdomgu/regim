import { getCached, setCached } from "@/lib/cache";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker") || "SPY";
  const period = searchParams.get("period") || "1y";

  const key = `intraday:${ticker}:${period}`;
  const cached = getCached(key);
  if (cached) return Response.json(cached);
  
  try {
    const res = await fetch(
      `http://localhost:8000/api/intraday_backtest/${ticker}?period=${period}`,
      { cache: "no-store" }
    );
    
    const data = await res.json();
    setCached(key, data, 60 * 60 * 1000);
    return Response.json(data);
    
  } catch (err) {
    return Response.json({ error: "Backend unavailable." }, { status: 503 });
  }
}