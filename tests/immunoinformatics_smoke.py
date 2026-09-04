#!/usr/bin/env python3
import json
import os
import subprocess
import sys

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SCRIPT=os.path.join(ROOT,"server","immunoinformatics.py")
passed=0
def check(n,c,ctx=None):
    global passed
    if not c: print(f"FAIL: {n}\n  {ctx}"); sys.exit(1)
    passed+=1; print(f"ok: {n}")
def run(p):
    r=subprocess.run([sys.executable,SCRIPT],input=json.dumps(p).encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE); return json.loads(r.stdout.decode())
d=run({"task":"repertoire_diversity","clones":{"a":50,"b":30,"c":20}})
check("diversity richness 3, shannon>0", d["richness"]==3 and d["shannon"]>0 and 0<=d["clonality"]<=1, d)
mono=run({"task":"repertoire_diversity","clones":{"only":100}})
check("monoclonal clonality 0", mono["clonality"]==0.0, mono)
vj=run({"task":"vj_usage","rearrangements":[{"v":"V1","j":"J1"},{"v":"V1","j":"J2"}]})
check("V1 usage 1.0", vj["vUsage"]["V1"]==1.0, vj)
sp=run({"task":"cdr3_spectratype","cdr3":["CASSL","CASS","CASSLL"]})
check("spectratype lengths 4/5/6", set(sp["lengthCounts"].keys())=={"4","5","6"}, sp)
ov=run({"task":"repertoire_overlap","repertoireA":{"a":10,"b":5},"repertoireB":{"a":10,"b":5}})
check("identical repertoire Morisita-Horn ~1", abs(ov["morisitaHorn"]-1.0)<1e-6, ov)
check("unknown task -> honest error", run({"task":"nope"}).get("status")=="error")
print(f"\nALL {passed} IMMUNO TESTS PASSED")
