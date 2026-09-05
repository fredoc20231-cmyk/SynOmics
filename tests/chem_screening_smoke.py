#!/usr/bin/env python3
"""Ground-truth smoke tests for server/chem_screening.py.

Zero-hallucination: expectations are real RDKit values verified by running the
computation, not hardcoded guesses.

- similarity_screen: query = aspirin. Library = aspirin (self, Tanimoto = 1.0,
  must rank first), salicylic acid (moderate similarity, a hit at threshold 0.3),
  decane (dissimilar, excluded at threshold 0.3).
- pharmacophore_profile: phenol -> at least 1 Aromatic feature and >= 1 Donor
  (the hydroxyl).
- scaffold_clustering: benzene, toluene, phenol all share the benzene Bemis-Murcko
  scaffold `c1ccccc1` (one cluster of size 3); cyclohexane is a distinct scaffold.
- diversity_selection: fixed seed -> deterministic pick (run twice, identical);
  exactly 2 molecules picked.

RDKit emits a Morgan-fingerprint deprecation warning to STDERR; the test reads
STDOUT only, so that is harmless.
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "chem_screening.py")

try:
    from rdkit import Chem  # noqa: F401
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
# Task 1 — similarity_screen
# =========================================================================== #
ASPIRIN = "CC(=O)Oc1ccccc1C(=O)O"
SALICYLIC = "O=C(O)c1ccccc1O"
DECANE = "CCCCCCCCCC"

res = run(
    {
        "task": "similarity_screen",
        "querySmiles": ASPIRIN,
        "library": [
            {"name": "aspirin", "smiles": ASPIRIN},
            {"name": "salicylic_acid", "smiles": SALICYLIC},
            {"name": "decane", "smiles": DECANE},
        ],
        "threshold": 0.3,
    }
)
check("screen status success", res.get("status") == "success", res)
check("screen nScreened == 3", res.get("nScreened") == 3, res)
hits = res.get("hits")
check("screen hits is a list", isinstance(hits, list), res)
hit_names = [h["name"] for h in hits]
# Self-hit: Tanimoto of aspirin vs itself is exactly 1.0 and it ranks first.
check("screen top hit is aspirin", hits and hits[0]["name"] == "aspirin", hits)
check("screen self Tanimoto == 1.0", hits and hits[0]["tanimoto"] == 1.0, hits)
# Salicylic acid is moderately similar (Tanimoto ~0.448 > 0.3) -> a hit.
check("screen salicylic_acid is a hit", "salicylic_acid" in hit_names, hit_names)
# Decane is dissimilar (Tanimoto ~0.03 < 0.3) -> excluded.
check("screen decane excluded at threshold 0.3", "decane" not in hit_names, hit_names)
check("screen nHits == 2", res.get("nHits") == 2, res)
# Hits are ranked by Tanimoto descending.
check(
    "screen hits ranked descending",
    all(hits[i]["tanimoto"] >= hits[i + 1]["tanimoto"] for i in range(len(hits) - 1)),
    hits,
)

# An invalid SMILES in the library is skipped, not fabricated.
res_bad = run(
    {
        "task": "similarity_screen",
        "querySmiles": ASPIRIN,
        "library": [
            {"name": "aspirin", "smiles": ASPIRIN},
            {"name": "junk", "smiles": "not_a_smiles"},
        ],
        "threshold": 0.3,
    }
)
check("screen skips invalid SMILES (nScreened==1)", res_bad.get("nScreened") == 1, res_bad)
check("screen invalid SMILES noted", any("junk" in n for n in res_bad.get("notes", [])), res_bad)


# =========================================================================== #
# Task 2 — pharmacophore_profile
# =========================================================================== #
res2 = run({"task": "pharmacophore_profile", "smiles": "c1ccccc1O"})
check("pharm status success", res2.get("status") == "success", res2)
fam = res2.get("familyCounts", {})
# Phenol has an aromatic ring (>=1 Aromatic) and a hydroxyl donor (>=1 Donor).
check("pharm Aromatic >= 1", fam.get("Aromatic", 0) >= 1, fam)
check("pharm Donor >= 1", fam.get("Donor", 0) >= 1, fam)
check("pharm totalFeatures >= 2", res2.get("totalFeatures", 0) >= 2, res2)
check("pharm features list present", isinstance(res2.get("features"), list), res2)

# Invalid SMILES -> honest error.
res2_bad = run({"task": "pharmacophore_profile", "smiles": "not_a_smiles"})
check("pharm invalid SMILES -> error", res2_bad.get("status") == "error", res2_bad)


# =========================================================================== #
# Task 3 — scaffold_clustering
# =========================================================================== #
res3 = run(
    {
        "task": "scaffold_clustering",
        "molecules": [
            {"name": "benzene", "smiles": "c1ccccc1"},
            {"name": "toluene", "smiles": "Cc1ccccc1"},
            {"name": "phenol", "smiles": "Oc1ccccc1"},
            {"name": "cyclohexane", "smiles": "C1CCCCC1"},
        ],
    }
)
check("scaffold status success", res3.get("status") == "success", res3)
check("scaffold nMolecules == 4", res3.get("nMolecules") == 4, res3)
# benzene/toluene/phenol share the aromatic benzene Murcko scaffold.
check("scaffold nScaffolds == 2", res3.get("nScaffolds") == 2, res3)
clusters = res3.get("clusters")
top = clusters[0]
check("scaffold top cluster size 3", top.get("size") == 3, top)
check("scaffold top cluster is benzene ring", top.get("scaffold") == "c1ccccc1", top)
check(
    "scaffold benzene ring members correct",
    set(top.get("members", [])) == {"benzene", "toluene", "phenol"},
    top,
)
# cyclohexane is its own scaffold.
cyclo = [c for c in clusters if c["scaffold"] == "C1CCCCC1"]
check("scaffold cyclohexane distinct cluster", len(cyclo) == 1 and cyclo[0]["size"] == 1, clusters)


# =========================================================================== #
# Task 4 — diversity_selection
# =========================================================================== #
DIV_LIB = [
    {"name": "aspirin", "smiles": ASPIRIN},
    {"name": "salicylic_acid", "smiles": SALICYLIC},
    {"name": "decane", "smiles": DECANE},
    {"name": "benzene", "smiles": "c1ccccc1"},
    {"name": "cyclohexane", "smiles": "C1CCCCC1"},
    {"name": "ethanol", "smiles": "CCO"},
]
res4 = run({"task": "diversity_selection", "molecules": DIV_LIB, "nPick": 2, "seed": 42})
check("diversity status success", res4.get("status") == "success", res4)
check("diversity nSelected == 2", res4.get("nSelected") == 2, res4)
check("diversity selected list len 2", len(res4.get("selected", [])) == 2, res4)
check("diversity meanPairwiseTanimoto present", res4.get("meanPairwiseTanimoto") is not None, res4)
# Fixed seed -> deterministic selection.
res4b = run({"task": "diversity_selection", "molecules": DIV_LIB, "nPick": 2, "seed": 42})
sel_a = [s["name"] for s in res4["selected"]]
sel_b = [s["name"] for s in res4b["selected"]]
check("diversity deterministic with fixed seed", sel_a == sel_b, (sel_a, sel_b))

# nPick >= library size -> all molecules returned.
res4c = run({"task": "diversity_selection", "molecules": DIV_LIB, "nPick": 99, "seed": 42})
check("diversity nPick>=size returns all", res4c.get("nSelected") == len(DIV_LIB), res4c)


# =========================================================================== #
# Dispatch / error handling
# =========================================================================== #
check("unknown task -> error", run({"task": "nope"}).get("status") == "error")
check(
    "missing querySmiles -> error",
    run({"task": "similarity_screen", "library": [{"name": "a", "smiles": ASPIRIN}]}).get("status") == "error",
)
check(
    "empty library -> error",
    run({"task": "similarity_screen", "querySmiles": ASPIRIN, "library": []}).get("status") == "error",
)
check("missing smiles (pharm) -> error", run({"task": "pharmacophore_profile"}).get("status") == "error")
check("empty molecules (scaffold) -> error", run({"task": "scaffold_clustering", "molecules": []}).get("status") == "error")
check("empty molecules (diversity) -> error", run({"task": "diversity_selection", "molecules": []}).get("status") == "error")

print(f"\nALL {passed} CHEM-SCREENING TESTS PASSED")
