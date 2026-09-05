#!/usr/bin/env python3
"""Ground-truth smoke tests for server/admet_tools.py.

Zero-hallucination: every expectation is a real RDKit-computed value for a
well-known molecule, verified by running RDKit directly before being asserted
here (see the comments for each constant), not a hardcoded guess.

- admet_profile: aspirin's QED / TPSA / logP match RDKit within tight
  tolerances, and an invalid SMILES is flagged as an error entry (no crash).
- druglikeness_rules: aspirin passes Lipinski (0 violations); rules are returned
  per set with explicit violation lists.
- synthetic_accessibility: ethanol's Ertl SA score is ~1.98 -> "easy".
- structural_alerts: catechol trips PAINS/BRENK/NIH alerts; ethanol is clean.
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "admet_tools.py")

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


ASPIRIN = "CC(=O)Oc1ccccc1C(=O)O"
ETHANOL = "CCO"
CATECHOL = "c1ccc(O)c(O)c1"

# =========================================================================== #
# Task 1 — admet_profile
# =========================================================================== #
res = run({"task": "admet_profile", "smiles": ASPIRIN})
check("admet status success", res.get("status") == "success", res)
check("admet nValid == 1", res.get("nValid") == 1, res)
prof = res["profiles"][0]
# RDKit ground truth (verified): QED=0.5501, TPSA=63.6, logP=1.3101.
check("admet aspirin QED ~ 0.55", abs(prof["qed"] - 0.55) < 0.02, prof)
check("admet aspirin TPSA ~ 63.6", abs(prof["tpsa"] - 63.6) < 0.5, prof)
check("admet aspirin logP ~ 1.31", abs(prof["logP"] - 1.31) < 0.1, prof)
# The full 13-descriptor panel must be present.
for key in (
    "molecularWeight",
    "logP",
    "tpsa",
    "hBondDonors",
    "hBondAcceptors",
    "rotatableBonds",
    "aromaticRings",
    "fractionCsp3",
    "molarRefractivity",
    "heavyAtoms",
    "formalCharge",
    "numRings",
    "qed",
):
    check(f"admet panel has {key}", key in prof, prof)
# Aspirin: MW ~ 180.16, 1 aromatic ring, 13 heavy atoms.
check("admet aspirin MW ~ 180", abs(prof["molecularWeight"] - 180.16) < 0.5, prof)
check("admet aspirin 1 aromatic ring", prof["aromaticRings"] == 1, prof)
check("admet aspirin 13 heavy atoms", prof["heavyAtoms"] == 13, prof)

# Batch mode with a mix of valid and invalid SMILES.
res_batch = run({"task": "admet_profile", "smilesList": [ASPIRIN, "XYZ123", ETHANOL]})
check("admet batch status success", res_batch.get("status") == "success", res_batch)
check("admet batch nMolecules == 3", res_batch.get("nMolecules") == 3, res_batch)
check("admet batch nValid == 2", res_batch.get("nValid") == 2, res_batch)
check("admet batch nInvalid == 1", res_batch.get("nInvalid") == 1, res_batch)
# The invalid SMILES becomes an error entry, not a crash / not a fabricated row.
invalid_entry = res_batch["profiles"][1]
check("admet invalid SMILES flagged as error", "error" in invalid_entry, invalid_entry)
check("admet invalid entry has no qed", "qed" not in invalid_entry, invalid_entry)

# =========================================================================== #
# Task 2 — druglikeness_rules
# =========================================================================== #
res2 = run({"task": "druglikeness_rules", "smiles": ASPIRIN})
check("druglikeness status success", res2.get("status") == "success", res2)
rules = res2["rules"]
check("druglikeness has 5 rule sets", len(rules) == 5, rules)
# Aspirin is a textbook Lipinski pass with 0 violations.
check("druglikeness aspirin Lipinski passes", rules["lipinski"]["pass"] is True, rules)
check("druglikeness aspirin 0 Lipinski violations", rules["lipinski"]["nViolations"] == 0, rules)
check("druglikeness aspirin Veber passes", rules["veber"]["pass"] is True, rules)
check("druglikeness aspirin Egan passes", rules["egan"]["pass"] is True, rules)
# Each rule reports a violations list.
for name in ("lipinski", "veber", "ghose", "egan", "muegge"):
    check(f"druglikeness {name} has violations list", isinstance(rules[name]["violations"], list), rules[name])

# =========================================================================== #
# Task 3 — synthetic_accessibility
# =========================================================================== #
res3 = run({"task": "synthetic_accessibility", "smiles": ETHANOL})
if res3.get("status") == "unavailable":
    print(f"SKIP: SA scorer unavailable ({res3.get('error')}).")
else:
    check("SA status success", res3.get("status") == "success", res3)
    # RDKit contrib ground truth (verified): ethanol SA score = 1.98.
    check("SA ethanol score ~ 1.98", abs(res3["saScore"] - 1.98) < 0.1, res3)
    check("SA ethanol interpretation easy", res3["interpretation"] == "easy", res3)

# =========================================================================== #
# Task 4 — structural_alerts
# =========================================================================== #
res4 = run({"task": "structural_alerts", "smiles": CATECHOL})
check("alerts status success", res4.get("status") == "success", res4)
# Verified: catechol trips >=1 alert across PAINS/BRENK/NIH (3 in RDKit 2026.03).
check("alerts catechol has >=1 alert", res4["nAlerts"] >= 1, res4)
check("alerts each has description+catalog", all("description" in a and "catalog" in a for a in res4["alerts"]), res4)

# A clean simple molecule -> zero alerts is a valid result.
res4b = run({"task": "structural_alerts", "smiles": ETHANOL})
check("alerts ethanol status success", res4b.get("status") == "success", res4b)
check("alerts ethanol is clean (0 alerts)", res4b["nAlerts"] == 0, res4b)

# =========================================================================== #
# Dispatch / error handling
# =========================================================================== #
check("unknown task -> error", run({"task": "nope"}).get("status") == "error")
check("admet missing smiles -> error", run({"task": "admet_profile"}).get("status") == "error")
check("druglikeness missing smiles -> error", run({"task": "druglikeness_rules"}).get("status") == "error")
check("druglikeness bad SMILES -> error", run({"task": "druglikeness_rules", "smiles": "XYZ123"}).get("status") == "error")
check("alerts missing smiles -> error", run({"task": "structural_alerts"}).get("status") == "error")

print(f"\nALL {passed} ADMET TESTS PASSED")
