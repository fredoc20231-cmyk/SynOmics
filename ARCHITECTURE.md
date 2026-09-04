# SynOmics — Platform Architecture

A layered architecture for the Advanced Bioinformatics Platform ("Aistudio Core";
citation name **Synapse**). This document maps each layer to the **real files that
implement it** and marks honestly what runs today vs. what is deployment-gated —
under the repository's zero-hallucination mandate, nothing here is claimed working
that has not been run.

```
┌──────────────────────────────────────────────────────────────┐
│                        User Interface                          │
│  React 19 + Vite + Tailwind (§2 palette)                       │
│  Analysis Hub · Results/Outcome panels · Reports · iDiscover   │
│  src/components/*.tsx (AdvancedReasoningMode, DagWorkflow-      │
│  Studio, IDiscoverPanel, BioOmniAgentWorkspace, …)             │
└───────────────────────────────┬──────────────────────────────┘
                                 │  HTTP (Express) — server.ts
┌───────────────────────────────▼──────────────────────────────┐
│                   Orchestration Layer (LLM)                    │
│  Intent · Planning · Tool Routing · Progress · Verification    │
│  server/agent_executor.ts  (real tool-use loop)               │
│  server/grounded_multi_agent.ts  (grounded multi-agent)       │
│  → /api/synomics/agent-execute                                 │
└──────┬────────────┬────────────┬────────────┬────────────────┘
       │            │            │            │
┌──────▼───┐ ┌──────▼────┐ ┌─────▼─────┐ ┌────▼──────────────┐
│ Compute  │ │ Storage   │ │ HPC / Jobs│ │ Databases         │
│ Layer    │ │ Layer     │ │ Layer     │ │ Layer             │
│          │ │           │ │           │ │                   │
│ Python   │ │ outcome_  │ │ tool_     │ │ external_db.ts    │
│ engine   │ │ bundle.py │ │ registry  │ │ Ensembl · MyGene  │
│ (193     │ │ (figs/    │ │ (.ts, 193 │ │ UniProt · VEP     │
│ tools)   │ │ tables/   │ │ tools) +  │ │ (egress-gated)    │
│ sandbox_ │ │ report/   │ │ rnaseq    │ │ + Terraform GCS/  │
│ runner.py│ │ MANIFEST) │ │ upstream  │ │ Filestore/BigQuery│
│ (RLIMITs)│ │ audit.ts  │ │ orchestr. │ │ (DEPLOYMENT.md)   │
│          │ │ provenance│ │ (deploy-  │ │                   │
│          │ │ .py       │ │ gated)    │ │                   │
└──────────┘ └───────────┘ └───────────┘ └───────────────────┘
       │            │            │
       └────────────┴────────────┘
                    │
┌───────────────────▼──────────────────────────────────────────┐
│                       Skills System                            │
│  Curated multi-tool workflows · SKILL.md · declarative steps   │
│  · CI tests. server/skills_registry.ts + skills/<name>/        │
│  → /api/synomics/skills (list) · /api/synomics/skill-run       │
└───────────────────────────────────────────────────────────────┘
```

---

## Layer-by-layer status (honest)

### 1. User Interface — ✅ real
- React 19 + Vite + Tailwind, SynOmics §2 palette. ~40 components under
  `src/components/` (Analysis Hub, `DagWorkflowStudio`, `IDiscoverPanel`,
  `AdvancedReasoningMode`, results/outcome explorers, `Molecular3DViewer`, …).
- Renders only backend-computed results; "load example" fills inputs only.
- Gap: several newer engine tools (waves 3b/4, Biomni-derived, RNA-seq) are not yet
  surfaced with dedicated panels — they are reachable via the generic tool-execute
  surface but lack bespoke UI. (~50% of tools have bespoke panels.)

### 2. Orchestration Layer (LLM) — ✅ real
- `server/agent_executor.ts`: a genuine tool-use loop over the typed 193-tool
  registry — intent → plan → route to real tools → collect real outputs → synthesize.
  Route `/api/synomics/agent-execute`. Covered by `tests/agent_smoke.ts` (12/12).
- `server/grounded_multi_agent.ts`: grounded multi-agent execution.
- Verifiable-AI gates (adversarial-validate, causal-discovery, Z3 pathway, etc.)
  let the *math*, not the LLM, decide analytical claims.

### 3. Compute Layer — ✅ real (Python); R/Bash deploy-gated
- `server/synomics_engine.py` (+ byte-identical `biomni_engine.py`) and the domain
  modules run real computation for all 193 tools via `server/engine_client.ts`
  (`python3 <module> <cmd>` + JSON stdin/stdout).
- `server/sandbox_runner.py`: real OS resource limits (RLIMIT_CPU/AS/FSIZE/CORE),
  wall-clock timeout, stripped env, isolated cwd. Route `/api/synomics/python-exec`.
  Verified: memory bombs / infinite loops killed; secrets invisible.
- Gap vs Biomni: no Jupyter-kernel or R/Bash execution surface yet; those arrive
  with the bioconda worker image (DEPLOYMENT.md). gVisor/seccomp isolation is
  deploy-gated (needs root/unshare).

### 4. Storage Layer — ✅ real (local); cloud tiers deploy-gated
- `server/outcome_bundle.py`: per-run structured bundle (result.json, research_log,
  figures png/svg, tables csv, code, report/DOCX/article, README, SHA-256 MANIFEST).
- `server/audit.ts`: append-only audit trail (timestamps, params, seeds, paths).
- `server/provenance.py`: SHA-256 provenance manifest.
- Cloud tiers (GCS active/archive buckets, Filestore NFS `/mnt/scratch`, BigQuery)
  are defined in `infra/terraform/` — real IaC, not yet `apply`-ed.

### 5. HPC / Jobs Layer — ⚠️ partial / deploy-gated
- `server/tool_registry.ts`: the typed registry + `invokeTool` dispatcher (193 tools)
  is the in-process "job" surface today.
- `server/rnaseq_pipeline.py::rnaseq_upstream`: a real multi-step pipeline
  orchestrator (fastp→STAR→minimap2→stringtie→salmon) that runs binaries when
  present, else returns an honest plan.
- Cluster execution (GKE worker tiers, gVisor sandbox pool, GPU nodes) is in
  `k8s/helm/` + `infra/terraform/` — a gRPC worker daemon is still to build before
  those workers serve (DEPLOYMENT.md "Known gaps").

### 6. Databases Layer — ⚠️ partial (egress-gated)
- `server/external_db.ts`: real API clients + normalizers for Ensembl, MyGene,
  UniProt, VEP with an honest-failure path; `tests/external_db_smoke.ts` covers the
  normalizers (live happy-path is egress-gated). Biomni ships ~40 DB clients + a
  ~76-dataset data lake — the larger set is the main breadth gap.

### 7. Skills System — ✅ NEW (this change)
- `server/skills_registry.ts` + `skills/<name>/SKILL.md`: curated, declarative
  multi-tool workflows that chain real registry tools (outputs bound to later
  inputs) and emit a combined outcome bundle. Listed via `/api/synomics/skills`,
  executed via `/api/synomics/skill-run`. Each skill has a CI test that runs it
  end-to-end on a labeled fixture.
- This is the layer SynOmics previously lacked; it formalizes de-facto pipelines
  (e.g. RNA-seq DE → enrichment → report) as reusable, tested skills.

---

## Design principles (binding)
- **Math decides, not the LLM.** Analytical claims come from executed code; the
  orchestration layer routes and narrates but never invents p-values, fold changes,
  or identities (CLAUDE.md §1).
- **Honest degradation.** A capability that needs a binary/GPU/egress absent here
  fails with an explicit "unavailable" — never a fabricated result.
- **Provenance by default.** Every outcome bundle carries a SHA-256 manifest and
  the Synapse attribution/citation block.

See `DEPLOYMENT.md` for the container/GKE/Terraform deployment path and
`BIOMNI_COMPARISON.md` for per-domain tool coverage.
