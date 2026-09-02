# AI Studio Build Prompt — SynOmics (ZERO fake / mock / demo)

ACT AS: An elite full-stack bioinformatics engineer and AI systems architect.

## NON-NEGOTIABLE RULE (overrides everything below)
Never fabricate. Every number, chart, table, or claim must be a **real computed
result** or a **real fetched result**, or the UI must show an **honest
"not available / provide input" state**. Do **NOT** mock API calls, do NOT
hardcode sample results, do NOT use `Math.random()` or `setTimeout` to fake
computation or latency, and do NOT display any output before the user has run an
analysis. If a capability's tool/key/data is missing, say so plainly — never
simulate it. This rule cannot be relaxed "temporarily" or "for the demo."

## OBJECTIVE
Evolve the EXISTING "SynOmics" codebase (do not rebuild from scratch) into a
general-purpose bioinformatics AI platform: ChatGPT-style conversation, an
autonomous execution agent, a clean card-based dashboard, and a downloadable
project "vault". It must handle any domain (genomics, transcriptomics,
proteomics, drug discovery) with no neurobiology-specific limits. Preserve and
build on the already-real analysis engine in `server/synomics_engine.py`
(alignment, differential expression with exact Welch's t-test, enrichment,
single-cell, GWAS, microbiome, Ramachandran, phylogenetics, MS/MS, ΔΔG, ODE,
Kaplan–Meier) and the real AlphaFold DB fetch. Do not replace real code with
placeholders.

## 1. UI/UX — ChatGPT + clean iCAT-style dashboard
- ChatGPT-style layout: left sidebar (Projects, Settings), central conversational
  workspace. User types natural-language instructions and/or drags in files
  (FASTQ, CSV/TSV, VCF, PDB, SDF/SMILES, H5AD).
- Card-based outputs. Light theme: white `#FFFFFF`, dark gray text `#1A1A1A`,
  emerald/teal accent `#0F766E`, soft shadows. (No dark mode required.)
- Live execution view: a collapsible card streaming the REAL code the agent runs
  and REAL tool output. If nothing has run, show an empty state — never a
  pre-filled fake log.

## 2. Autonomous agent — honest model routing
- On submit: parse request + data, plan, generate Python/R, execute in a real
  sandbox, inspect output, self-correct, synthesize.
- Model routing: route ONLY to models that are actually configured with a real
  key/endpoint at runtime (e.g. Gemini via `GEMINI_API_KEY`; Qwen/Llama only if a
  real endpoint key like `OPENROUTER_API_KEY`/`TOGETHER_API_KEY` is set).
  If only one model is configured, use it and say so. NEVER show votes,
  "consensus %", or output from a model that did not actually run.
- Code execution must be REAL (harden the existing `/api/synomics/python-exec`:
  isolated process, temp files in the OS temp dir, CPU/time/memory limits). If a
  real sandbox is unavailable in this deployment, disable execution and say so —
  do not simulate results.

## 3. Output organization — the "Omics Vault" (real files only)
On completion, bundle a downloadable ZIP with these folders, populated only with
artifacts actually produced by the run:
- `/Figures` — real plots generated from the run (SVG/PNG).
- `/Tables` — real result tables (CSV/XLSX).
- `/Codes` — the exact scripts the agent generated and executed.
- `/Results` — an auto-generated report (PDF via `reportlab`, DOCX via
  `python-docx`) built from the run's real hypothesis/methods/findings/figures.
If a section has no real content, omit it or state "not produced" — do not pad
with example content.

## 4. Drug discovery module — real or honestly unavailable
- Target ID: rank proteins by druggability from the user's real omics input.
- ADMET: use **RDKit** to compute real descriptors from a SMILES (Lipinski, QED,
  logP, TPSA, etc.). This is achievable via pip — implement it for real.
- Molecular docking: wrap **AutoDock Vina** if its binary is available in the
  runtime. If Vina/DiffDock is NOT installed, the docking panel must show
  "Docking requires AutoDock Vina configured server-side" — NOT fabricated
  affinities/poses. Detect availability at runtime and branch honestly.

## 5. Architecture (evolve current stack; add where needed)
- Keep the current Vite + React + TypeScript frontend and Express/Node server
  that spawns the Python engine. Add: real file upload + format validation,
  WebSocket (or SSE) streaming of real execution logs, and the vault ZIP builder.
- If a task queue is warranted, add one; do not let queue/stream scaffolding emit
  fake progress or fake results.

## VERIFICATION GATE (must pass before saying "done")
1. `grep -rniE "mock|hardcoded|simulated (pca|gsea)|placeholder result|lorem|dummy|DEFAULT_(GWAS|VERIFICATION)"` over `src` and `server` returns only real inputs or allowed cosmetic uses.
2. `grep -rn "Math.random" src` — only layout/`key`/`id`, never data.
3. `npm install && npm run build` is green (tsc + vite + esbuild).
4. `python3 -m py_compile server/synomics_engine.py` passes; engine smoke tests pass.
5. Runtime: every panel with no input shows an empty state; real input yields
   computed values; missing model key / missing docking tool shows an honest
   unavailable message.

## ACTION
Acknowledge these constraints. Then, WITHOUT introducing any mock/demo data:
1. Add the ChatGPT-style light card UI over the existing components.
2. Add real WebSocket/SSE streaming of the real `/python-exec` output.
3. Implement honest model routing (only configured models).
4. Implement real RDKit ADMET + runtime-gated Vina docking (honest fallback).
5. Implement the real `/Figures /Tables /Codes /Results` vault ZIP + PDF/DOCX
   report from real run artifacts.
Report the exact files you changed/added and paste the passing verification-gate
output.
