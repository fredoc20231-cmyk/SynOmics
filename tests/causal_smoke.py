#!/usr/bin/env python3
"""End-to-end test for causal discovery (DirectLiNGAM). Validates that the real
module recovers a KNOWN causal structure from synthetic linear non-Gaussian data
and gates edges by bootstrap stability. Requires numpy.

Run: `python tests/causal_smoke.py`
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "causal_discovery.py")

try:
    import numpy as np
except Exception as e:
    print(f"SKIP: numpy not available ({e}).")
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

# Known DAG: A -> B -> C, plus A -> C. Non-Gaussian noise (cubed uniform).
rng = np.random.default_rng(3)
n = 3000
A = rng.uniform(-1, 1, n) ** 3
B = 2.0 * A + 0.3 * (rng.uniform(-1, 1, n) ** 3)
C = 1.5 * B + 0.6 * A + 0.3 * (rng.uniform(-1, 1, n) ** 3)
data = np.c_[A, B, C].tolist()

res = run({"data": data, "variables": ["A", "B", "C"], "nBootstrap": 100, "seed": 5})
check("status success", res.get("status") == "success")
check("causal order recovered (A first, C last)", res["causalOrder"][0] == "A" and res["causalOrder"][-1] == "C")

edge_pairs = {(e["cause"], e["effect"]) for e in res["edges"]}
check("recovers A->B causal edge", ("A", "B") in edge_pairs)
check("recovers B->C causal edge", ("B", "C") in edge_pairs)
check("no reversed edge C->A fabricated", ("C", "A") not in edge_pairs and ("C", "B") not in edge_pairs)
check("edges carry stability >= threshold", all(e["stability"] >= 0.9 for e in res["edges"]))

# Honest error on insufficient data.
bad = run({"data": [[1, 2], [3, 4]], "variables": ["x", "y"]})
check("insufficient data -> honest error", bad.get("status") == "error")

print(f"\nALL {passed} CAUSAL DISCOVERY TESTS PASSED")
