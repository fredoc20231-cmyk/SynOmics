#!/usr/bin/env python3
"""Tests for regression models (statsmodels). Run: python tests/regression_tools_smoke.py"""
import json
import os
import random
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "regression_tools.py")
try:
    import statsmodels  # noqa: F401
except Exception as e:
    print(f"SKIP: statsmodels/pandas not available ({e}).")
    sys.exit(0)
passed = 0
def check(n, c, ctx=None):
    global passed
    if not c:
        print(f"FAIL: {n}\n  {ctx}"); sys.exit(1)
    passed += 1; print(f"ok: {n}")
def run(p):
    r = subprocess.run([sys.executable, SCRIPT], input=json.dumps(p).encode(), stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return json.loads(r.stdout.decode())
rng = random.Random(0)
X = [[i] for i in range(30)]
y = [2 * i + 1 + rng.gauss(0, 0.5) for i in range(30)]
o = run({"task": "ols", "X": X, "y": y, "featureNames": ["x"]})
slope = [c for c in o["coefficients"] if c["term"] == "x"][0]["coef"]
check("OLS recovers slope ~2 and high R2", abs(slope - 2) < 0.2 and o["rSquared"] > 0.95, o)
# non-separable binary target correlated with x
yb = [1 if (i + rng.gauss(0, 5)) > 15 else 0 for i in range(30)]
lg = run({"task": "logistic_glm", "X": X, "y": yb, "featureNames": ["x"]})
check("logistic GLM: OR>1 for positive predictor", [c for c in lg["coefficients"] if c["term"] == "x"][0]["oddsRatio"] > 1, lg)
yc = [max(0, int(0.5 * i + rng.gauss(0, 1))) for i in range(30)]
check("poisson GLM runs", run({"task": "poisson_glm", "X": X, "y": yc})["status"] == "success")
ml = run({"task": "mixedlm", "X": [[rng.gauss(0, 1)] for _ in range(30)], "y": [rng.gauss(0, 1) for _ in range(30)], "groups": [i % 3 for i in range(30)]})
check("mixed model runs", ml["status"] == "success", ml)
check("robust regression runs", run({"task": "robust_regression", "X": X, "y": y})["status"] == "success")
check("unknown task -> honest error", run({"task": "nope"}).get("status") == "error")
print(f"\nALL {passed} REGRESSION TESTS PASSED")
