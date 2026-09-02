# SynOmics — Fixes Applied & Remaining Work

This document records the changes made to the SynOmics codebase and the exact
remaining work, with file:line references. The product name is **SynOmics**
throughout. Guiding principle applied everywhere: **real computation or an
honest "not available" — never a fabricated result.**

> ⚠️ Build note: the JS/TS build (`vite build`, `tsc`, `esbuild`) could **not**
> be run in the environment where these edits were made (its package registry
> was blocked). **All Python was compiled and executed and passes.** Before
> shipping, run `npm install && npm run build` in AI Studio to confirm the
> frontend/server bundle — the edits are surgical and type-consistent, but the
> JS build is unverified here.

---

## 1. Critical correctness + security (DONE, high impact)

| Fix | File:line | Before → After |
|-----|-----------|----------------|
| Invalid Gemini model — the root cause of "nothing works" | `server.ts:47,1002,1125,1206` | `gemini-3.7-flash` (does not exist) → `gemini-2.5-flash`. Every live AI call previously failed and silently fell back to fabricated text. |
| Broken ODE route | `src/components/InSilicoPerturbationLab.tsx:84` + `server.ts:1345` | Frontend now calls `/api/synomics/ode-simulate`; server also accepts `/api/synapse/ode-simulate` as an alias. |
| Hardcoded secret | `server.ts:2418` | Removed the committed 64-hex fallback key → `''`. |
| Leaked secret in repo | `.env.example` | Real key replaced with `YOUR_VOICE_API_KEY` / `YOUR_CUSTOM_AI_SECRET_KEY` placeholders. **Rotate that key** — it is in git history. |
| Fake voice transcription | `server.ts` `/api/voice/transcribe` | No longer returns the hardcoded `"...SHANK3 and DLG4"` string; returns an honest `501 unavailable` and directs to the browser Web Speech API unless a real STT provider is configured. |

## 2. The big one — real analysis engine reconnected (DONE, verified)

**Finding:** the entire frontend was built against `server/synomics_engine.py`
(1968 lines of *real* algorithms), but the "universal conversion" repointed the
server to `server/bioOmni_engine.py`, whose analysis functions return
**hardcoded** data. That single mis-wire silently broke ~12 tools.

- `server.ts` `runPythonEngine()` now spawns **`synomics_engine.py`** (real).
- Response contract normalized so components that read `data.result` work
  (`ode-simulate`, `syngo-enrichment`, `deseq2` now send `{status, result, ...result}`).
- **Verified working** (`python3`, real math, real input): pairwise alignment
  (Needleman–Wunsch/Smith–Waterman + BLOSUM62), differential expression
  (log2FC + Wald z + Benjamini–Hochberg FDR), hypergeometric enrichment,
  single-cell pipeline (log-CPM, HVG, Welch's t markers), Ramachandran (real
  dihedral geometry), phylogenetics (Jukes–Cantor + neighbor-joining, Newick),
  MS/MS tryptic digest + b/y fragmentation, network topology, in-silico ΔΔG
  (physics-based VdW/electrostatic/solvation/entropy), Kaplan–Meier, MCL.
- Differential expression grouping generalized to **any two-group design / any
  organism** (was hardcoded to `"Control"`/`"Disease"` labels). Verified:
  up/down/non-significant genes computed correctly from raw counts.
- `biomni_engine.py` kept byte-identical to `synomics_engine.py`.

## 3. De-faked the chat path (DONE)

`src/App.tsx` no longer fabricates analysis results:
- The two fallback branches in `handleSendMessage` previously invented
  "Bioinformatics execution complete… matrices computed" / "FDR validation…".
  They now show an **honest error** (missing `GEMINI_API_KEY` / network error)
  and perform no fake analysis.
- The catalog launcher no longer claims "Pipeline initialized on Google Cloud
  Run HPC… matrices are ready"; it states the analysis is configured but **not
  yet run**.
- Removed hardcoded synaptic gene detection (`SHANK3`/`GRIN2B`/… → `DLG4`
  default). Target detection is now domain-agnostic (matches any loaded entity
  or a gene-symbol-like token).
- Defaults de-neuro'd: `selectedModel 'sheen_synomics_7'` → `'synomics_7'`
  (a valid id); `targetProteinSymbol 'DLG4'` → `'TP53'`.

## 4. Honesty pass on fabricated server endpoints (DONE for these)

- `/api/synomics/cloud-run-proxy` — was a fake "Cloud Run HPC" execution log +
  invented metrics. Now returns `501 unavailable` unless a real
  `CLOUD_RUN_ENDPOINT` is set, in which case it forwards the job verbatim.
- `/api/synomics/generic-analysis` — was fabricated `pValue: 1.4e-6, log2FC:
  2.35`. Now returns `400 needs_specific_tool` listing the real compute routes.
- `src/lib/cloud-functions.ts` error path — was inventing `p < 1e-6` + `0.985`
  confidence on failure. Now returns an honest `failed` status, no statistics.

## 5. Branding unified to SynOmics (DONE)

Replaced all user-visible `SynapseOmics` / `Sheen SynOmics [7]` / `SynComics`
strings with `SynOmics` across `server.ts`, `App.tsx`, `cloud-functions.ts`,
`synomics_engine.py`, `biomni_engine.py`, `VoiceInteractionModal.tsx`,
`AnalysisOutcomesExplorer.tsx`, `PlatformSupremacyBenchmark.tsx`,
`DrugDiscoveryMode.tsx`, `SynOmicsAgentWorkspace.tsx`, `WorkspaceMode.tsx`.
Voice greeting no longer says "neuro-omics research".

---

## REMAINING WORK (needs the AI Studio build loop to verify)

These are the fakes that live **inside frontend components** (they don't call
the backend, so they render fabricated data regardless of engine). Each needs a
component edit + a `npm run build` cycle to verify — safe to do in AI Studio.

### Already de-faked and made real since the first report
- **GWAS** (`GWASVariantPrioritizer.tsx` + engine `run_gwas` + `/api/synomics/gwas`):
  rewritten to accept pasted/uploaded summary statistics and compute REAL
  −log10(P), genomic inflation λ_GC (median chi-square / 0.4549), Manhattan, Q–Q,
  and genome-wide-significant lead loci. Honest empty state; no `Math.random()`.
- **Microbiome** (`MicrobiomeAnalyzer.tsx` + engine `run_microbiome` +
  `/api/synomics/microbiome`): rewritten to accept an uploaded abundance table
  and compute REAL Shannon/Simpson/Chao1/Pielou, Bray–Curtis dissimilarity, a
  real PCoA ordination (classical MDS), and between-group differential abundance.
- **Fake 4-model consensus removed**: `grounded_multi_agent.ts` no longer invents
  Qwen/Llama/DeepSeek votes or fixed confidence %s; `MultiModelVerificationStudio.tsx`
  opens on an honest empty state; `TopHeader.tsx` model list trimmed to the models
  that actually run (Gemini).

### Statistical accuracy upgrades (reliability of outcomes)
- Replaced the previous **normal/erfc (Wald-z) approximation** for p-values with
  an **exact Student's t-test via the regularized incomplete beta function**
  (`_betai` / `student_t_two_sided_p` / `welch_t_test` in `synomics_engine.py`).
  Validated against published t-tables: t=2.228,df=10 → p=0.0500; t=3.169,df=10 →
  p=0.0100; t=2.571,df=5 → p=0.0500 (exact matches).
- **Differential expression** now uses Welch's unequal-variance t-test on
  log2(count+1) with Welch–Satterthwaite df + Benjamini–Hochberg FDR, and reports
  honestly (p=1, `lfcSE:null`) when replicates are too few to test — instead of
  the old approximate z. Verified: clear up/down genes p<1e-3, flat gene p≈0.64.
- **Single-cell cluster markers** use the same exact Welch's t-test.
- **GWAS** λ_GC clamped so extreme p-values can't produce `Infinity` (which is
  invalid JSON and previously would have crashed the Node-side parse).
- Kaplan–Meier's `erfc(sqrt(χ²/2))` was verified to be the exact χ²(1 df) survival
  function and left as-is.

### Still remaining
1. **Fabricated data shown without any computation** (highest priority for
   "no fakes"):
   - `DrugDiscoveryMode.tsx:176-312` — `mockResult`/`mockAdmet` docking/ADMET
     with fake `setTimeout` latency. → Real docking/ADMET needs external tools
     (AutoDock Vina / RDKit); until then label honestly.
   - `DrugRepurposingEngine.tsx:87-125`, `ClinicalGenomicsPanel.tsx:120`,
     `MultiOmicsChartsSuite.tsx:51-69`, `AnalysisOutcomesExplorer.tsx:66-181`,
     `ScientificFiguresAndTables.tsx` — hardcoded default figures/tables shown
     when no real run exists. → Render an empty/"run analysis" state instead.
   - `InSilicoPerturbationLab.tsx:60-78` — hardcoded initial TP53 result shown
     before any run (the run itself is now real via the fixed ODE route).
   - `PlatformSupremacyBenchmark.tsx` — self-promotional "we win" table; not a
     feature. Consider removing.

2. **Server routes still returning canned data** (lower traffic):
   - `server.ts` `/api/synomics/tool-execute` switch (`:118-449`) — canned DE/
     enrichment/single-cell. → Delegate to the real engine
     (`deseq2`/`syngo_enrichment`/`scanpy_singlecell`) and match the shape
     Advanced mode expects.
   - `/api/synomics/alphafold-predict` (`~:1957`) — synthesized pLDDT. → Use
     the real deposited-structure fetch at `/api/synapse/pdb/:id` (already real)
     or an AlphaFold DB lookup; don't synthesize confidence.
   - `/api/synomics/dag-workflow-execute` — static templates + fake metrics.

3. **Universality leftovers** (cosmetic, safe):
   - Legacy `/api/synapse/*` knowledge-base routes still used by
     `App.tsx:176-178` (server keeps `/api/bio/*` aliases; consider migrating).
   - Synaptic example defaults inside `synomics_engine.py main()` and
     `GENE_PDB_RESOLVER` in `server.ts` (real PDB IDs, just neuro-biased
     coverage). Expand to a universal gene set.
   - Dead duplicate components: `BioInteractiveMap.tsx`/`BioNetworkGraph.tsx`
     and `BioOmniAgentWorkspace.tsx`/`SynOmicsAgentWorkspace.tsx` are not
     imported anywhere. Remove or wire in.

4. **Chat-first tiers (Basic / Advanced / Discovery):** the app already opens on
   a ChatGPT-style centered chat box (`BasicChatMode.tsx:276-508`). To fully
   match the request, add an explicit **Basic / Advanced / Discovery** tier
   selector (today `TopHeader.tsx:182-207` only has Chat / Analysis Hub, and
   `advanced` is reachable only programmatically). Small, additive change.

5. **Bundle size:** add `build.rollupOptions.output.manualChunks` in
   `vite.config.ts` to split the 3D viewer / charts / bioinformatics tools into
   lazy chunks (the main chunk is >1 MB).

6. **Deployment:** the Python engine needs `python3` on PATH in the Cloud Run
   image, and `/api/synomics/python-exec` writes temp files to `process.cwd()`
   (read-only on Cloud Run) — switch it to `os.tmpdir()` before relying on it in
   production.
