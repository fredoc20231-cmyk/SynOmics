# Contributing to SynOmics

SynOmics is an Advanced Bioinformatics Platform built on one binding rule:
**real computation or an honest "not available" — never a fabricated result.**
Please read [`CLAUDE.md`](./CLAUDE.md) before contributing; its prime directives
are enforced, not aspirational.

## Ground rules

1. **Zero hallucination.** Every analytical value must be produced by executing
   real code on real data, or fetched from a real source. If it can't be computed
   or fetched, return an explicit "not available"/honest error — no placeholder
   numbers, no canned "consensus", no demo data served to users. Test fixtures
   live only under `tests/`.
2. **Verify before ship.** Do not claim a code path works unless it has been run.
   New engines must ship with a test that checks the result against known ground
   truth (analytic value, reference implementation, or a falsifiable property).
3. **Honest scope.** If a capability needs a backend not available in this build
   (GPU, external weights, open network), make it fail honestly at runtime and
   document the boundary — do not fake it.
4. **UI palette.** New/changed frontend uses `#FFFFFF` / `#0A192F` / `#00B4D8` /
   `#F8F9FA`, with Inter/Roboto for prose and Fira Code/JetBrains Mono for data.

## Architecture

```
React 19 + Vite + Tailwind (src/)  ──fetch /api/*──▶  Express (server.ts)
                                                         │ spawn python3 < stdin(JSON)
                                                         ▼
                              Dependency-free engine (server/synomics_engine.py)
                              + per-capability modules (server/*.py)
```

- Heavy/optional engines live in dedicated `server/*.py` modules invoked via
  `runPythonScript` (stdin JSON → stdout JSON), each with an honest "unavailable"
  fallback when its dependency is missing.
- `server/synomics_engine.py` and `server/biomni_engine.py` are kept
  **byte-identical** — run `cp server/synomics_engine.py server/biomni_engine.py`
  after editing the engine.

## Local development

```bash
npm install
cp .env.example .env        # set GEMINI_API_KEY for AI/chat features (optional)
npm run dev                 # API + Vite frontend
npm run build               # production build (frontend + dist/server.mjs)
npm run lint                # tsc --noEmit
```

## Before opening a PR — the checks CI runs

```bash
npm run build                       # type-check + bundle must pass
npm run lint                        # tsc --noEmit
python -m ruff check server tests   # Python lint gate
python tests/engine_smoke.py
npx tsx tests/agent_smoke.ts
# plus the per-engine suites under tests/ (see .github/workflows/ci.yml)
```

Every new `server/*.py` engine should add: a route in `server.ts`, a tool in
`server/tool_registry.ts` (if agent-invokable), a `tests/*_smoke.py|ts` suite, and
a CI gate in `.github/workflows/ci.yml`. Keep commits focused and describe what was
verified in the message.
