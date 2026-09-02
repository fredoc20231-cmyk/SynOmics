#!/usr/bin/env python3
"""Test Gillespie SSA stochastic circuit verification. Requires numpy.
Run: python tests/circuit_smoke.py"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "circuit_verify.py")
try:
    import numpy  # noqa: F401
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

# Production-degradation: 0 -> X (k=10), X -> 0 (gamma=1). Steady-state mean = k/gamma = 10.
base = {"reactions": [{"reactants": {}, "products": {"X": 1}, "rate": 10.0},
                      {"reactants": {"X": 1}, "products": {}, "rate": 1.0}],
        "initialState": {"X": 0}, "maxTime": 25, "nRuns": 800, "seed": 1}

r = run({**base, "property": {"species": "X", "comparator": ">=", "threshold": 5, "byTime": 25, "targetProbability": 0.9}})
check("status success", r.get("status") == "success")
check("SSA steady-state mean matches analytic k/gamma=10", 8.0 <= r["meanEndpoint"]["X"] <= 12.0)
check("reachable property VERIFIED", r["verdict"] == "VERIFIED")
check("Wilson CI reported", isinstance(r["wilson95CI"], list) and len(r["wilson95CI"]) == 2)

r2 = run({**base, "property": {"species": "X", "comparator": ">=", "threshold": 100, "byTime": 25, "targetProbability": 0.9}})
check("unreachable property VIOLATED", r2["verdict"] == "VIOLATED")

print(f"\nALL {passed} CIRCUIT VERIFICATION TESTS PASSED")
