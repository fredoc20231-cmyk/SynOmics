#!/usr/bin/env python3
"""Tests for core biostatistics (10 real tests). Requires scipy/statsmodels/scikit-learn.
Run: `python tests/biostats_smoke.py`
"""
import json
import os
import random
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "biostats.py")

try:
    import scipy  # noqa: F401
    import sklearn  # noqa: F401
    import statsmodels  # noqa: F401
except Exception as e:
    print(f"SKIP: stats stack not available ({e}).")
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

check("fisher significant", run({"task": "fisher_exact", "table": [[8, 2], [1, 5]]})["pValue"] < 0.05)
check("chi-square significant", run({"task": "chi_square", "table": [[10, 20], [20, 10]]})["pValue"] < 0.05)
check("anova detects group diff", run({"task": "anova", "groups": [[1, 2, 3], [4, 5, 6], [1, 2, 1]]})["pValue"] < 0.05)
check("pearson perfect linear r=1", abs(run({"task": "correlation", "x": [1, 2, 3, 4], "y": [2, 4, 6, 8]})["r"] - 1.0) < 1e-9)
mt = run({"task": "multiple_testing", "pvalues": [0.001, 0.04, 0.2, 0.5]})
check("BH rejects the smallest only", mt["nRejected"] == 1 and mt["rejected"][0] is True, mt)
pw = run({"task": "power_ttest", "effectSize": 0.5, "power": 0.8})
check("power solves nobs ~64", pw["solvedFor"] == "nobs" and 60 < pw["value"] < 70, pw)
check("normality: normal-ish accepted", run({"task": "normality", "x": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]})["isNormal"] is True)
check("roc auc computed", abs(run({"task": "roc_auc", "yTrue": [0, 0, 1, 1], "yScore": [0.1, 0.4, 0.35, 0.8]})["auc"] - 0.75) < 1e-9)

lr = run({"task": "logrank", "durations": [2, 3, 4, 8, 9, 11, 12, 14], "events": [1, 1, 1, 1, 1, 1, 1, 1], "groups": [1, 1, 1, 1, 0, 0, 0, 0]})
check("logrank computes chi2 + p", lr.get("status") == "success" and lr["chi2"] >= 0 and 0 <= lr["pValue"] <= 1, lr)

rng = random.Random(1)
dur, ev, cov = [], [], []
for i in range(60):
    g = i % 2
    dur.append(round(rng.expovariate(1 / (4 if g == 1 else 9)) + 0.5, 2))
    ev.append(1 if rng.random() < 0.85 else 0)
    cov.append([g])
cx = run({"task": "cox", "durations": dur, "events": ev, "covariates": cov, "covariateNames": ["treatment"]})
c0 = cx["coefficients"][0]
check("cox HR finite and > 1 (treatment raises hazard)", cx.get("status") == "success" and 1.0 < c0["hazardRatio"] < 100, cx)

check("unknown task -> honest error", run({"task": "nope"}).get("status") == "error")

print(f"\nALL {passed} BIOSTATS TESTS PASSED")
