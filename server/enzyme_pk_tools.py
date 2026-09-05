#!/usr/bin/env python3
"""Enzyme kinetics & multi-phase pharmacokinetics (numpy/scipy) — one dispatch.

Reads a JSON payload on stdin and prints a single JSON result on stdout.
Zero-hallucination: every reported value is computed by real linear algebra /
nonlinear least squares on the supplied data; nothing is fabricated.

Tasks
-----
protease_kinetics
    Full Michaelis-Menten enzymology from a fluorescence time-course. Per
    substrate concentration, the initial velocity is the slope of a linear fit
    over the leading fraction of the progress curve; the (S, v) pairs are then
    fit to v = Vmax*S/(Km+S) by nonlinear least squares. Reports Vmax, Km,
    kcat, catalytic efficiency, the per-row initial velocities and R^2.

bi_exponential_pk
    Two-phase (distribution + elimination) pharmacokinetic fit
    C(t) = A*exp(-alpha*t) + B*exp(-beta*t) with alpha > beta, by nonlinear
    least squares seeded from the method of residuals. Reports A, B, alpha,
    beta, the distribution and elimination half-lives and R^2.

Design adapted from the Apache-2.0 Biomni project
(biochemistry.analyze_protease_kinetics,
pharmacology.analyze_radiolabeled_antibody_biodistribution); reimplemented
cleanly with original code.
"""
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


def protease_kinetics(p):
    """Michaelis-Menten kinetics from a fluorescence progress-curve panel."""
    import numpy as np
    from scipy.optimize import curve_fit

    time_points = p.get("time_points")
    fluorescence = p.get("fluorescence_data")
    substrate = p.get("substrate_concentrations")
    enzyme = p.get("enzyme_concentration")

    if time_points is None or fluorescence is None or substrate is None:
        _fail(
            "protease_kinetics requires 'time_points', 'fluorescence_data' "
            "and 'substrate_concentrations'."
        )
    if enzyme is None:
        _fail("protease_kinetics requires 'enzyme_concentration' (uM).")

    try:
        t = np.asarray(time_points, dtype=float)
        f = np.asarray(fluorescence, dtype=float)
        s = np.asarray(substrate, dtype=float)
        enzyme = float(enzyme)
    except Exception as e:  # noqa: BLE001
        _fail(f"Inputs must be numeric: {e}")

    if t.ndim != 1:
        _fail("'time_points' must be a 1-D array.")
    if f.ndim != 2:
        _fail("'fluorescence_data' must be a 2-D array (rows x time_points).")
    if s.ndim != 1:
        _fail("'substrate_concentrations' must be a 1-D array.")

    n_time = t.size
    n_rows = f.shape[0]
    if f.shape[1] != n_time:
        _fail(
            f"'fluorescence_data' has {f.shape[1]} columns but there are "
            f"{n_time} time_points; they must match."
        )
    if s.size != n_rows:
        _fail(
            f"'substrate_concentrations' (n={s.size}) must have one value per "
            f"fluorescence row (n={n_rows})."
        )
    if n_time < 5:
        _fail("protease_kinetics requires at least 5 time_points.")
    if n_rows < 3:
        _fail(
            "protease_kinetics requires at least 3 substrate concentrations "
            "to fit Vmax and Km."
        )
    if enzyme <= 0:
        _fail("'enzyme_concentration' must be positive.")

    initial_fraction = float(p.get("initial_fraction", 0.2))
    if not (0.0 < initial_fraction <= 1.0):
        _fail("'initial_fraction' must be in (0, 1].")

    # Number of leading points for the initial-velocity fit: a minimum of 5
    # points (or all of them if fewer time_points exist), else the requested
    # leading fraction of the progress curve.
    n_init = int(round(initial_fraction * n_time))
    n_init = max(5, n_init)
    n_init = min(n_init, n_time)

    order = np.argsort(t)
    t_sorted = t[order]
    t_window = t_sorted[:n_init]

    velocities = []
    for row in range(n_rows):
        y = f[row][order]
        slope = float(np.polyfit(t_window, y[:n_init], 1)[0])
        velocities.append(slope)
    v = np.asarray(velocities, dtype=float)

    def model(ss, vmax, km):
        return vmax * ss / (km + ss)

    vmax0 = float(np.max(v)) if np.max(v) > 0 else 1.0
    km0 = float(np.median(s)) if np.median(s) > 0 else 1.0
    try:
        popt, _ = curve_fit(
            model, s, v, p0=[vmax0, km0], maxfev=100000, bounds=(0, np.inf)
        )
    except Exception as e:  # noqa: BLE001
        _fail(f"Michaelis-Menten curve_fit failed: {e}")

    vmax, km = float(popt[0]), float(popt[1])
    if km <= 0:
        _fail("Fitted Km non-positive; cannot compute catalytic efficiency.")
    kcat = vmax / enzyme
    cat_eff = kcat / km
    r2 = _r_squared(v, model(s, vmax, km))

    analysis = (
        f"Michaelis-Menten fit over {n_rows} substrate concentrations: "
        f"Vmax={vmax:.6g}, Km={km:.6g}, kcat={kcat:.6g} /s "
        f"(enzyme={enzyme:g} uM), catalytic efficiency kcat/Km={cat_eff:.6g}, "
        f"R^2={r2:.6g}. Initial velocities from a linear fit over the leading "
        f"{n_init}/{n_time} time points."
    )

    research_log = (
        "# Protease / Michaelis-Menten kinetics\n\n"
        "**Step 1 — initial velocities.** For each of the "
        f"{n_rows} substrate concentrations, the initial velocity was taken as "
        "the slope of a degree-1 `np.polyfit` over the leading "
        f"{n_init} of {n_time} time points "
        f"(initial_fraction={initial_fraction:g}).\n\n"
        "**Step 2 — Michaelis-Menten fit.** The (S, v) pairs were fit to "
        "`v = Vmax*S / (Km + S)` by nonlinear least squares "
        "(`scipy.optimize.curve_fit`, non-negativity bounds).\n\n"
        "| Parameter | Value |\n| --- | --- |\n"
        f"| Vmax | {vmax:.6g} |\n"
        f"| Km | {km:.6g} |\n"
        f"| kcat (=Vmax/[E]) | {kcat:.6g} |\n"
        f"| kcat/Km | {cat_eff:.6g} |\n"
        f"| R^2 | {r2:.6g} |\n\n"
        "kcat = Vmax / enzyme_concentration; catalytic efficiency = kcat / Km."
    )

    return {
        "status": "success",
        "analysis": analysis,
        "Vmax": round(vmax, 10),
        "Km": round(km, 10),
        "kcat": round(kcat, 10),
        "catalyticEfficiency": round(cat_eff, 10),
        "initialVelocities": [round(x, 10) for x in velocities],
        "rSquared": round(r2, 10),
        "enzymeConcentration": enzyme,
        "nInitialPoints": n_init,
        "researchLog": research_log,
    }


def bi_exponential_pk(p):
    """Two-phase C(t)=A*exp(-alpha*t)+B*exp(-beta*t) PK fit (alpha>beta)."""
    import numpy as np
    from scipy.optimize import curve_fit

    time = p.get("time")
    conc = p.get("concentration")
    if time is None or conc is None:
        _fail("bi_exponential_pk requires 'time' and 'concentration' arrays.")

    try:
        t = np.asarray(time, dtype=float)
        c = np.asarray(conc, dtype=float)
    except Exception as e:  # noqa: BLE001
        _fail(f"'time'/'concentration' must be numeric: {e}")

    if t.ndim != 1 or c.ndim != 1:
        _fail("'time' and 'concentration' must be 1-D arrays.")
    if t.size != c.size:
        _fail(
            f"'time' (n={t.size}) and 'concentration' (n={c.size}) must have "
            "equal length."
        )
    if t.size < 4:
        _fail("bi_exponential_pk requires at least 4 points (4 parameters).")
    if not (np.all(np.isfinite(t)) and np.all(np.isfinite(c))):
        _fail("'time'/'concentration' must be finite numbers.")

    order = np.argsort(t)
    t = t[order]
    c = c[order]
    n = t.size

    # --- Method of residuals for robust initial guesses. ------------------
    # Terminal (slow / elimination) phase: log-linear fit to the tail.
    n_tail = max(3, n // 3)
    tt = t[-n_tail:]
    cc = c[-n_tail:]
    tail_mask = cc > 0
    if tail_mask.sum() >= 2:
        sl, ic = np.polyfit(tt[tail_mask], np.log(cc[tail_mask]), 1)
        beta0 = max(-float(sl), 1e-6)
        b0 = max(float(np.exp(ic)), 1e-9)
    else:
        beta0 = 0.1
        b0 = max(float(c[-1]), 1e-9)

    # Fast (distribution) phase: residual after removing the slow term.
    resid = c - b0 * np.exp(-beta0 * t)
    early = np.arange(n) < (n - n_tail)
    fast_mask = early & (resid > 0)
    if fast_mask.sum() >= 2:
        sl2, ic2 = np.polyfit(t[fast_mask], np.log(resid[fast_mask]), 1)
        alpha0 = max(-float(sl2), beta0 * 1.0 + 1e-6)
        a0 = max(float(np.exp(ic2)), 1e-9)
    else:
        alpha0 = beta0 * 10.0
        a0 = max(float(c[0]) - b0, 1e-9)

    def model(tv, a, alpha, b, beta):
        return a * np.exp(-alpha * tv) + b * np.exp(-beta * tv)

    try:
        popt, _ = curve_fit(
            model,
            t,
            c,
            p0=[a0, alpha0, b0, beta0],
            maxfev=200000,
            bounds=(0, np.inf),
        )
    except Exception as e:  # noqa: BLE001
        _fail(f"bi-exponential curve_fit failed: {e}")

    a, alpha, b, beta = (float(x) for x in popt)
    # Enforce alpha > beta (distribution phase decays faster than elimination).
    if alpha < beta:
        a, alpha, b, beta = b, beta, a, alpha
    if beta <= 0 or alpha <= 0:
        _fail("Fitted decay rate non-positive; cannot compute half-lives.")

    r2 = _r_squared(c, model(t, a, alpha, b, beta))
    dist_hl = float(np.log(2.0) / alpha)
    elim_hl = float(np.log(2.0) / beta)

    analysis = (
        f"Bi-exponential PK fit over n={n} points: "
        f"C(t)={a:.6g}*exp(-{alpha:.6g}*t)+{b:.6g}*exp(-{beta:.6g}*t). "
        f"Distribution half-life={dist_hl:.6g}, elimination half-life="
        f"{elim_hl:.6g}, R^2={r2:.6g}."
    )

    research_log = (
        "# Two-phase (bi-exponential) pharmacokinetics\n\n"
        "The concentration-time profile was fit to a two-compartment decay\n\n"
        "    C(t) = A*exp(-alpha*t) + B*exp(-beta*t),  alpha > beta\n\n"
        "by nonlinear least squares (`scipy.optimize.curve_fit`, "
        "non-negativity bounds), seeded via the method of residuals "
        "(log-linear terminal-phase fit, then a residual fast-phase fit).\n\n"
        "| Parameter | Value |\n| --- | --- |\n"
        f"| A (distribution intercept) | {a:.6g} |\n"
        f"| alpha (distribution rate) | {alpha:.6g} |\n"
        f"| B (elimination intercept) | {b:.6g} |\n"
        f"| beta (elimination rate) | {beta:.6g} |\n"
        f"| Distribution half-life | {dist_hl:.6g} |\n"
        f"| Elimination half-life | {elim_hl:.6g} |\n"
        f"| R^2 | {r2:.6g} |\n\n"
        "Half-life = ln(2) / rate for each phase."
    )

    return {
        "status": "success",
        "analysis": analysis,
        "A": round(a, 10),
        "B": round(b, 10),
        "alpha": round(alpha, 10),
        "beta": round(beta, 10),
        "distributionHalfLife": round(dist_hl, 10),
        "eliminationHalfLife": round(elim_hl, 10),
        "rSquared": round(r2, 10),
        "n": n,
        "researchLog": research_log,
    }


TASKS = {
    "protease_kinetics": protease_kinetics,
    "bi_exponential_pk": bi_exponential_pk,
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
        import scipy  # noqa: F401
    except Exception as e:  # noqa: BLE001
        _fail(f"enzyme_pk_tools requires numpy/scipy: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
