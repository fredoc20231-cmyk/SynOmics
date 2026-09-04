#!/usr/bin/env python3
"""Tests for population genetics estimators. Run: python tests/population_genetics_smoke.py"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "population_genetics.py")
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
# identical haplotypes -> pi 0
check("pi == 0 for identical haplotypes", run({"task": "nucleotide_diversity", "haplotypes": [[0, 1, 0], [0, 1, 0], [0, 1, 0]]})["pi"] == 0.0)
# divergent -> pi > 0
check("pi > 0 for divergent haplotypes", run({"task": "nucleotide_diversity", "haplotypes": [[0, 0, 1, 1], [1, 1, 0, 0], [0, 1, 0, 1]]})["pi"] > 0)
tj = run({"task": "tajimas_d", "haplotypes": [[0, 0, 1], [0, 1, 0], [1, 0, 0], [1, 1, 1], [0, 0, 0]]})
check("Tajima's D computed", tj["status"] == "success" and tj["segregatingSites"] > 0, tj)
# fully differentiated pops -> Fst near 1
fst = run({"task": "fst", "pop1": [[0, 0], [0, 0], [0, 0]], "pop2": [[1, 1], [1, 1], [1, 1]]})
check("Fst ~1 for fully differentiated pops", fst["fstGlobal"] > 0.9, fst)
check("LD r^2 == 1 for identical loci", abs(run({"task": "ld_r2", "locusA": [0, 0, 1, 1], "locusB": [0, 0, 1, 1]})["r2"] - 1.0) < 1e-9)
check("MAF spectrum computed", run({"task": "maf_spectrum", "haplotypes": [[0, 1, 1], [0, 1, 0], [1, 1, 0]]})["status"] == "success")
check("unknown task -> honest error", run({"task": "nope"}).get("status") == "error")
print(f"\nALL {passed} POPULATION-GENETICS TESTS PASSED")
