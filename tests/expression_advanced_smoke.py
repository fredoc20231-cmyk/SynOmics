#!/usr/bin/env python3
"""Tests for advanced expression analyses (nb_de, gsea, batch_correct, pca).
Requires numpy/scipy/scikit-learn/statsmodels (+ gseapy for GSEA).
Run: `python tests/expression_advanced_smoke.py`
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "expression_advanced.py")

try:
    import numpy  # noqa: F401
    import sklearn  # noqa: F401
    import statsmodels  # noqa: F401
except Exception as e:
    print(f"SKIP: core stats stack not available ({e}).")
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

# nb_de: known up / down / flat genes.
d = run({"task": "nb_de",
         "counts": {"GENEA": [10, 12, 11, 55, 60, 58], "GENEB": [80, 85, 82, 20, 18, 22], "GENEC": [40, 42, 41, 39, 43, 40]},
         "conditions": ["c", "c", "c", "t", "t", "t"]})
check("nb_de success", d.get("status") == "success", d)
by = {r["gene"]: r for r in d["differentialExpression"]}
check("nb_de GENEA up + significant", by["GENEA"]["log2FoldChange"] > 1 and by["GENEA"]["isSignificant"], by["GENEA"])
check("nb_de GENEB down + significant", by["GENEB"]["log2FoldChange"] < -1 and by["GENEB"]["isSignificant"], by["GENEB"])
check("nb_de GENEC flat + not significant", abs(by["GENEC"]["log2FoldChange"]) < 0.5 and not by["GENEC"]["isSignificant"], by["GENEC"])

# gsea: a top-ranked set should score positive NES, a bottom set negative.
try:
    import gseapy  # noqa: F401
    have_gseapy = True
except Exception:
    have_gseapy = False
if have_gseapy:
    g = run({"task": "gsea", "rnk": {f"G{i}": (10 - i) for i in range(10)},
             "geneSets": {"topset": ["G0", "G1", "G2"], "botset": ["G7", "G8", "G9"]}, "permutations": 100})
    check("gsea success", g.get("status") == "success", g)
    terms = {t["term"]: t for t in g["terms"]}
    check("gsea top set positive NES", terms["topset"]["nes"] > 0, terms)
    check("gsea bottom set negative NES", terms["botset"]["nes"] < 0, terms)
else:
    print("note: gseapy not installed — GSEA assertions skipped")

# batch_correct: two batches with a constant offset collapse after correction.
b = run({"task": "batch_correct", "matrix": [[1, 2], [1.1, 2.1], [5, 6], [5.1, 6.1]], "batch": ["A", "A", "B", "B"]})
check("batch_correct success", b.get("status") == "success", b)
cm = b["correctedMatrix"]
check("batch offset removed (B aligns to A)", abs(cm[2][0] - cm[0][0]) < 1e-6 and abs(cm[3][1] - cm[1][1]) < 1e-6, cm)

# pca: perfectly collinear data -> PC1 explains ~all variance.
p = run({"task": "pca", "matrix": [[1, 2, 3], [2, 4, 6], [3, 6, 9], [1, 0, 1]]})
check("pca success", p.get("status") == "success", p)
check("pca PC1 dominant", p["explainedVarianceRatio"][0] > 0.9, p["explainedVarianceRatio"])

# honest error on unknown task
check("unknown task -> honest error", run({"task": "nope"}).get("status") == "error")

print(f"\nALL {passed} EXPRESSION-ADVANCED TESTS PASSED")
