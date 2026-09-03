/**
 * End-to-end integration test: boots the built production server (dist/server.mjs)
 * and exercises the wired HTTP stack — health/version/ready, security headers,
 * rate-limit headers, JSON 404, metrics, and a REAL engine route (federated-zkp,
 * stdlib-only so no heavy deps are needed at this CI step).
 *
 * Prereq: `npm run build` has produced dist/server.mjs (CI runs build first).
 * Run: `npx tsx tests/server_integration.ts`
 */
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

const ROOT = path.dirname(new URL(import.meta.url).pathname).replace(/\/tests$/, '');
const BUNDLE = path.join(ROOT, 'dist', 'server.mjs');
const PORT = 3987;
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0;
function check(name: string, cond: boolean, ctx?: any) {
  if (!cond) { console.error(`FAIL: ${name}`, ctx ?? ''); throw new Error(name); }
  passed++; console.log(`ok: ${name}`);
}

async function waitForHealth(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('server did not become healthy in time');
}

async function main() {
  if (!existsSync(BUNDLE)) {
    console.error(`SKIP: ${BUNDLE} not found — run "npm run build" first.`);
    process.exit(0);
  }

  const srv = spawn('node', [BUNDLE], {
    env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT) },
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  try {
    await waitForHealth();

    // health + version
    const health = await (await fetch(`${BASE}/api/health`)).json();
    check('health status ok', health.status === 'ok' && !!health.version, health);
    const version = await (await fetch(`${BASE}/api/version`)).json();
    check('version reports name + version', version.name === 'SynOmics' && !!version.version, version);

    // readiness probes the real python engine
    const ready = await fetch(`${BASE}/api/ready`);
    const readyBody = await ready.json();
    check('ready: python engine invokable', ready.status === 200 && readyBody.pythonEngine === true, readyBody);

    // security + rate-limit headers
    const h = (await fetch(`${BASE}/api/health`)).headers;
    check('security header nosniff', h.get('x-content-type-options') === 'nosniff');
    check('security header frame options', h.get('x-frame-options') === 'SAMEORIGIN');
    check('rate-limit header present', !!h.get('x-ratelimit-limit'));
    check('x-powered-by disabled', !h.get('x-powered-by'));

    // JSON 404 for unmatched API route (not the SPA fallback)
    const nf = await fetch(`${BASE}/api/nope-xyz`);
    const nfBody = await nf.json();
    check('api 404 is JSON', nf.status === 404 && nfBody.status === 'error', nfBody);

    // a REAL engine route end-to-end (stdlib-only federated ZKP)
    const zkp = await fetch(`${BASE}/api/synomics/idiscover/federated-zkp`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sites: [
        { name: 'A', durations: [5, 8, 2, 9, 3, 11, 4, 7], events: [1, 1, 1, 0, 1, 0, 1, 1], groups: [1, 0, 1, 0, 1, 0, 1, 0] },
        { name: 'B', durations: [3, 10, 6, 12, 2, 14, 5, 9], events: [1, 0, 1, 0, 1, 0, 1, 1], groups: [1, 0, 1, 0, 1, 0, 1, 0] },
      ] }),
    });
    const zkpBody = await zkp.json();
    check('real engine route returns computed + verified result', zkp.status === 200 && zkpBody.status === 'success' && zkpBody.verified === true, zkpBody);

    // input validation: malformed body -> honest error, not a crash
    const bad = await fetch(`${BASE}/api/synomics/idiscover/federated-zkp`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sites: [] }),
    });
    check('malformed engine input -> honest 4xx', bad.status >= 400 && bad.status < 500);

    // metrics reflect the traffic we just generated
    const metrics = await (await fetch(`${BASE}/api/metrics`)).json();
    check('metrics tracked requests', metrics.status === 'success' && metrics.totalRequests > 0, metrics);

    console.log(`\nALL ${passed} SERVER INTEGRATION TESTS PASSED`);
  } finally {
    srv.kill('SIGTERM');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
