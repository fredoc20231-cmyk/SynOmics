#!/usr/bin/env python3
"""Test real RDKit molecular descriptors. Requires rdkit.
Run: python tests/drug_descriptors_smoke.py"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "drug_descriptors.py")
try:
    from rdkit import Chem  # noqa: F401
except Exception as e:
    print(f"SKIP: rdkit not available ({e}).")
    sys.exit(0)

passed = 0
def check(name, cond):
    global passed
    if not cond:
        print(f"FAIL: {name}"); sys.exit(1)
    passed += 1
    print(f"ok: {name}")

def run(payload):
    p = subprocess.run([sys.executable, SCRIPT], input=json.dumps(payload).encode(),
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return json.loads(p.stdout.decode())

# Aspirin: known MW ~180.16.
r = run({"smiles": "CC(=O)Oc1ccccc1C(=O)O", "name": "Aspirin"})
check("status success", r["status"] == "success")
check("aspirin MW ~180.16", abs(r["descriptors"]["molecularWeight"] - 180.16) < 0.5)
check("QED in [0,1]", 0 <= r["descriptors"]["qedDrugLikeness"] <= 1)
check("aspirin passes Lipinski", r["druglikeness"]["passesLipinski"] is True)
check("docking NOT fabricated", r["bindingAffinity"]["available"] is False)

# Gefitinib canonicalizes and computes.
g = run({"smiles": "COc1cc2ncnc(Nc3ccc(F)c(Cl)c3)c2cc1OCCCN1CCOCC1"})
check("gefitinib MW ~446.9", abs(g["descriptors"]["molecularWeight"] - 446.9) < 1.0)

check("invalid SMILES -> honest error", run({"smiles": "xxx not smiles"}).get("status") == "error")
print(f"\nALL {passed} DRUG-DESCRIPTOR TESTS PASSED")
