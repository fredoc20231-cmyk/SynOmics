# SynOmics — Advanced Bioinformatics Platform ("Aistudio Core")

Governing instructions for all code generation, shell execution, and
architectural decisions in this repository. These rules are binding.

---

## 1. Prime Directives & Absolute Constraints

- **ZERO HALLUCINATION MANDATE.** Never fabricate, simulate, or guess analytical
  results (p-values, fold changes, cluster identities, binding affinities, ADMET,
  gene coordinates, …). Every result must be produced by executing real code on
  real data, or fetched from a real source. If a value cannot be computed or
  fetched, return an explicit "not available" — never a placeholder number.
- **NO DEMO / SYNTHETIC DATA.** Do not generate or inject placeholder/example
  data into user-facing surfaces unless the user explicitly asks for it for UI
  testing. Test fixtures live only under `tests/` and are never served to users.
- **DETERMINISTIC EXECUTION.** Every analytical claim must be backed by an
  executable script whose actual stdout/stderr is captured and parsed, with the
  exact parameters and random seeds logged.
- **VERIFY BEFORE SHIP.** Do not claim a code path works unless it has been run.
  When a capability cannot be verified in the current environment (e.g. blocked
  network, missing GPU/binaries), say so explicitly and make the code fail
  honestly at runtime rather than returning fabricated output.
- **FORBIDDEN TERMINOLOGY.** Never use the legacy acronym "iCAT3" or any
  variation. Refer to the system only as the "Advanced Bioinformatics Platform"
  or "Aistudio Core" (product/UI name: SynOmics).

## 2. UI / UX & Visual Design (for new/changed frontend code)

Enforce this palette for new UI work:

| Token | Hex | Use |
| --- | --- | --- |
| Primary background | `#FFFFFF` | Dominant canvas |
| Primary accent | `#0A192F` | Headers, primary nav, structural boundaries |
| Secondary accent | `#00B4D8` | Interactive elements, active states, buttons, key data |
| Neutral | `#F8F9FA` | Panels, tables, subtle borders |

Typography: **Inter** or **Roboto** for prose; **Fira Code** or **JetBrains
Mono** for sequences, code, and tabular data. (Legacy screens use an earlier
cream/emerald palette; migrate opportunistically, do not mass-restyle in one
commit.)

## 3. Core Architecture & Modules

### Module A — Data Ingestion & Conditional Clarification Loop
- On upload (CSV/TSV/H5AD/FASTQ/FASTA/VCF), run a real profiling pass to detect
  data type, sample IDs, and metadata structure.
- **HALT on ambiguity.** If grouping, batch variables, or controls are ambiguous
  or contradictory, do not guess — ask a precise, targeted question.
- Status: FASTA/FASTQ/VCF/CSV/TSV parsing implemented in
  `server/synomics_engine.py::ingest_file` (`POST /api/synomics/ingest-file`).
  H5AD and the interactive clarification loop are still to build.

### Module B — Analysis Depth Engine (exponential rigor)
- **L1 Basic (1×):** QC, standard stats (DESeq2/edgeR-style DE, PCA, volcano).
- **L2 Medium (10×):** batch correction (ComBat), mixed models, GSEA, PPI maps.
- **L3 Advanced (100×):** multi-omics fusion, ML feature selection (LASSO/RF),
  single-cell trajectory inference.
- **L4 Discovery (1000×):** hypothesis generation, cross-database meta-analysis
  (Ensembl/GEO/KEGG/UniProt), deep-learning pattern recognition.
- Status: real L1 primitives exist in the engine (Welch+BH DE, hypergeometric
  enrichment, single-cell markers, PCA/ordination). L2–L4 largely to build and
  require a Python scientific stack (scanpy/scipy/statsmodels) on a worker.

### Module C — Deterministic Sandbox & Audit Trail
- Write analysis code to a file, execute it, read the real output.
- Append to `audit_log.json` per session: timestamp, tool/version, exact
  parameters, random seeds, output file paths — for 100% reproducibility.
- Status: `POST /api/synomics/python-exec` runs code and writes temp to
  `os.tmpdir()` with a timeout. Container isolation, resource limits, and the
  audit log are still to build; do not run untrusted agent-authored code until
  isolation exists.

### Module D — Publication-Grade Report Generator
- Compile validated results into a 6-section report (Title, Summary,
  Introduction, Methods, Results, Interpretations) exportable to PDF/DOCX/HTML.
- Tech: `python-docx` (Word), WeasyPrint/ReportLab (PDF), Jinja2 + Plotly (HTML).
- Status: HTML (Jinja2) + DOCX (python-docx) implemented in
  `server/report_generator.py` (`POST /api/synomics/report`); renders only real
  provided content, missing sections marked "not provided". PDF (WeasyPrint) and
  live Plotly figures still to add.

### Module E — AI-Native Drug Discovery (CADD) & Virtual Validation
Bridges omics findings into molecular design + rigorous in-silico validation.
- **E1 Target/pocket ID:** derive targets from the user's omics data; fetch
  structures (AlphaFold DB / PDB); predict with AlphaFold3/RoseTTAFold when no
  structure exists; detect pockets (FPocket/SiteMap-equivalent).
- **E2 Generative design + MOBO:** 3D pocket-conditioned diffusion (TargetDiff/
  DiffSBDD) / Bayesian optimization; jointly optimize affinity, synthesizability
  (SA/retro), and ADMET; output a Pareto front.
- **E3 Virtual validation:** equivariant GNN scoring (EquiBind/TANKBind) → short
  MD (OpenMM/GROMACS, RMSD/RMSF) → FEP/TI ΔΔG for top hits → PBPK curves.
- **E4 Depth scaling:** L1 Vina + Lipinski; L2 ensemble docking + ML-ADMET +
  pharmacophore; L3 generative + GNN affinity + short MD; L4 MOBO Pareto + FEP/TI
  + PBPK + retrosynthesis (AiZynthFinder).
- **Chemistry constraints (zero hallucination):** all molecules valid,
  RDKit-sanitizable SMILES/InChI; 3D conformers energy-minimized; never report a
  binding affinity or ADMET value without executing a real scoring/ML script.
- Status: **not implemented.** Requires RDKit/OpenMM/torch-geometric/DeepChem,
  GPUs, external model weights, and open network — none available in the current
  build. Until then, `DrugDiscoveryMode` shows honest "requires backend" states
  and fabricates nothing. Do not ship any E-module output that is not the product
  of a real executed pipeline.

## 4. Operational Rules

- **Verify before acting:** confirm a file exists and read it before modifying.
- **Iterative validation:** write a minimal version, run it on a tiny subset,
  then scale to full data.
- **Error transparency:** report the exact error; propose a scientifically sound
  alternative rather than degrading silently.
- **Confidence scoring:** flag findings with p > 0.05 or negligible effect sizes
  as "Preliminary" and explain why.
- **Network:** external DB calls go to real public APIs. If the environment's
  egress policy blocks a host, the route returns an honest error — never a
  fabricated fallback, and never route around the policy.

## 5. Current build reality (do not overclaim)

- Frontend (React 19 + Vite + Tailwind) + Express server + real Python engine.
- Verified real: sequence alignment, differential expression (Welch+BH),
  hypergeometric enrichment, single-cell markers, Ramachandran, phylogenetics,
  MS/MS, ΔΔG (physics), GWAS (λ_GC), microbiome diversity, Kaplan–Meier, MCL,
  ODE; file ingestion; a real agent tool-use loop (`/api/synomics/agent-execute`).
- External DB routes (`/api/synomics/db/*`) are real fetches with honest errors;
  their happy path is unverified until run in an open-egress environment.
- **Verifiable-AI engines (decision made by math, not the LLM):**
  - Adversarial validation (`/adversarial-validate`): permutation-null test of a
    DE hypothesis → deterministic VALIDATED/INVALIDATED/INCONCLUSIVE + veto.
    Verified: real signal validated, pure noise never validated.
  - Neuro-symbolic pathway solver (`/pathway-logic`): deterministic boolean
    SAT/UNSAT + proof trace. Tier-1 GNN edge-weight extractor is NOT built
    (needs trained weights/GPU) — accept edge states/fold-changes as input.
  - Causal discovery (`/causal-discovery`): DirectLiNGAM in numpy, empirically
    validated to recover known DAGs; bootstrap-gated edges; honest 'unavailable'
    without numpy.
  - Tensor-Train compression (`/tensor-compress`): error-bounded compression
    utility with an honest 'approximate' flag. NOT a cell/digital-twin simulator.
  - Enhanced ML adversary (`/adversarial-ml`): classifier overfit test
    (sklearn permutation_test_score) + PCA-vs-covariate confounder check.
  - Neuro-symbolic Tier 1 (`/edge-extraction`): partial-correlation (GraphicalLassoCV)
    edges — direct vs indirect. Tier 2 (`/pathway-logic-z3`): Z3 SMT formal
    SAT/UNSAT proof (in addition to the pure-Python `/pathway-logic`).
  - Boolean attractor analysis (`/boolean-attractors`): exact state-space
    attractors (phenotypes) + perturbation shifts — the deterministic
    "digital twin" replacement (no ODE/PDE fabrication).
  - Causal discovery (`/causal-discovery`): DirectLiNGAM + bootstrap gating.
- Module D report generator (`/report`): 6-section HTML+DOCX from real content only.
- **APEX engines (all code-grounded, honest fallbacks, CI-gated):**
  - Multi-omic Z3 consistency (`/multiomic-consistency`): flags LOGICAL_CONFLICT
    across omics layers and HALTS pathway activation for conflicted genes.
  - Adversarial swarm (`/adversarial-swarm`): ensemble (Welch + Mann-Whitney +
    exact permutation), survivors gated at FDR<0.01 with a swarm survival rate.
  - Robotic protocol (`/robotic-protocol`): Opentrons protocol generation gated
    by physical-constraint validation (volume/slot; oversize auto-split).
  - Self-optimizing compilation (`/accelerate`): runtime Cython acceleration with
    a correctness guard + measured speedup logged to the audit trail.
  - Cryptographic provenance (`/provenance`): SHA-256 manifest of inputs/scripts/
    outputs; the report footer embeds the manifest hash.
- Concordance: 7/7 engine statistics match scipy/statsmodels (VALIDATION_REPORT.md).
- Lint gate: `ruff check server tests` (pyflakes/syntax/imports) runs in CI.
- 33 real agent tools; 13 test suites in CI.
- Everything marked "to build" / "not implemented" above must not be faked.

## 6. Commands

```bash
npm install
npm run dev          # tsx server.ts (API + Vite frontend)
npm run build        # vite build + esbuild ESM server bundle -> dist/
npm start            # node dist/server.mjs
npm run lint         # tsc --noEmit
python tests/engine_smoke.py
npx tsx tests/agent_smoke.ts
npx tsx tests/external_db_smoke.ts
```
