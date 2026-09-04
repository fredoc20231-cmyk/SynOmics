#!/usr/bin/env python3
import json
import math
import os
import random
import subprocess
import sys

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SCRIPT=os.path.join(ROOT,"server","timeseries_tools.py")
try:
    import numpy  # noqa: F401
except Exception as e:
    print(f"SKIP: numpy/statsmodels not available ({e})."); sys.exit(0)
passed=0
def check(n,c,ctx=None):
    global passed
    if not c: print(f"FAIL: {n}\n  {ctx}"); sys.exit(1)
    passed+=1; print(f"ok: {n}")
def run(p):
    r=subprocess.run([sys.executable,SCRIPT],input=json.dumps(p).encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE); return json.loads(r.stdout.decode())
sine=[math.sin(2*math.pi*i/10) for i in range(60)]
check("acf lag0 == 1", abs(run({"task":"autocorrelation","x":sine})["acf"][0]-1.0)<1e-9)
check("periodicity recovers period 10", abs(run({"task":"periodicity_fft","x":sine})["dominantPeriod"]-10.0)<1.0)
rng=random.Random(3); base=[rng.gauss(0,1) for _ in range(40)]; y=[0,0,0]+base[:-3]
xc=run({"task":"cross_correlation","x":base,"y":y,"maxLag":10})
check("cross-correlation recovers lag 3", xc["bestLag"]==3 and xc["bestCorr"]>0.9, xc)
cp=run({"task":"changepoint_cusum","x":[0.0]*20+[5.0]*20,"nBootstrap":200})
check("CUSUM change-point near index 20", 18<=cp["changePointIndex"]<=21 and cp["significant"], cp)
check("LOWESS trend runs", run({"task":"lowess_trend","y":[1,2,1,3,2,4,3,5]})["status"]=="success")
dt=run({"task":"linear_detrend","y":[5,7,9,11,13,15]})
check("linear detrend recovers slope 2", abs(dt["slope"]-2.0)<1e-6, dt)
check("linear detrend residuals ~0", all(abs(v)<1e-6 for v in dt["detrended"]), dt)
ma=run({"task":"moving_average","y":[1,2,3,4,5],"window":3})
check("moving average of 1..5 w3 == [2,3,4]", ma["movingAverage"]==[2.0,3.0,4.0], ma)
check("unknown task -> honest error", run({"task":"nope"}).get("status")=="error")
print(f"\nALL {passed} TIMESERIES TESTS PASSED")
