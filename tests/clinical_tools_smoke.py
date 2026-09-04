#!/usr/bin/env python3
import json
import os
import subprocess
import sys

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SCRIPT=os.path.join(ROOT,"server","clinical_tools.py")
try:
    import numpy  # noqa: F401
except Exception as e:
    print(f"SKIP: numpy not available ({e})."); sys.exit(0)
passed=0
def check(n,c,ctx=None):
    global passed
    if not c: print(f"FAIL: {n}\n  {ctx}"); sys.exit(1)
    passed+=1; print(f"ok: {n}")
def run(p):
    r=subprocess.run([sys.executable,SCRIPT],input=json.dumps(p).encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE); return json.loads(r.stdout.decode())
orr=run({"task":"odds_ratio_rr","table":[[20,10],[5,25]]})
check("OR = 10.0 (20*25/(10*5))", abs(orr["oddsRatio"]-10.0)<1e-6, orr)
check("RR = 4.0", abs(orr["relativeRisk"]-4.0)<1e-6, orr)
dm=run({"task":"diagnostic_metrics","tp":90,"fp":10,"fn":20,"tn":80})
check("sensitivity 90/110", abs(dm["sensitivity"]-0.8182)<1e-3 and abs(dm["specificity"]-0.8889)<1e-3, dm)
check("NNT = 5.0 for ARR 0.2", run({"task":"number_needed_to_treat","controlEventRate":0.5,"treatedEventRate":0.3})["nnt"]==5.0)
ma=run({"task":"meta_analysis","studies":[{"effect":0.5,"se":0.1},{"effect":0.6,"se":0.15},{"effect":0.55,"se":0.12}]})
check("meta-analysis pools effect within range", 0.4<ma["pooledEffect"]<0.7 and ma["nStudies"]==3, ma)
check("unknown task -> honest error", run({"task":"nope"}).get("status")=="error")
print(f"\nALL {passed} CLINICAL TESTS PASSED")
