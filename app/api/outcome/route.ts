import { getOrFetch } from "@/lib/cache";

const TTL = 5 * 60 * 1000; 

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker") || "SPY";
  const period = searchParams.get("period") || "6mo";
  const key    = `outcome:${ticker}:${period}`;

  try {
    const data = await getOrFetch(
      key,
      async () => {
        const res = await fetch(
          `https://regim.up.railway.app/api/outcome/${ticker}?period=${period}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          const detail = await res.text();
          throw new Error(`Backend ${res.status}: ${detail}`);
        }
        return res.json();
      },
      TTL
    );
    return Response.json(data);
  } catch (err: any) {
    console.error("[/api/outcome]", err?.message ?? err);
    const status = err?.message?.includes("Backend 4") ? 400 : 503;
    return Response.json({ error: err?.message ?? "Backend unavailable." }, { status });
  }
}