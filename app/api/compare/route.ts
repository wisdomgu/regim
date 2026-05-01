import { getCached, setCached } from "@/lib/cache";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "6mo";

  const key = `compare:${period}`;
  const cached = getCached(key);
  if (cached) return Response.json(cached);

  try {
      const res = await fetch(
        `http://localhost:8000/api/compare?period=${period}`,
        { cache: "no-store", signal: AbortSignal.timeout(240000) }
      );

      const text = await res.text();
      console.log("Compare status:", res.status);
      console.log("Compare body:", text.slice(0, 300));

      if (!res.ok) {
        return Response.json({ error: `Backend error: ${res.status}`, detail: text }, { status: 502 });
      }

      const data = JSON.parse(text);
      if (data && !data.error && Object.keys(data).length > 0) {
        setCached(key, data, 30 * 60 * 1000);
      }
      return Response.json(data);
} catch (err) {
  console.error("Compare fetch error:", err);
  return Response.json({ error: "Backend unavailable" }, { status: 503 });
}
}