#!/usr/bin/env python3
"""Tests for sequence/molecular-biology tools (biopython). Run: python tests/seqtools_smoke.py"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "seqtools.py")

try:
    import Bio  # noqa: F401
except Exception as e:
    print(f"SKIP: biopython not available ({e}).")
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

check("translate ATGAAATTTTAA -> MKF*", run({"task": "translate", "sequence": "ATGAAATTTTAA"})["protein"] == "MKF*")
check("revcomp ATGC -> GCAT", run({"task": "revcomp", "sequence": "ATGC"})["reverseComplement"] == "GCAT")
check("GC content of GGCCATAT = 50", abs(run({"task": "gc_content", "sequence": "GGCCATAT"})["gcContent"] - 50.0) < 1e-9)
orf = run({"task": "orf_find", "sequence": "ATGAAAGAAGAAGAAGAAGAAGAAGAAGAAGAAGAAGAATAA", "minAminoAcids": 3})
check("orf found with stop", orf["nOrfs"] >= 1 and orf["orfs"][0]["lengthAA"] >= 3, orf)
tm = run({"task": "primer_tm", "primer": "GCGCGCGCGCGCGCGCGCGC"})
check("primer Tm high for GC-rich 20mer", tm["tmCelsius"] > 60, tm)
rm = run({"task": "restriction_map", "sequence": "GAATTCAAAAGAATTC"})
check("EcoRI finds 2 sites", rm["enzymes"].get("EcoRI", {}).get("nCuts") == 2, rm["enzymes"].get("EcoRI"))
pp = run({"task": "protein_params", "protein": "MKFLVLLFNILCLFPVLA"})
check("protein params computed", pp["molecularWeightDa"] > 1000 and "isoelectricPoint" in pp, pp)
cu = run({"task": "codon_usage", "sequence": "ATGATGAAA"})
check("codon usage counts", cu["counts"].get("ATG") == 2 and cu["counts"].get("AAA") == 1, cu)
check("unknown task -> honest error", run({"task": "nope"}).get("status") == "error")

print(f"\nALL {passed} SEQTOOLS TESTS PASSED")
