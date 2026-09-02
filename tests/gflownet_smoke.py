#!/usr/bin/env python3
"""End-to-end test for iDiscover Frontier 1 — GFlowNet molecular sampling.

Validates the ZERO-BS contract: every returned molecule is RDKit-sanitizable with a
real computed QED, the trained sampler concentrates on higher reward than uniform
random assembly (the point of Trajectory Balance), and the sampler returns a diverse
set (not one optimum). Requires numpy + rdkit.

Run: `python tests/gflownet_smoke.py`
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "gflownet.py")

try:
    import numpy  # noqa: F401
    from rdkit import Chem
    from rdkit.Chem import QED
except Exception as e:
    print(f"SKIP: numpy/rdkit not available ({e}).")
    sys.exit(0)

passed = 0
def check(name, cond):
    global passed
    if not cond:
        print(f"FAIL: {name}")
        sys.exit(1)
    passed += 1
    print(f"ok: {name}")

def run(payload):
    p = subprocess.run([sys.executable, SCRIPT], input=json.dumps(payload).encode(),
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return json.loads(p.stdout.decode())

# Keep iterations modest so CI stays fast but training is still meaningful.
res = run({"objective": "qed", "maxLength": 4, "beta": 4.0, "iterations": 600,
           "batchSize": 16, "nSamples": 150, "topK": 10, "seed": 1337})
check("status success", res.get("status") == "success")
check("returned distinct valid molecules", res["distinctValidMolecules"] >= 3)
check("diverse (not one optimum)", len(res["candidates"]) >= 3)

# ZERO-BS: every returned molecule is genuinely RDKit-valid with the reported QED.
for c in res["candidates"]:
    mol = Chem.MolFromSmiles(c["smiles"])
    check(f"candidate {c['smiles']} is RDKit-valid", mol is not None)
    real_qed = round(float(QED.qed(mol)), 4)
    check(f"reported QED matches RDKit for {c['smiles']}", abs(real_qed - c["qed"]) < 1e-3)

# Trajectory Balance guarantee: trained policy concentrates above uniform random.
dv = res["diversityVerification"]
check("trained mean QED >= uniform-random mean QED", dv["concentratesAboveUniform"] is True)
check("trained mean QED strictly beats uniform baseline", dv["trainedMeanQED"] > dv["uniformRandomMeanQED"])

# Unsupported objective -> honest error, never a fabricated score.
bad = run({"objective": "binding_affinity"})
check("unsupported objective -> honest error", bad.get("status") == "error")

print(f"\nALL {passed} GFLOWNET (iDiscover) TESTS PASSED")
