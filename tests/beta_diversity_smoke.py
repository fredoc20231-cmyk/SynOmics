#!/usr/bin/env python3
"""Ground-truth smoke tests for server/beta_diversity.py (numpy/scipy)."""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.join(HERE, os.pardir, "server", "beta_diversity.py")

try:
    import numpy as np  # noqa: F401
    import scipy  # noqa: F401
except Exception as e:  # pragma: no cover
    print(f"SKIP: numpy/scipy not installed ({e})")
    sys.exit(0)


def run(payload):
    proc = subprocess.run(
        [sys.executable, ENGINE],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, f"nonzero exit: {proc.stderr}"
    return json.loads(proc.stdout)


passed = 0


def check(name, cond):
    global passed
    assert cond, f"FAILED: {name}"
    passed += 1
    print(f"  ok: {name}")


# ---------------------------------------------------------------- Bray-Curtis
# [1,0,0] vs [0,1,0]: num=|1-0|+|0-1|+0=2, den=1+1=2 -> BC=1.0
r = run({"task": "bray_curtis", "matrix": [[1, 0, 0], [0, 1, 0]]})
check("bray_curtis status success", r["status"] == "success")
dm = r["distanceMatrix"]
check("bray_curtis disjoint == 1.0", abs(dm[0][1] - 1.0) < 1e-9)
check("bray_curtis diagonal 0", dm[0][0] == 0.0 and dm[1][1] == 0.0)
check("bray_curtis symmetric", dm[0][1] == dm[1][0])

# identical samples -> 0.0
r2 = run({"task": "bray_curtis", "matrix": [[3, 2, 5], [3, 2, 5]]})
check("bray_curtis identical == 0.0", abs(r2["distanceMatrix"][0][1]) < 1e-9)

# mixed hand case: [1,2,3] vs [2,0,1]
# num=|1-2|+|2-0|+|3-1|=1+2+2=5 ; den=(1+2+3)+(2+0+1)=6+3=9 ; BC=5/9=0.55556
r3 = run({"task": "bray_curtis", "matrix": [[1, 2, 3], [2, 0, 1]]})
check("bray_curtis mixed 5/9", abs(r3["distanceMatrix"][0][1] - (5.0 / 9.0)) < 1e-9)

# ---------------------------------------------------------------- Jaccard
# [1,1,0,0] vs [1,0,1,0]: inter=1, union=3 -> 1-1/3=0.6667
r = run({"task": "jaccard_distance", "matrix": [[1, 1, 0, 0], [1, 0, 1, 0]]})
check("jaccard status success", r["status"] == "success")
check("jaccard 0.6667", abs(r["distanceMatrix"][0][1] - (1 - 1 / 3)) < 1e-4)
check("jaccard diagonal 0", r["distanceMatrix"][0][0] == 0.0)
# identical presence -> 0 ; disjoint presence -> 1
r = run({"task": "jaccard_distance", "matrix": [[1, 1, 0], [0, 0, 5]]})
check("jaccard disjoint == 1.0", abs(r["distanceMatrix"][0][1] - 1.0) < 1e-9)

# ---------------------------------------------------------------- PCoA
pts = np.array([[0.0, 0.0], [1.0, 0.0], [0.0, 2.0], [3.0, 1.0]])
n = pts.shape[0]
D = np.zeros((n, n))
for i in range(n):
    for j in range(n):
        D[i, j] = np.sqrt(np.sum((pts[i] - pts[j]) ** 2))
r = run({"task": "pcoa", "distanceMatrix": D.tolist(), "nComponents": 2})
check("pcoa status success", r["status"] == "success")
prop = r["proportionExplained"]
check("pcoa proportion sums ~1", abs(sum(prop) - 1.0) < 1e-6)
coords = np.array(r["coordinates"])
check("pcoa 2 axes", coords.shape[1] == 2)
# reconstructed pairwise distances match input
recon = np.zeros((n, n))
for i in range(n):
    for j in range(n):
        recon[i, j] = np.sqrt(np.sum((coords[i] - coords[j]) ** 2))
check("pcoa reconstructs distances", np.allclose(recon, D, atol=1e-6))

# ---------------------------------------------------------------- PERMANOVA
# two clearly separated clusters (4 per group -> C(8,4)=70 partitions, p-floor < 0.05)
base = np.array([[0.0, 0.0], [0.1, 0.0], [0.0, 0.1], [0.1, 0.1],
                 [10.0, 10.0], [10.1, 10.0], [10.0, 10.1], [10.1, 10.1]])
m = base.shape[0]
sep_groups = ["A", "A", "A", "A", "B", "B", "B", "B"]
Dsep = np.zeros((m, m))
for i in range(m):
    for j in range(m):
        Dsep[i, j] = np.sqrt(np.sum((base[i] - base[j]) ** 2))
r = run({"task": "permanova", "distanceMatrix": Dsep.tolist(),
         "groups": sep_groups,
         "nPermutations": 999, "seed": 0})
check("permanova status success", r["status"] == "success")
check("permanova separated pseudoF large", r["pseudoF"] > 10)
check("permanova separated significant", r["pValue"] < 0.05 and r["significant"])

# overlapping groups -> not significant
over = np.array([[0.0, 0.0], [1.0, 0.0], [0.0, 1.0], [1.0, 1.0],
                 [0.2, 0.2], [1.1, 0.1], [0.1, 1.1], [0.9, 0.9]])
mo = over.shape[0]
Dov = np.zeros((mo, mo))
for i in range(mo):
    for j in range(mo):
        Dov[i, j] = np.sqrt(np.sum((over[i] - over[j]) ** 2))
r = run({"task": "permanova", "distanceMatrix": Dov.tolist(),
         "groups": ["A", "B", "A", "B", "A", "B", "A", "B"],
         "nPermutations": 999, "seed": 0})
check("permanova overlap not significant", r["pValue"] >= 0.05)

# ---------------------------------------------------------------- Mantel
r = run({"task": "mantel_test", "matrixA": Dsep.tolist(),
         "matrixB": Dsep.tolist(), "nPermutations": 999, "seed": 0})
check("mantel status success", r["status"] == "success")
check("mantel identical r ~ 1.0", abs(r["mantelR"] - 1.0) < 1e-9)
check("mantel identical significant", r["pValue"] < 0.05)

# ---------------------------------------------------------------- Unknown task
r = run({"task": "does_not_exist"})
check("unknown task -> error", r["status"] == "error")

print(f"ALL {passed} BETA-DIVERSITY TESTS PASSED")
