/**
 * Production hardening middleware for the SynOmics API — dependency-free.
 *
 * Provides security headers, an in-memory per-IP rate limiter, lightweight request
 * metrics, and centralized 404 / error handlers. Everything here is real and
 * self-contained (no external packages), so it works in the locked-down build.
 */
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------- request id
/** Attach a correlation id to every request (honor an inbound X-Request-Id, else
 *  generate one) and echo it back, so logs and clients can correlate a call. */
export function requestId() {
  return (req: Request, res: Response, next: NextFunction) => {
    const incoming = (req.headers['x-request-id'] as string | undefined)?.slice(0, 128);
    const id = incoming && /^[\w.-]+$/.test(incoming) ? incoming : randomUUID();
    (req as any).id = id;
    res.setHeader('X-Request-Id', id);
    next();
  };
}

/** Structured JSON access log for the API surface (one line per finished request).
 *  Container log drivers ingest stdout; keeps static-asset noise out by default. */
export function accessLog(opts?: { apiOnly?: boolean }) {
  const apiOnly = opts?.apiOnly ?? true;
  return (req: Request, res: Response, next: NextFunction) => {
    if (apiOnly && !req.path.startsWith('/api')) return next();
    const start = Date.now();
    res.on('finish', () => {
      const ip = (req.headers['x-forwarded-for'] as string || '').split(',')[0].trim() || req.socket.remoteAddress || '';
      const line = {
        t: new Date().toISOString(),
        id: (req as any).id,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        ms: Date.now() - start,
        ip,
      };
      console.log(JSON.stringify(line));
    });
    next();
  };
}

// ---------------------------------------------------------------- security headers
/** Conservative, SPA-safe security headers. No strict CSP (would break the Vite
 *  bundle's inline styles); the headers set here are safe for a same-origin app. */
export function securityHeaders() {
  const isProd = process.env.NODE_ENV === 'production';
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(self), camera=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    if (isProd) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  };
}

// ---------------------------------------------------------------- rate limiting
interface Bucket { count: number; resetAt: number; }
const buckets = new Map<string, Bucket>();

/** Fixed-window in-memory rate limiter keyed by client IP. Suitable for a single
 *  instance; behind a multi-instance LB, swap the store for Redis. */
export function rateLimit(opts?: { windowMs?: number; max?: number }) {
  const windowMs = opts?.windowMs ?? 60_000;
  const max = opts?.max ?? 120;
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = (req.headers['x-forwarded-for'] as string || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let b = buckets.get(ip);
    if (!b || now >= b.resetAt) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, b);
    }
    b.count += 1;
    const remaining = Math.max(0, max - b.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(b.resetAt / 1000)));
    if (b.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((b.resetAt - now) / 1000)));
      return res.status(429).json({ status: 'error', error: 'Rate limit exceeded. Slow down and retry shortly.' });
    }
    next();
  };
}

/** Periodically evict stale buckets so the map cannot grow unbounded. */
export function startRateLimitSweeper(intervalMs = 300_000): NodeJS.Timeout {
  const t = setInterval(() => {
    const now = Date.now();
    for (const [ip, b] of buckets) if (now >= b.resetAt) buckets.delete(ip);
  }, intervalMs);
  t.unref?.();
  return t;
}

// ---------------------------------------------------------------- metrics
interface RouteStat { count: number; errors: number; totalMs: number; maxMs: number; }
const routeStats = new Map<string, RouteStat>();
let totalRequests = 0;
let totalErrors = 0;
const startedAt = Date.now();

/** Record per-request count / latency / error, keyed by method + route pattern. */
export function requestMetrics() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    totalRequests += 1;
    res.on('finish', () => {
      const key = `${req.method} ${req.baseUrl || ''}${req.route?.path || req.path}`;
      const s = routeStats.get(key) || { count: 0, errors: 0, totalMs: 0, maxMs: 0 };
      const ms = Date.now() - start;
      s.count += 1;
      s.totalMs += ms;
      s.maxMs = Math.max(s.maxMs, ms);
      if (res.statusCode >= 500) { s.errors += 1; totalErrors += 1; }
      routeStats.set(key, s);
    });
    next();
  };
}

export function metricsSnapshot() {
  const routes: Record<string, any> = {};
  for (const [k, s] of routeStats) {
    routes[k] = { count: s.count, errors: s.errors, avgMs: Math.round(s.totalMs / Math.max(1, s.count)), maxMs: s.maxMs };
  }
  return {
    status: 'success',
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    totalRequests,
    totalErrors,
    memoryMB: Math.round(process.memoryUsage().rss / 1e6),
    routes,
  };
}

// ---------------------------------------------------------------- 404 + errors
/** JSON 404 for unmatched /api routes (so the SPA catch-all never swallows them). */
export function apiNotFound() {
  return (req: Request, res: Response) => {
    res.status(404).json({ status: 'error', error: `No API route for ${req.method} ${req.originalUrl}` });
  };
}

/** Centralized error handler — never leak stack traces to clients in production. */
export function errorHandler() {
  return (err: any, _req: Request, res: Response, _next: NextFunction) => {
    const isProd = process.env.NODE_ENV === 'production';
    console.error('[SynOmics] Unhandled error:', err?.stack || err);
    if (res.headersSent) return;
    res.status(err?.status || 500).json({
      status: 'error',
      error: isProd ? 'Internal server error.' : String(err?.message || err),
    });
  };
}
