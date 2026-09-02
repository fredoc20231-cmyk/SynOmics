# AI Studio Directive — ZERO Fake / Mock / Demo Data (SynOmics)

**Absolute rule for every change you make to SynOmics:**
> A feature must return a **real computed or real fetched result**, or an
> **explicit, honest "not available / provide input" state**. It must NEVER
> display fabricated, hardcoded, random, or placeholder numbers, charts, tables,
> or text presented as if they were real analysis results.

If you cannot make something real (missing tool, missing data, missing API key),
you must show an honest empty/unavailable state — **never invent an output**.
Do not "fill in" a chart or table to make the UI look complete.

---

## What counts as a FORBIDDEN fake (remove on sight)
- Hardcoded result arrays/objects rendered as analysis output (e.g. `DEFAULT_*`,
  `TAXA_DATA`, `mockResult`, `mockAdmet`, canned gene/variant/compound lists).
- `Math.random()` (or `setTimeout` "processing" delays) used to generate or
  fake-compute **data or metrics**.
- Fixed statistics presented as computed: p-values, FDR/q, log2FC, λ_GC,
  binding affinity/Ki, pLDDT/pTM, confidence %, "consensus %", ADMET numbers.
- Fabricated multi-model "consensus" from models that do not actually run.
- Any figure/table/metric shown **before** the user runs an analysis or **when
  the backend/tool is unavailable**.
- Marketing "we beat competitor X" tables presented as product capability.

## What is ALLOWED (not a fake)
- Real results computed by `server/synomics_engine.py` from user input.
- Real data fetched from a real API/DB (RCSB, AlphaFold DB, Ensembl, UniProt,
  ClinVar, Open Targets…) with the source shown.
- An honest **empty state**: "No analysis run yet — provide input and click Run."
- An honest **unavailable state**: "Docking requires an external tool (AutoDock
  Vina/RDKit) not configured in this deployment."
- **Cosmetic-only** randomness for node/graph *layout* jitter and for generating
  DOM `key`/`id` strings (these are not data — leave them).
- Curated reference **inputs/examples** clearly labeled as examples the user can
  edit (not results).

---

## Remaining fakes to eliminate (hit-list)
Search each file, replace with real compute or an honest state. (Line numbers are
approximate — grep the pattern.)

1. **`src/components/DrugDiscoveryMode.tsx`** — `runDockingSimulation` /
   `runAdmetCalculation` / `runDeNovoGeneration` build `mockResult` / `mockAdmet`
   inside `setTimeout(...)`, and `useEffect` auto-runs them on mount.
   → Remove the auto-run and the fabricated objects. Docking/ADMET/de-novo need
   external tools; show: "Not available — real docking/ADMET requires AutoDock
   Vina / RDKit configured server-side." Only compute if such a backend exists.

2. **`src/components/DrugRepurposingEngine.tsx`** — hardcoded compound/indication
   lists + `radarData`. → Empty state, or wire to a real Open Targets / ChEMBL
   endpoint and render only what it returns.

3. **`src/components/ClinicalGenomicsPanel.tsx`** — hardcoded `PGX_GUIDELINES` and
   panel rows. → Empty state, or wire to real ClinVar / PharmGKB / gnomAD.

4. **`src/components/MultiOmicsChartsSuite.tsx`** — `// Simulated PCA clusters`,
   `// Simulated GSEA pathways` hardcoded arrays. → Render only from a real
   `agentRun`/analysis result; otherwise empty state.

5. **`src/components/AnalysisOutcomesExplorer.tsx`** — default hardcoded
   `figures`/`tables` (e.g. TOP2A/CDKN2A volcano/DE) shown when no real run.
   → Show empty state when there is no real `agentRun`.

6. **`src/components/ScientificFiguresAndTables.tsx`** — hardcoded figure/table
   fallbacks. → Same: render only real data, else empty state.

7. **`src/components/PlatformSupremacyBenchmark.tsx`** — self-promotional
   "SynOmics vs competitors (full vs none)" table. → Remove it, or clearly mark
   it as subjective positioning, not a computed benchmark. (Prefer removal.)

8. **`server.ts` → `/api/synomics/tool-execute` switch** (cases returning canned
   `geneUniverse`, `significantUp.length + 842`, fixed clusters/`14820`, etc.).
   → Route `differential_expression`→`deseq2`, `pathway_enrichment`→
   `syngo_enrichment`, `single_cell*`→`scanpy_singlecell` through
   `runPythonEngine(...)`; for anything without a real implementation return
   `{ status: 'needs_specific_tool' }`. Delete the hardcoded data.

9. **`server/grounded_multi_agent.ts`** — the volcano/radar figure `data` still
   contains illustrative numbers (now captioned "illustrative"). Prefer to
   compute them from a real DE run, or drop those figures; keep only the real
   Gemini-derived synthesis + real DB-backed table.

10. **`src/components/FileUploadModal.tsx`** — any hardcoded `genesDetected`
    fallback list (e.g. `['EGFR','KRAS',...]`). → Derive from the actual parsed
    file, or omit the field. Never invent detected genes.

11. **Duplicate/dead fabricated components** — `BioInteractiveMap.tsx`,
    `BioNetworkGraph.tsx`, `BioOmniAgentWorkspace.tsx` (unused). Delete or wire in;
    don't leave fabricated variants around.

Already fixed (do not reintroduce): chat fallbacks, GWAS, Microbiome, single-cell
markers, DE (now exact Welch t-test), AlphaFold pLDDT (real B-factor fetch),
cloud-run-proxy / generic-analysis / voice endpoints, the fake 4-model consensus,
and the misleading model list.

---

## Verification gate (run before declaring "done")
1. **Grep must return nothing that is data-fabrication:**
   ```bash
   grep -rniE "mockResult|mockAdmet|\bDEFAULT_(GWAS|VERIFICATION|SYNGO)?|simulated (pca|gsea)|hardcoded|lorem|dummy|placeholder result" src server.ts server/*.ts
   grep -rniE "setTimeout\\(.*\\b(mock|result|admet|docking)\\b" src
   grep -rn "Math.random" src | grep -viE "key=|id:|id=|layout|jitter|cx|cy|angle|position"
   ```
   Every remaining hit must be either a real computation input or an allowed
   cosmetic use — otherwise fix it.
2. **Build must be green:** `npm install && npm run build` (runs `tsc` + `vite`
   + esbuild). Fix all type/build errors.
3. **Python engine:** `python3 -m py_compile server/synomics_engine.py` and the
   smoke tests in `.github/workflows/ci.yml` must pass.
4. **Runtime smoke test (no fakes visible):**
   - Every Analysis Hub tool with **no input** shows an empty/"provide input"
     state, NOT pre-filled numbers.
   - Running a tool with real input returns computed values (verify a couple by
     hand, e.g. alignment identity %, DE significant genes).
   - Chat with no `GEMINI_API_KEY` shows the honest "not configured" message,
     not a fabricated analysis.

## Acceptance criteria
- Zero fabricated data anywhere in the UI or API responses.
- Every visible number/chart/table is traceable to a real computation or a real
  fetched source, or the UI honestly says it has none yet.
- `npm run build` green; Python smoke tests green.
