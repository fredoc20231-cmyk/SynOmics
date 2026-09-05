#!/usr/bin/env python3
"""Ground-truth smoke tests for server/dissolution_tools.py.

Task: drug_release_kinetics. Fixtures are built from KNOWN closed-form release
profiles so the expected model fit, R^2, and analytic t50 can be asserted
against ground truth (no hardcoded guesses):

- Perfect zero-order: release = 20*t %  (concentration 4*t, total 20).
  Zero-order fits exactly (R^2=1); best-model t50 = 50/20 = 2.5 h.
- Perfect Higuchi: release = 30*sqrt(t) %  (t = 1,4,9,16,25).
  Higuchi fits exactly (R^2=1); best-model t50: 50 = k*sqrt(t50). After the
  module's max-normalization (max release -> 100), the *shape* is preserved so
  R^2 is scale-invariant and t50 is unchanged: 20*sqrt(t50)=50 -> t50 = 6.25 h.

Error paths: too few points, mismatched lengths, and an unknown task must each
return status "error".
"""
import json
import math
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "dissolution_tools.py")

try:
    import numpy  # noqa: F401
    import scipy  # noqa: F401
except Exception as e:  # noqa: BLE001
    print(f"SKIP: numpy/scipy not available ({e}).")
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


# --- Fixture 1: perfect zero-order (release = 20*t %) -----------------------
res = run(
    {
        "task": "drug_release_kinetics",
        "time_points": [1, 2, 3, 4, 5],
        "concentration_data": [4, 8, 12, 16, 20],
        "total_drug_loaded": 20,
        "drug_name": "TestDrug",
    }
)
check("zero-order: status success", res.get("status") == "success", res)
check("zero-order: models dict present", isinstance(res.get("models"), dict), res)
check(
    "zero-order: all 4 models fitted",
    set(res["models"]) == {"zero_order", "first_order", "higuchi", "korsmeyer_peppas"},
    res.get("models"),
)
zo_r2 = res["models"]["zero_order"]["rSquared"]
check("zero-order: zero_order rSquared > 0.999", zo_r2 is not None and zo_r2 > 0.999, zo_r2)
check(
    "zero-order: best-model t50Hours ~ 2.5",
    res.get("t50Hours") is not None and abs(res["t50Hours"] - 2.5) < 0.05,
    res.get("t50Hours"),
)
check("zero-order: drugName echoed", res.get("drugName") == "TestDrug", res.get("drugName"))
check(
    "zero-order: transportMechanism present",
    isinstance(res.get("transportMechanism"), str),
    res.get("transportMechanism"),
)

# --- Fixture 2: perfect Higuchi (release = 30*sqrt(t) %) ---------------------
t2 = [1, 4, 9, 16, 25]
conc2 = [30.0 * math.sqrt(x) for x in t2]  # 30,60,90,120,150 -> normalized to max 100
res2 = run(
    {
        "task": "drug_release_kinetics",
        "time_points": t2,
        "concentration_data": conc2,
    }
)
check("higuchi: status success", res2.get("status") == "success", res2)
hg_r2 = res2["models"]["higuchi"]["rSquared"]
check("higuchi: higuchi rSquared > 0.999", hg_r2 is not None and hg_r2 > 0.999, hg_r2)
# After max-normalization release = 20*sqrt(t); 50 = 20*sqrt(t50) -> t50 = 6.25 h.
check(
    "higuchi: best-model t50Hours ~ 6.25",
    res2.get("t50Hours") is not None and abs(res2["t50Hours"] - 6.25) < 0.1,
    res2.get("t50Hours"),
)
check("higuchi: default drugName == 'Drug'", res2.get("drugName") == "Drug", res2.get("drugName"))

# --- Error paths ------------------------------------------------------------
few = run(
    {
        "task": "drug_release_kinetics",
        "time_points": [1, 2, 3],
        "concentration_data": [10, 20, 30],
    }
)
check("too few points -> error", few.get("status") == "error", few)

mismatch = run(
    {
        "task": "drug_release_kinetics",
        "time_points": [1, 2, 3, 4],
        "concentration_data": [10, 20, 30],
    }
)
check("length mismatch -> error", mismatch.get("status") == "error", mismatch)

check("unknown task -> error", run({"task": "nope"}).get("status") == "error")

print(f"\nALL {passed} DISSOLUTION TESTS PASSED")
