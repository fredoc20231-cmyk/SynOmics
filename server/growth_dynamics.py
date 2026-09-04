#!/usr/bin/env python3
"""Population growth-dynamics fitting & simulation (scipy) — one dispatch.

Tasks:
- logistic_growth_fit    : fit the logistic model N(t)=K/(1+((K-N0)/N0)e^{-rt}).
- gompertz_growth_fit    : fit the Zwietering Gompertz model.
- lotka_volterra_simulate: integrate the generalized Lotka-Volterra ODE system.

Reads a JSON payload on stdin, writes a single JSON object on stdout. Every
reported number is produced by executing real scipy code on the caller's real
data — nothing is fabricated. When the payload carries an ``outputDir`` a full
Biomni-style outcome bundle (figures/tables/code/report) is written and its
manifest is attached under ``bundle``.
"""
import json
import math
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _arr(p, key, ndim=1):
    """Fetch a required numeric array/matrix from the payload as a numpy array."""
    import numpy as np
    v = p.get(key)
    if v is None:
        _fail(f"`{key}` is required.")
    try:
        a = np.asarray(v, dtype=float)
    except Exception as e:
        _fail(f"`{key}` must be numeric: {e}")
    if a.ndim != ndim:
        _fail(f"`{key}` must be a {ndim}-D array (got {a.ndim}-D).")
    if a.size == 0:
        _fail(f"`{key}` must be non-empty.")
    return a


def _rsquared(y, yhat):
    import numpy as np
    y = np.asarray(y, float)
    yhat = np.asarray(yhat, float)
    ss_res = float(np.sum((y - yhat) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    if ss_tot == 0.0:
        return 1.0 if ss_res == 0.0 else 0.0
    return 1.0 - ss_res / ss_tot


def _maybe_bundle(result, p, *, tool, title, figures, tables, code, methods, interp):
    """Attach an outcome-bundle manifest if the payload requested one."""
    outdir = p.get("outputDir")
    if not outdir:
        return result
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt  # noqa: F401  (imported for callers)
        from outcome_bundle import build_bundle
    except Exception as e:
        result["bundleError"] = f"bundle unavailable: {e}"
        return result
    manifest = build_bundle(
        outdir,
        tool=tool,
        title=title,
        result=result,
        research_log=result.get("researchLog", ""),
        figures=figures,
        tables=tables,
        code=code,
        methods=methods,
        interpretation=interp,
    )
    result["bundle"] = manifest
    return result


# --------------------------------------------------------------------------- #
# 1. Logistic growth
# --------------------------------------------------------------------------- #
def _logistic(t, K, r, N0):
    import numpy as np
    return K / (1.0 + ((K - N0) / N0) * np.exp(-r * t))


def logistic_growth_fit(p):
    import numpy as np
    from scipy.optimize import curve_fit

    t = _arr(p, "time")
    y = _arr(p, "population")
    if t.shape != y.shape:
        _fail("`time` and `population` must have the same length.")
    if len(t) < 4:
        _fail("logistic fit needs at least 4 data points.")

    K0 = float(max(y.max() * 1.05, y.max() + 1e-9))
    N00 = float(max(y[np.argmin(t)], 1e-6))
    r0 = 0.1
    try:
        popt, _ = curve_fit(
            _logistic, t, y, p0=[K0, r0, N00],
            bounds=([0, 0, 0], [np.inf, np.inf, np.inf]), maxfev=100000,
        )
    except Exception as e:
        _fail(f"logistic curve_fit failed to converge: {e}")
    K, r, N0 = (float(v) for v in popt)
    yhat = _logistic(t, K, r, N0)
    r2 = _rsquared(y, yhat)

    result = {
        "status": "success",
        "analysis": "logistic growth fit  N(t)=K/(1+((K-N0)/N0)e^{-rt})",
        "K": round(K, 6),
        "r": round(r, 6),
        "N0": round(N0, 6),
        "rSquared": round(r2, 8),
    }
    result["researchLog"] = (
        "## Logistic growth fit\n\n"
        f"- carrying capacity **K = {K:.4f}**\n"
        f"- intrinsic growth rate **r = {r:.4f}**\n"
        f"- initial population **N0 = {N0:.4f}**\n"
        f"- goodness of fit **R² = {r2:.6f}** over {len(t)} points\n"
    )

    figures = tables = None
    code = None
    if p.get("outputDir"):
        import matplotlib.pyplot as plt
        from outcome_bundle import apply_palette
        tt = np.linspace(float(t.min()), float(t.max()), 300)
        fig, ax = plt.subplots(figsize=(7, 4.5))
        ax.scatter(t, y, s=28, color="#0A192F", label="data", zorder=3)
        ax.plot(tt, _logistic(tt, K, r, N0), color="#00B4D8", lw=2.2, label="logistic fit")
        ax.set_xlabel("time"); ax.set_ylabel("population")
        ax.set_title("Logistic growth fit"); ax.legend()
        apply_palette(ax)
        figures = [("logistic_fit", fig)]
        tables = [("logistic_parameters", [
            {"parameter": "K", "value": round(K, 6)},
            {"parameter": "r", "value": round(r, 6)},
            {"parameter": "N0", "value": round(N0, 6)},
            {"parameter": "rSquared", "value": round(r2, 8)},
        ])]
        code = (
            "import numpy as np\nfrom scipy.optimize import curve_fit\n\n"
            f"time = np.array({t.tolist()})\n"
            f"population = np.array({y.tolist()})\n\n"
            "def logistic(t, K, r, N0):\n"
            "    return K / (1.0 + ((K - N0) / N0) * np.exp(-r * t))\n\n"
            "popt, _ = curve_fit(logistic, time, population,\n"
            f"                    p0=[{K0}, {r0}, {N00}],\n"
            "                    bounds=([0,0,0],[np.inf,np.inf,np.inf]), maxfev=100000)\n"
            "K, r, N0 = popt\n"
            "yhat = logistic(time, K, r, N0)\n"
            "ss_res = np.sum((population - yhat)**2)\n"
            "ss_tot = np.sum((population - population.mean())**2)\n"
            "r2 = 1 - ss_res/ss_tot\n"
            "print('K=%.4f r=%.4f N0=%.4f R2=%.6f' % (K, r, N0, r2))\n"
        )
        plt.close(fig)

    return _maybe_bundle(
        result, p, tool="logistic_growth_fit", title="Logistic Growth Fit",
        figures=figures, tables=tables, code=code,
        methods="Non-linear least squares (scipy.optimize.curve_fit) of the "
                "logistic model N(t)=K/(1+((K-N0)/N0)e^{-rt}) to the observed series.",
        interp=f"The model explains R²={r2:.6f} of the variance; "
                       f"the population saturates at K={K:.2f}.",
    )


# --------------------------------------------------------------------------- #
# 2. Gompertz growth (Zwietering parameterization)
# --------------------------------------------------------------------------- #
def _gompertz(t, A, mu, lag):
    import numpy as np
    return A * np.exp(-np.exp((mu * math.e / A) * (lag - t) + 1.0))


def gompertz_growth_fit(p):
    import numpy as np
    from scipy.optimize import curve_fit

    t = _arr(p, "time")
    y = _arr(p, "population")
    if t.shape != y.shape:
        _fail("`time` and `population` must have the same length.")
    if len(t) < 4:
        _fail("Gompertz fit needs at least 4 data points.")

    A0 = float(max(y.max(), 1e-6))
    order = np.argsort(t)
    ts, ys = t[order], y[order]
    dt = np.diff(ts)
    slopes = np.divide(np.diff(ys), dt, out=np.zeros_like(dt), where=dt != 0)
    mu0 = float(max(slopes.max(), 1e-6)) if slopes.size else 1.0
    lag0 = float(ts[0])
    try:
        popt, _ = curve_fit(
            _gompertz, t, y, p0=[A0, mu0, lag0],
            bounds=([0, 0, -np.inf], [np.inf, np.inf, np.inf]), maxfev=200000,
        )
    except Exception as e:
        _fail(f"Gompertz curve_fit failed to converge: {e}")
    A, mu, lag = (float(v) for v in popt)
    yhat = _gompertz(t, A, mu, lag)
    r2 = _rsquared(y, yhat)

    result = {
        "status": "success",
        "analysis": "Gompertz growth fit (Zwietering)  N(t)=A*exp(-exp((mu*e/A)(lag-t)+1))",
        "A": round(A, 6),
        "mu": round(mu, 6),
        "lag": round(lag, 6),
        "rSquared": round(r2, 8),
    }
    result["researchLog"] = (
        "## Gompertz growth fit (Zwietering)\n\n"
        f"- asymptote **A = {A:.4f}**\n"
        f"- maximum specific growth rate **mu = {mu:.4f}**\n"
        f"- lag time **lag = {lag:.4f}**\n"
        f"- goodness of fit **R² = {r2:.6f}** over {len(t)} points\n"
    )

    figures = tables = None
    code = None
    if p.get("outputDir"):
        import matplotlib.pyplot as plt
        from outcome_bundle import apply_palette
        tt = np.linspace(float(t.min()), float(t.max()), 300)
        fig, ax = plt.subplots(figsize=(7, 4.5))
        ax.scatter(t, y, s=28, color="#0A192F", label="data", zorder=3)
        ax.plot(tt, _gompertz(tt, A, mu, lag), color="#00B4D8", lw=2.2, label="Gompertz fit")
        ax.set_xlabel("time"); ax.set_ylabel("population")
        ax.set_title("Gompertz growth fit"); ax.legend()
        apply_palette(ax)
        figures = [("gompertz_fit", fig)]
        tables = [("gompertz_parameters", [
            {"parameter": "A", "value": round(A, 6)},
            {"parameter": "mu", "value": round(mu, 6)},
            {"parameter": "lag", "value": round(lag, 6)},
            {"parameter": "rSquared", "value": round(r2, 8)},
        ])]
        code = (
            "import math\nimport numpy as np\nfrom scipy.optimize import curve_fit\n\n"
            f"time = np.array({t.tolist()})\n"
            f"population = np.array({y.tolist()})\n\n"
            "def gompertz(t, A, mu, lag):\n"
            "    return A * np.exp(-np.exp((mu*math.e/A)*(lag - t) + 1.0))\n\n"
            "popt, _ = curve_fit(gompertz, time, population,\n"
            f"                    p0=[{A0}, {mu0}, {lag0}],\n"
            "                    bounds=([0,0,-np.inf],[np.inf,np.inf,np.inf]), maxfev=200000)\n"
            "A, mu, lag = popt\n"
            "yhat = gompertz(time, A, mu, lag)\n"
            "ss_res = np.sum((population - yhat)**2)\n"
            "ss_tot = np.sum((population - population.mean())**2)\n"
            "r2 = 1 - ss_res/ss_tot\n"
            "print('A=%.4f mu=%.4f lag=%.4f R2=%.6f' % (A, mu, lag, r2))\n"
        )
        plt.close(fig)

    return _maybe_bundle(
        result, p, tool="gompertz_growth_fit", title="Gompertz Growth Fit",
        figures=figures, tables=tables, code=code,
        methods="Non-linear least squares (scipy.optimize.curve_fit) of the "
                "Zwietering Gompertz model N(t)=A*exp(-exp((mu*e/A)(lag-t)+1)).",
        interp=f"The model explains R²={r2:.6f} of the variance; "
                       f"asymptote A={A:.2f}, lag time={lag:.2f}.",
    )


# --------------------------------------------------------------------------- #
# 3. Generalized Lotka-Volterra simulation
# --------------------------------------------------------------------------- #
def lotka_volterra_simulate(p):
    import numpy as np
    from scipy.integrate import solve_ivp

    N0 = _arr(p, "initialAbundances")
    r = _arr(p, "growthRates")
    A = _arr(p, "interactionMatrix", ndim=2)
    tp = _arr(p, "timePoints")

    n = N0.shape[0]
    if r.shape[0] != n:
        _fail("`growthRates` length must match `initialAbundances`.")
    if A.shape != (n, n):
        _fail(f"`interactionMatrix` must be {n}x{n}.")
    if np.any(np.diff(tp) <= 0):
        _fail("`timePoints` must be strictly increasing.")

    def rhs(_t, N):
        return N * (r + A.dot(N))

    sol = solve_ivp(
        rhs, (float(tp[0]), float(tp[-1])), N0, t_eval=tp,
        method="LSODA", rtol=1e-8, atol=1e-10, dense_output=False,
    )
    if not sol.success:
        _fail(f"ODE integration failed: {sol.message}")

    traj = sol.y  # shape (n_species, n_time)
    trajectories = [[round(float(v), 8) for v in traj[i, :]] for i in range(n)]
    final = [round(float(traj[i, -1]), 8) for i in range(n)]

    result = {
        "status": "success",
        "analysis": "generalized Lotka-Volterra integration  dN_i/dt = N_i(r_i + Σ_j A_ij N_j)",
        "nSpecies": int(n),
        "trajectories": trajectories,
        "finalAbundances": final,
    }
    result["researchLog"] = (
        "## Generalized Lotka-Volterra simulation\n\n"
        f"- species: **{n}**\n"
        f"- integrated over t ∈ [{tp[0]:.4g}, {tp[-1]:.4g}] at {len(tp)} time points (LSODA)\n"
        f"- final abundances: {final}\n"
    )

    figures = tables = None
    code = None
    if p.get("outputDir"):
        import matplotlib.pyplot as plt
        from outcome_bundle import apply_palette
        colors = ["#0A192F", "#00B4D8", "#7B2CBF", "#E63946", "#2A9D8F", "#F4A261"]
        fig, ax = plt.subplots(figsize=(7, 4.5))
        for i in range(n):
            ax.plot(tp, traj[i, :], lw=2.0, color=colors[i % len(colors)], label=f"species {i + 1}")
        ax.set_xlabel("time"); ax.set_ylabel("abundance")
        ax.set_title("Lotka-Volterra trajectories"); ax.legend()
        apply_palette(ax)
        figures = [("lotka_volterra_trajectories", fig)]
        rows = []
        for k, tk in enumerate(tp):
            row = {"time": round(float(tk), 8)}
            for i in range(n):
                row[f"species_{i + 1}"] = trajectories[i][k]
            rows.append(row)
        tables = [("lotka_volterra_timeseries", rows)]
        code = (
            "import numpy as np\nfrom scipy.integrate import solve_ivp\n\n"
            f"N0 = np.array({N0.tolist()})\n"
            f"r = np.array({r.tolist()})\n"
            f"A = np.array({A.tolist()})\n"
            f"tp = np.array({tp.tolist()})\n\n"
            "def rhs(t, N):\n"
            "    return N * (r + A.dot(N))\n\n"
            "sol = solve_ivp(rhs, (tp[0], tp[-1]), N0, t_eval=tp,\n"
            "                method='LSODA', rtol=1e-8, atol=1e-10)\n"
            "print('final abundances:', sol.y[:, -1])\n"
        )
        plt.close(fig)

    return _maybe_bundle(
        result, p, tool="lotka_volterra_simulate", title="Lotka-Volterra Simulation",
        figures=figures, tables=tables, code=code,
        methods="Numerical integration of the generalized Lotka-Volterra ODE "
                "system with scipy.integrate.solve_ivp (LSODA, rtol=1e-8).",
        interp=f"Final abundances after integration: {final}.",
    )


TASKS = {
    "logistic_growth_fit": logistic_growth_fit,
    "gompertz_growth_fit": gompertz_growth_fit,
    "lotka_volterra_simulate": lotka_volterra_simulate,
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
        _fail(f"growth_dynamics requires numpy+scipy: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
