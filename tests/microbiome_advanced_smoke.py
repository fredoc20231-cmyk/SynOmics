#!/usr/bin/env python3
"""Tests for advanced microbiome analyses. Run: python tests/microbiome_advanced_smoke.py"""
import json
import os
import random
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "microbiome_advanced.py")

try:
    import numpy  # noqa: F401
    import scipy  # noqa: F401
    import statsmodels  # noqa: F401
except Exception as e:
    print(f"SKIP: stats stack not available ({e}).")
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

# chao1: 4 taxa, 2 singletons, 1 doubleton -> chao1 = 4 + (2*1)/(2*2) = 4.5
c = run({"task": "chao1", "counts": {"S1": {"a": 10, "b": 1, "c": 2, "d": 1}}})
check("chao1 bias-corrected estimate", abs(c["perSample"]["S1"]["chao1"] - 4.5) < 1e-6, c)

rng = random.Random(0)
da_counts = {}
groups = {}
for i in range(6):
    da_counts[f"c{i}"] = {"X": int(rng.gauss(10, 2)), "Y": int(rng.gauss(50, 5)), "Z": int(rng.gauss(30, 4))}
    groups[f"c{i}"] = "ctrl"
    da_counts[f"t{i}"] = {"X": int(rng.gauss(80, 8)), "Y": int(rng.gauss(50, 5)), "Z": int(rng.gauss(30, 4))}
    groups[f"t{i}"] = "trt"
da = run({"task": "differential_abundance", "counts": da_counts, "groups": groups})
check("DA runs and finds significance", da.get("status") == "success" and da["nSignificant"] >= 1, da)
xrow = next(r for r in da["results"] if r["taxon"] == "X")
check("DA: taxon X is up in treatment (largest +CLR diff)", xrow["clrMeanDiff"] > 0 and xrow["significant"], xrow)
check("DA: X has the largest positive CLR shift", xrow["clrMeanDiff"] == max(r["clrMeanDiff"] for r in da["results"]), da["results"])

rf = run({"task": "rarefaction", "counts": {"S1": {"a": 10, "b": 5, "c": 3, "d": 2}}, "steps": 3})
curve = rf["perSample"]["S1"]
check("rarefaction monot, ends at observed richness 4", curve[-1]["expectedRichness"] == 4.0 and curve[0]["expectedRichness"] <= curve[-1]["expectedRichness"], curve)

check("unknown task -> honest error", run({"task": "nope", "counts": {"S1": {"a": 1}}}).get("status") == "error")

print(f"\nALL {passed} MICROBIOME-ADVANCED TESTS PASSED")
