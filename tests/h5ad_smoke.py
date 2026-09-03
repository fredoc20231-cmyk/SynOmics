#!/usr/bin/env python3
"""Module A — H5AD profiling tests. Builds a minimal, REAL AnnData-format HDF5
fixture with h5py and asserts the profiler reads its true structure and applies the
HALT-on-ambiguity rule. Requires h5py + numpy.

Run: `python tests/h5ad_smoke.py`
"""
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "h5ad_profiler.py")

try:
    import h5py
    import numpy as np
except Exception as e:
    print(f"SKIP: h5py/numpy not available ({e}).")
    sys.exit(0)

passed = 0
def check(name, cond, ctx=None):
    global passed
    if not cond:
        print(f"FAIL: {name}\n  {ctx}")
        sys.exit(1)
    passed += 1
    print(f"ok: {name}")


def run(path):
    p = subprocess.run([sys.executable, SCRIPT], input=json.dumps({"path": path}).encode(),
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return json.loads(p.stdout.decode())


def build_h5ad(path, n_obs, n_var, with_group=True):
    rng = np.random.default_rng(0)
    with h5py.File(path, "w") as f:
        f.attrs["encoding-type"] = "anndata"
        f.attrs["encoding-version"] = "0.1.0"
        f.create_dataset("X", data=rng.poisson(3, (n_obs, n_var)).astype("float32"))
        obs = f.create_group("obs")
        obs.attrs["_index"] = "_index"
        obs.create_dataset("_index", data=np.array([f"cell{i}".encode() for i in range(n_obs)]))
        if with_group:
            cond = obs.create_group("condition")
            cond.attrs["encoding-type"] = "categorical"
            cond.create_dataset("categories", data=np.array([b"control", b"treated"]))
            cond.create_dataset("codes", data=(np.arange(n_obs) % 2).astype("int8"))
        var = f.create_group("var")
        var.attrs["_index"] = "_index"
        var.create_dataset("_index", data=np.array([f"GENE{i}".encode() for i in range(n_var)]))


tmp = tempfile.mkdtemp(prefix="h5ad_test_")

# 1. Well-formed h5ad with a grouping column.
p1 = os.path.join(tmp, "good.h5ad")
build_h5ad(p1, 40, 12, with_group=True)
r = run(p1)
check("status success", r.get("status") == "success", r)
check("reads true cell count", r["nCells"] == 40, r)
check("reads true gene count", r["nGenes"] == 12, r)
check("X encoding dense", r["xEncoding"] == "dense", r)
check("cell id preview real", r["cellIdPreview"][0] == "cell0", r)
check("gene id preview real", r["geneIdPreview"][0] == "GENE0", r)
cand = {c["column"]: c for c in r["groupingCandidates"]}
check("detects condition grouping", "condition" in cand, r["groupingCandidates"])
check("condition has correct levels", set(cand["condition"]["levels"]) == {"control", "treated"}, cand)
check("no clarification needed when grouping exists", r["needsClarification"] is False, r)

# 2. No grouping column -> HALT on ambiguity.
p2 = os.path.join(tmp, "ambiguous.h5ad")
build_h5ad(p2, 30, 8, with_group=False)
r2 = run(p2)
check("ambiguous status success", r2.get("status") == "success", r2)
check("HALT: needsClarification true", r2["needsClarification"] is True, r2)
check("HALT: asks a precise question", "grouping" in r2.get("clarificationQuestion", "").lower(), r2)

# 3. Missing file -> honest error.
r3 = run(os.path.join(tmp, "nope.h5ad"))
check("missing file -> honest error", r3.get("status") == "error", r3)

print(f"\nALL {passed} H5AD PROFILER TESTS PASSED")
