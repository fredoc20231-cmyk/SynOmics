#!/usr/bin/env python3
"""Pharmacokinetics & enzyme kinetics (numpy/scipy) — one dispatch."""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _r_squared(y_obs, y_pred):
    import numpy as np

    y_obs = np.asarray(y_obs, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    ss_res = float(np.sum((y_obs - y_pred) ** 2))
    ss_tot = float(np.sum((y_obs - np.mean(y_obs)) ** 2))
    if ss_tot == 0.0:
        return 1.0 if ss_res == 0.0 else 0.0
    return 1.0 - ss_res / ss_tot


def task_nca(p):
    """Non-compartmental analysis of a concentration-time profile."""
    import numpy as np

    time = p.get("time")
    conc = p.get("conc")
    if time is None or conc is None:
        _fail("task_nca requires 'time' and 'conc' arrays.")
    t = np.asarray(time, dtype=float)
    c = np.asarray(conc, dtype=float)
    if t.size != c.size:
        _fail("'time' and 'conc' must have equal length.")
    if t.size < 3:
        _fail("task_nca requires at least 3 points.")

    order = np.argsort(t)
    t = t[order]
    c = c[order]

    cmax = float(np.max(c))
    tmax = float(t[int(np.argmax(c))])

    # Linear trapezoidal AUC to last observation.
    auc_last = float(np.sum((t[1:] - t[:-1]) * (c[1:] + c[:-1]) / 2.0))

    # Terminal elimination: log-linear regression on the last >=3 descending,
    # strictly positive points.
    imax = int(np.argmax(c))
    # candidate terminal points are those after Cmax
    idx = np.arange(imax, t.size)
    idx = idx[c[idx] > 0]
    # keep the tail; ensure at least 3 points
    if idx.size < 3:
        idx = np.arange(t.size)[c > 0]
    if idx.size < 3:
        _fail("Not enough positive points for terminal-phase regression.")
    tail = idx[-max(3, idx.size - imax):] if idx.size - imax >= 3 else idx[-3:]
    tt = t[tail]
    lc = np.log(c[tail])
    # slope of ln(C) vs t
    slope, intercept = np.polyfit(tt, lc, 1)
    kel = float(-slope)
    if kel <= 0:
        _fail("Terminal slope non-negative; cannot estimate kel/half-life.")
    half_life = float(np.log(2.0) / kel)
    clast = float(c[-1])
    auc_inf = float(auc_last + clast / kel)

    analysis = {
        "Cmax": cmax,
        "Tmax": tmax,
        "AUC_last": auc_last,
        "kel": kel,
        "half_life": half_life,
        "AUC_inf": auc_inf,
        "Clast": clast,
        "n_terminal_points": int(tt.size),
    }
    dose = p.get("dose")
    if dose is not None:
        dose = float(dose)
        if auc_inf > 0:
            analysis["CL"] = float(dose / auc_inf)
    return {"status": "success", "analysis": analysis}


def task_one_compartment_fit(p):
    """Fit C(t) = (dose/Vd) * exp(-k*t) via nonlinear least squares."""
    import numpy as np
    from scipy.optimize import curve_fit

    time = p.get("time")
    conc = p.get("conc")
    dose = p.get("dose")
    if time is None or conc is None or dose is None:
        _fail("task_one_compartment_fit requires 'time', 'conc', 'dose'.")
    t = np.asarray(time, dtype=float)
    c = np.asarray(conc, dtype=float)
    dose = float(dose)
    if t.size != c.size:
        _fail("'time' and 'conc' must have equal length.")
    if t.size < 3:
        _fail("task_one_compartment_fit requires at least 3 points.")

    def model(tt, k, vd):
        return (dose / vd) * np.exp(-k * tt)

    c0 = c[0] if c[0] > 0 else np.max(c)
    vd0 = dose / c0 if c0 > 0 else 1.0
    p0 = [0.1, max(vd0, 1e-6)]
    try:
        popt, _ = curve_fit(
            model, t, c, p0=p0, maxfev=100000, bounds=(0, np.inf)
        )
    except Exception as e:  # noqa: BLE001
        _fail(f"curve_fit failed: {e}")
    k, vd = float(popt[0]), float(popt[1])
    if k <= 0:
        _fail("Fitted elimination rate k non-positive.")
    r2 = _r_squared(c, model(t, k, vd))
    return {
        "status": "success",
        "analysis": {
            "k": k,
            "Vd": vd,
            "half_life": float(np.log(2.0) / k),
            "rSquared": r2,
        },
    }


def task_michaelis_menten(p):
    """Fit v = Vmax*S/(Km+S) via nonlinear least squares."""
    import numpy as np
    from scipy.optimize import curve_fit

    substrate = p.get("substrate")
    velocity = p.get("velocity")
    if substrate is None or velocity is None:
        _fail("task_michaelis_menten requires 'substrate' and 'velocity'.")
    s = np.asarray(substrate, dtype=float)
    v = np.asarray(velocity, dtype=float)
    if s.size != v.size:
        _fail("'substrate' and 'velocity' must have equal length.")
    if s.size < 3:
        _fail("task_michaelis_menten requires at least 3 points.")

    def model(ss, vmax, km):
        return vmax * ss / (km + ss)

    vmax0 = float(np.max(v)) if np.max(v) > 0 else 1.0
    km0 = float(np.median(s)) if np.median(s) > 0 else 1.0
    try:
        popt, _ = curve_fit(
            model, s, v, p0=[vmax0, km0], maxfev=100000, bounds=(0, np.inf)
        )
    except Exception as e:  # noqa: BLE001
        _fail(f"curve_fit failed: {e}")
    vmax, km = float(popt[0]), float(popt[1])
    r2 = _r_squared(v, model(s, vmax, km))
    return {
        "status": "success",
        "analysis": {"Vmax": vmax, "Km": km, "rSquared": r2},
    }


def task_lineweaver_burk(p):
    """Linearized Michaelis-Menten: regress 1/v on 1/S."""
    import numpy as np

    substrate = p.get("substrate")
    velocity = p.get("velocity")
    if substrate is None or velocity is None:
        _fail("task_lineweaver_burk requires 'substrate' and 'velocity'.")
    s = np.asarray(substrate, dtype=float)
    v = np.asarray(velocity, dtype=float)
    if s.size != v.size:
        _fail("'substrate' and 'velocity' must have equal length.")
    if np.any(s == 0) or np.any(v == 0):
        _fail("Lineweaver-Burk needs non-zero substrate and velocity values.")
    if s.size < 3:
        _fail("task_lineweaver_burk requires at least 3 points.")

    x = 1.0 / s
    y = 1.0 / v
    slope, intercept = np.polyfit(x, y, 1)
    slope = float(slope)
    intercept = float(intercept)
    # 1/v = (Km/Vmax)(1/S) + 1/Vmax
    if intercept == 0:
        _fail("Zero intercept; cannot recover Vmax.")
    vmax = 1.0 / intercept
    km = slope * vmax
    r2 = _r_squared(y, slope * x + intercept)
    return {
        "status": "success",
        "analysis": {
            "Vmax": float(vmax),
            "Km": float(km),
            "slope": slope,
            "intercept": intercept,
            "rSquared": r2,
        },
    }


def task_competitive_inhibition_ki(p):
    """Estimate Ki from apparent Km values across inhibitor concentrations."""
    import numpy as np

    inhibitor = p.get("inhibitor")
    km_apparent = p.get("km_apparent")
    if inhibitor is None or km_apparent is None:
        _fail(
            "task_competitive_inhibition_ki requires 'inhibitor' and "
            "'km_apparent'."
        )
    i = np.asarray(inhibitor, dtype=float)
    kma = np.asarray(km_apparent, dtype=float)
    if i.size != kma.size:
        _fail("'inhibitor' and 'km_apparent' must have equal length.")
    if i.size < 2:
        _fail("task_competitive_inhibition_ki requires at least 2 points.")

    # Km_app = Km*(1 + [I]/Ki) = Km + (Km/Ki)*[I]
    slope, intercept = np.polyfit(i, kma, 1)
    slope = float(slope)
    intercept = float(intercept)
    km = intercept
    if slope == 0:
        _fail("Zero slope; cannot estimate Ki (no inhibition detected).")
    ki = km / slope
    r2 = _r_squared(kma, slope * i + intercept)
    return {
        "status": "success",
        "analysis": {"Km": float(km), "Ki": float(ki), "rSquared": r2},
    }


TASKS = {
    "nca": task_nca,
    "one_compartment_fit": task_one_compartment_fit,
    "michaelis_menten": task_michaelis_menten,
    "lineweaver_burk": task_lineweaver_burk,
    "competitive_inhibition_ki": task_competitive_inhibition_ki,
}


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:  # noqa: BLE001
        _fail(f"Invalid JSON payload: {e}")
    task = payload.get("task")
    if task not in TASKS:
        _fail(f"Unknown task {task!r}. Available: {', '.join(TASKS)}.")
    try:
        import numpy  # noqa: F401
    except Exception as e:  # noqa: BLE001
        _fail(f"pkpd_tools requires numpy/scipy: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
