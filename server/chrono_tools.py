#!/usr/bin/env python3
"""Chronobiology / circadian rhythm analysis (numpy) — single dispatch.

Task: cosinor_analysis — single-component cosinor regression on time-series /
circadian data. Reads a JSON payload on stdin and prints a JSON result on
stdout. Zero-hallucination: every reported value is computed by real OLS on the
provided data; nothing is fabricated.
"""
import json
import os
import sys

# Sibling import of the (already-built) outcome bundle helper.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _fit_cosinor(t, y, period):
    """Return (mesor, beta, gamma, amplitude, acro_rad, acro_hours, r2, fitted).

    Model: y = MESOR + beta*cos(2*pi*t/period) + gamma*sin(2*pi*t/period),
    solved by ordinary least squares (numpy.linalg.lstsq).
    """
    import numpy as np

    t = np.asarray(t, float)
    y = np.asarray(y, float)
    w = 2.0 * np.pi / period
    cos = np.cos(w * t)
    sin = np.sin(w * t)
    design = np.column_stack([np.ones_like(t), cos, sin])
    coef, *_ = np.linalg.lstsq(design, y, rcond=None)
    mesor, beta, gamma = (float(coef[0]), float(coef[1]), float(coef[2]))

    amplitude = float(np.hypot(beta, gamma))
    acro_rad = float(np.arctan2(-gamma, beta))
    acro_hours = float((-acro_rad * period / (2.0 * np.pi)) % period)

    fitted = design @ coef
    ss_res = float(np.sum((y - fitted) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    r2 = float(1.0 - ss_res / ss_tot) if ss_tot > 0 else (1.0 if ss_res == 0 else 0.0)
    return mesor, beta, gamma, amplitude, acro_rad, acro_hours, r2, fitted


def task_cosinor_analysis(p):
    import numpy as np

    time = p.get("time")
    values = p.get("values")
    if not isinstance(time, list) or len(time) < 3:
        _fail("Provide `time` (array of >=3 numbers).")
    if not isinstance(values, list) or len(values) < 3:
        _fail("Provide `values` (array of >=3 numbers).")
    if len(time) != len(values):
        _fail(f"`time` (n={len(time)}) and `values` (n={len(values)}) must have equal length.")
    try:
        t = np.asarray(time, float)
        y = np.asarray(values, float)
    except Exception as e:
        _fail(f"`time`/`values` must be numeric: {e}")
    if not (np.all(np.isfinite(t)) and np.all(np.isfinite(y))):
        _fail("`time`/`values` must be finite numbers.")
    period = float(p.get("period", 24.0))
    if not (period > 0):
        _fail("`period` must be a positive number.")

    n = len(time)
    mesor, beta, gamma, amplitude, acro_rad, acro_hours, r2, fitted = _fit_cosinor(t, y, period)

    analysis = (
        f"Single-component cosinor (period={period:g}): MESOR={mesor:.6g}, "
        f"amplitude={amplitude:.6g}, acrophase={acro_rad:.6g} rad "
        f"({acro_hours:.6g} h), R^2={r2:.6g} over n={n} points."
    )
    result = {
        "status": "success",
        "analysis": analysis,
        "mesor": round(mesor, 10),
        "amplitude": round(amplitude, 10),
        "acrophaseRadians": round(acro_rad, 10),
        "acrophaseHours": round(acro_hours, 10),
        "rSquared": round(r2, 10),
        "beta": round(beta, 10),
        "gamma": round(gamma, 10),
        "period": period,
        "n": n,
    }

    research_log = (
        f"# Cosinor analysis\n\n"
        f"Fitted a single-component cosinor model by ordinary least squares:\n\n"
        f"    y = MESOR + beta*cos(2*pi*t/P) + gamma*sin(2*pi*t/P)\n\n"
        f"with period **P = {period:g}**, on **n = {n}** observations.\n\n"
        f"| Parameter | Value |\n| --- | --- |\n"
        f"| MESOR | {mesor:.6g} |\n"
        f"| Amplitude | {amplitude:.6g} |\n"
        f"| Acrophase (rad) | {acro_rad:.6g} |\n"
        f"| Acrophase (h) | {acro_hours:.6g} |\n"
        f"| beta (cos) | {beta:.6g} |\n"
        f"| gamma (sin) | {gamma:.6g} |\n"
        f"| R^2 | {r2:.6g} |\n\n"
        f"Amplitude = sqrt(beta^2 + gamma^2); acrophase = atan2(-gamma, beta); "
        f"acrophase hours = (-acrophase * P / (2*pi)) mod P (peak time)."
    )

    if p.get("outputDir"):
        result["bundle"] = _bundle(p["outputDir"], t, y, period, fitted, result, research_log)
    return result


def _bundle(output_dir, t, y, period, fitted, result, research_log):
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import numpy as np
    from outcome_bundle import apply_palette, build_bundle

    # Figure: observed scatter + fitted cosine curve on a fine grid.
    order = np.argsort(t)
    ts, ys = t[order], y[order]
    grid = np.linspace(float(t.min()), float(t.max()), 400)
    w = 2.0 * np.pi / period
    curve = (
        result["mesor"]
        + result["beta"] * np.cos(w * grid)
        + result["gamma"] * np.sin(w * grid)
    )
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.scatter(ts, ys, s=18, color="#00B4D8", label="observed", zorder=3)
    ax.plot(grid, curve, color="#0A192F", lw=2, label="fitted cosinor", zorder=2)
    ax.set_xlabel("time")
    ax.set_ylabel("value")
    ax.set_title("Cosinor fit")
    ax.legend(frameon=False)
    apply_palette(ax)

    table = [
        {
            "mesor": result["mesor"],
            "amplitude": result["amplitude"],
            "acrophaseRadians": result["acrophaseRadians"],
            "acrophaseHours": result["acrophaseHours"],
            "beta": result["beta"],
            "gamma": result["gamma"],
            "rSquared": result["rSquared"],
            "period": result["period"],
            "n": result["n"],
        }
    ]

    code = _reproducer(list(map(float, t)), list(map(float, y)), period)

    manifest = build_bundle(
        output_dir,
        tool="cosinor_analysis",
        title="Cosinor rhythm analysis",
        result={k: v for k, v in result.items() if k != "bundle"},
        research_log=research_log,
        figures=[("cosinor_fit", fig)],
        tables=[("cosinor_parameters", table)],
        code=code,
        methods=(
            "Single-component cosinor regression. The design matrix [1, cos(2*pi*t/P), "
            "sin(2*pi*t/P)] was solved for [MESOR, beta, gamma] by ordinary least squares "
            "(numpy.linalg.lstsq). Amplitude = sqrt(beta^2 + gamma^2); acrophase = "
            "atan2(-gamma, beta); R^2 = 1 - SS_res/SS_tot."
        ),
        interpretation=(
            f"Estimated rhythm amplitude {result['amplitude']:.4g} about a MESOR of "
            f"{result['mesor']:.4g}, with the peak (acrophase) at t = "
            f"{result['acrophaseHours']:.4g} h (period {result['period']:g}). "
            f"Goodness of fit R^2 = {result['rSquared']:.4g}."
        ),
    )
    plt.close(fig)
    return manifest


def _reproducer(time, values, period):
    return (
        "#!/usr/bin/env python3\n"
        '"""Standalone reproducer for a single-component cosinor fit."""\n'
        "import numpy as np\n\n"
        f"time = {time!r}\n"
        f"values = {values!r}\n"
        f"period = {period!r}\n\n"
        "t = np.asarray(time, float)\n"
        "y = np.asarray(values, float)\n"
        "w = 2.0 * np.pi / period\n"
        "design = np.column_stack([np.ones_like(t), np.cos(w * t), np.sin(w * t)])\n"
        "coef, *_ = np.linalg.lstsq(design, y, rcond=None)\n"
        "mesor, beta, gamma = coef\n"
        "amplitude = np.hypot(beta, gamma)\n"
        "acro_rad = np.arctan2(-gamma, beta)\n"
        "acro_hours = (-acro_rad * period / (2.0 * np.pi)) % period\n"
        "fitted = design @ coef\n"
        "ss_res = np.sum((y - fitted) ** 2)\n"
        "ss_tot = np.sum((y - y.mean()) ** 2)\n"
        "r2 = 1.0 - ss_res / ss_tot\n"
        "print('MESOR', mesor)\n"
        "print('amplitude', amplitude)\n"
        "print('acrophase rad', acro_rad)\n"
        "print('acrophase h', acro_hours)\n"
        "print('R^2', r2)\n"
    )


TASKS = {"cosinor_analysis": task_cosinor_analysis}


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
    except Exception as e:
        _fail(f"chrono_tools requires numpy: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
