#!/usr/bin/env python3
"""Systems-biology / synthetic-biology dynamics (numpy/scipy) — one dispatch.

Tasks:
- protein_dimerization_equilibrium         : 2M <-> D equilibrium (mass balance).
- simulate_gene_circuit_with_growth_feedback: gene expression with growth dilution.
- simulate_protein_signaling_network        : linear activation cascade ODE.

Reads a JSON payload on stdin, writes a single JSON object on stdout. Every
reported number is produced by executing real numpy/scipy code on the caller's
real parameters — nothing is fabricated. Design adapted from the Apache-2.0
Biomni systems_biology / synthetic_biology modules; reimplemented cleanly.
"""
import json
import math
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _req_num(p, key):
    """Fetch a required scalar number from the payload."""
    v = p.get(key)
    if v is None:
        _fail(f"`{key}` is required.")
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        _fail(f"`{key}` must be a number.")
    v = float(v)
    if not math.isfinite(v):
        _fail(f"`{key}` must be a finite number.")
    return v


def _opt_num(p, key, default):
    """Fetch an optional scalar number, falling back to a default."""
    if p.get(key) is None:
        return float(default)
    v = p.get(key)
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        _fail(f"`{key}` must be a number.")
    v = float(v)
    if not math.isfinite(v):
        _fail(f"`{key}` must be a finite number.")
    return v


def _num_list(p, key):
    """Fetch a required numeric list; fails honestly on bad input."""
    v = p.get(key)
    if not isinstance(v, (list, tuple)) or len(v) == 0:
        _fail(f"`{key}` must be a non-empty array of numbers.")
    out = []
    for x in v:
        if isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(float(x)):
            _fail(f"`{key}` must contain only finite numbers.")
        out.append(float(x))
    return out


# --------------------------------------------------------------------------- #
# 1. Protein monomer <-> dimer equilibrium  (2M <-> D)
# --------------------------------------------------------------------------- #
def _solve_dimer(total, kd):
    """Free monomer m, dimer d, fraction dimerized for total protein & Kd.

    Kd = [M]^2 / [D]  =>  [D] = m^2 / Kd.
    Mass balance (in monomer units):  total = m + 2*[D] = m + 2*m^2/Kd.
      2*m^2 + Kd*m - Kd*total = 0
      m = (-Kd + sqrt(Kd^2 + 8*Kd*total)) / 4     (positive root)
    fractionDimerized = 2*[D] / total  (fraction of total monomer locked in dimer).
    """
    m = (-kd + math.sqrt(kd * kd + 8.0 * kd * total)) / 4.0
    dimer = m * m / kd
    frac = (2.0 * dimer / total) if total > 0 else 0.0
    return m, dimer, frac


def protein_dimerization_equilibrium(p):
    kd = _req_num(p, "kd")
    if kd <= 0:
        _fail("`kd` must be positive.")

    titr = p.get("totalConcentrations")
    if titr is not None:
        totals = _num_list(p, "totalConcentrations")
        if any(t < 0 for t in totals):
            _fail("`totalConcentrations` must be non-negative.")
        free, dim, fr = [], [], []
        for t in totals:
            m, d, f = _solve_dimer(t, kd)
            free.append(round(m, 10))
            dim.append(round(d, 10))
            fr.append(round(f, 10))
        result = {
            "status": "success",
            "analysis": (
                f"Monomer<->dimer titration (2M<->D), Kd={kd:g} uM: solved the "
                f"mass-balance quadratic 2m^2+Kd*m-Kd*T=0 at {len(totals)} total "
                f"concentrations."
            ),
            "mode": "titration",
            "kd": kd,
            "totalConcentrations": totals,
            "freeMonomer": free,
            "dimerConcentration": dim,
            "fractionDimerized": fr,
        }
        result["researchLog"] = (
            "## Protein dimerization titration (2M <-> D)\n\n"
            f"- dissociation constant **Kd = {kd:g} uM**\n"
            f"- solved free monomer from `2m^2 + Kd*m - Kd*T = 0` at "
            f"**{len(totals)}** total concentrations\n"
            f"- fraction dimerized ranges "
            f"[{min(fr):.4g}, {max(fr):.4g}] across the titration\n\n"
            "Kd = [M]^2/[D]; mass balance T = m + 2[D]; "
            "fractionDimerized = 2[D]/T.\n"
        )
        return result

    total = _req_num(p, "totalConcentration")
    if total < 0:
        _fail("`totalConcentration` must be non-negative.")
    m, dimer, frac = _solve_dimer(total, kd)
    result = {
        "status": "success",
        "analysis": (
            f"Monomer<->dimer equilibrium (2M<->D): total={total:g} uM, "
            f"Kd={kd:g} uM -> free monomer={m:.6g} uM, dimer={dimer:.6g} uM, "
            f"fraction dimerized={frac:.6g}."
        ),
        "kd": kd,
        "totalConcentration": total,
        "freeMonomer": round(m, 10),
        "dimerConcentration": round(dimer, 10),
        "fractionDimerized": round(frac, 10),
    }
    result["researchLog"] = (
        "## Protein dimerization equilibrium (2M <-> D)\n\n"
        f"- total protein **T = {total:g} uM**\n"
        f"- dissociation constant **Kd = {kd:g} uM**\n"
        f"- free monomer **m = {m:.6g} uM**\n"
        f"- dimer **[D] = {dimer:.6g} uM**\n"
        f"- fraction dimerized **= {frac:.6g}**\n\n"
        "Kd = [M]^2/[D] gives [D] = m^2/Kd. Solving the mass balance "
        "T = m + 2[D] yields the quadratic 2m^2 + Kd*m - Kd*T = 0, "
        "so m = (-Kd + sqrt(Kd^2 + 8*Kd*T))/4. Mass balance "
        f"m + 2[D] = {m + 2 * dimer:.6g} uM is preserved.\n"
    )
    return result


# --------------------------------------------------------------------------- #
# 2. Gene-expression circuit with growth-rate dilution
#    dP/dt = k_transcription - (k_degradation + growthRate) * P
# --------------------------------------------------------------------------- #
def simulate_gene_circuit_with_growth_feedback(p):
    import numpy as np
    from scipy.integrate import solve_ivp

    k_tx = _req_num(p, "k_transcription")
    k_deg = _req_num(p, "k_degradation")
    growth = _req_num(p, "growthRate")
    initial = _opt_num(p, "initial", 0.0)
    tmax = _opt_num(p, "tMax", 50.0)
    npoints = int(_opt_num(p, "nPoints", 200))
    if tmax <= 0:
        _fail("`tMax` must be positive.")
    if npoints < 2:
        _fail("`nPoints` must be >= 2.")

    decay = k_deg + growth

    def rhs(_t, y):
        return [k_tx - decay * y[0]]

    t_eval = np.linspace(0.0, tmax, npoints)
    sol = solve_ivp(
        rhs, (0.0, tmax), [initial], t_eval=t_eval,
        method="LSODA", rtol=1e-9, atol=1e-12,
    )
    if not sol.success:
        _fail(f"ODE integration failed: {sol.message}")

    protein = sol.y[0]
    steady = (k_tx / decay) if decay != 0 else None

    result = {
        "status": "success",
        "analysis": (
            "Gene-expression circuit with growth dilution "
            "dP/dt = k_tx - (k_deg + mu)*P: "
            f"k_tx={k_tx:g}, k_deg={k_deg:g}, mu={growth:g} -> "
            + (f"steady state P* = {steady:.6g}." if steady is not None
               else "no finite steady state (k_deg + mu = 0).")
        ),
        "kTranscription": k_tx,
        "kDegradation": k_deg,
        "growthRate": growth,
        "initial": initial,
        "tMax": tmax,
        "nPoints": npoints,
        "time": [round(float(v), 10) for v in sol.t],
        "protein": [round(float(v), 10) for v in protein],
        "finalProtein": round(float(protein[-1]), 10),
        "steadyState": (round(float(steady), 10) if steady is not None else None),
    }
    result["researchLog"] = (
        "## Gene circuit with growth-rate feedback\n\n"
        "Integrated `dP/dt = k_tx - (k_deg + mu)*P` with "
        "scipy.integrate.solve_ivp (LSODA).\n\n"
        f"- transcription rate **k_tx = {k_tx:g}**\n"
        f"- degradation rate **k_deg = {k_deg:g}**\n"
        f"- growth rate (dilution) **mu = {growth:g}**\n"
        f"- initial protein **P0 = {initial:g}**\n"
        f"- integrated over t in [0, {tmax:g}] at {npoints} points\n"
        f"- analytic steady state **P\\* = k_tx/(k_deg+mu) = "
        + (f"{steady:.6g}**\n" if steady is not None else "undefined**\n")
        + f"- simulated final P = **{float(protein[-1]):.6g}**\n\n"
        "The effective first-order decay rate is (k_deg + mu); growth dilutes "
        "the protein exactly like an extra degradation term.\n"
    )
    return result


# --------------------------------------------------------------------------- #
# 3. Linear protein-signaling activation cascade
#    dx_i/dt = k_i * upstream_i * (1 - x_i) - kd_i * x_i
#    upstream_0 = stimulus ; upstream_i = x_{i-1}  (i > 0)
# --------------------------------------------------------------------------- #
def simulate_protein_signaling_network(p):
    import numpy as np
    from scipy.integrate import solve_ivp

    stimulus = _req_num(p, "stimulus")
    if stimulus < 0:
        _fail("`stimulus` must be non-negative.")

    rates_in = p.get("rates")
    if rates_in is not None:
        rates = _num_list(p, "rates")
        n = len(rates)
    else:
        n = int(_opt_num(p, "nStages", 3.0))
        if n < 1:
            _fail("`nStages` must be >= 1.")
        rates = [1.0] * n
    if any(k < 0 for k in rates):
        _fail("`rates` must be non-negative.")

    deact_in = p.get("deactivationRates")
    if deact_in is not None:
        deact = _num_list(p, "deactivationRates")
        if len(deact) != n:
            _fail(f"`deactivationRates` length ({len(deact)}) must match number of stages ({n}).")
    else:
        deact = [1.0] * n
    if any(kd <= 0 for kd in deact):
        _fail("`deactivationRates` must be positive.")

    init_in = p.get("initial")
    if init_in is None:
        x0 = [0.0] * n
    elif isinstance(init_in, (list, tuple)):
        x0 = _num_list(p, "initial")
        if len(x0) != n:
            _fail(f"`initial` length ({len(x0)}) must match number of stages ({n}).")
    else:
        x0 = [_opt_num(p, "initial", 0.0)] * n

    tmax = _opt_num(p, "tMax", 50.0)
    npoints = int(_opt_num(p, "nPoints", 200))
    if tmax <= 0:
        _fail("`tMax` must be positive.")
    if npoints < 2:
        _fail("`nPoints` must be >= 2.")

    k = np.asarray(rates, float)
    kd = np.asarray(deact, float)

    def rhs(_t, x):
        dx = np.empty(n)
        up = stimulus
        for i in range(n):
            dx[i] = k[i] * up * (1.0 - x[i]) - kd[i] * x[i]
            up = x[i]
        return dx

    t_eval = np.linspace(0.0, tmax, npoints)
    sol = solve_ivp(
        rhs, (0.0, tmax), x0, t_eval=t_eval,
        method="LSODA", rtol=1e-9, atol=1e-12,
    )
    if not sol.success:
        _fail(f"ODE integration failed: {sol.message}")

    traj = sol.y  # shape (nStages, nPoints)
    trajectories = [[round(float(v), 10) for v in traj[i, :]] for i in range(n)]
    final = [round(float(traj[i, -1]), 10) for i in range(n)]

    # Analytic cascade fixed point: for each stage the upstream is the previous
    # stage's steady state; stage 0 upstream is the sustained stimulus.
    #   x_i* = k_i * u_i / (k_i * u_i + kd_i)   with u_0 = stimulus, u_i = x_{i-1}*
    ss = []
    up = stimulus
    for i in range(n):
        denom = rates[i] * up + deact[i]
        xi = (rates[i] * up / denom) if denom > 0 else 0.0
        ss.append(round(float(xi), 10))
        up = xi

    result = {
        "status": "success",
        "analysis": (
            f"Linear activation cascade of {n} stages, "
            f"dx_i/dt = k_i*upstream*(1-x_i) - kd_i*x_i, sustained stimulus="
            f"{stimulus:g}: integrated to t={tmax:g}; downstream steady level="
            f"{ss[-1]:.6g}."
        ),
        "nStages": n,
        "stimulus": stimulus,
        "rates": rates,
        "deactivationRates": deact,
        "initial": x0,
        "tMax": tmax,
        "nPoints": npoints,
        "time": [round(float(v), 10) for v in sol.t],
        "trajectories": trajectories,
        "finalLevels": final,
        "steadyStateLevels": ss,
    }
    result["researchLog"] = (
        "## Protein signaling activation cascade\n\n"
        "Integrated the linear activation cascade "
        "`dx_i/dt = k_i*u_i*(1-x_i) - kd_i*x_i` "
        "(u_0 = stimulus, u_i = x_{i-1}) with scipy.integrate.solve_ivp (LSODA).\n\n"
        f"- stages **n = {n}**\n"
        f"- sustained stimulus **S = {stimulus:g}**\n"
        f"- activation rates **k = {rates}**\n"
        f"- deactivation rates **kd = {deact}**\n"
        f"- integrated over t in [0, {tmax:g}] at {npoints} points\n"
        f"- analytic steady-state levels **x\\* = {ss}**\n"
        f"- simulated final levels **= {final}**\n\n"
        "Stage-0 fixed point x_0\\* = k_0*S/(k_0*S + kd_0); each downstream "
        "stage uses the previous stage's steady state as its input.\n"
    )
    return result


TASKS = {
    "protein_dimerization_equilibrium": protein_dimerization_equilibrium,
    "simulate_gene_circuit_with_growth_feedback": simulate_gene_circuit_with_growth_feedback,
    "simulate_protein_signaling_network": simulate_protein_signaling_network,
}


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        _fail(f"Invalid JSON payload: {e}")
    task = payload.get("task")
    if task not in TASKS:
        _fail(f"Unknown task {task!r}. Available: {', '.join(TASKS)}.")
    try:
        import numpy  # noqa: F401
        import scipy  # noqa: F401
    except Exception as e:
        _fail(f"systems_dynamics_tools requires numpy+scipy: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
