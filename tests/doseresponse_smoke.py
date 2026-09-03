#!/usr/bin/env python3
"""Tests for dose-response curve fitting (scipy). Run: python tests/doseresponse_smoke.py"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "doseresponse.py")

try:
    import scipy  # noqa: F401
except Exception as e:
    print(f"SKIP: scipy not available ({e}).")
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

doses = [0.1, 0.3, 1, 3, 10, 30, 100, 300, 1000]
resp = [100 / (1 + (10 / d) ** 1) for d in doses]  # true IC50=10, hill=1
d = run({"task": "ic50", "doses": doses, "responses": resp})
check("IC50 recovered ~10", abs(d["ic50"] - 10.0) < 0.5, d)
check("Hill slope ~1", abs(d["hillSlope"] - 1.0) < 0.1, d)
check("R^2 near 1 on clean sigmoid", d["rSquared"] > 0.99, d)

check("AUC of triangle 0..3 == 4.5", abs(run({"task": "auc", "x": [0, 1, 2, 3], "y": [0, 1, 2, 3]})["auc"] - 4.5) < 1e-9)

check("too few points -> honest error", run({"task": "ic50", "doses": [1, 2], "responses": [1, 2]}).get("status") == "error")
check("unknown task -> honest error", run({"task": "nope"}).get("status") == "error")

print(f"\nALL {passed} DOSE-RESPONSE TESTS PASSED")
