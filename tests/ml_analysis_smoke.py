#!/usr/bin/env python3
"""Tests for ML analyses (scikit-learn). Run: python tests/ml_analysis_smoke.py"""
import json
import os
import random
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "ml_analysis.py")

try:
    import sklearn  # noqa: F401
except Exception as e:
    print(f"SKIP: scikit-learn not available ({e}).")
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

rng = random.Random(0)
two = [[rng.gauss(0, .1), rng.gauss(0, .1)] for _ in range(10)] + [[5 + rng.gauss(0, .1), 5 + rng.gauss(0, .1)] for _ in range(10)]

km = run({"task": "kmeans", "X": two, "k": 2})
check("kmeans separates two clusters", len(set(km["labels"])) == 2 and km["silhouette"] > 0.8, km)
hc = run({"task": "hierarchical", "X": two, "k": 2})
check("hierarchical separates two clusters", hc["silhouette"] > 0.8, hc)
ts = run({"task": "tsne", "X": two})
check("tsne returns 2-D embedding", len(ts["embedding"]) == 20 and len(ts["embedding"][0]) == 2, ts)

Xr = [[rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1)] for _ in range(60)]
y = [1 if row[0] > 0 else 0 for row in Xr]
rf = run({"task": "rf_importance", "X": Xr, "y": y, "featureNames": ["driver", "noise1", "noise2"]})
check("RF ranks driver feature first", rf["importances"][0]["feature"] == "driver", rf)

yr = [2 * row[0] + 0.01 * row[1] for row in Xr]
ls = run({"task": "lasso_select", "X": Xr, "y": yr, "featureNames": ["driver", "noise1", "noise2"]})
check("LASSO selects driver (largest coef)", ls["selectedFeatures"][0]["feature"] == "driver", ls)

lo = run({"task": "logistic", "X": Xr, "y": y})
check("logistic accuracy high on separable data", lo["accuracy"] > 0.8, lo)

check("unknown task -> honest error", run({"task": "nope"}).get("status") == "error")

print(f"\nALL {passed} ML-ANALYSIS TESTS PASSED")
