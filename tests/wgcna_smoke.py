#!/usr/bin/env python3
import json
import os
import random
import subprocess
import sys

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SCRIPT=os.path.join(ROOT,"server","wgcna.py")
try:
    import numpy  # noqa: F401
except Exception as e:
    print(f"SKIP: stack not available ({e})."); sys.exit(0)
passed=0
def check(n,c,ctx=None):
    global passed
    if not c: print(f"FAIL: {n}\n  {ctx}"); sys.exit(1)
    passed+=1; print(f"ok: {n}")
def run(p):
    r=subprocess.run([sys.executable,SCRIPT],input=json.dumps(p).encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE); return json.loads(r.stdout.decode())
# two co-expressed blocks: A1-3 driven by a, B1-3 by b
rng=random.Random(0); samples=[]
for _ in range(20):
    a=rng.gauss(0,1); b=rng.gauss(0,1)
    samples.append([a+rng.gauss(0,0.05) for _ in range(3)]+[b+rng.gauss(0,0.05) for _ in range(3)])
st=run({"task":"soft_threshold","expression":samples})
check("soft_threshold returns a chosen power", st["status"]=="success" and st["chosenPower"] in [1,2,4,6,8,10,12], st)
cm=run({"task":"coexpression_modules","expression":samples,"geneNames":["A1","A2","A3","B1","B2","B3"],"power":6,"nModules":2})
mods=[set(v) for v in cm["modules"].values()]
check("modules separate the two co-expression blocks", {"A1","A2","A3"} in mods and {"B1","B2","B3"} in mods, cm)
me=run({"task":"module_eigengenes","expression":samples,"geneNames":["A1","A2","A3","B1","B2","B3"],"moduleAssignments":{"M1":["A1","A2","A3"],"M2":["B1","B2","B3"]}})
check("module eigengene explains most variance", me["moduleEigengenes"]["M1"]["varianceExplained"]>0.8, me)
check("unknown task -> honest error", run({"task":"nope","expression":samples}).get("status")=="error")
print(f"\nALL {passed} WGCNA TESTS PASSED")
