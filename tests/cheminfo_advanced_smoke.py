#!/usr/bin/env python3
"""Tests for advanced cheminformatics (RDKit). Run: python tests/cheminfo_advanced_smoke.py"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "cheminfo_advanced.py")

try:
    from rdkit import Chem  # noqa: F401
except Exception as e:
    print(f"SKIP: rdkit not available ({e}).")
    sys.exit(0)

passed = 0
def check(name, cond, ctx=None):
    global passed
    if not cond:
        print(f"FAIL: {name}\n  {ctx}")
        sys.exit(1)
    passed += 1
    print(f"ok: {name}")

def run(p):
    r = subprocess.run([sys.executable, SCRIPT], input=json.dumps(p).encode(),
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return json.loads(r.stdout.decode())

ASP = "CC(=O)OC1=CC=CC=C1C(=O)O"
IBU = "CC(C)CC1=CC=C(C=C1)C(C)C(=O)O"

check("tanimoto self == 1.0", abs(run({"task": "tanimoto", "smiles1": ASP, "smiles2": ASP})["tanimoto"] - 1.0) < 1e-9)
check("tanimoto distinct < 1", run({"task": "tanimoto", "smiles1": ASP, "smiles2": IBU})["tanimoto"] < 0.9)

sm = run({"task": "similarity_matrix", "smiles": [ASP, IBU, "c1ccccc1"]})
check("similarity matrix diagonal is 1", all(sm["matrix"][i][i] == 1.0 for i in range(3)), sm["matrix"])
check("similarity matrix symmetric", sm["matrix"][0][1] == sm["matrix"][1][0], sm["matrix"])

ss = run({"task": "substructure_search", "query": "c1ccccc1", "smiles": ["Cc1ccccc1", "CCO", ASP]})
check("benzene substructure found in aromatic mols only", ss["nMatches"] == 2 and ss["results"][1]["match"] is False, ss)

check("murcko scaffold of aspirin is benzene", run({"task": "murcko_scaffold", "smiles": ASP})["scaffold"] == "c1ccccc1")

pf = run({"task": "pains_filter", "smiles": ["c1ccccc1", "O=C1C=CC(=O)C=C1"]})
check("PAINS: benzene clean, quinone flagged", pf["results"][0]["painsFlagged"] is False and pf["results"][1]["painsFlagged"] is True, pf)

check("invalid SMILES -> honest error", run({"task": "tanimoto", "smiles1": "not_a_mol", "smiles2": ASP}).get("status") == "error")
check("unknown task -> honest error", run({"task": "nope"}).get("status") == "error")

print(f"\nALL {passed} CHEMINFO-ADVANCED TESTS PASSED")
