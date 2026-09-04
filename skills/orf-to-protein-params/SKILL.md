# Skill: ORF finding → protein biophysical parameters

**Name:** `orf-to-protein-params`

A curated two-step workflow that goes from a DNA sequence to the biophysical
profile of its longest-ORF protein product, chaining two real, CI-gated tools.

## Steps
1. **`orf_find`** — scan all frames/strands for open reading frames; returns
   `orfs` sorted by length (each with its translated `protein`).
2. **`protein_params`** — biophysical parameters (MW, pI, GRAVY hydrophobicity,
   aromaticity, instability index, secondary-structure fractions) of the longest
   ORF's protein, bound via the dot-path `orfs.0.protein`.

## Inputs
| param | description |
| --- | --- |
| `dna` | DNA sequence to scan (required) |
| `minAA` | minimum ORF length in amino acids (optional) |

## Output
The protein-parameters result (`output.primary = props`) plus the ORF table and
the full per-step trace.

## Guarantees
The protein analyzed in step 2 is the exact translation produced by step 1 — bound
by explicit dot-path, no fabrication. If no ORF meets `minAA`, step 2 fails
honestly rather than inventing a sequence.
