#!/usr/bin/env python3
"""Tests for proteomics tools. Run: python tests/proteomics_tools_smoke.py"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "proteomics_tools.py")
passed = 0
def check(n, c, ctx=None):
    global passed
    if not c:
        print(f"FAIL: {n}\n  {ctx}"); sys.exit(1)
    passed += 1; print(f"ok: {n}")
def run(p):
    r = subprocess.run([sys.executable, SCRIPT], input=json.dumps(p).encode(), stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return json.loads(r.stdout.decode())
# PEPTIDE monoisotopic [M] = 799.360 Da (known reference)
pm = run({"task": "peptide_mass", "peptide": "PEPTIDE"})
check("PEPTIDE monoisotopic mass ~799.36", abs(pm["monoisotopicMass"] - 799.360) < 0.02, pm)
dg = run({"task": "tryptic_digest", "protein": "MKWVTFISLLK"})
peps = [x["peptide"] for x in dg["peptides"]]
check("trypsin cuts after K -> MK + WVTFISLLK", "MK" in peps and "WVTFISLLK" in peps, dg)
fi = run({"task": "fragment_ions", "peptide": "PEPTIDE"})
check("b/y ion ladders length n-1", len(fi["bIons"]) == 6 and len(fi["yIons"]) == 6, fi)
check("first b-ion = P + proton (~98.06)", abs(fi["bIons"][0] - 98.06) < 0.05, fi)
check("empty peptide -> honest error", run({"task": "peptide_mass", "peptide": ""}).get("status") == "error")
print(f"\nALL {passed} PROTEOMICS TESTS PASSED")
