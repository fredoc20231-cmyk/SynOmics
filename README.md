# SynOmics — Universal Bioinformatics Platform

A general-purpose, AI-native bioinformatics platform for autonomous multi-omics
analysis. It covers genomics, transcriptomics, proteomics, single-cell biology,
microbiome, GWAS, drug repurposing, clinical genomics, structural biology and
more — across any organism and any biological domain.

**Guiding principle: real computation or an honest "not available" — never a
fabricated result.** Every analysis route either returns a genuinely computed /
fetched value or an explicit error state. There is no `Math.random()` stand-in,
no canned p-values, and no invented multi-model "consensus."

---

## Architecture

```
Browser (React 19 + Vite + Tailwind)
        │  fetch /api/*
        ▼
Express server  (server.ts)  ── Gemini (server-side, @google/genai)
        │  spawn python3 <tool> < stdin(JSON)
        ▼
Real compute engine  (server/synomics_engine.py)
```

- **Frontend** — `src/` : React 19 SPA with ~50 analysis surfaces (sequence
  alignment, single-cell, phylogenetics, mass spec, 3D molecular viewer, GWAS,
  clinical genomics, drug discovery, microbiome, and more).
- **Server** — `server.ts` : Express app exposing ~35 analysis routes plus a
  chat/agent path. It shells out to the Python engine for numerical work and
  uses server-side Gemini for language tasks. Firebase (`src/lib/firebase.ts`)
  provides optional auth + cloud session persistence.
- **Engine** — `server/synomics_engine.py` : ~2,350 lines of dependency-free
  Python implementing the actual algorithms (see below). `biomni_engine.py` is
  kept byte-identical as an alias.

### Verified real algorithms

Validated by execution against published references:

- **Sequence alignment** — Needleman–Wunsch / Smith–Waterman with BLOSUM62.
- **Differential expression** — log2FC + Welch's unequal-variance t-test on
  log2(count+1) with Welch–Satterthwaite df and Benjamini–Hochberg FDR. Exact
  Student's t via the regularized incomplete beta function (matches t-tables:
  t=2.228, df=10 → p=0.0500; t=3.169, df=10 → p=0.0100).
- **Enrichment** — hypergeometric test.
- **Single-cell** — log-CPM, HVG selection, Welch's t markers.
- **Structural** — Ramachandran dihedral geometry + contact maps; physics-based
  in-silico ΔΔG (VdW / electrostatics / solvation / entropy).
- **Phylogenetics** — Jukes–Cantor distance + neighbor-joining, Newick output.
- **Mass spec** — tryptic digest + b/y ion fragmentation.
- **GWAS** — −log10(P), genomic inflation λ_GC, Manhattan / Q–Q, lead loci.
- **Microbiome** — Shannon / Simpson / Chao1 / Pielou, Bray–Curtis, PCoA (MDS).
- **Survival** — Kaplan–Meier with exact χ²(1 df) log-rank.
- **Networks** — topology metrics + Markov clustering (MCL).

---

## Run locally

**Prerequisites:** Node.js 22, Python 3.11 (`python3` on `PATH`).

```bash
npm install
cp .env.example .env      # then set GEMINI_API_KEY for the AI/chat features
npm run dev               # tsx server.ts — serves API + Vite dev frontend
```

The numerical analysis routes and the Python engine work **without** any API
key. `GEMINI_API_KEY` is only needed for the language/chat/agent features; when
it is absent those paths return an honest "not configured" error rather than
fabricated text.

### Build & serve production

```bash
npm run build   # vite build (frontend) + esbuild server → dist/server.mjs
npm start       # node dist/server.mjs
```

The server binds `process.env.PORT` (falling back to `3000`), so it drops
straight into Cloud Run / Heroku / Render / Fly, which inject `$PORT`.

### Container / cloud deployment

A production `Dockerfile` (two-stage Node 22 + Python 3.11) is included:

```bash
# Lean image — the core compute engine is dependency-free:
docker build -t synomics .
# Full platform — also installs the scientific stack for the heavier modules:
docker build -t synomics --build-arg INSTALL_SCIENCE_STACK=true .

docker run -p 8080:8080 -e PORT=8080 -e GEMINI_API_KEY=... synomics
```

The image runs as a non-root user and defines a `HEALTHCHECK` that probes the
real `/api/health` route.

### iDiscover — monumental discovery frontiers

Code-grounded, honest-fallback engines (manifest at `GET /api/synomics/idiscover`):

- **Biological Git** (`POST /api/synomics/idiscover/cellular-reversion`) —
  Optimal-Transport cellular-state reversion. Returns the exact Wasserstein
  "energy" to move a diseased single-cell distribution back to a healthy
  reference, plus the top per-gene *revert commits* from the transport coupling.
  Exact EMD via POT (else numpy Sinkhorn, flagged `approximate`); a strict
  "failed to converge" error on disjoint distributions — never a heuristic guess.
- **GFlowNet** (`POST /api/synomics/idiscover/gflownet-sample`) — generative
  molecular sampling trained with Trajectory Balance, sampling molecules ∝ reward
  for diversity, not a single optimum. Every returned molecule is RDKit-valid
  with a **real computed QED**; invalid samples are discarded. Tabular tier
  (numpy) — a deep neural GFlowNet (torch/GPU) is not claimed.

```bash
pip install numpy pot rdkit
python tests/optimal_transport_smoke.py   # exact Wasserstein recovered analytically
python tests/gflownet_smoke.py            # every candidate RDKit-valid, real QED
```

### Engine smoke tests (no network, real math)

```bash
python -m py_compile server/synomics_engine.py server/biomni_engine.py server/bioOmni_engine.py
echo '{"seq1":"MKTAYIAKQR","seq2":"MKTAYIAKQC","method":"needleman_wunsch","seq_type":"protein"}' \
  | python server/synomics_engine.py align_sequences
```

### Scientific concordance (gold-standard validation)

The engine's statistics are validated against community reference
implementations (scipy / statsmodels) across ~1,200 seeded randomized cases:

```bash
pip install numpy scipy statsmodels
python tests/scientific_validation.py     # writes VALIDATION_REPORT.md
```

Current result: **7/7 statistics concordant** (Welch t-test, Student's t,
Benjamini–Hochberg FDR, hypergeometric enrichment, Jukes–Cantor) to ≤1e-10 — see
[`VALIDATION_REPORT.md`](./VALIDATION_REPORT.md).

### Verifiable-AI engines (the decision is math, not the LLM)

A "Zero-Fake" layer where every verdict is produced by deterministic code:

- **Adversarial validation** — `POST /api/synomics/adversarial-validate`: a
  label-permutation null tests whether a differential-expression signal survives
  random relabelling; returns VALIDATED / INVALIDATED / INCONCLUSIVE + confidence
  + auto-veto. Verified: real signal validated, pure noise never validated.
- **Neuro-symbolic pathway solver** — `POST /api/synomics/pathway-logic`: a
  deterministic boolean logic solver (AND/OR/NOT over gene up/down states)
  returns SATISFIABLE / UNSATISFIABLE with a proof trace; missing genes stay
  neutral (never fabricated as active).
- **Causal discovery** — `POST /api/synomics/causal-discovery`: DirectLiNGAM
  (numpy) infers a directed causal graph with bootstrap-stability-gated edges;
  validated to recover known DAGs.
- **Tensor-Train compression** — `POST /api/synomics/tensor-compress`: an
  error-bounded compression utility with an honest "approximate" flag (not a cell
  simulator).

Run the Verifiable-AI test gates:

```bash
pip install numpy scipy statsmodels tensorly
python tests/causal_smoke.py
python tests/tensor_smoke.py
```

### Provenance / audit trail (Module C)

Every analytical request is recorded as an immutable append-only JSONL line
(`SYNOMICS_AUDIT_LOG`) with tool, params (large/sensitive inputs hashed, not
copied), input/output SHA-256, status and timing; read recent records at
`GET /api/synomics/audit-log`.

CI (`.github/workflows/ci.yml`) runs the type-check, the full build, the Python
compile, the engine/agent/external-DB/audit test suites, and the scientific
concordance gate on every push and pull request.

---

## Honesty guardrail

A feature ships only when it returns real computed/fetched results or an
explicit "not available / provide input" state. This is the line that keeps the
platform credible as a scientific instrument. See
[`SYNOMICS_FIXES_REPORT.md`](./SYNOMICS_FIXES_REPORT.md) for the de-faking work
already done and [`INTEGRATION_ROADMAP.md`](./INTEGRATION_ROADMAP.md) for the
plan to reach Biomni-class capability (real external databases, a hardened
code-execution sandbox, and a genuine plan→run→iterate agent loop).

## Repository layout

| Path | What |
| --- | --- |
| `src/` | React frontend (components, data, lib, utils) |
| `server.ts` | Express API server |
| `server/synomics_engine.py` | Real compute engine (algorithms) |
| `server/grounded_multi_agent.ts` | Agent scaffold (being upgraded to a real tool-use loop) |
| `docs/directives/` | Build/anti-fabrication directives |
| `legacy/` | Prior science-first frontend-shell design docs, retained for provenance |
| `.github/workflows/ci.yml` | Build + engine verification CI |

## Known remaining work

Tracked in detail in `SYNOMICS_FIXES_REPORT.md` and `INTEGRATION_ROADMAP.md`.
Highlights: real external database integrations (Ensembl, UniProt, ClinVar,
Open Targets, ChEMBL), real docking/ADMET workers (AutoDock Vina / RDKit,
infra-gated), a hardened `python-exec` sandbox, and a real multi-step agent
loop — plus removing the last frontend placeholder data (e.g. `DrugDiscoveryMode`).
