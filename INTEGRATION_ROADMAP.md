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
- ⬜ **S** — Add a SessionStart hook + CI that runs `npm run build`, `tsc`,
  and `pytest` so every change is verified (this is what unblocks fast, safe iteration).
- ⬜ **M** — Real file ingestion: parse uploaded FASTA/FASTQ/VCF/CSV/H5AD server-side
  (currently detection is filename-heuristic) and route into the engines above.

## Phase 1 — Real external databases (grounding, like Biomni's data lake)
Each is a thin, cached server route to a public API; all real, no keys except where noted.
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
- ⬜ **M** Turn each real endpoint above into a typed **tool schema** the LLM can call
  (the app already has a tool registry — populate it with the real routes).
- ⬜ **L** Give the agent a real code-execution sandbox (the `/api/synomics/python-exec`
  route exists; harden it: run in an isolated container, write temp to `os.tmpdir()`,
  resource/time limits) so it can run arbitrary analysis, like Biomni.
- ⬜ **M** Multi-step tool-use loop in `server.ts` `/agent-run` (plan → call tools →
  observe → synthesize) replacing the templated scaffold in `grounded_multi_agent.ts`.
- ⬜ **S** Optional: real second-model verification (only claim consensus when a real
  second provider key is configured).

## Phase 4 — Scale & UX
- ⬜ **S** `vite.config.ts` `manualChunks` to split 3D viewer/charts/tools (bundle >1 MB).
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
