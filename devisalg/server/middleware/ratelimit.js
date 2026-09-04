// Simple in-memory sliding-window rate limiter keyed by IP + route.
// Suitable for a single-instance deployment; for multi-instance scale,
// swap this for a Redis-backed limiter behind the same interface.
const buckets = new Map();

function rateLimit({ windowMs = 60 * 1000, max = 60, key = (req) => req.ip } = {}) {
  return (req, res, next) => {
    const k = `${key(req)}:${req.path}`;
    const now = Date.now();
    const bucket = buckets.get(k) || { times: [] };
    bucket.times = bucket.times.filter((t) => now - t < windowMs);
    if (bucket.times.length >= max) {
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    bucket.times.push(now);
    buckets.set(k, bucket);
    next();
  };
}

// Stricter limiter for auth endpoints (login/register)
const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });

module.exports = { rateLimit, authLimiter, apiLimiter };
