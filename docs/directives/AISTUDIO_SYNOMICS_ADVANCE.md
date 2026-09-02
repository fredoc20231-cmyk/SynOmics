# SynOmics Advancement Directive (apply Biomni + verifiable-provenance lessons)

Zero fake/mock/demo remains absolute. Implement in this order. Each program is a
separate change; do not claim a capability "done" until its gate passes and
`npm run build` + `python3 -m py_compile server/*.py` are green.

## PROGRAM 1 — Capability Truth Registry (do this FIRST; it enforces zero-fake structurally)
Create `server/capabilities/registry.json`, `schema.json`, `validator.py`.
Each capability entry:
`{ id, domain, public_name, api_route, engine_command, status, validation_level,
input_types, output_types, deterministic, seed_controlled, provenance_level,
reference_library, reference_version, parity_test_path, known_limitations,
introduced_version, last_validated_commit }`
Statuses: `SUPPORTED_VALIDATED | SUPPORTED_CONDITIONAL | EXPERIMENTAL | UNSUPPORTED`.
Rules (enforced, not cosmetic):
- The frontend Analysis Hub renders a tool ONLY if it is in the registry; its
  badge = its status. `UNSUPPORTED` tools are hidden or disabled.
- Server: calling an `UNSUPPORTED` route returns `501 {status:'unsupported'}`
  BEFORE any work; `EXPERIMENTAL` responses include `"experimental":true` and the
  UI shows a visible label.
- No UI string, docs page, or model/agent claim may exceed the registry.
- `validator.py` runs in CI and fails on invalid/stale entries.
Seed the registry with the already-real engine commands: align_sequences,
deseq2, syngo_enrichment, scanpy_singlecell, ramachandran_contact,
phylogenetic_tree, msms_fragment, network_topology, mutagenesis_ddg,
kaplan_meier, markov_clustering, ode_simulate, gwas, microbiome (all
SUPPORTED_VALIDATED or _CONDITIONAL); docking/ADMET/repurposing/clinical =
UNSUPPORTED until Program 3 wires a real backend.

## PROGRAM 2 — Numerical validation & parity (this is "reliable and accurate")
Create `server/tests/parity/` (Python). For every engine function, add: a fixed
deterministic fixture, a trusted reference (scipy / statsmodels / scikit-learn /
lifelines / biopython), documented absolute+relative tolerance, plus edge,
missing-value, and invalid-input (must raise) cases.
- DE t-test already matches t-tables — formalize it here; add Kaplan–Meier vs
  lifelines, enrichment vs scipy hypergeom, alignment vs Biopython, PCoA/PCA
  numeric checks, GWAS λ_GC check.
- Emit `reports/numerical-validation.md` (function, ref lib+version, expected,
  observed, abs/rel error, tolerance, status, commit). A function may be
  `SUPPORTED_VALIDATED` in the registry ONLY if its parity test passes.
- Add these to `.github/workflows/ci.yml`.

## PROGRAM 3 — Real database + tool connectors (Biomni-level grounding), opt-in & cached
Add `server` REST wrappers, each cached to disk with a provenance record
(URL, timestamp, response SHA-256); mark `SUPPORTED_CONDITIONAL` (needs network/key):
Ensembl (gene→coords/transcripts), UniProt (protein), MyGene/MyVariant,
ClinVar + gnomAD (variant annotation), GWAS Catalog, Open Targets (targets),
ChEMBL/PubChem (compounds), PDB + AlphaFold DB (structure — AlphaFold pLDDT
already real). Replace the hardcoded ACMG/PGX/repurposing panels with these.
Real ADMET: RDKit descriptors from SMILES (SUPPORTED_CONDITIONAL, needs rdkit).
Docking: AutoDock Vina subprocess only if the binary exists, else registry
`UNSUPPORTED` + honest UI message. Never fabricate affinities.

## PROGRAM 4 — Provenance + reproducibility on every run
Attach to each analysis result and to the Omics Vault a JSON record:
inputs + SHA-256 hashes, parameters, random seed, engine_command +
backend/library versions, python version, timestamps, and (for DB calls) source
URLs + response hashes. Deterministic seeds where randomness is used. The Vault
ZIP includes this `provenance.json`; the report cites it. (This is Sheen's
defensible edge — bring it into SynOmics.)

## PROGRAM 5 — Skills library (Biomni-style reusable, validated workflows)
Add `server/skills/` = named multi-step pipelines that ONLY chain registered
SUPPORTED capabilities (e.g. "bulk RNA-seq DE→enrichment", "GWAS→fine-map→
enrichment", "variant→annotate→prioritize"). The agent must check the skills
library and the capability registry before planning, plan before executing
multi-step tasks, cite sources for external data, and stream real tool logs.

## PROGRAM 6 — Honest positioning & release gates
- Generate the public capability page and any "what SynOmics can do" copy FROM
  the registry (not hand-written).
- A release may call a feature "validated" only if: implemented, registered,
  parity test passing, deterministic, provenance emitted, docs generated from
  registry, CI green on py3.10–3.12.
- Never claim "more advanced than Biomni", production-ready, or clinical-ready.

## VERIFICATION GATE (all must pass)
```bash
python3 server/capabilities/validator.py            # registry valid, no stale entries
python3 -m pytest server/tests/parity -q             # numerical parity passes
grep -rniE "mock|hardcoded|simulated (pca|gsea)|placeholder result|DEFAULT_(GWAS|VERIFICATION)" src server.ts server/*.ts   # no data fabrication
npm install && npm run build
python3 -m py_compile server/synomics_engine.py server/biomni_engine.py
```
Runtime: Analysis Hub shows only registry tools with correct status badges;
UNSUPPORTED routes 501 before work; every result carries provenance; DB panels
show real fetched data or honest "unavailable". Report files changed + gate output.
