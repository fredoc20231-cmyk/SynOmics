/**
 * Deterministic tests for the production-hardening middleware (no network, no server).
 * Exercises the real middleware with lightweight Express-shaped mocks.
 * Run: `npx tsx tests/production_smoke.ts`
 */
import { securityHeaders, rateLimit, requestMetrics, metricsSnapshot, apiNotFound, errorHandler, requestId } from '../server/production.ts';

let passed = 0;
function check(name: string, cond: boolean) {
  if (!cond) { console.error(`FAIL: ${name}`); process.exit(1); }
  passed++; console.log(`ok: ${name}`);
}

function mockRes() {
  const res: any = {
    headers: {} as Record<string, string>,
    statusCode: 200,
    finished: false,
    _json: undefined,
    _finishCbs: [] as (() => void)[],
    setHeader(k: string, v: any) { this.headers[k.toLowerCase()] = String(v); },
    status(c: number) { this.statusCode = c; return this; },
    json(o: any) { this._json = o; this.finished = true; this._finishCbs.forEach((f) => f()); return this; },
    on(ev: string, cb: () => void) { if (ev === 'finish') this._finishCbs.push(cb); },
    get headersSent() { return this.finished; },
  };
  return res;
}
function mockReq(over: any = {}) {
  return { method: 'GET', path: '/api/x', originalUrl: '/api/x', baseUrl: '', headers: {}, socket: { remoteAddress: '10.0.0.1' }, ...over };
}

// 1. Security headers are applied and x-powered-by is not set here.
{
  const res = mockRes();
  let nexted = false;
  securityHeaders()(mockReq() as any, res as any, () => { nexted = true; });
  check('security: nosniff set', res.headers['x-content-type-options'] === 'nosniff');
  check('security: frame options SAMEORIGIN', res.headers['x-frame-options'] === 'SAMEORIGIN');
  check('security: referrer policy set', res.headers['referrer-policy'] === 'strict-origin-when-cross-origin');
  check('security: calls next', nexted);
}

// 2. Rate limiter allows up to max, then 429 with headers.
{
  const rl = rateLimit({ windowMs: 60_000, max: 3 });
  const ip = '203.0.113.7';
  let allowed = 0; let blocked = 0;
  for (let i = 0; i < 5; i++) {
    const res = mockRes();
    let nexted = false;
    rl(mockReq({ headers: { 'x-forwarded-for': ip } }) as any, res as any, () => { nexted = true; });
    if (nexted) allowed++;
    if (res.statusCode === 429) blocked++;
  }
  check('rate limit: exactly max allowed', allowed === 3);
  check('rate limit: excess blocked with 429', blocked === 2);
}

// 3. Metrics record a finished request.
{
  const mw = requestMetrics();
  const res = mockRes();
  mw(mockReq({ method: 'POST', path: '/api/test-metric' }) as any, res as any, () => {});
  res.statusCode = 200;
  res.json({ ok: true }); // triggers 'finish'
  const snap = metricsSnapshot();
  check('metrics: totalRequests increments', snap.totalRequests >= 1);
  check('metrics: snapshot has routes + memory', typeof snap.memoryMB === 'number' && typeof snap.routes === 'object');
}

// 4. API 404 returns structured JSON.
{
  const res = mockRes();
  apiNotFound()(mockReq({ method: 'GET', originalUrl: '/api/nope' }) as any, res as any);
  check('404: status 404', res.statusCode === 404);
  check('404: honest error body', res._json?.status === 'error' && /No API route/.test(res._json?.error));
}

// 5. Error handler hides details in production, exposes in dev.
{
  process.env.NODE_ENV = 'production';
  const res = mockRes();
  errorHandler()(new Error('secret stack detail'), mockReq() as any, res as any, () => {});
  check('error handler: 500 in prod', res.statusCode === 500);
  check('error handler: no leak in prod', res._json?.error === 'Internal server error.');
  delete process.env.NODE_ENV;
  const res2 = mockRes();
  errorHandler()(Object.assign(new Error('boom'), { status: 400 }), mockReq() as any, res2 as any, () => {});
  check('error handler: respects err.status', res2.statusCode === 400);
  check('error handler: exposes message in dev', res2._json?.error === 'boom');
}

// 6. Request id: honors a safe inbound id, generates one otherwise.
{
  const res = mockRes();
  requestId()(mockReq({ headers: { 'x-request-id': 'trace-abc.123' } }) as any, res as any, () => {});
  check('request id: honors safe inbound id', res.headers['x-request-id'] === 'trace-abc.123');
  const res2 = mockRes();
  const req2: any = mockReq({ headers: { 'x-request-id': 'bad id with spaces!' } });
  requestId()(req2, res2 as any, () => {});
  check('request id: rejects unsafe inbound, generates one', !!res2.headers['x-request-id'] && res2.headers['x-request-id'] !== 'bad id with spaces!');
  check('request id: attaches id to req', typeof req2.id === 'string' && req2.id.length > 0);
}

console.log(`\nALL ${passed} PRODUCTION-HARDENING TESTS PASSED`);
