# SynOmics → Biomni-class Platform: Real Integration Roadmap

Goal: make SynOmics a genuinely powerful, general bioinformatics platform by
adding **real** tool/data integrations — never fabricated outputs. Biomni's power
is ~150 real tools + a large curated data lake + an agent that writes and runs
code. The only honest path to "as/more powerful" is to add real integrations
incrementally, each verified against a working build. This is that plan.

Legend: ✅ done in this repo · 🟡 partial/honest-stub · ⬜ to build.
Effort: S (hours) · M (a day) · L (multi-day) · XL (needs infra/licensing).

## Phase 0 — Foundation (mostly ✅)
- ✅ Real compute engine reachable (`synomics_engine.py`), response contract fixed.
- ✅ Real: alignment (NW/SW+BLOSUM62), DE (Welch+BH), enrichment (hypergeometric),
  single-cell, Ramachandran, phylogenetics (NJ), MS/MS, ΔΔG, MCL, ODE, network.
- ✅ Real: GWAS (λ_GC, Manhattan, QQ, lead loci), Microbiome (Shannon/Simpson/
  Chao1/Bray–Curtis/PCoA), AlphaFold DB fetch with real B-factor pLDDT.
- ✅ **S** — CI that runs `tsc`, the full `npm run build`, the Python compile,
  and the engine + agent test suites on every push/PR (`.github/workflows/ci.yml`,
  `tests/engine_smoke.py`, `tests/agent_smoke.ts`). (H5AD ingestion still ⬜.)
- ✅ **M** — Real file ingestion: `ingest_file` parses uploaded FASTA/FASTQ/VCF/
  CSV/TSV server-side into structured records (Phred+33 decoding, VCF variant
  typing, matrix→gene-keyed counts) with honest routing suggestions and honest
  errors, exposed at `POST /api/synomics/ingest-file`. (H5AD/binary formats ⬜.)

## Phase 1 — Real external databases (grounding, like Biomni's data lake)
Each is a thin, cached server route to a public API; all real, no keys except where noted.
> Note: these require outbound network to the public APIs. They can be written
> here but cannot be *verified* in a sandbox whose egress is restricted to
> package registries — so they are deferred until they can be run against the
> live endpoints, per the honesty guardrail (no shipping of unverified network
> code claimed as working).
- ⬜ **S** Ensembl REST (`rest.ensembl.org`) — gene → coordinates, transcripts,
  exons → replace the synaptic `GENOMIC_LOCI` fallback and `get_genomic_locus_tracks`.
- ⬜ **S** UniProt REST — protein metadata, sequence, domains (feeds alignment/ΔΔG).
- ⬜ **S** MyGene.info / MyVariant.info — gene & variant annotation.
- ⬜ **S** gnomAD GraphQL — population allele frequencies for variant panels.
- ⬜ **M** ClinVar (NCBI E-utilities) — real clinical significance → replace the
  hardcoded ACMG list in `ClinicalGenomicsPanel`/`annotate_variants`.
- ⬜ **M** g:Profiler or Enrichr API — enrichment against real annotation sets
  (keeps the local hypergeometric test, adds real gene-set libraries).
- ⬜ **S** PDBe/RCSB + AlphaFold DB — already fetched; add PAE JSON for real error maps.
- ⬜ **M** Open Targets GraphQL — target–disease associations & tractability →
  replaces `DrugRepurposingEngine` hardcoded lists.
- ⬜ **M** ChEMBL / PubChem — bioactivities, SMILES, drug data.

## Phase 2 — Real analysis tools (compute)
- ⬜ **M** Swap pure-Python stats for scipy/statsmodels where a Python runtime is
  available (exact t/negative-binomial, BH already correct); keep pure-Python
  fallback for the pure-Node/Cloud-Run deployment.
- ⬜ **L** Real docking: wire AutoDock Vina (or DiffDock) as a job → replaces the
  `DrugDiscoveryMode` `mockResult`. Needs a worker with the binary (XL infra).
- ⬜ **L** Real ADMET: RDKit descriptors + a trained/hosted ADMET model (admetSAR/
  DeepPurpose) → replaces `mockAdmet`.
- ⬜ **M** Real variant effect: Ensembl VEP REST or a local VEP.
- ⬜ **M** Real pathway/network: STRING API for interactomes → feeds MCL/topology.
- ⬜ **L** scanpy/Seurat-grade single-cell on a Python worker (Leiden clustering,
  UMAP) → upgrade the pure-Python single-cell pipeline.

## Phase 3 — The agent (Biomni's core differentiator)
Biomni's power is an LLM agent that **plans → writes code → executes in a sandbox →
inspects results → iterates**. To match/exceed it:
- ✅ **M** Typed **tool schema** registry (`server/tool_registry.ts`): 15 real
  tools mapped to engine commands with parameter schemas, required-arg
  validation, and honest unknown-tool errors; discoverable at
  `GET /api/synomics/agent-tools`.
- ✅ **M** Real multi-step tool-use loop (`server/agent_executor.ts`,
  `POST /api/synomics/agent-execute`): plan → **actually execute the real tools**
  → observe genuine outputs → synthesize, with data-flow between steps
  (ingest_file → differential_expression chains on real parsed counts).
  Observations are never LLM-simulated. Without a key it returns real tool
  outputs + a factual synthesis or an honest `needs_input`.
- 🟡 **L** Code-execution sandbox: `/api/synomics/python-exec` exists and writes
  temp to `os.tmpdir()` with a 30s timeout; still needs container isolation and
  resource limits before it is safe for arbitrary agent-authored code.
- ⬜ **S** Optional: real second-model verification (only claim consensus when a real
  second provider key is configured).

## Phase 4 — Scale & UX
- ✅ **S** `vite.config.ts` `manualChunks` splits firebase/charts/react/markdown/
  pdf/icons into separate vendor chunks (function form, since firebase exposes
  only subpath exports).
- ⬜ **S** Explicit Basic / Advanced / Discovery tier selector (chat box already default).
- ⬜ **M** Remove remaining dead/duplicate components (Bio*/Synaptic* pairs).
- ⬜ **S** Migrate `/api/synapse/*` legacy routes fully to `/api/bio|synomics/*`.

## Honesty guardrail (applies to every item)
A feature ships only when it returns real computed/fetched results or an explicit
"not available / provide input" state. No `Math.random()`, no canned numbers, no
invented multi-model consensus. That is the line that keeps this credible.

## Suggested order for the SynOmics-a session
1. Phase 0 CI/build hook (so everything after is verified).
2. Phase 1 Ensembl + UniProt + ClinVar + Open Targets (biggest realness-per-hour).
3. Phase 3 tool schemas + hardened python-exec + real agent loop.
4. Phase 2 docking/ADMET workers (infra permitting).

## Delivered in the SynOmics-a build session
- Consolidated the full-stack platform into the repo and made it build, boot,
  and serve real computation end-to-end (tsc, vite, esbuild ESM server bundle).
- Phase 0: expanded CI + `tests/engine_smoke.py` + `tests/agent_smoke.ts`; real
  file ingestion (`ingest_file` + `/api/synomics/ingest-file`).
- Phase 3: typed tool registry (15 real tools) + real plan→execute→observe→
  synthesize agent loop (`/api/synomics/agent-execute`, `/agent-tools`).
- Honesty: de-faked `DrugDiscoveryMode` (docking/ADMET/de-novo now honest
  "requires backend" states, no fabricated affinities/ADMET/molecules).
- Honesty: de-faked the remaining viz components. `AnalysisOutcomesExplorer` and
  `ScientificFiguresAndTables` now show honest empty states instead of hardcoded
  volcano/PCA/pathway results with invented p-values; `DrugRepurposingEngine`,
  `ClinicalGenomicsPanel`, and `MultiOmicsChartsSuite` carry explicit banners
  marking their data as curated reference / illustrative, not computed from user
  input. (`InSilicoPerturbationLab` already runs the real ODE route.)

## Remaining (highest value first)
- Phase 1 live external-database routes (need open outbound network to verify;
  deferred rather than shipped unverified, per the honesty guardrail).
- Harden `python-exec` into an isolated sandbox before agent-authored code.
- Real docking/ADMET workers (AutoDock Vina / RDKit) — external infra.
- `PlatformSupremacyBenchmark` is a marketing table, not a feature — consider
  removing (left in place as a product decision).
