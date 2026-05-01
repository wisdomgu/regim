import { getOrFetch } from "@/lib/cache";
const TTL = 60 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker") || "SPY";
  const period = searchParams.get("period") || "6mo";
  const key = `macro:${ticker}:${period}`;

  try {
    const data = await getOrFetch(
      key,
      async () => {
        const res = await fetch(
          `http://localhost:8000/api/macro_attribution?ticker=${ticker}&period=${period}&api_key=${process.env.FRED_API_KEY}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`Backend ${res.status}`);
        return res.json();
      },
      TTL
    );
    return Response.json(data);
  } catch (err: any) {
    return Response.json(
      { error: err?.message ?? "Backend unavailable." },
      { status: 503 }
    );
  }
}