#!/usr/bin/env python3
"""End-to-end test for the adversarial swarm. Requires scipy.
Run: `python tests/swarm_smoke.py`
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "swarm.py")

try:
    import numpy as np
    import scipy  # noqa: F401
except Exception as e:
    print(f"SKIP: scipy not available ({e}).")
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

rng = np.random.default_rng(2)
conds = ["control"] * 8 + ["treated"] * 8
counts = {}
for g in range(10):
    b = rng.uniform(30, 60)
    counts[f"SIG{g}"] = [max(0, b + rng.normal(0, 3)) for _ in range(8)] + [max(0, b * 4 + rng.normal(0, 3)) for _ in range(8)]
for g in range(20):
    b = rng.uniform(30, 60)
    counts[f"N{g}"] = [max(0, b + rng.normal(0, 8)) for _ in range(16)]

r = run({"counts": counts, "conditions": conds, "fdr": 0.01})
check("status success", r.get("status") == "success")
check("exact permutation used for small samples", r["permutation"]["exact"] is True)
surv = {s["gene"] for s in r["survivors"]}
check("real signal genes survive (>=8/10)", sum(1 for g in surv if g.startswith("SIG")) >= 8)
check("no noise gene survives at FDR<0.01 across all models", sum(1 for g in surv if g.startswith("N")) == 0)
check("survivors tagged with survival rate 1.0", all(s["swarmSurvivalRate"] == 1.0 for s in r["survivors"]))
check("survivors carry per-model FDR", all(set(s["perModelFDR"].keys()) == {"welch_t", "mann_whitney", "permutation"} for s in r["survivors"]))

print(f"\nALL {passed} SWARM TESTS PASSED")
