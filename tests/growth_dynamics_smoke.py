#!/usr/bin/env python3
"""Smoke test for server/growth_dynamics.py — asserts REAL numeric ground truth.

Ground truth is generated from KNOWN parameters (noise-free) and must be
recovered by the fitters; the Lotka-Volterra carrying capacity r/|A| is verified
analytically. One task additionally exercises the full outcome bundle.
"""
import json
import math
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "growth_dynamics.py")

try:
    import matplotlib  # noqa: F401
    import numpy as np  # noqa: F401
    import scipy  # noqa: F401
except Exception as e:  # pragma: no cover
    print(f"SKIP: numpy/scipy/matplotlib not available ({e}).")
    sys.exit(0)

passed = 0


def check(name, cond, ctx=None):
    global passed
    if not cond:
        print(f"FAIL: {name}\n  {ctx}")
        sys.exit(1)
    passed += 1
    print(f"ok: {name}")


def run(payload):
    r = subprocess.run(
        [sys.executable, SCRIPT],
        input=json.dumps(payload).encode(),
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    if r.returncode != 0:
        print(f"process error rc={r.returncode}: {r.stderr.decode()}")
    return json.loads(r.stdout.decode())


# --- 1. Logistic: recover K=1000, r=0.5, N0=10 from noise-free data ---------
K_true, r_true, N0_true = 1000.0, 0.5, 10.0
t = [float(i) for i in range(0, 31)]
pop = [K_true / (1.0 + ((K_true - N0_true) / N0_true) * math.exp(-r_true * ti)) for ti in t]
res = run({"task": "logistic_growth_fit", "time": t, "population": pop})
check("logistic status success", res.get("status") == "success", res)
check("logistic recovers K≈1000", abs(res["K"] - 1000.0) < 1.0, res)
check("logistic recovers r≈0.5", abs(res["r"] - 0.5) < 0.005, res)
check("logistic recovers N0≈10", abs(res["N0"] - 10.0) < 0.1, res)
check("logistic rSquared>0.999", res["rSquared"] > 0.999, res)

# --- 2. Gompertz: recover A=1000, mu=100, lag=2 from noise-free data ---------
A_true, mu_true, lag_true = 1000.0, 100.0, 2.0


def gompertz(ti):
    return A_true * math.exp(-math.exp((mu_true * math.e / A_true) * (lag_true - ti) + 1.0))


tg = [i * (30.0 / 79.0) for i in range(80)]
popg = [gompertz(ti) for ti in tg]
# sanity: generator matches model asymptote
check("gompertz generator approaches A", abs(popg[-1] - 1000.0) < 5.0, popg[-1])
resg = run({"task": "gompertz_growth_fit", "time": tg, "population": popg})
check("gompertz status success", resg.get("status") == "success", resg)
check("gompertz recovers A≈1000", abs(resg["A"] - 1000.0) < 1.0, resg)
check("gompertz recovers mu≈100", abs(resg["mu"] - 100.0) < 1.0, resg)
check("gompertz recovers lag≈2", abs(resg["lag"] - 2.0) < 0.05, resg)
check("gompertz rSquared>0.999", resg["rSquared"] > 0.999, resg)

# --- 3a. Lotka-Volterra single species: carrying capacity r/|A| = 1000 -------
tp = [i * (30.0 / 200.0) for i in range(201)]
lv = run({
    "task": "lotka_volterra_simulate",
    "initialAbundances": [10.0],
    "growthRates": [1.0],
    "interactionMatrix": [[-0.001]],
    "timePoints": tp,
})
check("LV status success", lv.get("status") == "success", lv)
check("LV single-species final ≈ 1000 (r/|A|)", abs(lv["finalAbundances"][0] - 1000.0) < 10.0, lv)
# monotonic increase from 10 toward carrying capacity (verifiable sanity)
traj0 = lv["trajectories"][0]
check("LV single-species monotonic increasing", all(traj0[i + 1] >= traj0[i] - 1e-6 for i in range(len(traj0) - 1)), traj0[:5])
check("LV single-species bounded by K", max(traj0) <= 1000.0 + 1.0, max(traj0))

# --- 3b. Lotka-Volterra 2-species symmetric competition ----------------------
# r=[1,1], A symmetric competitive; by symmetry N1(t)==N2(t) and both converge
# to coexistence equilibrium N* solving 0 = 1 + (-0.0015)N*  =>  N* = 1/0.0015.
lv2 = run({
    "task": "lotka_volterra_simulate",
    "initialAbundances": [10.0, 10.0],
    "growthRates": [1.0, 1.0],
    "interactionMatrix": [[-0.001, -0.0005], [-0.0005, -0.001]],
    "timePoints": tp,
})
check("LV 2-species status success", lv2.get("status") == "success", lv2)
f1, f2 = lv2["finalAbundances"]
check("LV 2-species symmetry N1≈N2", abs(f1 - f2) < 1e-3, lv2["finalAbundances"])
check("LV 2-species coexistence ≈ 1/0.0015", abs(f1 - (1.0 / 0.0015)) < 5.0, f1)

# --- 4. Outcome bundle on one task (logistic) --------------------------------
with tempfile.TemporaryDirectory() as td:
    outdir = os.path.join(td, "bundle")
    rb = run({"task": "logistic_growth_fit", "time": t, "population": pop, "outputDir": outdir})
    check("bundle attached", "bundle" in rb, rb.get("bundleError", rb))
    man = rb["bundle"]
    figs = man["artifacts"]["figures"]
    png = [f for f in figs if f.endswith(".png")]
    svg = [f for f in figs if f.endswith(".svg")]
    check("bundle has png figure", len(png) == 1, figs)
    check("bundle has svg figure", len(svg) == 1, figs)
    with open(os.path.join(outdir, png[0]), "rb") as fh:
        check("png has PNG magic", fh.read(4) == b"\x89PNG", png)
    csvs = man["artifacts"]["tables"]
    check("bundle has csv table", any(c.endswith(".csv") for c in csvs), csvs)
    check("bundle csv non-empty", os.path.getsize(os.path.join(outdir, csvs[0])) > 0, csvs)
    code_p = os.path.join(outdir, "code", "analysis.py")
    check("bundle code/analysis.py non-empty", os.path.getsize(code_p) > 0, code_p)
    html_p = os.path.join(outdir, "report.html")
    md_p = os.path.join(outdir, "report.md")
    check("bundle report.html non-empty", os.path.getsize(html_p) > 0, html_p)
    check("bundle report.md non-empty", os.path.getsize(md_p) > 0, md_p)

# --- 5. Unknown task -> honest error -----------------------------------------
check("unknown task -> error", run({"task": "nope"}).get("status") == "error")

print(f"\nALL {passed} GROWTH TESTS PASSED")
