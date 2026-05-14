import { getOrFetch } from "@/lib/cache";
const TTL = 15 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker") || "SPY";
  const period = searchParams.get("period") || "6mo";
  const key = `vol_forecast:${ticker}:${period}`;

  try {
    const data = await getOrFetch(
      key,
      async () => {
        const res = await fetch(
          `https://regim.up.railway.app/api/vol_forecast/${ticker}?period=${period}`,
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