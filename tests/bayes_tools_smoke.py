#!/usr/bin/env python3
"""Ground-truth smoke tests for server/bayes_tools.py.

Every expected value is computed independently / by hand and asserted
against real executed output. Skips cleanly if scipy/numpy are missing.
"""
import json
import math
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MODULE = os.path.join(ROOT, "server", "bayes_tools.py")

try:
    import numpy  # noqa: F401
    import scipy  # noqa: F401
except Exception as e:  # pragma: no cover
    print(f"SKIP: bayes_tools_smoke requires numpy/scipy ({e})")
    sys.exit(0)


def run(payload):
    proc = subprocess.run(
        [sys.executable, MODULE],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, f"nonzero exit: {proc.stderr}"
    return json.loads(proc.stdout)


def approx(a, b, tol=1e-9):
    return abs(a - b) <= tol


passed = 0


def check(cond, msg):
    global passed
    assert cond, f"FAIL: {msg}"
    passed += 1
    print(f"PASS: {msg}")


# 1. beta_binomial_update: Beta(1,1) prior, 8/10 -> Beta(9,3), mean=0.75.
r = run({"task": "beta_binomial_update", "successes": 8, "trials": 10})
check(r["status"] == "success", "beta_binomial status success")
check(r["posteriorAlpha"] == 9, "beta posteriorAlpha == 9")
check(r["posteriorBeta"] == 3, "beta posteriorBeta == 3")
check(approx(r["posteriorMean"], 0.75), "beta posteriorMean == 0.75")
# mode of Beta(9,3) = (9-1)/(9+3-2) = 8/10 = 0.8
check(approx(r["posteriorMode"], 0.8), "beta posteriorMode == 0.8")
lo, hi = r["credibleInterval"]
check(0.0 < lo < r["posteriorMean"] < hi < 1.0, "beta CI brackets mean within (0,1)")

# 2. normal_normal_update: priorMean=0,priorVar=1, dataMean=2, sigma2=1, n=1
#    post precision = 1 + 1 = 2 -> var=0.5; mean = (0*1 + 2*1)/2 = 1.0
r = run({
    "task": "normal_normal_update",
    "priorMean": 0, "priorVar": 1,
    "dataMean": 2, "sigma2": 1, "n": 1,
})
check(r["status"] == "success", "normal_normal status success")
check(approx(r["posteriorMean"], 1.0), "normal posteriorMean == 1.0")
check(approx(r["posteriorVar"], 0.5), "normal posteriorVar == 0.5")
lo, hi = r["credibleInterval"]
check(lo < r["posteriorMean"] < hi, "normal CI brackets mean")

# 2b. normal_normal_update via data array (same sufficient stats):
#     data=[2], sigma2=1, priorMean=0, priorVar=1 -> mean 1.0, var 0.5
r = run({
    "task": "normal_normal_update",
    "priorMean": 0, "priorVar": 1,
    "data": [2.0], "sigma2": 1,
})
check(approx(r["posteriorMean"], 1.0) and approx(r["posteriorVar"], 0.5),
      "normal via data array matches sufficient stats")

# 3. poisson_gamma_update: Gamma(2,1) + counts sum=10, n=5 ->
#    shape=12, rate=6, mean=2.0
r = run({
    "task": "poisson_gamma_update",
    "priorShape": 2, "priorRate": 1,
    "counts": [2, 2, 2, 2, 2],
})
check(r["status"] == "success", "poisson_gamma status success")
check(approx(r["posteriorShape"], 12.0), "poisson posteriorShape == 12")
check(approx(r["posteriorRate"], 6.0), "poisson posteriorRate == 6")
check(approx(r["posteriorMean"], 2.0), "poisson posteriorMean == 2.0")
lo, hi = r["credibleInterval"]
check(lo < r["posteriorMean"] < hi, "poisson CI brackets mean")

# 3b. same via sumCounts/nObs
r = run({
    "task": "poisson_gamma_update",
    "priorShape": 2, "priorRate": 1,
    "sumCounts": 10, "nObs": 5,
})
check(approx(r["posteriorShape"], 12.0) and approx(r["posteriorRate"], 6.0),
      "poisson via sumCounts/nObs matches")

# 4. bayesian_ab_test: A=50/100, B=70/100 -> P(B>A) very high (>0.99)
r = run({
    "task": "bayesian_ab_test",
    "successesA": 50, "trialsA": 100,
    "successesB": 70, "trialsB": 100,
    "seed": 0,
})
check(r["status"] == "success", "ab_test status success")
check(r["probBGreaterA"] > 0.99, "ab_test P(B>A) > 0.99 for clear signal")
check(approx(r["meanA"], 51.0 / 102.0) and approx(r["meanB"], 71.0 / 102.0),
      "ab_test posterior means match Beta(1,1)+data")
# identical data -> ~0.5
r = run({
    "task": "bayesian_ab_test",
    "successesA": 50, "trialsA": 100,
    "successesB": 50, "trialsB": 100,
    "seed": 0,
})
check(0.45 <= r["probBGreaterA"] <= 0.55, "ab_test identical data P(B>A) ~ 0.5")

# 5. bayes_factor_bic: bic0=110, bic1=100 -> BF10 = exp(5) ~ 148.41
r = run({"task": "bayes_factor_bic", "bic0": 110, "bic1": 100})
check(r["status"] == "success", "bayes_factor status success")
check(approx(r["bayesFactor10"], math.exp(5.0), tol=1e-6),
      "bayes_factor BF10 == exp(5)")
check(approx(r["log10BF"], 5.0 / math.log(10.0), tol=1e-9),
      "bayes_factor log10BF == 5/ln(10)")
# equal BIC -> BF10 = 1
r = run({"task": "bayes_factor_bic", "bic0": 100, "bic1": 100})
check(approx(r["bayesFactor10"], 1.0), "bayes_factor equal BIC BF10 == 1")
check(r["evidenceCategory"] == "anecdotal", "bayes_factor equal BIC anecdotal")

# 6. Unknown task -> status error
r = run({"task": "not_a_real_task"})
check(r["status"] == "error", "unknown task returns status error")

print(f"ALL {passed} BAYES TESTS PASSED")
