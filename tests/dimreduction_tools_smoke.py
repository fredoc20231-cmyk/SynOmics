#!/usr/bin/env python3
"""Tests for dimensionality reduction (scikit-learn). Run: python tests/dimreduction_tools_smoke.py"""
import json
import os
import random
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "dimreduction_tools.py")
try:
    import sklearn  # noqa: F401
except Exception as e:
    print(f"SKIP: scikit-learn not available ({e}).")
    sys.exit(0)
passed = 0
def check(n, c, ctx=None):
    global passed
    if not c:
        print(f"FAIL: {n}\n  {ctx}"); sys.exit(1)
    passed += 1; print(f"ok: {n}")
def run(p):
    r = subprocess.run([sys.executable, SCRIPT], input=json.dumps(p).encode(), stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return json.loads(r.stdout.decode())
rng = random.Random(0)
M = [[rng.gauss(0, 1) for _ in range(5)] for _ in range(15)]
Mpos = [[abs(rng.gauss(5, 1)) for _ in range(5)] for _ in range(15)]
r = run({"task": "mds", "matrix": M})
check("MDS returns 2-D embedding", r["status"] == "success" and len(r["embedding"]) == 15 and len(r["embedding"][0]) == 2, r)
check("ICA runs", run({"task": "ica", "matrix": M})["status"] == "success")
nmf = run({"task": "nmf", "matrix": Mpos})
check("NMF runs with reconstruction error", nmf["status"] == "success" and nmf["reconstructionErr"] >= 0, nmf)
check("NMF rejects negative matrix", run({"task": "nmf", "matrix": M}).get("status") == "error")
check("factor analysis runs", run({"task": "factor_analysis", "matrix": M})["status"] == "success")
check("kernel PCA runs", run({"task": "kernel_pca", "matrix": M})["status"] == "success")
check("unknown task -> honest error", run({"task": "nope", "matrix": M}).get("status") == "error")
print(f"\nALL {passed} DIMREDUCTION TESTS PASSED")
