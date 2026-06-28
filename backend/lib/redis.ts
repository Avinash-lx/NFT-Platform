import Redis from "ioredis";
import { config } from "../config";

/**
 * Shared Redis connection used for caching marketplace listings, portfolio
 * stats, and rate-limit counters. Lazy-connects so the API can boot without
 * Redis in local dev (cache helpers degrade gracefully).
 */
export const redis = new Redis(config.redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 2,
  enableOfflineQueue: false,
});

redis.on("error", (err) => {
  // Don't crash the process if the cache is unavailable.
  console.warn("[redis] connection error:", err.message);
});

/** Get a cached JSON value, or null on miss / error. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Set a cached JSON value with a TTL (seconds). Best-effort. */
export async function cacheSet(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    /* ignore cache write failures */
  }
}

/** Invalidate one or more cache keys. Best-effort. */
export async function cacheDel(...keys: string[]): Promise<void> {
  try {
    if (keys.length) await redis.del(...keys);
  } catch {
    /* ignore */
  }
}
