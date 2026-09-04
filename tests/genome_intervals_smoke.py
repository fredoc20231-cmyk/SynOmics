#!/usr/bin/env python3
"""Ground-truth smoke tests for server/genome_intervals.py.

Every expected value below is verified by hand against half-open 0-based
[start, end) interval arithmetic — no external dependencies.
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.join(HERE, "..", "server", "genome_intervals.py")

passed = 0


def run(payload):
    proc = subprocess.run(
        [sys.executable, ENGINE],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, f"non-zero exit: {proc.stderr}"
    return json.loads(proc.stdout)


def check(name, cond):
    global passed
    assert cond, f"FAILED: {name}"
    passed += 1
    print(f"ok - {name}")


# 1. interval_merge
# [[1,5],[3,8]] overlap -> [1,8]; [[10,12],[12,15]] book-ended (minGap 0) -> [10,15]
r = run({"task": "interval_merge",
         "intervals": [[1, 5], [3, 8], [10, 12], [12, 15]]})
check("merge status", r["status"] == "success")
check("merge merged == [[1,8],[10,15]]", r["merged"] == [[1, 8], [10, 15]])
check("merge mergedCount == 2", r["mergedCount"] == 2)

# minGap sanity: a gap of 2 between [0,5] and [7,9] merges only when minGap >= 2
r = run({"task": "interval_merge", "intervals": [[0, 5], [7, 9]], "minGap": 2})
check("merge minGap=2 merges gap-2 -> [[0,9]]", r["merged"] == [[0, 9]])
r = run({"task": "interval_merge", "intervals": [[0, 5], [7, 9]], "minGap": 0})
check("merge minGap=0 keeps gap-2 separate", r["merged"] == [[0, 5], [7, 9]])

# 2. interval_intersect
# a=[[1,10]] vs b=[[5,15],[0,3]] -> [5,10] (len 5) and [1,3] (len 2); total 7
r = run({"task": "interval_intersect", "a": [[1, 10]], "b": [[5, 15], [0, 3]]})
check("intersect status", r["status"] == "success")
check("intersect contains [5,10]", [5, 10] in r["intersections"])
check("intersect contains [1,3]", [1, 3] in r["intersections"])
check("intersect totalOverlapBp == 7", r["totalOverlapBp"] == 7)

# 3. interval_subtract
# a=[[1,10]] minus b=[[3,5]] -> [[1,3],[5,10]]
r = run({"task": "interval_subtract", "a": [[1, 10]], "b": [[3, 5]]})
check("subtract status", r["status"] == "success")
check("subtract remaining == [[1,3],[5,10]]", r["remaining"] == [[1, 3], [5, 10]])

# 4. interval_coverage
# intervals=[[0,5],[3,10]] over [0,20]: union is [0,10] -> 10 bp of 20 -> 0.5
r = run({"task": "interval_coverage",
         "intervals": [[0, 5], [3, 10]], "regionStart": 0, "regionEnd": 20})
check("coverage status", r["status"] == "success")
check("coverage coveredBp == 10 (union not sum)", r["coveredBp"] == 10)
check("coverage regionBp == 20", r["regionBp"] == 20)
check("coverage coverageFraction == 0.5", r["coverageFraction"] == 0.5)
# regionLength form gives same answer
r2 = run({"task": "interval_coverage",
          "intervals": [[0, 5], [3, 10]], "regionLength": 20})
check("coverage regionLength form matches", r2["coveredBp"] == 10 and r2["regionBp"] == 20)

# 5. interval_nearest
# query [100,110]: to [0,10] dist = 100-10 = 90; to [200,210] dist = 200-110 = 90.
# tie broken toward the later feature -> nearest [200,210], distance 90.
r = run({"task": "interval_nearest",
         "query": [[100, 110]], "features": [[0, 10], [200, 210]]})
check("nearest status", r["status"] == "success")
check("nearest -> [200,210]", r["results"][0]["nearest"] == [200, 210])
check("nearest distance == 90", r["results"][0]["distance"] == 90)
# overlapping query returns distance 0
r = run({"task": "interval_nearest",
         "query": [[5, 15]], "features": [[10, 20]]})
check("nearest overlapping distance == 0", r["results"][0]["distance"] == 0)

# 6. Unknown task -> error
r = run({"task": "not_a_task"})
check("unknown task -> status error", r["status"] == "error")

print(f"ALL {passed} GENOME-INTERVALS TESTS PASSED")
