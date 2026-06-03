interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expiry > Date.now()) {
    return entry.data;
  }
  if (entry) {
    cache.delete(key);
  }
  return null;
}

export function setInCache<T>(key: string, data: T, durationMs: number = CACHE_DURATION_MS): void {
  const expiry = Date.now() + durationMs;
  cache.set(key, { data, expiry });
}

export function invalidateCache(key: string | RegExp): void {
  if (typeof key === 'string') {
    cache.delete(key);
  } else {
    for (const k of Array.from(cache.keys())) {
      if (key.test(k)) {
        cache.delete(k);
      }
    }
  }
}

export function clearCache(): void {
  cache.clear();
}
