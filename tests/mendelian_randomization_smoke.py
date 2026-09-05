#!/usr/bin/env python3
"""Smoke tests for server/mendelian_randomization.py.

Zero-hallucination: the fixtures are simulated with a KNOWN true causal effect
(beta = 0.5) so the asserted ground truth is analytically justified, not pinned
to whatever the code happens to emit.

Simulation (numpy default_rng(0), 40 SNPs):
  betaExposure ~ Uniform(0.1, 0.5); TRUE causal beta = 0.5.
  Clean model:     betaOutcome = 0.5 * betaExposure + small noise.
  Pleiotropy model: betaOutcome = 0.5 * betaExposure + 0.3 + small noise
                    (a constant +0.3 directional-pleiotropy offset).
  seOutcome = small constant (0.05).

Expected ground truth:
  * mr_ivw  (clean): causalEstimate ~ 0.5 (within 0.05); pValue < 0.01.
  * mr_egger(clean): slope ~ 0.5 (within 0.08); Egger intercept ~ 0
                     (interceptP > 0.05 -> no pleiotropy detected).
  * mr_egger(pleio): Egger intercept ~ 0.3 (within 0.1); interceptP < 0.05
                     (directional pleiotropy DETECTED).
  * mr_ivw  (pleio): estimate biased well away from 0.5 -- |ivw - 0.5| in the
                     pleiotropy case is far larger than in the clean case,
                     demonstrating that MR-Egger catches pleiotropy that IVW
                     misses.
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.join(HERE, "..", "server", "mendelian_randomization.py")

try:
    import numpy as np  # noqa: F401
    import scipy  # noqa: F401
except Exception:
    print("SKIP: numpy/scipy not installed")
    sys.exit(0)

import numpy as np  # noqa: E402


def run(payload):
    proc = subprocess.run(
        [sys.executable, ENGINE],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, f"non-zero exit: {proc.stderr}"
    return json.loads(proc.stdout)


N = 40
TRUE_BETA = 0.5

# --- clean fixture: no pleiotropy -------------------------------------------
rng = np.random.default_rng(0)
bx = rng.uniform(0.1, 0.5, N)
noise = rng.normal(0.0, 0.02, N)
se_y = np.full(N, 0.05)
by_clean = TRUE_BETA * bx + noise

# --- pleiotropy fixture: constant +0.3 directional offset -------------------
rng2 = np.random.default_rng(0)
bx2 = rng2.uniform(0.1, 0.5, N)
noise2 = rng2.normal(0.0, 0.02, N)
by_pleio = TRUE_BETA * bx2 + 0.3 + noise2

CLEAN = {
    "betaExposure": bx.tolist(),
    "betaOutcome": by_clean.tolist(),
    "seOutcome": se_y.tolist(),
}
PLEIO = {
    "betaExposure": bx2.tolist(),
    "betaOutcome": by_pleio.tolist(),
    "seOutcome": se_y.tolist(),
}

passed = 0

# 1. mr_ivw (clean): recovers ~0.5, highly significant, Q reported ------------
r = run({"task": "mr_ivw", **CLEAN})
assert r["status"] == "success", r
assert r["nSnps"] == N, r
assert abs(r["causalEstimate"] - 0.5) < 0.05, r
assert r["pValue"] < 0.01, r
assert r["se"] > 0, r
assert len(r["ci95"]) == 2 and r["ci95"][0] < r["causalEstimate"] < r["ci95"][1], r
assert r["cochranQ"] >= 0, r
assert r["qDf"] == N - 1, r
assert 0.0 <= r["qPvalue"] <= 1.0, r
ivw_clean_bias = abs(r["causalEstimate"] - 0.5)
passed += 1

# 2. mr_egger (clean): slope ~0.5, intercept ~0, NO pleiotropy detected -------
r = run({"task": "mr_egger", **CLEAN})
assert r["status"] == "success", r
assert r["nSnps"] == N, r
assert abs(r["causalEstimate"] - 0.5) < 0.08, r  # slope
assert abs(r["eggerIntercept"]) < 0.05, r        # ~0
assert r["interceptP"] > 0.05, r                 # no pleiotropy flagged
assert r["slopeSE"] > 0 and r["interceptSE"] > 0, r
passed += 1

# 3. mr_egger (pleio): intercept ~0.3, pleiotropy DETECTED, slope still ~0.5 --
r_pleio_egger = run({"task": "mr_egger", **PLEIO})
assert r_pleio_egger["status"] == "success", r_pleio_egger
assert abs(r_pleio_egger["eggerIntercept"] - 0.3) < 0.1, r_pleio_egger
assert r_pleio_egger["interceptP"] < 0.05, r_pleio_egger  # pleiotropy detected
# Egger's slope is still recovered near the true causal effect.
assert abs(r_pleio_egger["causalEstimate"] - 0.5) < 0.08, r_pleio_egger
passed += 1

# 4. mr_ivw (pleio): estimate biased away from 0.5, far more than the clean run
r = run({"task": "mr_ivw", **PLEIO})
assert r["status"] == "success", r
ivw_pleio_bias = abs(r["causalEstimate"] - 0.5)
assert ivw_pleio_bias > 0.3, r  # substantially biased
assert ivw_pleio_bias > ivw_clean_bias + 0.2, (ivw_pleio_bias, ivw_clean_bias)
# The comparison that matters: Egger's intercept flags the pleiotropy IVW misses.
assert r_pleio_egger["interceptP"] < 0.05, r_pleio_egger
passed += 1

# 5. mismatched array lengths -> status error --------------------------------
r = run({
    "task": "mr_ivw",
    "betaExposure": [0.1, 0.2, 0.3],
    "betaOutcome": [0.05, 0.1],
    "seOutcome": [0.05, 0.05, 0.05],
})
assert r["status"] == "error", r
passed += 1

# 6. unknown task -> status error --------------------------------------------
r = run({"task": "does_not_exist"})
assert r["status"] == "error", r
passed += 1

print(f"ALL {passed} MR TESTS PASSED")
