// ─────────────────────────────────────────────────────────────────────────────
//  Lightweight in-memory fixed-window rate limiter.
//
//  ⚠️ This is per-server-instance. On serverless (Netlify/Vercel) each instance
//  has its own memory, so it's best-effort — good enough to blunt casual abuse,
//  NOT a substitute for a distributed limiter. For real protection in production
//  use Upstash Redis (@upstash/ratelimit) keyed by user id / IP.
// ─────────────────────────────────────────────────────────────────────────────

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 }
  }
  if (b.count >= limit) {
    return { ok: false, remaining: 0, retryAfterMs: b.resetAt - now }
  }
  b.count++
  return { ok: true, remaining: limit - b.count, retryAfterMs: 0 }
}

// Opportunistic cleanup so the map doesn't grow unbounded.
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    buckets.forEach((v, k) => { if (now > v.resetAt) buckets.delete(k) })
  }, 60_000).unref?.()
}
