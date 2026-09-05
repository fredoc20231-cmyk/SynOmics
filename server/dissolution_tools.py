#!/usr/bin/env python3
"""In-vitro drug-release (dissolution) kinetics (numpy/scipy) — one dispatch.

Task: drug_release_kinetics — fit four closed-form dissolution models to a
cumulative-release profile, pick the best by R^2, derive the time to 50 %
release analytically from the winning model's fitted constants, and (from the
Korsmeyer-Peppas exponent) classify the drug-transport mechanism.

Reads a JSON payload on stdin, prints a JSON result on stdout. Zero
hallucination: every reported value is produced by real least-squares fitting
(scipy.optimize.curve_fit) on the provided data; nothing is fabricated. If a
value cannot be computed it is returned as null / an explicit error.

Design adapted from the Apache-2.0 Biomni project
(bioengineering.analyze_in_vitro_drug_release_kinetics); reimplemented cleanly.
"""
import json
import math
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _r_squared(y_obs, y_pred):
    """Coefficient of determination R^2 = 1 - SS_res/SS_tot."""
    import numpy as np

    y_obs = np.asarray(y_obs, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    ss_res = float(np.sum((y_obs - y_pred) ** 2))
    ss_tot = float(np.sum((y_obs - np.mean(y_obs)) ** 2))
    if ss_tot == 0.0:
        return 1.0 if ss_res == 0.0 else 0.0
    return 1.0 - ss_res / ss_tot


# --- Closed-form dissolution models (release R in percent, time t in hours) ---
def _zero_order(t, k):
    return k * t


def _first_order(t, k):
    import numpy as np

    return 100.0 * (1.0 - np.exp(-k * t))


def _higuchi(t, k):
    import numpy as np

    return k * np.sqrt(t)


def _korsmeyer_peppas(t, k, n):
    import numpy as np

    return 100.0 * np.power(k * t, n)


def _t50_from_model(name, params):
    """Analytic time to 50 % release from the model's fitted constants."""
    k = params.get("k")
    if name == "zero_order":
        # 50 = k*t  ->  t = 50/k
        return 50.0 / k if k and k > 0 else None
    if name == "first_order":
        # 50 = 100*(1-exp(-k*t))  ->  exp(-k*t)=0.5  ->  t = ln(2)/k
        return math.log(2.0) / k if k and k > 0 else None
    if name == "higuchi":
        # 50 = k*sqrt(t)  ->  t = (50/k)^2
        return (50.0 / k) ** 2 if k and k > 0 else None
    if name == "korsmeyer_peppas":
        # 50 = 100*(k*t)^n  ->  k*t = 0.5^(1/n)  ->  t = 0.5^(1/n)/k
        n = params.get("n")
        if k and k > 0 and n and n > 0:
            return (0.5 ** (1.0 / n)) / k
        return None
    return None


def _classify_mechanism(n):
    """Korsmeyer-Peppas transport mechanism from the release exponent n."""
    if n is None:
        return None
    if n < 0.43:
        return "Fickian diffusion"
    if n <= 0.85:
        return "anomalous (non-Fickian) transport"
    return "Case-II transport"


def task_drug_release_kinetics(p):
    import numpy as np
    from scipy.optimize import curve_fit

    time_points = p.get("time_points")
    concentration_data = p.get("concentration_data")
    if not isinstance(time_points, list) or not isinstance(concentration_data, list):
        _fail("Provide `time_points` and `concentration_data` as arrays.")
    if len(time_points) < 4:
        _fail(
            f"`time_points` needs >=4 points to fit 4 models "
            f"(got {len(time_points)})."
        )
    if len(time_points) != len(concentration_data):
        _fail(
            f"`time_points` (n={len(time_points)}) and `concentration_data` "
            f"(n={len(concentration_data)}) must have equal length."
        )
    try:
        t = np.asarray(time_points, dtype=float)
        conc = np.asarray(concentration_data, dtype=float)
    except Exception as e:  # noqa: BLE001
        _fail(f"`time_points`/`concentration_data` must be numeric: {e}")
    if not (np.all(np.isfinite(t)) and np.all(np.isfinite(conc))):
        _fail("`time_points`/`concentration_data` must be finite numbers.")
    if np.any(t < 0):
        _fail("`time_points` must be non-negative (hours).")

    drug_name = p.get("drug_name", "Drug")
    if not isinstance(drug_name, str) or not drug_name:
        drug_name = "Drug"

    # Sort by time (models and t50 are order-independent, but keep pairing sane).
    order = np.argsort(t, kind="stable")
    t = t[order]
    conc = conc[order]

    # Convert to cumulative-release percent.
    total_drug_loaded = p.get("total_drug_loaded")
    if total_drug_loaded is not None:
        try:
            total = float(total_drug_loaded)
        except Exception as e:  # noqa: BLE001
            _fail(f"`total_drug_loaded` must be a number: {e}")
        if not (total > 0):
            _fail("`total_drug_loaded` must be a positive number.")
        release = 100.0 * conc / total
        norm = f"100 * concentration / total_drug_loaded (total={total:g})"
    else:
        cmax = float(np.max(conc))
        if not (cmax > 0):
            _fail("`concentration_data` has no positive values to normalize.")
        release = 100.0 * conc / cmax
        norm = "100 * concentration / max(concentration) (max normalized to 100)"

    # --- Fit each model; record fitted params and R^2 ---
    models = {}

    def _try_fit(name, func, p0, bounds):
        try:
            popt, _ = curve_fit(
                func, t, release, p0=p0, bounds=bounds, maxfev=200000
            )
        except Exception as e:  # noqa: BLE001
            models[name] = {"params": {}, "rSquared": None, "error": str(e)}
            return
        pred = func(t, *popt)
        r2 = _r_squared(release, pred)
        models[name] = {"params": popt, "rSquared": r2}

    # Zero-order: R = k*t
    k0_zero = float(np.max(release) / np.max(t)) if np.max(t) > 0 else 1.0
    _try_fit("zero_order", _zero_order, [max(k0_zero, 1e-6)], (0.0, np.inf))

    # First-order: R = 100*(1-exp(-k*t))
    _try_fit("first_order", _first_order, [0.1], (0.0, np.inf))

    # Higuchi: R = k*sqrt(t)
    k0_hig = (
        float(np.max(release) / np.sqrt(np.max(t))) if np.max(t) > 0 else 1.0
    )
    _try_fit("higuchi", _higuchi, [max(k0_hig, 1e-6)], (0.0, np.inf))

    # Korsmeyer-Peppas: R = 100*(k*t)^n. Seed from a log-log linear regression:
    #   log(R/100) = n*log(t) + n*log(k)  ->  slope = n, intercept = n*log(k).
    mask = (t > 0) & (release > 0)
    if int(np.sum(mask)) >= 2:
        lt = np.log(t[mask])
        lr = np.log(release[mask] / 100.0)
        slope, intercept = np.polyfit(lt, lr, 1)
        n0 = float(slope) if slope > 1e-3 else 0.5
        k0_kp = float(np.exp(intercept / n0)) if n0 > 0 else 0.1
        if not (k0_kp > 0) or not math.isfinite(k0_kp):
            k0_kp = 0.1
    else:
        n0, k0_kp = 0.5, 0.1
    _try_fit(
        "korsmeyer_peppas",
        _korsmeyer_peppas,
        [max(k0_kp, 1e-6), max(n0, 1e-3)],
        ([0.0, 0.0], [np.inf, np.inf]),
    )

    # --- Select the best model by max R^2 among successful fits ---
    fitted = {
        name: m for name, m in models.items()
        if isinstance(m.get("rSquared"), float) and math.isfinite(m["rSquared"])
    }
    if not fitted:
        _fail("All dissolution-model fits failed to converge.")
    best_model = max(fitted, key=lambda name: fitted[name]["rSquared"])

    # KP-derived quantities (release exponent + transport mechanism).
    release_exponent_n = None
    transport_mechanism = None
    kp = models.get("korsmeyer_peppas", {})
    if isinstance(kp.get("rSquared"), float):
        kp_params = kp["params"]
        release_exponent_n = float(kp_params[1])
        transport_mechanism = _classify_mechanism(release_exponent_n)

    # Build a JSON-serializable models dict (named params, rounded R^2).
    param_names = {
        "zero_order": ["k"],
        "first_order": ["k"],
        "higuchi": ["k"],
        "korsmeyer_peppas": ["k", "n"],
    }
    models_out = {}
    for name, m in models.items():
        if isinstance(m.get("rSquared"), float):
            named = {
                pn: round(float(v), 10)
                for pn, v in zip(param_names[name], m["params"])
            }
            models_out[name] = {
                "params": named,
                "rSquared": round(float(m["rSquared"]), 10),
            }
        else:
            models_out[name] = {
                "params": {},
                "rSquared": None,
                "error": m.get("error", "fit failed"),
            }

    best_params = models_out[best_model]["params"]
    t50 = _t50_from_model(best_model, best_params)
    t50_out = round(float(t50), 10) if t50 is not None and math.isfinite(t50) else None

    pretty = {
        "zero_order": "zero-order",
        "first_order": "first-order",
        "higuchi": "Higuchi",
        "korsmeyer_peppas": "Korsmeyer-Peppas",
    }
    best_r2 = models_out[best_model]["rSquared"]
    analysis = (
        f"{drug_name}: fitted 4 dissolution models to a {len(t)}-point cumulative-"
        f"release profile ({norm}). Best fit = {pretty[best_model]} "
        f"(R^2={best_r2:.6g})"
        + (f", t50={t50_out:.6g} h" if t50_out is not None else ", t50=not available")
        + "."
    )
    if release_exponent_n is not None:
        analysis += (
            f" Korsmeyer-Peppas release exponent n={release_exponent_n:.4g} "
            f"-> {transport_mechanism}."
        )

    # --- Research log (markdown) ---
    rows = ""
    for name in ["zero_order", "first_order", "higuchi", "korsmeyer_peppas"]:
        m = models_out[name]
        r2 = m["rSquared"]
        r2s = f"{r2:.6g}" if isinstance(r2, float) else "n/a"
        ps = ", ".join(f"{pn}={pv:g}" for pn, pv in m["params"].items()) or "n/a"
        star = " (best)" if name == best_model else ""
        rows += f"| {pretty[name]}{star} | {ps} | {r2s} |\n"

    research_log = (
        f"# In-vitro drug-release kinetics — {drug_name}\n\n"
        f"Cumulative release computed as: **{norm}**, over **n = {len(t)}** "
        f"time points (hours).\n\n"
        f"Four closed-form dissolution models were fitted by nonlinear least "
        f"squares (scipy.optimize.curve_fit) to the cumulative-release percent:\n\n"
        f"- Zero-order: R = k·t\n"
        f"- First-order: R = 100·(1 − e^(−k·t))\n"
        f"- Higuchi: R = k·√t\n"
        f"- Korsmeyer-Peppas: R = 100·(k·t)^n\n\n"
        f"| Model | Fitted parameters | R^2 |\n| --- | --- | --- |\n{rows}\n"
        f"**Best model:** {pretty[best_model]} (highest R^2 = {best_r2:.6g}).\n\n"
        f"**Time to 50 % release (t50):** "
        + (f"{t50_out:.6g} h" if t50_out is not None else "not available")
        + f", derived analytically from the {pretty[best_model]} fitted "
        f"constant(s).\n\n"
    )
    if release_exponent_n is not None:
        research_log += (
            f"**Transport mechanism (Korsmeyer-Peppas):** release exponent "
            f"n = {release_exponent_n:.4g} -> **{transport_mechanism}** "
            f"(Fickian n<0.43; anomalous 0.43-0.85; Case-II n>0.85).\n"
        )

    return {
        "status": "success",
        "analysis": analysis,
        "drugName": drug_name,
        "nPoints": int(len(t)),
        "models": models_out,
        "bestModel": best_model,
        "bestRSquared": best_r2,
        "t50Hours": t50_out,
        "releaseExponentN": (
            round(release_exponent_n, 10) if release_exponent_n is not None else None
        ),
        "transportMechanism": transport_mechanism,
        "researchLog": research_log,
    }


TASKS = {"drug_release_kinetics": task_drug_release_kinetics}


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
        _fail(f"dissolution_tools requires numpy/scipy: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
