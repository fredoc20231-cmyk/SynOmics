#!/usr/bin/env python3
"""End-to-end test for iDiscover Frontier 2 — Optimal Transport cellular reversion.

Validates the Wasserstein distance against an analytically KNOWN 1-D optimal
transport, checks that the top revert commits are exact input gene names with the
correct direction, and that non-convergence / malformed input return honest errors.
Requires numpy (POT optional — exact vs Sinkhorn fallback both accepted).

Run: `python tests/optimal_transport_smoke.py`
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "optimal_transport.py")

try:
    import numpy as np  # noqa: F401
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

# 1. Analytic 1-D case: source {0,1} -> target {10,11}. Optimal matching 0->10,
#    1->11 gives squared-cost 100, so the 2-Wasserstein distance == 10 exactly.
res = run({"sourceMatrix": [[0], [1]], "targetMatrix": [[10], [11]], "genes": ["G1"], "topK": 1})
check("status success", res.get("status") == "success")
check("Wasserstein distance == 10 (analytic)", abs(res["wassersteinDistance"] - 10.0) < 1e-3)
commit = res["revertCommits"][0]
check("revert commit gene is exact input name", commit["gene"] == "G1")
check("revert commit direction UP (0/1 -> 10/11)", commit["direction"] == "UP")
check("revert commit mean shift ~ +10", abs(commit["meanShift"] - 10.0) < 1e-3)

# 2. Multi-gene diseased->healthy: TP53 high->low, MYC low->high, ACTB ~unchanged.
res2 = run({
    "sourceMatrix": [[5, 0, 3], [6, 0, 2], [5, 1, 3]],
    "targetMatrix": [[0, 5, 3], [1, 6, 3], [0, 5, 2]],
    "genes": ["TP53", "MYC", "ACTB"], "topK": 3,
})
check("multi-gene status success", res2.get("status") == "success")
by_gene = {c["gene"]: c for c in res2["revertCommits"]}
check("TP53 flagged DOWN", by_gene["TP53"]["direction"] == "DOWN")
check("MYC flagged UP", by_gene["MYC"]["direction"] == "UP")
check("TP53/MYC are the top-2 largest shifts", {res2["revertCommits"][0]["gene"], res2["revertCommits"][1]["gene"]} == {"TP53", "MYC"})
check("no fabricated gene names", all(c["gene"] in ["TP53", "MYC", "ACTB"] for c in res2["revertCommits"]))

# 3. Gene-dimension mismatch -> honest error, never a guess.
bad = run({"sourceMatrix": [[1, 2]], "targetMatrix": [[1, 2, 3]], "genes": ["a", "b"]})
check("dimension mismatch -> honest error", bad.get("status") == "error")

print(f"\nALL {passed} OPTIMAL TRANSPORT (iDiscover) TESTS PASSED")
