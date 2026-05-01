import { getCached, setCached } from "@/lib/cache";
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker") || "SPY";
  const period = searchParams.get("period") || "6mo";

  const key = `shap:${ticker}:${period}`;
  const cached = getCached(key);
  if (cached) return Response.json(cached);

  try {
    const backendUrl = `http://localhost:8000/api/shap/${ticker}?period=${period}`;
    console.log("Calling backend:", backendUrl);

    const res = await fetch(backendUrl, { cache: "no-store" });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Backend error:", errText);
      return Response.json(
        { error: "Backend error", detail: errText },
        { status: res.status }
      );
    }

    const data = await res.json();

    setCached(key, data, 30 * 60 * 1000);
    return Response.json(data);

  } catch (err) {
    console.error(err);
    return Response.json({ error: "Backend unavailable." }, { status: 503 });
  }
}