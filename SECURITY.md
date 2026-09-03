# Security Policy — SynOmics

## Reporting a vulnerability

Please report suspected vulnerabilities privately. Do **not** open a public issue
for security reports. Email the maintainers with:

- a description of the issue and its impact,
- steps to reproduce (a minimal proof-of-concept if possible),
- affected route/module and version (`GET /api/version`).

You will receive an acknowledgement, and we will coordinate a fix and disclosure
timeline with you.

## Handling of data and secrets

- **No secrets in the repo.** `.env` is git-ignored; only `.env.example` (with
  placeholder values) is committed. Configure real secrets via environment
  variables at deploy time.
- **Sandboxed code execution.** `POST /api/synomics/python-exec` runs code through
  `server/sandbox_runner.py`, which enforces OS resource limits (CPU, memory,
  file size), a wall-clock timeout, an isolated temp working directory, and a
  **stripped environment** — server secrets (e.g. `GEMINI_API_KEY`) are not
  exposed to executed code. Kernel network namespacing / seccomp are **not**
  applied (they require root/unshare); outbound network from sandboxed code is
  governed by the deployment's egress policy, not blocked at the app layer. Treat
  this endpoint as privileged and gate it appropriately in production.
- **Rate limiting & headers.** The API applies a per-IP rate limit and security
  headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, HSTS in production). `x-powered-by` is disabled.
- **Egress policy.** External database calls go to real public APIs. The platform
  never routes around a blocked host or fabricates a fallback result — a blocked
  host returns an honest error.

## Zero-hallucination guarantee

Analytical results are computed by real code on real data or fetched from a real
source. Values that cannot be computed/fetched are returned as an explicit
"not available" — the platform does not emit placeholder numbers. This is enforced
by the engines and covered by the CI test suites.

## Supported versions

The latest `main` is supported. Security fixes are applied to `main` and released
as a new version.
