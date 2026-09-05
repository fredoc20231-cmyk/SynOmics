#!/usr/bin/env python3
"""Ground-truth smoke tests for server/cell_motility_tools.py.

Every expectation is derived analytically from the constructed geometry (a
straight track, a back-and-forth track, and two clearly separable motility
groups) — nothing is a hardcoded guess. Zero-hallucination: the module must
return REAL computed numbers matching these ground truths.
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "cell_motility_tools.py")

try:
    import numpy  # noqa: F401
    import sklearn  # noqa: F401
    from sklearn.metrics import adjusted_rand_score
except Exception as e:  # noqa: BLE001
    print(f"SKIP: numpy/scikit-learn not available ({e}).")
    sys.exit(0)

passed = 0


def check(n, c, ctx=None):
    global passed
    if not c:
        print(f"FAIL: {n}\n  {ctx}")
        sys.exit(1)
    passed += 1
    print(f"ok: {n}")


def run(p):
    r = subprocess.run(
        [sys.executable, SCRIPT],
        input=json.dumps(p).encode(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return json.loads(r.stdout.decode())


# ---------------------------------------------------------------------------
# Task 1: cell_motility_metrics
# ---------------------------------------------------------------------------

# A perfectly STRAIGHT track: 3 unit steps along +x.
straight = [[0, 0], [1, 0], [2, 0], [3, 0]]
res = run({"task": "cell_motility_metrics", "tracks": [straight], "dt": 1})
check("straight: status success", res.get("status") == "success", res)
m0 = res["perTrack"][0]
check("straight: totalPathLength == 3.0", m0["totalPathLength"] == 3.0, m0)
check("straight: netDisplacement == 3.0", m0["netDisplacement"] == 3.0, m0)
check("straight: directionalityRatio == 1.0", m0["directionalityRatio"] == 1.0, m0)
check("straight: meanSpeed == 1.0", m0["meanSpeed"] == 1.0, m0)
# MSD at lag 1 for 3 unit steps = mean([1,1,1]) = 1.0
check("straight: msdLag1 == 1.0", m0["msdLag1"] == 1.0, m0)
check("straight: perTrack length 1", len(res["perTrack"]) == 1, res)
check("straight: populationMeans present", isinstance(res.get("populationMeans"), dict), res)
check("straight: researchLog present", isinstance(res.get("researchLog"), str) and res["researchLog"], res)

# A BACK-AND-FORTH track: 0->1->0->1, three unit steps, net displacement 1.
backforth = [[0, 0], [1, 0], [0, 0], [1, 0]]
res2 = run({"task": "cell_motility_metrics", "tracks": [backforth]})
check("backforth: status success", res2.get("status") == "success", res2)
mb = res2["perTrack"][0]
check("backforth: totalPathLength == 3.0", mb["totalPathLength"] == 3.0, mb)
check("backforth: netDisplacement == 1.0", mb["netDisplacement"] == 1.0, mb)
check(
    "backforth: directionalityRatio ~ 0.333",
    abs(mb["directionalityRatio"] - (1.0 / 3.0)) < 1e-6,
    mb,
)

# pixelSize scaling: doubling pixel size doubles distances (ratio unchanged).
resp = run({"task": "cell_motility_metrics", "tracks": [straight], "dt": 1, "pixelSize": 2})
mp = resp["perTrack"][0]
check("pixelSize=2: totalPathLength == 6.0", mp["totalPathLength"] == 6.0, mp)
check("pixelSize=2: netDisplacement == 6.0", mp["netDisplacement"] == 6.0, mp)
check("pixelSize=2: directionalityRatio == 1.0", mp["directionalityRatio"] == 1.0, mp)

# populationMeans across two tracks (straight + backforth), dt=1, pixelSize=1.
resm = run({"task": "cell_motility_metrics", "tracks": [straight, backforth], "dt": 1})
pm = resm["populationMeans"]
# net displacement mean = (3.0 + 1.0)/2 = 2.0 ; path mean = (3+3)/2 = 3.0
check("popmean: netDisplacement == 2.0", pm["netDisplacement"] == 2.0, pm)
check("popmean: totalPathLength == 3.0", pm["totalPathLength"] == 3.0, pm)

# ---------------------------------------------------------------------------
# Task 2: cluster_motility_patterns
# ---------------------------------------------------------------------------

# Group A: FAST + STRAIGHT (large steps along +x, directionality == 1).
# Group B: SLOW + RANDOM (small back-and-forth, net displacement 0, directionality 0).
group_a = []
group_b = []
for i in range(10):
    s = 10.0 + 0.1 * i  # step size ~10 (fast)
    group_a.append([[0.0, float(i)], [s, float(i)], [2 * s, float(i)], [3 * s, float(i)], [4 * s, float(i)]])
    b = 1.0 + 0.05 * i  # step size ~1 (slow)
    group_b.append([[0.0, float(i)], [b, float(i)], [0.0, float(i)], [b, float(i)], [0.0, float(i)]])

tracks = group_a + group_b
true_labels = [0] * 10 + [1] * 10

resc = run({"task": "cluster_motility_patterns", "tracks": tracks, "nClusters": 2})
check("cluster: status success", resc.get("status") == "success", resc)
labels = resc.get("clusterLabels")
check("cluster: labels length == 20", isinstance(labels, list) and len(labels) == 20, resc)
ari = adjusted_rand_score(true_labels, labels)
check("cluster: adjusted Rand index == 1.0 (perfect separation)", ari == 1.0, ari)
sizes = resc.get("clusterSizes")
check(
    "cluster: two clusters of size 10 each",
    sorted(sizes.values()) == [10, 10],
    sizes,
)
check("cluster: clusterMeans present", isinstance(resc.get("clusterMeans"), dict), resc)
check("cluster: researchLog present", isinstance(resc.get("researchLog"), str) and resc["researchLog"], resc)

# ---------------------------------------------------------------------------
# Honest error handling
# ---------------------------------------------------------------------------
check("empty tracks -> error", run({"task": "cell_motility_metrics", "tracks": []}).get("status") == "error")
check(
    "single-position track -> error",
    run({"task": "cell_motility_metrics", "tracks": [[[0, 0]]]}).get("status") == "error",
)
check(
    "non-numeric track -> error",
    run({"task": "cell_motility_metrics", "tracks": [[["a", "b"], [1, 2]]]}).get("status") == "error",
)
check(
    "cluster nClusters > tracks -> error",
    run({"task": "cluster_motility_patterns", "tracks": [straight, backforth], "nClusters": 5}).get("status")
    == "error",
)
check("unknown task -> error", run({"task": "nope"}).get("status") == "error")
check("missing tracks -> error", run({"task": "cell_motility_metrics"}).get("status") == "error")

print(f"\nALL {passed} CELL-MOTILITY TESTS PASSED")
