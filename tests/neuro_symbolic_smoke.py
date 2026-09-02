#!/usr/bin/env python3
"""End-to-end tests for neuro-symbolic grounding: partial-correlation edge
extraction (Tier 1) and the Z3 formal pathway proof (Tier 2).
Requires scikit-learn and z3-solver. Run: `python tests/neuro_symbolic_smoke.py`
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "neuro_symbolic.py")

try:
    import numpy as np
    import sklearn  # noqa: F401
    import z3  # noqa: F401
except Exception as e:
    print(f"SKIP: scientific/SMT stack not available ({e}).")
    sys.exit(0)

passed = 0
def check(name, cond):
    global passed
    if not cond:
        print(f"FAIL: {name}")
        sys.exit(1)
    passed += 1
    print(f"ok: {name}")

def run(payload):
    p = subprocess.run([sys.executable, SCRIPT], input=json.dumps(payload).encode(),
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return json.loads(p.stdout.decode())

# Tier 1: chain X -> Y -> Z. Partial correlation should reveal X-Z as indirect.
rng = np.random.default_rng(0)
n = 500
X = rng.standard_normal(n); Y = 0.9 * X + 0.3 * rng.standard_normal(n); Z = 0.9 * Y + 0.3 * rng.standard_normal(n)
res = run({"task": "edge_extraction", "data": np.c_[X, Y, Z].tolist(), "variables": ["X", "Y", "Z"], "threshold": 0.1})
check("edge extraction status success", res.get("status") == "success")
vi = {v: i for i, v in enumerate(res["variables"])}
M = res["partialCorrelationMatrix"]
check("direct edges X-Y and Y-Z strong", abs(M[vi["X"]][vi["Y"]]) > 0.3 and abs(M[vi["Y"]][vi["Z"]]) > 0.3)
check("indirect edge X-Z suppressed (mediation)", abs(M[vi["X"]][vi["Z"]]) < 0.2)

# Tier 2: Z3 formal proof of pathway activation.
res2 = run({"task": "z3_pathway", "foldChanges": {"EGFR": 2.4, "KRAS": 0.1, "BRAF": 1.8, "TP53": -2.0},
            "threshold": 1.0, "pathways": [
                {"id": "RTK", "name": "RTK", "rule": {"op": "AND", "args": [
                    {"gene": "EGFR", "state": "up"},
                    {"op": "OR", "args": [{"gene": "KRAS", "state": "up"}, {"gene": "BRAF", "state": "up"}]}]}},
                {"id": "P53", "name": "p53", "rule": {"op": "AND", "args": [
                    {"gene": "TP53", "state": "up"}, {"gene": "BAX", "state": "up"}]}}]})
check("z3 status success", res2.get("status") == "success")
check("z3 SAT when logic holds", res2["pathways"][0]["z3Result"] == "SAT" and res2["pathways"][0]["status"] == "SATISFIABLE")
check("z3 UNSAT when data fails (cannot override)", res2["pathways"][1]["z3Result"] == "UNSAT" and res2["pathways"][1]["activated"] is False)
check("z3 emits a satisfying model on SAT", isinstance(res2["pathways"][0]["model"], dict))

# Multi-omic Z3 consistency: transcript up but protein down -> LOGICAL_CONFLICT + HALT.
res3 = run({"task": "multiomic_consistency", "threshold": 1.0,
            "layers": {"transcriptomics": {"EGFR": 2.0, "TP53": 1.5},
                       "proteomics": {"EGFR": 1.8, "TP53": -2.0}},
            "pathways": [{"id": "P53", "name": "p53", "rule": {"gene": "TP53", "state": "up"}},
                         {"id": "EGFRp", "name": "EGFR", "rule": {"gene": "EGFR", "state": "up"}}]})
check("multiomic conflict flagged", res3.get("consistency") == "LOGICAL_CONFLICT")
check("conflict identifies TP53", any(c["gene"] == "TP53" for c in res3["conflicts"]))
check("conflicted pathway HALTED", any(p["id"] == "P53" and p["status"] == "HALTED" for p in res3["pathways"]))
check("consistent gene pathway still evaluates", any(p["id"] == "EGFRp" and p["status"] == "SATISFIABLE" for p in res3["pathways"]))
res4 = run({"task": "multiomic_consistency", "layers": {"transcriptomics": {"EGFR": 2.0}, "proteomics": {"EGFR": 1.9}}})
check("consistent layers -> CONSISTENT", res4.get("consistency") == "CONSISTENT")

print(f"\nALL {passed} NEURO-SYMBOLIC TESTS PASSED")
