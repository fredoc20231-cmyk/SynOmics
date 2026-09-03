#!/usr/bin/env python3
"""Dose-response / pharmacology curve fitting (scipy) — real 4-parameter logistic.

Tasks (payload.task):
  ic50   : fit a 4-parameter logistic (Hill) curve to (dose, response) and report
           IC50/EC50, Hill slope, top/bottom, R^2 — the standard potency analysis.
  auc    : trapezoidal area under a response curve.

Fits a real nonlinear model with scipy.optimize.curve_fit; nothing is fabricated.
If the fit fails to converge, returns an honest error. Reads JSON on stdin.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def task_ic50(p):
    import numpy as np
    from scipy.optimize import curve_fit
    doses = p.get("doses")
    resp = p.get("responses")
    if not (isinstance(doses, list) and isinstance(resp, list) and len(doses) == len(resp) and len(doses) >= 4):
        _fail("ic50 needs equal-length `doses` and `responses` (>=4 points).")
    x = np.asarray(doses, float)
    y = np.asarray(resp, float)
    if np.any(x <= 0):
        _fail("Doses must be positive (log-domain 4PL).")
    logx = np.log10(x)

    def hill(lx, bottom, top, loghill_ic50, hill):
        return bottom + (top - bottom) / (1.0 + 10 ** ((loghill_ic50 - lx) * hill))

    p0 = [float(y.min()), float(y.max()), float(np.median(logx)), 1.0]
    try:
        popt, _ = curve_fit(hill, logx, y, p0=p0, maxfev=20000)
    except Exception as e:
        _fail(f"Dose-response fit did not converge: {e}")
    bottom, top, log_ic50, hill_slope = [float(v) for v in popt]
    yhat = hill(logx, *popt)
    ss_res = float(np.sum((y - yhat) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else None
    return {"status": "success", "analysis": "4-parameter logistic dose-response (Hill)",
            "ic50": round(float(10 ** log_ic50), 6), "log10_ic50": round(log_ic50, 6),
            "hillSlope": round(hill_slope, 4), "top": round(top, 4), "bottom": round(bottom, 4),
            "rSquared": round(r2, 5) if r2 is not None else None,
            "note": "IC50/EC50 is the dose at half-maximal response from the fitted Hill curve."}


def task_auc(p):
    import numpy as np
    x = p.get("x") or p.get("doses")
    y = p.get("y") or p.get("responses")
    if not (isinstance(x, list) and isinstance(y, list) and len(x) == len(y) and len(x) >= 2):
        _fail("auc needs equal-length `x` and `y` (>=2 points).")
    order = np.argsort(x)
    xa = np.asarray(x, float)[order]
    ya = np.asarray(y, float)[order]
    auc = float(np.trapezoid(ya, xa)) if hasattr(np, "trapezoid") else float(np.trapz(ya, xa))
    return {"status": "success", "analysis": "area under curve (trapezoidal)", "auc": round(auc, 6)}


TASKS = {"ic50": task_ic50, "auc": task_auc}


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
        import scipy  # noqa: F401
    except Exception as e:
        _fail(f"doseresponse requires scipy: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
