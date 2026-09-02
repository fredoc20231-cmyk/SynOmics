#!/usr/bin/env python3
"""Test self-optimizing Cython compilation. Requires numpy + Cython + a C compiler.
Run: `python tests/accelerate_smoke.py`
"""
import json, os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "accelerate.py")
try:
    import numpy, Cython  # noqa: F401
except Exception as e:
    print(f"SKIP: numpy/Cython not available ({e}).")
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

r = run({"kernel": "sum_sq_pairwise", "n": 1200, "seed": 7})
if r.get("status") == "unavailable":
    print("SKIP: C compiler unavailable for Cython."); sys.exit(0)
check("status success", r["status"] == "success")
check("compiled result matches pure Python", r["resultsMatch"] is True and r["relError"] < 1e-9)
check("real speedup measured (>1x)", r["speedupFactor"] and r["speedupFactor"] > 1.0)
check("unknown kernel -> honest error", run({"kernel": "nope"}).get("status") == "error")
print(f"\nALL {passed} ACCELERATE TESTS PASSED")
