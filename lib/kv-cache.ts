import { kv } from '@vercel/kv'

export const KV_PREFIX = 'magical:'

interface MemoryEntry {
  value: unknown
  expiry: number
}

const memoryStore = new Map<string, MemoryEntry>()

const DEFAULT_TTL_SECONDS = 60

function hasKVConfig() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

function memoryGet<T>(key: string): T | null {
  const entry = memoryStore.get(key)

  if (!entry) return null
  if (entry.expiry <= Date.now()) {
    memoryStore.delete(key)
    return null
  }

  return entry.value as T
}

function memorySet(key: string, value: unknown, ttlSeconds: number) {
  memoryStore.set(key, {
    value,
    expiry: Date.now() + Math.max(1, ttlSeconds) * 1000,
  })

  if (memoryStore.size > 500) {
    const now = Date.now()
    for (const [staleKey, entry] of memoryStore) {
      if (entry.expiry <= now) {
        memoryStore.delete(staleKey)
      }
    }
  }
}

function memoryDelete(key: string) {
  memoryStore.delete(key)
}

function memoryDeletePrefix(prefix: string) {
  for (const key of Array.from(memoryStore.keys())) {
    if (key.startsWith(prefix)) {
      memoryStore.delete(key)
    }
  }
}

/**
 * Cache helper that transparently uses Vercel KV (Redis) when configured and
 * falls back to an in-memory store otherwise. All keys are namespaced so they
 * cannot collide with other parts of the app.
 */
export async function kvCacheGet<T>(key: string): Promise<T | null> {
  if (!hasKVConfig()) {
    return memoryGet<T>(KV_PREFIX + key)
  }

  try {
    return await kv.get<T>(KV_PREFIX + key)
  } catch (error) {
    console.warn('KV cache read failed, falling back to memory:', error)
    return memoryGet<T>(KV_PREFIX + key)
  }
}

export async function kvCacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<void> {
  if (!hasKVConfig()) {
    memorySet(KV_PREFIX + key, value, ttlSeconds)
    return
  }

  try {
    await kv.set(KV_PREFIX + key, value, { ex: Math.max(1, ttlSeconds) })
  } catch (error) {
    console.warn('KV cache write failed, falling back to memory:', error)
    memorySet(KV_PREFIX + key, value, ttlSeconds)
  }
}

export async function kvCacheDelete(key: string): Promise<void> {
  if (!hasKVConfig()) {
    memoryDelete(KV_PREFIX + key)
    return
  }

  try {
    await kv.del(KV_PREFIX + key)
  } catch (error) {
    console.warn('KV cache delete failed:', error)
    memoryDelete(KV_PREFIX + key)
  }
}

export async function kvCacheDeletePrefix(prefix: string): Promise<void> {
  if (!hasKVConfig()) {
    memoryDeletePrefix(KV_PREFIX + prefix)
    return
  }

  try {
    const keys = await kv.keys(KV_PREFIX + prefix + '*')
    if (keys.length > 0) {
      await kv.del(...keys)
    }
  } catch (error) {
    console.warn('KV cache prefix delete failed:', error)
    memoryDeletePrefix(KV_PREFIX + prefix)
  }
}
