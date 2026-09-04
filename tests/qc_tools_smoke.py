#!/usr/bin/env python3
"""Tests for QC tools. Run: python tests/qc_tools_smoke.py"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "qc_tools.py")
try:
    import numpy  # noqa: F401
except Exception as e:
    print(f"SKIP: numpy not available ({e}).")
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
fq = run({"task": "fastq_quality", "fastq": "@r1\nGGCC\n+\nIIII\n@r2\nATAT\n+\n!!!!\n"})
check("FASTQ mean quality (I=40,!=0 -> 20)", abs(fq["meanQuality"] - 20.0) < 1e-9 and fq["nReads"] == 2, fq)
check("FASTQ GC% == 50", abs(fq["gcPercent"] - 50.0) < 1e-9, fq)
cm = run({"task": "count_matrix_qc", "counts": [[5, 0, 2], [3, 3, 0]], "genes": ["A", "MT-CO1", "B"]})
check("count QC median lib size 6.5", cm["medianLibrarySize"] == 6.5, cm)
check("count QC mito% detects MT gene", cm["mitoPercent"][1] == 50.0, cm)
od = run({"task": "outlier_mad", "x": [10, 11, 10, 12, 11, 100]})
check("MAD flags the 100 outlier", od["nOutliers"] == 1 and od["outliers"][0]["value"] == 100.0, od)
check("unknown task -> honest error", run({"task": "nope"}).get("status") == "error")
print(f"\nALL {passed} QC TESTS PASSED")
