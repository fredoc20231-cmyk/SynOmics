#!/usr/bin/env python3
"""Smoke tests for server/power_tools.py — asserts textbook / statsmodels ground truth.

Ground-truth values (computed directly with statsmodels/scipy, then pinned):
- sample_size_two_means d=0.5, alpha=0.05, power=0.8, two-sided -> nRaw=63.766 -> n=64
- power_two_means d=0.5, nPerGroup=64, alpha=0.05 -> power=0.80146
- sample_size_two_proportions p1=0.5, p2=0.7, power=0.8, alpha=0.05 -> nRaw=92.696 -> n=93
- power_anova k=4, f=0.25, nPerGroup=45 (N=180), alpha=0.05 -> power=0.80399
- sample_size_correlation r=0.3, alpha=0.05 two-sided, power=0.8 -> nRaw=84.928 -> n=85
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.join(HERE, "..", "server", "power_tools.py")

try:
    import statsmodels  # noqa: F401
except Exception:
    print("SKIP: statsmodels not installed")
    sys.exit(0)


def run(payload):
    proc = subprocess.run(
        [sys.executable, ENGINE],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, f"non-zero exit: {proc.stderr}"
    return json.loads(proc.stdout)


def approx(a, b, tol):
    return abs(a - b) <= tol


passed = 0

# 1. sample_size_two_means: d=0.5 -> n ~= 64
r = run({"task": "sample_size_two_means", "effectSize": 0.5, "alpha": 0.05, "power": 0.8, "alternative": "two-sided"})
assert r["status"] == "success", r
assert 63 <= r["nPerGroup"] <= 65, r
assert approx(r["nPerGroupRaw"], 63.766, 0.05), r
passed += 1

# 2. power_two_means: d=0.5, n=64 -> power ~= 0.8015
r = run({"task": "power_two_means", "effectSize": 0.5, "nPerGroup": 64, "alpha": 0.05})
assert r["status"] == "success", r
assert approx(r["power"], 0.80146, 0.02), r
passed += 1

# 3. sample_size_two_proportions: p1=0.5, p2=0.7 -> n ~= 93
r = run({"task": "sample_size_two_proportions", "p1": 0.5, "p2": 0.7, "power": 0.8, "alpha": 0.05})
assert r["status"] == "success", r
assert abs(r["nPerGroup"] - 93) <= 3, r
assert approx(abs(r["effectSizeH"]), 0.41152, 0.001), r
passed += 1

# 4. power_anova: k=4, f=0.25, nPerGroup=45 (N=180) -> power ~= 0.80399
r = run({"task": "power_anova", "groups": 4, "effectSize": 0.25, "nPerGroup": 45, "alpha": 0.05})
assert r["status"] == "success", r
assert r["nTotal"] == 180, r
assert approx(r["power"], 0.80399, 0.02), r
passed += 1

# 5. sample_size_correlation: r=0.3 -> n ~= 85
r = run({"task": "sample_size_correlation", "r": 0.3, "alpha": 0.05, "power": 0.8, "alternative": "two-sided"})
assert r["status"] == "success", r
assert abs(r["n"] - 85) <= 3, r
assert approx(r["nRaw"], 84.928, 0.05), r
passed += 1

# 6. unknown task -> status error
r = run({"task": "does_not_exist"})
assert r["status"] == "error", r
passed += 1

print(f"ALL {passed} POWER TESTS PASSED")
