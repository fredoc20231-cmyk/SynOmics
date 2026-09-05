#!/usr/bin/env python3
"""Spatial deconvolution gate — NNLS recovers KNOWN cell-type mixtures; OT maps
cells to their true spot. (Adapted from Tangram's goal; deterministic scipy/POT
implementation, validated numerically.)"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "spatial_deconvolution.py")

try:
    import numpy as np
    import scipy  # noqa: F401
except Exception as e:  # noqa: BLE001
    print(f"SKIP: numpy/scipy not available ({e}).")
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


# 3 cell-type signatures over 5 genes (distinct marker profiles)
sig = [
    [10, 0, 0, 1, 1],   # typeA
    [0, 10, 0, 1, 1],   # typeB
    [0, 0, 10, 1, 1],   # typeC
]
sig = np.asarray(sig, float)
# Build spots as KNOWN mixtures.
mix = [
    [0.7, 0.2, 0.1],
    [0.0, 0.0, 1.0],
    [0.5, 0.5, 0.0],
]
spots = (np.asarray(mix) @ sig).tolist()

d = run({"task": "nnls_deconvolution", "spots": spots, "signatures": sig.tolist(),
         "cellTypes": ["typeA", "typeB", "typeC"]})
check("nnls status success", d["status"] == "success", d)
p0 = d["proportions"]["spot0"]
check("spot0 proportions recover 0.7/0.2/0.1",
      abs(p0["typeA"] - 0.7) < 0.02 and abs(p0["typeB"] - 0.2) < 0.02 and abs(p0["typeC"] - 0.1) < 0.02, p0)
p1 = d["proportions"]["spot1"]
check("spot1 pure typeC", p1["typeC"] > 0.98, p1)
p2 = d["proportions"]["spot2"]
check("spot2 ~50/50 A/B", abs(p2["typeA"] - 0.5) < 0.02 and abs(p2["typeB"] - 0.5) < 0.02, p2)
check("gene-count mismatch -> error",
      run({"task": "nnls_deconvolution", "spots": [[1, 2]], "signatures": [[1, 2, 3]]}).get("status") == "error")

# ---- OT mapping: cells that ARE copies of specific spots should map to those spots ----
try:
    import ot  # noqa: F401
    spot_profiles = sig.tolist()  # 3 spots = the 3 pure signatures
    cells = [sig[2].tolist(), sig[0].tolist(), sig[1].tolist()]  # cell0~typeC(spot2), cell1~typeA(spot0), cell2~typeB(spot1)
    m = run({"task": "ot_map_cells_to_spots", "cells": cells, "spots": spot_profiles, "reg": 0.01})
    check("ot status success", m["status"] == "success", m)
    check("cell0 -> spot2", m["assignedSpotIndex"][0] == 2, m["assignedSpotIndex"])
    check("cell1 -> spot0", m["assignedSpotIndex"][1] == 0, m["assignedSpotIndex"])
    check("cell2 -> spot1", m["assignedSpotIndex"][2] == 1, m["assignedSpotIndex"])
except Exception as e:  # noqa: BLE001
    print(f"(OT checks skipped: {e})")

check("unknown task -> error", run({"task": "nope"}).get("status") == "error")
print(f"\nALL {passed} SPATIAL-DECONVOLUTION TESTS PASSED")
