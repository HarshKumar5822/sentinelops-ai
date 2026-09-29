'use strict';
/** Tiny fixed-window rate limiter (per IP). Protects your Groq quota. */
module.exports = function rateLimit({ perMinute = 60 } = {}) {
  const hits = new Map();
  setInterval(() => hits.clear(), 60_000).unref();
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const n = (hits.get(ip) || 0) + 1;
    hits.set(ip, n);
    if (n > perMinute) {
      res.set('Retry-After', '30');
      return res.status(429).json({ error: { code: 'rate_limited', message: 'Too many requests. Slow down for a moment.' } });
    }
    next();
  };
};
