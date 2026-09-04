#!/usr/bin/env python3
import json
import math
import os
import subprocess
import sys

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SCRIPT=os.path.join(ROOT,"server","flow_tools.py")
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
t=run({"task":"arcsinh_transform","events":[[150,300]],"cofactor":150})["transformed"][0]
check("arcsinh(150/150)=asinh(1)", abs(t[0]-math.asinh(1))<1e-5, t)
comp=run({"task":"compensation","events":[[100,10]],"spillover":[[1,0.1],[0.0,1]]})["compensated"][0]
check("compensation removes 0.1 spillover -> ch2 == 0", abs(comp[1]-0.0)<1e-6, comp)
gf=run({"task":"gating_frequencies","events":[[1,5],[2,6],[10,1]],"channels":["x","y"],"gates":[{"channel":"x","max":5}]})
check("gate x<=5 captures 2/3 = 66.67%", abs(gf["frequencyPercent"]-66.6667)<1e-2, gf)
cs=run({"task":"channel_summary","events":[[1,2],[3,4]],"channels":["x","y"]})
check("channel summary median x == 2.0", cs["channels"]["x"]["median"]==2.0, cs)
check("singular spillover -> honest error", run({"task":"compensation","events":[[1,1]],"spillover":[[1,1],[1,1]]}).get("status")=="error")
print(f"\nALL {passed} FLOW TESTS PASSED")
