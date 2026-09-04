#!/usr/bin/env python3
import json
import os
import subprocess
import sys

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SCRIPT=os.path.join(ROOT,"server","phylo_tools.py")
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
seqs={"A":"ACGTACGT","B":"ACGTACGA","C":"ACGAACGA","D":"TTGTACGA"}
dm=run({"task":"distance_matrix","sequences":seqs})
check("distance matrix square over 4 taxa", len(dm["names"])==4 and len(dm["matrix"])==4, dm)
check("diagonal is zero", all(dm["matrix"][i][i]==0 for i in range(4)), dm)
nj=run({"task":"nj_tree","sequences":seqs})
check("NJ newick + 4 terminals", nj["newick"].endswith(";") and nj["nTerminals"]==4, nj)
check("UPGMA tree 4 terminals", run({"task":"upgma_tree","sequences":seqs})["nTerminals"]==4)
check("patristic has C(4,2)=6 pairs", len(run({"task":"patristic","sequences":seqs})["distances"])==6)
check("too few taxa -> honest error", run({"task":"nj_tree","sequences":{"A":"AC","B":"AC"}}).get("status")=="error")
print(f"\nALL {passed} PHYLO TESTS PASSED")
