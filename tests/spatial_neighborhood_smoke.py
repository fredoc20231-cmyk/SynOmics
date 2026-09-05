#!/usr/bin/env python3
"""Spatial neighborhood gate — every result checked against known geometry.

Two spatially separated single-type blobs -> strong within-type enrichment and
negative cross-type z (segregation). A tight same-type cluster co-occurs above
its global frequency at short distance. Infiltration recovers a known fraction.
Neighbor composition of a segregated field is ~100% self."""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "spatial_neighborhood.py")

try:
    import numpy as np
except Exception as e:  # noqa: BLE001
    print(f"SKIP: numpy not available ({e}).")
    sys.exit(0)
try:
    import scipy  # noqa: F401
except Exception as e:  # noqa: BLE001
    print(f"SKIP: scipy not available ({e}).")
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
    if r.returncode != 0:
        print("STDERR:", r.stderr.decode())
    return json.loads(r.stdout.decode())


# --------------------------------------------------------------------------- #
# Build a segregated field: blob A near origin (type A), blob B far away (type B).
# --------------------------------------------------------------------------- #
rng = np.random.default_rng(42)
blobA = rng.normal(loc=[0.0, 0.0], scale=0.5, size=(40, 2))
blobB = rng.normal(loc=[20.0, 20.0], scale=0.5, size=(40, 2))
coords = np.vstack([blobA, blobB]).tolist()
labels = ["A"] * 40 + ["B"] * 40

# ---- neighborhood enrichment ----
d = run({"task": "neighborhood_enrichment", "coordinates": coords, "labels": labels,
         "k": 6, "nPermutations": 500, "seed": 0})
check("nhood status success", d["status"] == "success", d)
tn = d["typeNames"]  # ['A', 'B']
ia, ib = tn.index("A"), tn.index("B")
z = d["zscore"]
check("within-type A strongly enriched (z>0)", z[ia][ia] > 3, z)
check("within-type B strongly enriched (z>0)", z[ib][ib] > 3, z)
check("cross-type A-B segregated (z<0)", z[ia][ib] < 0, z)
check("nhood is seed-reproducible",
      run({"task": "neighborhood_enrichment", "coordinates": coords, "labels": labels,
           "k": 6, "nPermutations": 500, "seed": 0})["zscore"] == z)
check("top pair is a within-type pair",
      d["pairs"][0]["typeA"] == d["pairs"][0]["typeB"], d["pairs"][0])

# A checkerboard-ish interleaved field -> A and B should NOT segregate (z not strongly negative).
# Alternating grid of A/B.
grid = []
glabels = []
for xi in range(8):
    for yi in range(8):
        grid.append([float(xi), float(yi)])
        glabels.append("A" if (xi + yi) % 2 == 0 else "B")
dg = run({"task": "neighborhood_enrichment", "coordinates": grid, "labels": glabels,
          "k": 4, "nPermutations": 500, "seed": 1})
tg = dg["typeNames"]
ga, gb = tg.index("A"), tg.index("B")
# On a 4-NN checkerboard the nearest neighbors are the opposite type -> cross-type enriched.
check("checkerboard cross-type enriched (z>0)", dg["zscore"][ga][gb] > 0, dg["zscore"])

# ---- co-occurrence ----
dc = run({"task": "cooccurrence", "coordinates": coords, "labels": labels,
          "nBins": 6})
check("cooc status success", dc["status"] == "success", dc)
# At the shortest bin, A co-occurs with A above its global frequency (ratio>1).
a_near_a = dc["ratio"]["A"]["A"][0]
check("A clusters with A at short distance (ratio>1)", a_near_a > 1.0, a_near_a)
# A near B at short distance should be depleted (blobs are far apart) -> ratio 0 or <1.
a_near_b = dc["ratio"]["A"]["B"][0]
check("A-B depleted at short distance (ratio<1)", a_near_b < 1.0, a_near_b)

# ---- infiltration ----
# 10 target cells, 5 within radius 1 of a source cell, 5 far away.
src = [[0.0, 0.0], [10.0, 0.0]]
tgt_close = [[0.2, 0.0], [0.0, 0.3], [10.1, 0.0], [9.9, 0.1], [0.0, 0.0]]
tgt_far = [[100.0, 100.0], [200.0, 0.0], [0.0, 300.0], [400.0, 400.0], [500.0, 0.0]]
inf_coords = src + tgt_close + tgt_far
inf_labels = ["S", "S"] + ["T"] * 10
di = run({"task": "infiltration_score", "coordinates": inf_coords, "labels": inf_labels,
          "source": "S", "target": "T", "radius": 1.0})
check("infiltration status success", di["status"] == "success", di)
check("infiltration counts 5/10 within radius", di["infiltratingCells"] == 5, di)
check("infiltration fraction = 0.5", abs(di["infiltrationFraction"] - 0.5) < 1e-9, di)
check("infiltration reports source/target counts", di["nSource"] == 2 and di["nTarget"] == 10, di)

# ---- neighbor composition ----
dn = run({"task": "neighbor_composition", "coordinates": coords, "labels": labels, "k": 5})
check("composition status success", dn["status"] == "success", dn)
# In the segregated field, A's neighbors are ~all A.
check("A neighbors are ~100% A", dn["composition"]["A"]["A"] > 0.95, dn["composition"]["A"])
check("B neighbors are ~100% B", dn["composition"]["B"]["B"] > 0.95, dn["composition"]["B"])

# --------------------------------------------------------------------------- #
# Error handling.
# --------------------------------------------------------------------------- #
check("unknown task -> error", run({"task": "nope"}).get("status") == "error")
check("mismatched coords/labels -> error",
      run({"task": "neighborhood_enrichment", "coordinates": [[0, 0], [1, 1]],
           "labels": ["A"]}).get("status") == "error")
check("infiltration unknown source -> error",
      run({"task": "infiltration_score", "coordinates": coords, "labels": labels,
           "source": "Z", "target": "A", "radius": 1.0}).get("status") == "error")
check("bad coordinate dim -> error",
      run({"task": "neighbor_composition", "coordinates": [[0, 0, 0, 0]], "labels": ["A"]}).get("status") == "error")

print(f"\nALL {passed} SPATIAL-NEIGHBORHOOD TESTS PASSED")
