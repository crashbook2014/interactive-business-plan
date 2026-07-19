// Security headers, per-IP rate limiting, HTTPS fail-fast off-localhost.

export function securityHeaders(req, res, next) {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

// Redirect / refuse plain HTTP when not on localhost (behind a proxy we trust
// x-forwarded-proto, which Cloud Run / Render set).
export function httpsEnforce(req, res, next) {
  const host = (req.headers.host || '').split(':')[0];
  const local = host === 'localhost' || host === '127.0.0.1';
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (!local && !isHttps && process.env.NODE_ENV === 'production') {
    return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
  }
  next();
}

// Simple sliding-window per-IP rate limiter (in-memory).
const buckets = new Map();
export function rateLimit({ windowMs = 60_000, max = 300 } = {}) {
  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
    const now = Date.now();
    let b = buckets.get(ip);
    if (!b || now - b.start > windowMs) { b = { start: now, count: 0 }; buckets.set(ip, b); }
    b.count++;
    if (buckets.size > 10_000) buckets.clear(); // crude memory bound
    if (b.count > max) {
      res.setHeader('Retry-After', Math.ceil((b.start + windowMs - now) / 1000));
      return res.status(429).json({ error: 'Too many requests' });
    }
    next();
  };
}
