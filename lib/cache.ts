interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

const cache    = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<any>>();

export function getCached(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCached(key: string, data: any, ttl = 60 * 60 * 1000): void {
  cache.set(key, { data, timestamp: Date.now(), ttl });
}

export async function getOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number
): Promise<T> {
  const cached = getCached(key);
  if (cached) return cached as T;
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fetcher()
    .then(data => {
      setCached(key, data, ttl);
      inFlight.delete(key);
      return data;
    })
    .catch(err => {
      inFlight.delete(key);
      throw err;
    });

  inFlight.set(key, promise);
  return promise;
}