# Skill: RNA-seq DE → pathway over-representation

**Name:** `rnaseq-de-enrichment`

A curated two-step workflow that takes a raw gene count matrix to a ranked list of
enriched pathways, chaining two real, CI-gated SynOmics tools.

## Steps
1. **`rnaseq_deseq`** — DESeq2-style differential expression (median-of-ratios
   normalization → NB-GLM Wald test → BH FDR → log2FC shrinkage). Produces the
   per-gene `results` table.
2. **`over_representation`** — hypergeometric over-representation of the
   **significant** genes (padj < α, extracted by the `sigGenes` transform) against
   the provided `geneSets`, with fold enrichment + BH FDR.

## Inputs
| param | description |
| --- | --- |
| `counts` | gene count matrix `{gene:[counts…]}` or genes×samples array (required) |
| `conditions` | two-group label per sample (required) |
| `reference` | control group level (optional) |
| `geneSets` | `{setName: [genes]}` pathway definitions (required) |
| `alpha` | FDR threshold for significance (default 0.05) |

## Output
The over-representation result (`output.primary = enrichment`) plus the full
per-step trace and the intermediate DE table.

## Guarantees
Every value passed from step 1 to step 2 is a genuine computed output — the
significant-gene list is derived from real BH-adjusted p-values, never fabricated.
A failing step halts the skill with an honest error.
