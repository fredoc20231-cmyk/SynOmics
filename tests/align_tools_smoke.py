#!/usr/bin/env python3
import json
import os
import subprocess
import sys

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SCRIPT=os.path.join(ROOT,"server","align_tools.py")
try:
    import Bio  # noqa: F401
except Exception as e:
    print(f"SKIP: biopython not available ({e})."); sys.exit(0)
passed=0
def check(n,c,ctx=None):
    global passed
    if not c: print(f"FAIL: {n}\n  {ctx}"); sys.exit(1)
    passed+=1; print(f"ok: {n}")
def run(p):
    r=subprocess.run([sys.executable,SCRIPT],input=json.dumps(p).encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE); return json.loads(r.stdout.decode())
check("global identity 7/8 = 87.5", abs(run({"task":"global_align","seq1":"ACGTACGT","seq2":"ACGTATGT"})["identity"]-87.5)<1e-6)
check("local align positive score on shared core", run({"task":"local_align","seq1":"TTACGTACGTAA","seq2":"ACGTACGT"})["score"]>0)
check("percent identity 100 for identical", run({"task":"percent_identity","seq1":"ACGT","seq2":"ACGT"})["identity"]==100.0)
check("kmer distance 0 for identical", run({"task":"kmer_distance","seq1":"ACGTACGT","seq2":"ACGTACGT","k":3})["distance"]==0.0)
check("kmer distance 1 for disjoint", run({"task":"kmer_distance","seq1":"AAAAAA","seq2":"TTTTTT","k":3})["distance"]==1.0)
check("missing seq -> honest error", run({"task":"global_align","seq1":"A"}).get("status")=="error")
print(f"\nALL {passed} ALIGN TESTS PASSED")
