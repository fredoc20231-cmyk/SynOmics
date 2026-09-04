#!/usr/bin/env python3
import json
import os
import subprocess
import sys

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SCRIPT=os.path.join(ROOT,"server","epigenomics.py")
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
check("interval Jaccard 5/25 = 0.2", abs(run({"task":"interval_jaccard","setA":[[0,10],[20,30]],"setB":[[5,15]]})["jaccard"]-0.2)<1e-6)
pwm={"A":[0.97,0.01,0.01],"C":[0.01,0.97,0.01],"G":[0.01,0.01,0.97],"T":[0.01,0.01,0.01]}
check("PWM finds ACG motif", run({"task":"pwm_scan","pwm":pwm,"sequence":"TTACGTT","threshold":3})["nHits"]==1)
mv=run({"task":"methylation_mvalues","betas":[0.5,0.9,0.1]})["mValues"]
check("beta 0.5 -> M 0", abs(mv[0])<1e-6 and mv[1]>0 and mv[2]<0)
dmr=run({"task":"dmr_test","group1":[[0.1,0.5],[0.12,0.52],[0.09,0.48]],"group2":[[0.8,0.5],[0.82,0.51],[0.79,0.49]]})
check("DMR flags the differential site", dmr["nSignificant"]==1 and dmr["results"][0]["site"]==0, dmr)
check("unknown task -> honest error", run({"task":"nope"}).get("status")=="error")
print(f"\nALL {passed} EPIGENOMICS TESTS PASSED")
