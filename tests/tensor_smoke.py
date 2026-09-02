#!/usr/bin/env python3
"""End-to-end test for Tensor-Train compression. Requires numpy + tensorly.
Run: `python tests/tensor_smoke.py`
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "tensor_compression.py")

try:
    import numpy as np
    import tensorly  # noqa: F401
except Exception as e:
    print(f"SKIP: numpy/tensorly not available ({e}).")
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

# A genuinely rank-1 tensor (outer product) compresses near-exactly with TT rank 1.
a = np.linspace(1, 2, 6); b = np.linspace(0, 1, 6); c = np.linspace(-1, 1, 6)
low_rank = np.einsum("i,j,k->ijk", a, b, c)
res = run({"tensor": low_rank.tolist(), "rank": 1, "maxRelError": 1e-4})
check("status success", res.get("status") == "success")
check("rank-1 tensor reconstructs near-exactly", res["relativeError"] < 1e-6)
check("not flagged approximate when within tolerance", res["approximate"] is False)
check("achieves real compression", res["compressionRatio"] and res["compressionRatio"] > 1.0)

# A full-rank random tensor at rank 1 must be flagged approximate (honest).
rng = np.random.default_rng(0)
dense = rng.standard_normal((6, 6, 6))
res2 = run({"tensor": dense.tolist(), "rank": 1, "maxRelError": 1e-4})
check("dense tensor at low rank flagged approximate", res2["approximate"] is True and res2["relativeError"] > 1e-4)

# Honest error on bad input.
bad = run({"tensor": [1, 2, 3]})
check("1-D input -> honest error", bad.get("status") == "error")

print(f"\nALL {passed} TENSOR COMPRESSION TESTS PASSED")
