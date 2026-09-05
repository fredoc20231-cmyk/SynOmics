#!/usr/bin/env python3
"""Ground-truth smoke tests for server/drug_repurposing.py.

Zero-hallucination: expectations are derived from data with a KNOWN structure or
computed analytically, not hardcoded guesses.

- connectivity_score: a reference signature is built so the query UP genes sit at
  the very TOP (highest values) and the DOWN genes at the very BOTTOM => the
  connectivity score must be strongly POSITIVE (the drug mimics the query). The
  reference is then FLIPPED (up genes at the bottom, down at the top) => the score
  must flip to strongly NEGATIVE (the drug reverses the query). The sign must flip
  and |score| must be large.
- signature_reversal_screen: a disease signature is screened against a drug whose
  signature is its EXACT NEGATION (Spearman rho = -1 => reversalScore = +1, ranks
  #1) and a drug that is IDENTICAL (rho = +1 => reversalScore = -1, ranks last).
- target_based_repurposing: query = aspirin; the library contains aspirin itself
  (Tanimoto = 1.0, top hit, echoes its indication) and decane (very dissimilar,
  below threshold, excluded).
- dispatch/error handling: unknown task -> error; empty up+down -> error.
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "drug_repurposing.py")

try:
    import numpy as np  # noqa: F401
except Exception as e:
    print(f"SKIP: numpy not available ({e}).")
    sys.exit(0)
try:
    import scipy  # noqa: F401
except Exception as e:
    print(f"SKIP: scipy not available ({e}).")
    sys.exit(0)
try:
    import rdkit  # noqa: F401
except Exception as e:
    print(f"SKIP: rdkit not available ({e}).")
    sys.exit(0)

passed = 0


def check(n, c, ctx=None):
    global passed
    if not c:
        print(f"FAIL: {n}\n  {ctx}")
        sys.exit(1)
    passed += 1
    print(f"ok: {n}")


def run(p):
    r = subprocess.run(
        [sys.executable, SCRIPT],
        input=json.dumps(p).encode(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return json.loads(r.stdout.decode())


# =========================================================================== #
# Task 1 — connectivity_score
# =========================================================================== #
# Reference of 100 genes, strictly decreasing values (g0 highest, g99 lowest).
n = 100
reference = {f"g{i}": float(n - i) for i in range(n)}
up_top = ["g0", "g1", "g2", "g3"]      # at the very TOP of the ranked list
down_bottom = ["g96", "g97", "g98", "g99"]  # at the very BOTTOM

res_mimic = run(
    {
        "task": "connectivity_score",
        "upGenes": up_top,
        "downGenes": down_bottom,
        "referenceSignature": reference,
    }
)
check("connectivity status success", res_mimic.get("status") == "success", res_mimic)
check("connectivity ksUp positive", res_mimic["ksUp"] > 0.5, res_mimic)
check("connectivity ksDown negative", res_mimic["ksDown"] < -0.5, res_mimic)
check(
    "connectivity mimic score strongly POSITIVE",
    res_mimic["connectivityScore"] > 0.5,
    res_mimic,
)

# FLIP: put up genes at the bottom and down genes at the top -> reversal.
res_reverse = run(
    {
        "task": "connectivity_score",
        "upGenes": down_bottom,   # now the "up" query sits at the bottom
        "downGenes": up_top,      # and the "down" query sits at the top
        "referenceSignature": reference,
    }
)
check("connectivity flip status success", res_reverse.get("status") == "success", res_reverse)
check(
    "connectivity reverse score strongly NEGATIVE",
    res_reverse["connectivityScore"] < -0.5,
    res_reverse,
)
# The sign must flip and the magnitude must be large & symmetric here.
check(
    "connectivity sign flips",
    res_mimic["connectivityScore"] > 0 and res_reverse["connectivityScore"] < 0,
    (res_mimic["connectivityScore"], res_reverse["connectivityScore"]),
)
check(
    "connectivity magnitudes large & symmetric",
    abs(res_mimic["connectivityScore"] + res_reverse["connectivityScore"]) < 1e-9
    and abs(res_mimic["connectivityScore"]) > 0.5,
    (res_mimic["connectivityScore"], res_reverse["connectivityScore"]),
)

# Empty up+down -> error.
empty = run({"task": "connectivity_score", "upGenes": [], "downGenes": [], "referenceSignature": reference})
check("connectivity empty up+down -> error", empty.get("status") == "error", empty)
# Missing reference -> error.
noref = run({"task": "connectivity_score", "upGenes": up_top, "downGenes": down_bottom})
check("connectivity missing reference -> error", noref.get("status") == "error", noref)


# =========================================================================== #
# Task 2 — signature_reversal_screen
# =========================================================================== #
disease = {"A": 2.0, "B": 1.0, "C": 0.0, "D": -1.0, "E": -2.0}
drug_sigs = {
    "NEG": {"A": -2.0, "B": -1.0, "C": 0.0, "D": 1.0, "E": 2.0},   # exact negation
    "POS": {"A": 2.0, "B": 1.0, "C": 0.0, "D": -1.0, "E": -2.0},   # identical
    "TOO_FEW": {"A": 1.0, "B": -1.0},                               # <3 shared -> skipped
}
res_screen = run(
    {
        "task": "signature_reversal_screen",
        "diseaseSignature": disease,
        "drugSignatures": drug_sigs,
    }
)
check("screen status success", res_screen.get("status") == "success", res_screen)
ranking = res_screen.get("ranking")
check("screen ranking is a list of 2", isinstance(ranking, list) and len(ranking) == 2, res_screen)
# NEG (exact negation) must rank #1 with reversalScore ~ +1 (Spearman rho = -1).
check("screen top drug is NEG", ranking[0]["drug"] == "NEG", ranking)
check("screen NEG reversalScore ~ 1.0", abs(ranking[0]["reversalScore"] - 1.0) < 1e-9, ranking[0])
check("screen NEG correlation ~ -1.0", abs(ranking[0]["correlation"] + 1.0) < 1e-9, ranking[0])
# POS (identical) must rank last with reversalScore ~ -1 (Spearman rho = +1).
check("screen last drug is POS", ranking[-1]["drug"] == "POS", ranking)
check("screen POS reversalScore ~ -1.0", abs(ranking[-1]["reversalScore"] + 1.0) < 1e-9, ranking[-1])
check("screen POS correlation ~ +1.0", abs(ranking[-1]["correlation"] - 1.0) < 1e-9, ranking[-1])
# TOO_FEW must be skipped, not ranked.
check("screen TOO_FEW skipped", any(s.get("drug") == "TOO_FEW" for s in res_screen["skipped"]), res_screen)
check("screen nRanked == 2", res_screen["nRanked"] == 2, res_screen)


# =========================================================================== #
# Task 3 — target_based_repurposing
# =========================================================================== #
res_sim = run(
    {
        "task": "target_based_repurposing",
        "querySmiles": "CC(=O)Oc1ccccc1C(=O)O",  # aspirin
        "library": [
            {"name": "aspirin", "smiles": "CC(=O)Oc1ccccc1C(=O)O", "indication": "analgesic"},
            {"name": "decane", "smiles": "CCCCCCCCCC"},          # very dissimilar
            {"name": "bad", "smiles": "not_a_smiles"},           # invalid -> skipped
        ],
        "threshold": 0.3,
    }
)
check("repurpose status success", res_sim.get("status") == "success", res_sim)
hits = res_sim.get("hits")
check("repurpose has hits", isinstance(hits, list) and len(hits) >= 1, res_sim)
# Self-match: aspirin vs aspirin -> Tanimoto 1.0, first, echoes its indication.
check("repurpose top hit is aspirin", hits[0]["name"] == "aspirin", hits)
check("repurpose self Tanimoto == 1.0", hits[0]["tanimoto"] == 1.0, hits[0])
check("repurpose echoes indication", hits[0]["indication"] == "analgesic", hits[0])
# Decane is below threshold -> excluded from hits.
check("repurpose decane excluded (below threshold)", all(h["name"] != "decane" for h in hits), hits)
# Invalid SMILES is skipped with a note, never fabricated.
check("repurpose invalid SMILES skipped", any(s.get("name") == "bad" for s in res_sim["skipped"]), res_sim)
# Invalid query SMILES -> error.
bad_query = run({"task": "target_based_repurposing", "querySmiles": "xyz!!!", "library": [{"name": "a", "smiles": "CCO"}]})
check("repurpose invalid query -> error", bad_query.get("status") == "error", bad_query)


# =========================================================================== #
# Dispatch / error handling
# =========================================================================== #
check("unknown task -> error", run({"task": "nope"}).get("status") == "error")
check("missing disease signature -> error", run({"task": "signature_reversal_screen"}).get("status") == "error")
check("missing library -> error", run({"task": "target_based_repurposing", "querySmiles": "CCO"}).get("status") == "error")

print(f"\nALL {passed} DRUG-REPURPOSING TESTS PASSED")
