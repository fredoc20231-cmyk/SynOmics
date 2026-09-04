#!/usr/bin/env python3
"""Tests for enrichment tools. Run: python tests/enrichment_tools_smoke.py"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "enrichment_tools.py")
try:
    import scipy  # noqa: F401
except Exception as e:
    print(f"SKIP: scipy/statsmodels not available ({e}).")
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
o = run({"task": "ora", "query": ["G1", "G2", "G3", "G4", "G5"],
         "geneSets": {"A": ["G1", "G2", "G3", "G50", "G51"], "B": ["G90", "G91", "G92"]},
         "universe": [f"G{i}" for i in range(100)]})
check("ORA finds enriched set A first, significant", o["results"][0]["term"] == "A" and o["results"][0]["significant"], o)
check("ORA fold enrichment > 1", o["results"][0]["foldEnrichment"] > 1, o)
ov = run({"task": "geneset_overlap", "setA": ["A", "B", "C", "D"], "setB": ["C", "D", "E"]})
check("Jaccard 2/5 = 0.4", abs(ov["jaccard"] - 0.4) < 1e-9 and ov["sharedGenes"] == ["C", "D"], ov)
check("unknown task -> honest error", run({"task": "nope"}).get("status") == "error")
print(f"\nALL {passed} ENRICHMENT TESTS PASSED")
