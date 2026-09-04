#!/usr/bin/env python3
"""Ground-truth smoke tests for server/pkpd_tools.py (PK/PD & enzyme kinetics).

Each test generates data from KNOWN parameters and asserts the module recovers
them, plus expected R^2. Skips cleanly if numpy/scipy are unavailable.
"""
import json
import os
import subprocess
import sys

try:
    import numpy as np  # noqa: F401
    from scipy.optimize import curve_fit  # noqa: F401
except Exception as e:  # noqa: BLE001
    print(f"SKIP: pkpd_tools_smoke requires numpy/scipy ({e})")
    sys.exit(0)

MODULE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "server",
    "pkpd_tools.py",
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
# 1. Michaelis-Menten: v = Vmax*S/(Km+S) with Vmax=100, Km=10
# ---------------------------------------------------------------------------
VMAX_TRUE, KM_TRUE = 100.0, 10.0
S = np.array([0.5, 1, 2, 5, 10, 20, 50, 100], dtype=float)
V = VMAX_TRUE * S / (KM_TRUE + S)

r = run_task({"task": "michaelis_menten", "substrate": S.tolist(),
              "velocity": V.tolist()})
check("mm.status", r["status"] == "success", r)
a = r["analysis"]
check("mm.Vmax", abs(a["Vmax"] - VMAX_TRUE) < 1e-3, f"Vmax={a['Vmax']}")
check("mm.Km", abs(a["Km"] - KM_TRUE) < 1e-3, f"Km={a['Km']}")
check("mm.r2", a["rSquared"] > 0.999, f"r2={a['rSquared']}")

# ---------------------------------------------------------------------------
# 2. Lineweaver-Burk on the same clean data -> Vmax=100, Km=10
# ---------------------------------------------------------------------------
r = run_task({"task": "lineweaver_burk", "substrate": S.tolist(),
              "velocity": V.tolist()})
check("lb.status", r["status"] == "success", r)
a = r["analysis"]
# scratch verification of the linear regression
x = 1.0 / S
y = 1.0 / V
slope_exp, intercept_exp = np.polyfit(x, y, 1)
vmax_exp = 1.0 / intercept_exp
km_exp = slope_exp * vmax_exp
check("lb.Vmax", abs(a["Vmax"] - VMAX_TRUE) < 1e-3, f"Vmax={a['Vmax']}")
check("lb.Km", abs(a["Km"] - KM_TRUE) < 1e-3, f"Km={a['Km']}")
check("lb.slope", abs(a["slope"] - slope_exp) < 1e-9, f"slope={a['slope']}")
check("lb.intercept", abs(a["intercept"] - intercept_exp) < 1e-9,
      f"intercept={a['intercept']}")
check("lb.r2", a["rSquared"] > 0.999, f"r2={a['rSquared']}")

# ---------------------------------------------------------------------------
# 3. One-compartment fit: C(t)=(dose/Vd)exp(-k t), k=0.2, Vd=10, dose=100
# ---------------------------------------------------------------------------
K_TRUE, VD_TRUE, DOSE = 0.2, 10.0, 100.0
T = np.array([0, 0.5, 1, 2, 4, 6, 8, 12, 24], dtype=float)
C = (DOSE / VD_TRUE) * np.exp(-K_TRUE * T)
HL_EXP = np.log(2.0) / K_TRUE  # ~3.4657

r = run_task({"task": "one_compartment_fit", "time": T.tolist(),
              "conc": C.tolist(), "dose": DOSE})
check("oc.status", r["status"] == "success", r)
a = r["analysis"]
check("oc.k", abs(a["k"] - K_TRUE) < 1e-4, f"k={a['k']}")
check("oc.Vd", abs(a["Vd"] - VD_TRUE) < 1e-3, f"Vd={a['Vd']}")
check("oc.half_life", abs(a["half_life"] - HL_EXP) < 1e-3,
      f"t1/2={a['half_life']} exp={HL_EXP}")
check("oc.r2", a["rSquared"] > 0.999, f"r2={a['rSquared']}")

# ---------------------------------------------------------------------------
# 4. NCA on clean mono-exponential decay, known kel
# ---------------------------------------------------------------------------
# C(t) = C0*exp(-kel t), C0=dose/Vd=10, kel=0.2
KEL_TRUE = 0.2
C0 = DOSE / VD_TRUE  # 10
# fine grid so linear trapezoid closely approaches the analytic C0/kel
Tn = np.arange(0.0, 48.0 + 1e-9, 0.25)
Cn = C0 * np.exp(-KEL_TRUE * Tn)
# scratch expected values
auc_last_exp = float(np.sum((Tn[1:] - Tn[:-1]) * (Cn[1:] + Cn[:-1]) / 2.0))
clast_exp = float(Cn[-1])
auc_inf_exp = auc_last_exp + clast_exp / KEL_TRUE
# analytic AUC_inf for a pure mono-exponential = C0/kel
auc_inf_analytic = C0 / KEL_TRUE  # 50.0

r = run_task({"task": "nca", "time": Tn.tolist(), "conc": Cn.tolist(),
              "dose": DOSE})
check("nca.status", r["status"] == "success", r)
a = r["analysis"]
check("nca.Cmax", abs(a["Cmax"] - float(np.max(Cn))) < 1e-9,
      f"Cmax={a['Cmax']}")
check("nca.Tmax", abs(a["Tmax"] - float(Tn[int(np.argmax(Cn))])) < 1e-9,
      f"Tmax={a['Tmax']}")
check("nca.kel", abs(a["kel"] - KEL_TRUE) < 1e-6, f"kel={a['kel']}")
check("nca.half_life", abs(a["half_life"] - np.log(2.0) / KEL_TRUE) < 1e-4,
      f"t1/2={a['half_life']}")
check("nca.AUC_last", abs(a["AUC_last"] - auc_last_exp) < 1e-6,
      f"AUC_last={a['AUC_last']}")
check("nca.AUC_inf", abs(a["AUC_inf"] - auc_inf_exp) < 1e-6,
      f"AUC_inf={a['AUC_inf']}")
# AUC_inf should be reasonably close to analytic C0/kel (trapezoid is slightly
# biased high for exp decay, so allow a modest tolerance)
check("nca.AUC_inf_analytic", abs(a["AUC_inf"] - auc_inf_analytic) < 1.0,
      f"AUC_inf={a['AUC_inf']} analytic={auc_inf_analytic}")
check("nca.CL", abs(a["CL"] - DOSE / a["AUC_inf"]) < 1e-9, f"CL={a['CL']}")

# ---------------------------------------------------------------------------
# 5. Competitive inhibition Ki: Km_app = Km*(1+[I]/Ki), Km=10, Ki=5
# ---------------------------------------------------------------------------
KM_C, KI_TRUE = 10.0, 5.0
I = np.array([0, 2, 4, 6, 8, 10], dtype=float)
KMA = KM_C * (1.0 + I / KI_TRUE)
# scratch: slope=Km/Ki=2, intercept=Km=10
slope_c, intercept_c = np.polyfit(I, KMA, 1)
ki_exp = intercept_c / slope_c

r = run_task({"task": "competitive_inhibition_ki",
              "inhibitor": I.tolist(), "km_apparent": KMA.tolist()})
check("ki.status", r["status"] == "success", r)
a = r["analysis"]
check("ki.Km", abs(a["Km"] - KM_C) < 1e-6, f"Km={a['Km']}")
check("ki.Ki", abs(a["Ki"] - KI_TRUE) < 1e-6, f"Ki={a['Ki']}")
check("ki.Ki_scratch", abs(a["Ki"] - ki_exp) < 1e-9, f"Ki={a['Ki']}")
check("ki.r2", a["rSquared"] > 0.999, f"r2={a['rSquared']}")

# ---------------------------------------------------------------------------
# 6. Unknown task -> status error
# ---------------------------------------------------------------------------
r = run_task({"task": "does_not_exist"})
check("unknown.status", r["status"] == "error", r)

print(f"ALL {passed} PKPD TESTS PASSED")
