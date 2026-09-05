#!/usr/bin/env python3
"""Ground-truth smoke tests for server/enzyme_pk_tools.py.

Every fixture is noiseless with KNOWN analytical answers; the module must
recover them. Skips cleanly if numpy/scipy are unavailable.
"""
import json
import os
import subprocess
import sys

try:
    import numpy as np  # noqa: F401
    from scipy.optimize import curve_fit  # noqa: F401
except Exception as e:  # noqa: BLE001
    print(f"SKIP: enzyme_pk_tools_smoke requires numpy/scipy ({e})")
    sys.exit(0)

MODULE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "server",
    "enzyme_pk_tools.py",
)


def run_task(payload):
    proc = subprocess.run(
        [sys.executable, MODULE],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, f"nonzero exit: {proc.stderr}"
    return json.loads(proc.stdout)


passed = 0


def check(name, cond, detail=""):
    global passed
    assert cond, f"FAIL {name}: {detail}"
    passed += 1
    print(f"PASS {name} {detail}")


# ---------------------------------------------------------------------------
# 1. protease_kinetics: Vmax=100, Km=10, enzyme=2 uM.
#    time_points = 0..9; substrate = [1,2,5,10,20,50].
#    Each fluorescence trace is exactly linear: F(t) = v_i * t with
#    v_i = 100*S/(10+S). polyfit recovers v_i; curve_fit recovers Vmax/Km.
# ---------------------------------------------------------------------------
VMAX_TRUE, KM_TRUE, ENZYME = 100.0, 10.0, 2.0
time_points = list(range(10))
substrate = [1.0, 2.0, 5.0, 10.0, 20.0, 50.0]
v_true = [VMAX_TRUE * s / (KM_TRUE + s) for s in substrate]
fluorescence = [[vi * t for t in time_points] for vi in v_true]

r = run_task({
    "task": "protease_kinetics",
    "time_points": time_points,
    "fluorescence_data": fluorescence,
    "substrate_concentrations": substrate,
    "enzyme_concentration": ENZYME,
})
check("pk.status", r["status"] == "success", r)
check("pk.Vmax", abs(r["Vmax"] - VMAX_TRUE) < 1e-2, f"Vmax={r['Vmax']}")
check("pk.Km", abs(r["Km"] - KM_TRUE) < 1e-2, f"Km={r['Km']}")
# kcat = Vmax/[E] = 100/2 = 50 ; catalytic efficiency = kcat/Km = 50/10 = 5
check("pk.kcat", abs(r["kcat"] - 50.0) < 1e-2, f"kcat={r['kcat']}")
check("pk.catEff", abs(r["catalyticEfficiency"] - 5.0) < 1e-2,
      f"catEff={r['catalyticEfficiency']}")
check("pk.nvel", len(r["initialVelocities"]) == len(substrate),
      f"n={len(r['initialVelocities'])}")
for i, (got, exp) in enumerate(zip(r["initialVelocities"], v_true)):
    check(f"pk.v{i}", abs(got - exp) < 1e-6, f"got={got} exp={exp}")
check("pk.r2", r["rSquared"] > 0.999, f"r2={r['rSquared']}")
check("pk.analysis", isinstance(r["analysis"], str) and len(r["analysis"]) > 0)
check("pk.log", isinstance(r["researchLog"], str) and len(r["researchLog"]) > 0)

# ---------------------------------------------------------------------------
# 2. bi_exponential_pk: C(t) = 8*exp(-1.0*t) + 2*exp(-0.1*t).
#    Recover alpha=1.0, beta=0.1, A=8, B=2, elim half-life = ln2/0.1 ~ 6.93.
# ---------------------------------------------------------------------------
A_TRUE, ALPHA_TRUE, B_TRUE, BETA_TRUE = 8.0, 1.0, 2.0, 0.1
t = [0.0, 0.25, 0.5, 1.0, 2.0, 4.0, 6.0, 8.0, 12.0, 24.0]
conc = [
    A_TRUE * np.exp(-ALPHA_TRUE * ti) + B_TRUE * np.exp(-BETA_TRUE * ti)
    for ti in t
]
ELIM_HL = np.log(2.0) / BETA_TRUE  # ~6.9315
DIST_HL = np.log(2.0) / ALPHA_TRUE  # ~0.6931

r = run_task({"task": "bi_exponential_pk", "time": t, "concentration": conc})
check("bx.status", r["status"] == "success", r)
check("bx.alpha", abs(r["alpha"] - ALPHA_TRUE) < 0.05 * ALPHA_TRUE,
      f"alpha={r['alpha']}")
check("bx.beta", abs(r["beta"] - BETA_TRUE) < 0.05 * BETA_TRUE,
      f"beta={r['beta']}")
check("bx.A", abs(r["A"] - A_TRUE) < 0.05 * A_TRUE, f"A={r['A']}")
check("bx.B", abs(r["B"] - B_TRUE) < 0.05 * B_TRUE, f"B={r['B']}")
check("bx.ordering", r["alpha"] > r["beta"],
      f"alpha={r['alpha']} beta={r['beta']}")
check("bx.elimHL", abs(r["eliminationHalfLife"] - ELIM_HL) < 0.05 * ELIM_HL,
      f"t1/2_elim={r['eliminationHalfLife']} exp={ELIM_HL}")
check("bx.distHL", abs(r["distributionHalfLife"] - DIST_HL) < 0.05 * DIST_HL,
      f"t1/2_dist={r['distributionHalfLife']} exp={DIST_HL}")
check("bx.r2", r["rSquared"] > 0.999, f"r2={r['rSquared']}")
check("bx.log", isinstance(r["researchLog"], str) and len(r["researchLog"]) > 0)

# ---------------------------------------------------------------------------
# 3. Error handling.
# ---------------------------------------------------------------------------
# Mismatched shapes: substrate rows != fluorescence rows.
r = run_task({
    "task": "protease_kinetics",
    "time_points": time_points,
    "fluorescence_data": fluorescence,
    "substrate_concentrations": [1.0, 2.0],  # only 2, but 6 rows
    "enzyme_concentration": ENZYME,
})
check("err.pk_shape", r["status"] == "error", r)

# Fluorescence columns != time_points length.
r = run_task({
    "task": "protease_kinetics",
    "time_points": [0.0, 1.0, 2.0, 3.0, 4.0],
    "fluorescence_data": [[0.0, 1.0, 2.0]],  # 3 cols vs 5 time points
    "substrate_concentrations": [5.0],
    "enzyme_concentration": ENZYME,
})
check("err.pk_cols", r["status"] == "error", r)

# Too few time points for protease (< 5).
r = run_task({
    "task": "protease_kinetics",
    "time_points": [0.0, 1.0, 2.0],
    "fluorescence_data": [[0.0, 1.0, 2.0], [0.0, 2.0, 4.0], [0.0, 3.0, 6.0]],
    "substrate_concentrations": [1.0, 2.0, 5.0],
    "enzyme_concentration": ENZYME,
})
check("err.pk_fewpts", r["status"] == "error", r)

# bi_exponential_pk mismatched lengths.
r = run_task({
    "task": "bi_exponential_pk",
    "time": [0.0, 1.0, 2.0, 3.0],
    "concentration": [10.0, 5.0, 2.0],
})
check("err.bx_shape", r["status"] == "error", r)

# bi_exponential_pk too few points (< 4).
r = run_task({
    "task": "bi_exponential_pk",
    "time": [0.0, 1.0, 2.0],
    "concentration": [10.0, 5.0, 2.0],
})
check("err.bx_fewpts", r["status"] == "error", r)

# Unknown task.
r = run_task({"task": "does_not_exist"})
check("err.unknown", r["status"] == "error", r)

print(f"ALL {passed} ENZYME-PK TESTS PASSED")
