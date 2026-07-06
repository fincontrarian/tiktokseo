import { redis } from "@/lib/redis";

/**
 * Read-through JSON cache. Fails open on Redis errors — a cache outage must
 * never take down a page, we just pay the DB query.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<T> {
  try {
    const hit = await redis.get(key);
    if (hit !== null) return JSON.parse(hit) as T;
  } catch (error) {
    console.warn(`cache: read failed for ${key}`, error);
  }

  const value = await load();

  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (error) {
    console.warn(`cache: write failed for ${key}`, error);
  }
  return value;
}
