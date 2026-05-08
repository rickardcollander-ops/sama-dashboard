/**
 * IP-based rate limiter for auth-sensitive endpoints.
 *
 * Default backend: in-memory map (single-process). For multi-replica
 * deployments set RATE_LIMIT_BACKEND=upstash and provide UPSTASH_REDIS_REST_URL
 * and UPSTASH_REDIS_REST_TOKEN. The in-memory backend is best-effort under
 * Vercel's serverless model (each lambda has its own memory) but still
 * effective for the common case where one IP hits one lambda repeatedly.
 */

type Backend = "memory" | "upstash";

const BACKEND: Backend =
  (process.env.RATE_LIMIT_BACKEND as Backend) || "memory";

interface Bucket {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, Bucket>();

function memoryCheck(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = memoryStore.get(key);

  if (!bucket || bucket.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: limit - bucket.count,
    retryAfter: 0,
  };
}

async function upstashCheck(key: string, limit: number, windowMs: number) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return memoryCheck(key, limit, windowMs);

  const ttl = Math.ceil(windowMs / 1000);
  const cmd = ["INCR", key];
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify([cmd, ["EXPIRE", key, ttl, "NX"]]),
  });
  if (!res.ok) return memoryCheck(key, limit, windowMs);

  const data = (await res.json()) as Array<{ result: number }>;
  const count = data[0]?.result ?? 0;
  if (count > limit) {
    return { allowed: false, remaining: 0, retryAfter: ttl };
  }
  return { allowed: true, remaining: limit - count, retryAfter: 0 };
}

export async function rateLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  if (BACKEND === "upstash") return upstashCheck(opts.key, opts.limit, opts.windowMs);
  return memoryCheck(opts.key, opts.limit, opts.windowMs);
}

export function clientIp(req: { headers: Headers }): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
