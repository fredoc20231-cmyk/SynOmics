# SynOmics — MASTER FIX DIRECTIVE (execute all; zero fake / mock / demo)

Apply ALL sections. Do not stop until every "Verify" check passes and
`npm run build` is green. Never fabricate: every number/chart/table/log/file
must be a real computed result, a real fetched result, or an honest
"not available / provide input" state. No `Math.random()` or `setTimeout` used
as data/latency, no hardcoded sample results, no output before the user runs
something.

## A. Markdown rendering (answers show raw ``` and | )
- Render every assistant message via `react-markdown` + `remark-gfm`. Do not wrap
  model output in inline code / `<pre>` / backticks before rendering.
- Must render: `##`/`###`, ordered/unordered lists, GFM tables, fenced code with
  language highlighting.

## B. Intent gating (no tools/vault on informational questions)
- Detect intent. Steps/explanation/definition requests → return ONLY the
  formatted answer; do NOT call `synomics.vault.bundle` / `build_vault_on_disk`,
  docking, or any tool.
- Remove any standing "Compile Omics Vault Structure" step that runs after every
  reply. Tools/vault run ONLY after a real analysis that wrote real artifacts.

## C. Omics Vault honesty
- Enumerate the real directory after writing; print only files that exist.
- Show a directory as "bundled" only if it has ≥1 real file. Header count =
  number of non-empty dirs. No "Vault Ready / Download ZIP" when empty.
- `/Codes` = only scripts that really ran; `/Figures`,`/Tables` = only real
  outputs; `/Results` = PDF (`reportlab`) + DOCX (`python-docx`) from the real
  run. If a section has no content, omit it.

## D. Training telemetry panel (currently contradictory)
- Compute ALL metrics (accuracy, precision, recall, specificity, F1, MCC,
  ROC-AUC, confusion matrix, loss) from the SAME real predictions arrays of the
  real train/val/test run. Remove hardcoded metric literals (e.g. 0.708, 0.820,
  26.1%). Top cards must equal the evaluation section (single source of truth).
- If no model was trained this session → honest empty state, not numbers.
- Do not hide below-chance AUC; surface true metrics and check split/leakage/
  label encoding.

## E. Drug discovery / docking / ADMET
- Delete `mockResult`/`mockAdmet` and any mount auto-run in
  `DrugDiscoveryMode.tsx`. Remove hardcoded docking numbers (e.g. "-8.7 kcal/mol,
  Ki 42.1 nM, 3 H-bonds").
- ADMET: implement REAL RDKit descriptors from a SMILES (MW, logP, TPSA, HBD/HBA,
  rotatable bonds, QED, Lipinski). 
- Docking: run AutoDock Vina only if its binary exists in the runtime; else show
  "Docking unavailable — requires AutoDock Vina configured server-side." Never
  fabricate affinity/Ki/poses.

## F. Remaining hardcoded panels → real or empty state
- `DrugRepurposingEngine.tsx` (hardcoded compounds/radar) → empty until a real
  Open Targets/ChEMBL call.
- `ClinicalGenomicsPanel.tsx` (hardcoded PGX/panel) → empty until real ClinVar/
  PharmGKB/gnomAD.
- `MultiOmicsChartsSuite.tsx` ("Simulated PCA/GSEA") → render only from a real run.
- `AnalysisOutcomesExplorer.tsx` + `ScientificFiguresAndTables.tsx` (default
  hardcoded figures/tables) → empty state when no real run.
- `PlatformSupremacyBenchmark.tsx` (self-promo table) → remove.
- `FileUploadModal.tsx` (hardcoded `genesDetected`) → derive from parsed file or
  omit.

## G. Server: tool-execute must be real
- In `server.ts` `/api/synomics/tool-execute`, replace canned branches: route
  `differential_expression`→`deseq2`, `pathway_enrichment`→`syngo_enrichment`,
  `single_cell*`→`scanpy_singlecell` via `runPythonEngine(...)`; anything with no
  real implementation returns `{status:'needs_specific_tool'}`. Delete hardcoded
  gene universes / fixed counts (e.g. `+842`, `14820`).

## H. Model routing honesty
- Route only to models with a real key/endpoint configured at runtime. If one
  model is configured, use it and say so. Never show votes/consensus/output from
  a model that did not run.

## FINAL VERIFICATION GATE (must all pass)
```bash
# 1. No fabricated data literals or mock scaffolding:
grep -rniE "mockResult|mockAdmet|hardcoded|simulated (pca|gsea)|placeholder result|lorem|dummy|DEFAULT_(GWAS|VERIFICATION)|-8\.7|42\.1 nM|0\.708|0\.820|Volcano_Plot_DEGs|Executive_Summary_Report" src server.ts server/*.ts
# 2. Math.random only for layout/key/id:
grep -rn "Math.random" src | grep -viE "key=|id:|id=|layout|jitter|cx|cy|angle|position"
# 3. Vault/tools only from a real-run path, never chat-answer path:
grep -rniE "vault.bundle|build_vault" src server.ts server/*.ts
# 4. Builds:
npm install && npm run build
python3 -m py_compile server/synomics_engine.py server/biomni_engine.py
```
Runtime checks:
- "provide list of steps to analyze m6A" → clean formatted answer, NO vault/tool cards.
- Every Analysis Hub panel with no input → empty state (no pre-filled numbers).
- Real input → computed values; missing key/tool → honest unavailable message.
- Vault appears only with ≥1 real file; ZIP contents == files on disk.
- Training panel metrics all agree and derive from a real run (or empty state).

Report: the list of files changed and the passing output of all gate commands.
