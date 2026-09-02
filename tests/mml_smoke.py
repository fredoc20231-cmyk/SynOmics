#!/usr/bin/env python3
"""Test MML model selection. Requires numpy. Run: python tests/mml_smoke.py"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "mml.py")
try:
    import numpy as np
except Exception as e:
    print(f"SKIP: numpy not available ({e}).")
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

rng = np.random.default_rng(0)
x = np.linspace(-3, 3, 80)
yq = 1.5 * x**2 - 2 * x + 0.5 + rng.normal(0, 0.5, len(x))
rq = run({"x": x.tolist(), "y": yq.tolist(), "maxDegree": 8})
check("selects quadratic for quadratic data", rq["selectedDegree"] == 2)

yl = 3 * x + 1 + rng.normal(0, 0.5, len(x))
rl = run({"x": x.tolist(), "y": yl.tolist(), "maxDegree": 8})
check("selects linear for linear data", rl["selectedDegree"] == 1)
check("does not overfit to max degree", rq["selectedDegree"] < 8 and rl["selectedDegree"] < 8)

rg = run({"candidates": [{"name": "simple", "paramsCount": 2, "negLogLik": 100, "n": 50},
                         {"name": "complex", "paramsCount": 10, "negLogLik": 98, "n": 50}]})
check("generic mode prefers parsimonious model", rg["selected"] == "simple")
print(f"\nALL {passed} MML TESTS PASSED")
