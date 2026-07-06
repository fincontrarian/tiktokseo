import { redis } from "@/lib/redis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Fixed-window rate limit backed by Redis. Fails open: if Redis is
 * unreachable, the request is allowed — the free audit is an acquisition
 * surface and must not go down with the cache.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  } catch (error) {
    console.warn("rate-limit: redis unavailable, failing open", error);
    return { allowed: true, remaining: limit };
  }
}
