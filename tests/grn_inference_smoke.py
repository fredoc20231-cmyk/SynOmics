#!/usr/bin/env python3
"""Tests for gene regulatory network inference (GENIE3 / ARACNe-MI). Run:

    python tests/grn_inference_smoke.py

Ground truth is simulated with numpy default_rng(0) and asserted against REAL
computed values (zero hallucination):

  * GENIE3: with G0 = 2*G1 + small noise and G2..G4 independent, the top
    regulator of target G0 must be G1 (and clearly above the others).
  * ARACNe-MI: in a chain X->Y->Z the indirect X-Z edge must be pruned by the
    Data Processing Inequality while the direct X-Y and Y-Z edges are retained.
  * Unknown task -> honest error.
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "grn_inference.py")

try:
    import numpy as np  # noqa: F401
    import sklearn  # noqa: F401
except Exception as e:
    print(f"SKIP: numpy/scikit-learn not available ({e}).")
    sys.exit(0)

import numpy as np  # noqa: E402

passed = 0


def check(name, cond, ctx=None):
    global passed
    if not cond:
        print(f"FAIL: {name}\n  {ctx}")
        sys.exit(1)
    passed += 1
    print(f"ok: {name}")


def run(p):
    r = subprocess.run(
        [sys.executable, SCRIPT],
        input=json.dumps(p).encode(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if not r.stdout.strip():
        raise AssertionError(f"no stdout; stderr={r.stderr.decode()}")
    return json.loads(r.stdout.decode())


# --------------------------------------------------------------------------- #
# 1. GENIE3: G1 is the true regulator of target G0.
# --------------------------------------------------------------------------- #
rng = np.random.default_rng(0)
n = 400
G1 = rng.normal(0, 1, n)
G2 = rng.normal(0, 1, n)
G3 = rng.normal(0, 1, n)
G4 = rng.normal(0, 1, n)
G0 = 2 * G1 + 0.1 * rng.normal(0, 1, n)  # G1 is the true regulator of G0
expr = np.column_stack([G0, G1, G2, G3, G4]).tolist()
gene_names = ["G0", "G1", "G2", "G3", "G4"]

res = run({"task": "genie3", "expression": expr, "geneNames": gene_names})
check("genie3: status success", res.get("status") == "success", res)
check("genie3: nSamples/nGenes correct",
      res["nSamples"] == n and res["nGenes"] == 5, res)
check("genie3: edges present", len(res["edges"]) > 0, res)

# Edges targeting G0, ranked by weight desc.
g0_edges = [e for e in res["edges"] if e["target"] == "G0"]
g0_edges.sort(key=lambda e: e["weight"], reverse=True)
check("genie3: G0 has regulator edges", len(g0_edges) >= 1, g0_edges)
top_reg = g0_edges[0]["regulator"]
top_w = g0_edges[0]["weight"]
second_w = g0_edges[1]["weight"] if len(g0_edges) > 1 else 0.0
check(f"genie3: top regulator of G0 is G1 (got {top_reg})", top_reg == "G1", g0_edges)
check(f"genie3: G1 weight ({top_w}) clearly > next ({second_w})",
      top_w > 5 * max(second_w, 1e-9), g0_edges)

# --------------------------------------------------------------------------- #
# 2. ARACNe-MI: chain X -> Y -> Z; DPI prunes the indirect X-Z edge.
# --------------------------------------------------------------------------- #
rng2 = np.random.default_rng(0)
n2 = 400
Xc = rng2.normal(0, 1, n2)
Yc = Xc + 0.1 * rng2.normal(0, 1, n2)  # Y = f(X) + noise (strong coupling)
Zc = Yc + 0.1 * rng2.normal(0, 1, n2)  # Z = g(Y) + noise (strong coupling)
chain_expr = np.column_stack([Xc, Yc, Zc]).tolist()
chain_names = ["X", "Y", "Z"]

res2 = run({"task": "aracne_mi", "expression": chain_expr, "geneNames": chain_names})
check("aracne_mi: status success", res2.get("status") == "success", res2)


def has_edge(edges, a, b):
    return any(
        {e["geneA"], e["geneB"]} == {a, b} for e in edges
    )


edges2 = res2["edges"]
check("aracne_mi: X-Y edge retained", has_edge(edges2, "X", "Y"), edges2)
check("aracne_mi: Y-Z edge retained", has_edge(edges2, "Y", "Z"), edges2)
check("aracne_mi: X-Z indirect edge PRUNED", not has_edge(edges2, "X", "Z"), edges2)
check("aracne_mi: prunedCount == 1", res2["prunedCount"] == 1, res2)
check("aracne_mi: retainedCount == 2", res2["retainedCount"] == 2, res2)

# --------------------------------------------------------------------------- #
# 3. Unknown task -> honest error.
# --------------------------------------------------------------------------- #
check("unknown task -> error", run({"task": "nope"}).get("status") == "error")

# Missing geneNames -> honest error.
check("missing geneNames -> error",
      run({"task": "genie3", "expression": expr}).get("status") == "error")

print(
    f"\ngenie3 top regulator of G0 = {top_reg} (w={top_w}); "
    f"aracne_mi pruned {res2['prunedCount']} indirect edge(s)"
)
print(f"\nALL {passed} GRN TESTS PASSED")
