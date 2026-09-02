#!/usr/bin/env python3
"""End-to-end test for the enhanced ML adversary (classifier overfit +
covariate confounder). Requires scikit-learn. Run: `python tests/adversary_ml_smoke.py`
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "adversary.py")

try:
    import numpy as np
    import sklearn  # noqa: F401
except Exception as e:
    print(f"SKIP: scikit-learn not available ({e}).")
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

rng = np.random.default_rng(1)
def nz(s): return float(rng.normal(0, s))
conds = ["control"] * 6 + ["treated"] * 6

# Separable signal.
sig = {}
for g in range(20):
    b = rng.uniform(20, 50)
    sig[f"S{g}"] = [max(0, b + nz(3)) for _ in range(6)] + [max(0, b * 3 + nz(3)) for _ in range(6)]
r = run({"counts": sig, "conditions": conds, "nPermutations": 200})
check("signal VALIDATED by classifier", r["verdict"] == "VALIDATED" and r["overfitCheck"]["permutationP"] <= 0.05)

# Pure noise.
noise = {f"N{g}": [max(0, rng.uniform(20, 50) + nz(10)) for _ in range(12)] for g in range(20)}
r2 = run({"counts": noise, "conditions": conds, "nPermutations": 200})
check("noise INVALIDATED (overfit veto)", r2["verdict"] == "INVALIDATED" and r2["veto"] is True)

# Confounder aligned with a batch covariate.
r3 = run({"counts": sig, "conditions": conds, "nPermutations": 200, "covariates": {"batch": ["b1"] * 6 + ["b2"] * 6}})
check("batch confounder detected", r3["confounderCheck"]["confounderDetected"] is True)

# Honest error on missing inputs.
bad = run({"counts": {}, "conditions": []})
check("missing inputs -> honest error", bad.get("status") == "error")

print(f"\nALL {passed} ADVERSARY-ML TESTS PASSED")
