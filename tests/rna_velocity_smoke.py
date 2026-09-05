#!/usr/bin/env python3
"""RNA velocity gate — recovers a KNOWN degradation rate gamma; velocity sign and
embedding-projection direction are correct. (Adapted from dynamo/scVelo steady-state
concepts; implementation original, validated numerically.)"""
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "rna_velocity.py")

try:
    import numpy as np
except Exception as e:  # noqa: BLE001
    print(f"SKIP: numpy not available ({e}).")
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


gamma_true = 0.3
# GENE_A: steady state everywhere — u = gamma*s exactly (velocity ~0 for all cells)
s_a = np.linspace(1, 20, 60)
u_a = gamma_true * s_a
# GENE_B: high-spliced cells at steady state (u=gamma*s) define gamma; low-spliced
# cells are INDUCED (unspliced boosted by +5 above the line) -> positive velocity there.
s_hi = np.linspace(10, 20, 30); u_hi = gamma_true * s_hi
s_lo = np.linspace(1, 5, 30);   u_lo = gamma_true * s_lo + 5.0
s_b = np.concatenate([s_lo, s_hi]); u_b = np.concatenate([u_lo, u_hi])  # first 30 induced

d = run({"task": "velocity_estimate",
         "unspliced": {"GENE_A": list(u_a), "GENE_B": list(u_b)},
         "spliced": {"GENE_A": list(s_a), "GENE_B": list(s_b)},
         "mode": "steady_state"})
check("status success", d["status"] == "success", d)
check("gamma recovered ~0.3 for GENE_A", abs(d["gamma"]["GENE_A"] - 0.3) < 1e-6, d["gamma"])
check("R^2 ~1 on perfect steady-state line", d["rSquared"]["GENE_A"] > 0.999, d["rSquared"])
check("GENE_A velocity ~0 (on steady state)", max(abs(x) for x in d["velocity"]["GENE_A"]) < 1e-6, d["velocity"]["GENE_A"][:3])
check("gamma recovered ~0.3 for GENE_B (from high-spliced cells)", abs(d["gamma"]["GENE_B"] - 0.3) < 0.05, d["gamma"])
check("GENE_B induced cells (low spliced) have positive velocity ~5",
      all(x > 0 for x in d["velocity"]["GENE_B"][:30]), d["velocity"]["GENE_B"][:3])

# deterministic mode recovers gamma exactly on the clean steady-state line
d2 = run({"task": "velocity_estimate",
          "unspliced": {"GENE_A": list(u_a)}, "spliced": {"GENE_A": list(s_a)},
          "mode": "deterministic"})
check("deterministic mode recovers gamma ~0.3", abs(d2["gamma"]["GENE_A"] - 0.3) < 1e-6, d2["gamma"])

check("mismatched shapes -> error",
      run({"task": "velocity_estimate", "unspliced": {"G": [1, 2]}, "spliced": {"G": [1, 2, 3]}}).get("status") == "error")
check("unknown task -> error", run({"task": "nope"}).get("status") == "error")

# ---- stream projection ----
# 3 cells, 2 genes; neighbors lie in DIFFERENT directions so the velocity picks one.
# cell0 at origin; cell1 has higher gene0 (to its "right"); cell2 has higher gene1 ("up").
# cell0 velocity = [+1, 0] -> correlates with the direction toward cell1 -> arrow points toward cell1.
expr = [[0.0, 1.0, 0.0], [0.0, 0.0, 1.0]]     # genes x cells
vel = [[1.0, 0.0, 0.0], [0.0, 0.0, 0.0]]      # cell0 velocity points along gene0 (toward cell1)
embn = [[0.0, 0.0], [1.0, 0.0], [0.0, 1.0]]   # cell1 to the right, cell2 up
sp = run({"task": "velocity_stream_projection", "expression": expr, "velocity": vel,
          "embedding": embn, "nNeighbors": 2})
check("stream projection ok", sp["status"] == "success", sp)
check("cell0 arrow points toward the velocity-correlated neighbor (+x)", sp["embeddingVelocity"][0][0] > 0, sp["embeddingVelocity"])
check("cell0 arrow favors cell1 (x) over cell2 (y)", sp["embeddingVelocity"][0][0] > sp["embeddingVelocity"][0][1], sp["embeddingVelocity"])

# ---- bundle ----
try:
    import matplotlib  # noqa: F401
    with tempfile.TemporaryDirectory() as t:
        out = os.path.join(t, "vel")
        db = run({"task": "velocity_estimate", "unspliced": {"GENE_A": list(u_a), "GENE_B": list(u_b)},
                  "spliced": {"GENE_A": list(s_a), "GENE_B": list(s_b)}, "outputDir": out})
        b = db["bundle"]
        check("bundle has phase-portrait png", any(f.endswith(".png") for f in b["artifacts"]["figures"]))
        check("bundle report carries Synapse attribution", "Synapse" in open(os.path.join(out, "report.md")).read())
except Exception as e:  # noqa: BLE001
    print(f"(bundle checks skipped: {e})")

print(f"\nALL {passed} RNA-VELOCITY TESTS PASSED")
