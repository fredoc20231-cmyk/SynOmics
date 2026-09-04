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
  H5AD (single-cell AnnData) profiling implemented in `server/h5ad_profiler.py`
  (`POST /api/synomics/ingest-h5ad`, accepts base64 bytes or a path) — reads real
  cell/gene counts, X encoding, obs/var columns, and grouping candidates via h5py,
  and HALTS with a precise clarification question when no unambiguous grouping
  column exists. The broader interactive clarification loop is still to build.

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
- Status: `POST /api/synomics/python-exec` runs agent code through
  `server/sandbox_runner.py`, which enforces REAL OS resource limits (RLIMIT_CPU,
  RLIMIT_AS memory, RLIMIT_FSIZE, RLIMIT_CORE=0), a wall-clock timeout, a stripped
  environment (server secrets are NOT visible to the code), and an isolated temp
  cwd. Verified: memory bombs and infinite loops are killed; secrets are invisible.
  The append-only audit trail is live (`server/audit.ts`). Honest scope: kernel
  network namespacing / seccomp syscall filtering are NOT applied (need root/unshare,
  unavailable here) — outbound network from sandboxed code is still governed by the
  environment's egress policy, not blocked at this layer.

### Module D — Publication-Grade Report Generator
- Compile validated results into a 6-section report (Title, Summary,
  Introduction, Methods, Results, Interpretations) exportable to PDF/DOCX/HTML.
- Tech: `python-docx` (Word), WeasyPrint/ReportLab (PDF), Jinja2 + Plotly (HTML).
- Status: HTML (Jinja2) + DOCX (python-docx) + PDF (ReportLab, pure-Python) all
  implemented in `server/report_generator.py` (`POST /api/synomics/report`, pass
  `formats:["html","docx","pdf"]`); renders only real provided content, missing
  sections marked "not provided". Verified: PDF has valid %PDF- magic. Live Plotly
  figures still to add.

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
- **Final-Frontier engines (all code-grounded, honest fallbacks, CI-gated):**
  - MML model selection (`/mml-select`): parsimony via minimum two-part message length.
  - Circuit verification (`/circuit-verify`): Gillespie SSA + temporal-property
    VERIFIED/VIOLATED with a Wilson CI.
  - PDE residual gate (`/pde-validate`): reaction-diffusion residual → PHYSICALLY
    VALID/INVALID (PINN training itself needs torch/GPU; the enforcement runs here).
  - Assay vision (`/assay-quantify`): deterministic OpenCV quantification (no LLM
    eyeballing) + Bayesian posterior update (`/bayesian-update`).
- **iDiscover engines (monumental frontiers; code-grounded, honest fallbacks, CI-gated):**
  - Biological Git — cellular reversion (`/idiscover/cellular-reversion`):
    Waddington Optimal Transport. Exact EMD via POT (else numpy Sinkhorn, flagged
    `approximate`) → exact Wasserstein "energy" + top per-gene revert commits from
    the barycentric projection. Gene names are exact input columns; strict
    "failed to converge" error on disjoint distributions (no heuristic fallback).
    Verified: analytic 1-D W₂ recovered exactly; known diseased→healthy shifts recovered.
  - GFlowNet generative chemistry (`/idiscover/gflownet-sample`): tabular numpy
    GFlowNet trained with Trajectory Balance, sampling molecules ∝ reward. Every
    candidate is RDKit-sanitizable with a REAL computed QED; invalid samples are
    discarded, nothing fabricated. Tabular tier only — a deep neural GFlowNet needs
    torch/GPU and is NOT claimed. Verified: trained policy concentrates above uniform
    random; all reported QED values match RDKit.
  - Hyper-NOTEARS — hypergraph causal discovery (`/idiscover/hyper-causal-discovery`):
    discovers a Directed Acyclic Hypergraph of multi-way JOINT causes ([A,B]->C
    that pairwise LiNGAM/PCMCI cannot represent) via exogeneity-ordered,
    order-restricted continuous optimization (scipy L-BFGS-B); OR verifies a
    proposed weighted adjacency with the EXACT tr(exp(W∘W))-d acyclicity gate and
    rejects any causal loop with a strict error (no heuristic DAG). Honest scope:
    orienting edges / detecting loops from raw observational data is not
    identifiable in general, so discover returns a certified DAH and loop-detection
    is the verify path. Verified: recovers Z=X*Y joint cause; rejects A→B→C→A loop
    (h=0.131>ε). Requires numpy+scipy.
  - Federated ZKP biomarker discovery (`/idiscover/federated-zkp`): each site runs
    a REAL stratified log-rank survival test on its own private records; only the
    additive (O-E, V) sufficient statistics leave the site — never raw rows. The
    aggregate is secured with REAL Pedersen commitments (additively homomorphic,
    RFC-3526 2048-bit group) + Schnorr/Fiat–Shamir zero-knowledge proofs of
    knowledge, so per-site contributions stay hidden and tamper-evident. Pure
    stdlib. Honest scope: this is a commitment + Sigma-protocol system (integrity
    + ZK proof of knowledge), NOT a general zk-SNARK over an arbitrary predicate
    (needs a proving backend not bundled — not claimed). Verified: real cross-site
    signal detected + cryptographically verified; pooled log-rank matches an
    independent reference; forged proof/aggregate rejected.
  - Manifest at `/idiscover`. All four are also reachable as engine commands
    (`synomics_engine.py cellular_reversion|gflownet_sampling|hyper_causal_discovery|federated_zkp`,
    delegating to the dedicated modules).
  - Frontend surface: `src/components/IDiscoverPanel.tsx` (in the Analysis Hub →
    "iDiscover Frontiers" pipeline). Calls the four real routes and renders real
    computed output with honest error/empty states, on the §2 palette. "Load
    example input" only fills INPUT fields (user-initiated); displayed results
    always come from the backend — nothing is fabricated client-side.
- **De-faked sandbox route:** `/api/synomics/tool-execute` (+ `/api/biomni`,
  `/api/bio` aliases) no longer returns canned/fabricated tool results. It now
  dispatches every `toolId` to the real registry via `invokeTool` (with a UI→tool
  alias map); unmapped tools and missing params return honest errors. The former
  hardcoded DE/single-cell/docking result blocks and the dead
  `generateDomainIntelligence` fabricator have been removed.
- Concordance: 7/7 engine statistics match scipy/statsmodels (VALIDATION_REPORT.md).
- Lint gate: `ruff check server tests` (pyflakes/syntax/imports) runs in CI.
- **Standard-bioinformatics breadth modules (real, CI-gated, added to close the
  Biomni breadth gap):** advanced expression (`expression_advanced.py`: NB-GLM DE,
  GSEA, batch correction, PCA), biostatistics (`biostats.py`: Fisher, chi-square,
  ANOVA, correlation, multiple-testing, power, normality, ROC/AUC, log-rank, Cox),
  sequence/molecular biology (`seqtools.py`: translate, revcomp, GC, ORF, primer Tm,
  restriction map, protein params, codon usage), network biology (`netbio.py`:
  centrality, community detection, shortest path, graph stats, RWR), advanced
  cheminformatics (`cheminfo_advanced.py`: Tanimoto, similarity matrix, substructure
  search, Murcko scaffold, PAINS), machine learning (`ml_analysis.py`: k-means,
  hierarchical, t-SNE, RF importance, LASSO, logistic), variant/population genetics
  (`variant_tools.py`: Hardy-Weinberg, allele frequency, Ts/Tv, VCF summary),
  advanced microbiome (`microbiome_advanced.py`: Chao1, CLR differential abundance,
  rarefaction), structural biology (`structure_tools.py`: summary, radius of
  gyration, contact map, atom distance). Each validated against known ground truth.
- **Breadth wave 3b (real, CI-gated):** time-series/signal (`timeseries_tools.py`:
  autocorrelation, cross-correlation, CUSUM change-point, FFT periodicity, LOWESS,
  linear detrend, moving average), clinical epidemiology (`clinical_tools.py`: odds
  ratio/relative risk, diagnostic metrics, number-needed-to-treat, inverse-variance
  meta-analysis), WGCNA co-expression (`wgcna.py`: soft-threshold, co-expression
  modules, module eigengenes), flow cytometry (`flow_tools.py`: arcsinh transform,
  spillover compensation, gating frequencies, channel summary). Each validated
  against known ground truth.
- **Breadth wave 4 (real, CI-gated):** spatial statistics (`spatial_tools.py`:
  Moran's I, Geary's C, Getis-Ord G, Ripley's K, Moran permutation test),
  pharmacokinetics/enzyme kinetics (`pkpd_tools.py`: NCA, one-compartment fit,
  Michaelis-Menten, Lineweaver-Burk, competitive-inhibition Ki), Bayesian inference
  (`bayes_tools.py`: beta-binomial, normal-normal, Poisson-gamma conjugate updates,
  Bayesian A/B test, BIC Bayes factor), beta-diversity/ordination
  (`beta_diversity.py`: Bray-Curtis, Jaccard, PCoA, PERMANOVA, Mantel), statistical
  power/sample size (`power_tools.py`: two-means, two-proportions, ANOVA,
  correlation), genomic interval arithmetic (`genome_intervals.py`: merge,
  intersect, subtract, coverage, nearest). Each validated against known ground
  truth (e.g. d=0.5/power=0.8 → n≈64; Bray-Curtis of disjoint samples = 1.0;
  Michaelis-Menten recovers Km=10; Moran's I = +1 for a perfectly clustered field).
- **Biomni-derived wave (real, CI-gated, with outcome bundles):** glycoengineering
  (`glyco_tools.py`: N/O-glycosylation motif scans), synthetic biology
  (`codon_tools.py`: codon optimization + CAI), biochemistry
  (`conservation_tools.py`: per-column Shannon-entropy conservation), chronobiology
  (`chrono_tools.py`: cosinor MESOR/amplitude/acrophase), microbial growth
  (`growth_dynamics.py`: logistic + Gompertz fits, generalized Lotka-Volterra),
  genomic prediction (`genomic_prediction.py`: GBLUP/ridge breeding values). Designs
  adapted from the Apache-2.0 Biomni project; implementations original + validated
  against known ground truth (e.g. cosinor recovers MESOR=10/amplitude=5; GBLUP
  accuracy r>0.9 on signal, ~0 on pure noise; conservation entropy 0 bits for a
  conserved column, 2 bits for 4 equiprobable residues).
- **Outcome bundles (Biomni-style output structure):** `server/outcome_bundle.py`
  writes, per invocation (when a tool is called with `outputDir`), a structured
  bundle mirroring Biomni's Results→artifacts shape: `result.json` +
  `research_log.md` (Results), `figures/*.png|svg` (matplotlib on the §2 palette),
  `tables/*.csv`, `code/analysis.py` (a runnable reproducer), `report.html`+`.md`,
  `README.md` (docs), and a SHA-256 `MANIFEST.json` (provenance). It only serializes
  real computed content — never fabricates a figure, row, or value. The six
  Biomni-derived modules emit bundles; future tools opt in via the helper.
- 190 real agent tools in `server/tool_registry.ts`; 52 test suites in CI, plus a
  `tsc --noEmit` type-check gate. See `BIOMNI_COMPARISON.md` for the per-domain
  Biomni↔SynOmics coverage table.
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
