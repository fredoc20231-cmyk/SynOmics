#!/usr/bin/env python3
"""Ground-truth smoke tests for server/omics_assoc_tools.py.

Zero-hallucination: expectations are derived from data generated with a KNOWN
structure (numpy default_rng(0)) or computed analytically, not hardcoded
guesses.

- methylome_wide_association: one site is a strong linear function of the
  phenotype; the other 19 are pure noise. The signal site must have the smallest
  padj (<0.05), be flagged significant, and the number of significant sites must
  stay small.
- compare_protein_structures: structure B is A after a rigid transform
  (translation + known rotation); Kabsch RMSD-after must be ~0 while RMSD-before
  is clearly positive.
- barcode_sequencing: fixed reads/barcodes -> exact counts, unassigned, total,
  and an analytically computed Shannon diversity.
"""
import json
import math
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "omics_assoc_tools.py")

try:
    import numpy as np
except Exception as e:
    print(f"SKIP: numpy not available ({e}).")
    sys.exit(0)
try:
    import scipy  # noqa: F401
except Exception as e:
    print(f"SKIP: scipy not available ({e}).")
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
# Task 1 — methylome_wide_association
# =========================================================================== #
rng = np.random.default_rng(0)
n_samples, n_sites = 60, 20
phenotype = rng.normal(size=n_samples)
methylation = rng.normal(size=(n_samples, n_sites))
# Site 0 is strongly associated; sites 1..19 are pure noise.
methylation[:, 0] = 2.0 * phenotype + 0.1 * rng.normal(size=n_samples)

res = run(
    {
        "task": "methylome_wide_association",
        "methylation": methylation.tolist(),
        "phenotype": phenotype.tolist(),
    }
)
check("mwas status success", res.get("status") == "success", res)
results = res.get("results")
check("mwas results is a list of 20", isinstance(results, list) and len(results) == n_sites, res)
# results are sorted by padj ascending -> the signal site must be first.
top = results[0]
check("mwas top site is site_0", top["site"] == "site_0", top)
check("mwas top padj < 0.05", top["padj"] < 0.05, top)
# site_0 must have the smallest padj of all sites.
padj_by_site = {r["site"]: r["padj"] for r in results}
check(
    "mwas site_0 has the global minimum padj",
    padj_by_site["site_0"] == min(padj_by_site.values()),
    padj_by_site,
)
# Only a small number of sites should be significant, and site_0 among them.
sig_sites = {r["site"] for r in results if r["padj"] < 0.05}
check("mwas site_0 flagged significant", "site_0" in sig_sites, sig_sites)
check("mwas nSignificant >= 1", res["nSignificant"] >= 1, res)
check("mwas nSignificant small (<=3)", res["nSignificant"] <= 3, res)
check("mwas nSignificant matches sig set size", res["nSignificant"] == len(sig_sites), (res["nSignificant"], sig_sites))
# The signal site has a large positive coefficient (methylation = ~2*phenotype).
check("mwas site_0 beta ~ 2", abs(top["beta"] - 2.0) < 0.2, top)

# siteIds are honoured when provided.
site_ids = [f"cg{j:04d}" for j in range(n_sites)]
res_ids = run(
    {
        "task": "methylome_wide_association",
        "methylation": methylation.tolist(),
        "phenotype": phenotype.tolist(),
        "siteIds": site_ids,
    }
)
check("mwas honours siteIds (top == cg0000)", res_ids["results"][0]["site"] == "cg0000", res_ids["results"][0])

# Shape mismatch (phenotype too short) -> error.
mm = run(
    {
        "task": "methylome_wide_association",
        "methylation": methylation.tolist(),
        "phenotype": phenotype[:-1].tolist(),
    }
)
check("mwas shape mismatch -> error", mm.get("status") == "error", mm)


# =========================================================================== #
# Task 2 — compare_protein_structures
# =========================================================================== #
rng2 = np.random.default_rng(0)
coordsA = rng2.normal(size=(10, 3)) * 10.0
theta = math.pi / 5.0  # 36 degrees about the z-axis
Rz = np.array(
    [
        [math.cos(theta), -math.sin(theta), 0.0],
        [math.sin(theta), math.cos(theta), 0.0],
        [0.0, 0.0, 1.0],
    ]
)
# Rigid transform: translate by [5,0,0] then rotate.
coordsB = (coordsA + np.array([5.0, 0.0, 0.0])) @ Rz.T

res2 = run(
    {
        "task": "compare_protein_structures",
        "coordsA": coordsA.tolist(),
        "coordsB": coordsB.tolist(),
    }
)
check("compare status success", res2.get("status") == "success", res2)
check("compare nAtoms == 10", res2.get("nAtoms") == 10, res2)
check("compare rmsdBefore > 0", res2["rmsdBefore"] > 1.0, res2)
check("compare rmsdAfter ~ 0 (rigid transform)", res2["rmsdAfter"] < 1e-6, res2)
check("compare rmsdBefore > rmsdAfter", res2["rmsdBefore"] > res2["rmsdAfter"], res2)

# Shape mismatch (different atom counts) -> error.
mm2 = run(
    {
        "task": "compare_protein_structures",
        "coordsA": coordsA.tolist(),
        "coordsB": coordsB[:-1].tolist(),
    }
)
check("compare shape mismatch -> error", mm2.get("status") == "error", mm2)


# =========================================================================== #
# Task 3 — barcode_sequencing
# =========================================================================== #
barcodes = {"S1": "AAAA", "S2": "CCCC"}
reads = [
    "AAAACGTA",  # -> S1
    "AAAATTTT",  # -> S1
    "AAAAGGGG",  # -> S1
    "CCCCAAAA",  # -> S2
    "CCCCTTTT",  # -> S2
    "GGGGCCCC",  # -> unassigned
]
res3 = run(
    {
        "task": "barcode_sequencing",
        "reads": reads,
        "barcodes": barcodes,
        "barcodeStart": 0,
        "maxMismatches": 0,
    }
)
check("barcode status success", res3.get("status") == "success", res3)
check("barcode S1 == 3", res3["counts"]["S1"] == 3, res3)
check("barcode S2 == 2", res3["counts"]["S2"] == 2, res3)
check("barcode unassigned == 1", res3["unassignedCount"] == 1, res3)
check("barcode totalReads == 6", res3["totalReads"] == 6, res3)
# Analytic Shannon diversity over assigned distribution: p = [3/5, 2/5].
p1, p2 = 3.0 / 5.0, 2.0 / 5.0
shannon_expected = -(p1 * math.log(p1) + p2 * math.log(p2))
check(
    "barcode shannonDiversity matches analytic value",
    abs(res3["shannonDiversity"] - shannon_expected) < 1e-9,
    (res3["shannonDiversity"], shannon_expected),
)

# maxMismatches allows one substitution in the barcode region.
res3b = run(
    {
        "task": "barcode_sequencing",
        "reads": ["AAAT....", "ACCC...."],  # 1 mismatch each vs S1 / S2
        "barcodes": barcodes,
        "maxMismatches": 1,
    }
)
check("barcode 1-mismatch assigns", res3b["counts"]["S1"] == 1 and res3b["counts"]["S2"] == 1, res3b)
check("barcode 1-mismatch no unassigned", res3b["unassignedCount"] == 0, res3b)


# =========================================================================== #
# Dispatch / error handling
# =========================================================================== #
check("unknown task -> error", run({"task": "nope"}).get("status") == "error")
check("missing methylation -> error", run({"task": "methylome_wide_association"}).get("status") == "error")
check("missing coords -> error", run({"task": "compare_protein_structures"}).get("status") == "error")
check("missing reads -> error", run({"task": "barcode_sequencing"}).get("status") == "error")

print(f"\nALL {passed} OMICS-ASSOC TESTS PASSED")
