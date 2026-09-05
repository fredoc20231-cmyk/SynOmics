#!/usr/bin/env python3
"""Two-sample Mendelian randomization from GWAS summary statistics (numpy/scipy).

Single stdin-JSON -> stdout-JSON dispatch. Two tasks:

  * mr_ivw   — inverse-variance-weighted MR (weighted regression of the
               SNP-outcome effects on the SNP-exposure effects THROUGH THE
               ORIGIN) + Cochran's Q heterogeneity test.
  * mr_egger — MR-Egger regression (weighted linear regression WITH an
               intercept); the slope is the causal estimate corrected for
               directional pleiotropy and the intercept (Egger intercept) is
               the average pleiotropic effect.

Zero-hallucination: every reported number is computed by real weighted least
squares on the per-SNP instrument effects supplied by the caller. Nothing is
fabricated; missing dependencies and malformed input fail honestly.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _numeric_vector(name, value):
    """Validate and return a python list of floats, or _fail."""
    if not isinstance(value, list) or len(value) == 0:
        _fail(f"`{name}` must be a non-empty array of numbers.")
    try:
        out = [float(x) for x in value]
    except (TypeError, ValueError):
        _fail(f"`{name}` must contain only numbers.")
    return out


def _load_inputs(p):
    """Parse and align the three (optionally four) instrument-effect vectors."""
    import numpy as np

    bx = _numeric_vector("betaExposure", p.get("betaExposure"))
    by = _numeric_vector("betaOutcome", p.get("betaOutcome"))
    se_y = _numeric_vector("seOutcome", p.get("seOutcome"))

    n = len(bx)
    if not (len(by) == n and len(se_y) == n):
        _fail(
            "betaExposure, betaOutcome and seOutcome must have equal length "
            f"(got {len(bx)}, {len(by)}, {len(se_y)})."
        )

    se_x = p.get("seExposure")
    if se_x is not None:
        se_x = _numeric_vector("seExposure", se_x)
        if len(se_x) != n:
            _fail(
                "seExposure must have the same length as the other vectors "
                f"(got {len(se_x)} vs {n})."
            )
        se_x = np.asarray(se_x, float)

    if n < 3:
        _fail("Mendelian randomization requires at least 3 instruments (SNPs).")

    bx = np.asarray(bx, float)
    by = np.asarray(by, float)
    se_y = np.asarray(se_y, float)

    if not (np.all(np.isfinite(bx)) and np.all(np.isfinite(by)) and np.all(np.isfinite(se_y))):
        _fail("betaExposure, betaOutcome and seOutcome must be finite numbers.")
    if np.any(se_y <= 0):
        _fail("seOutcome values must be strictly positive (they define the weights).")

    return bx, by, se_y, se_x, n


def task_mr_ivw(p):
    """Inverse-variance-weighted MR (fixed-effect), through the origin."""
    import numpy as np
    from scipy import stats

    bx, by, se_y, se_x, n = _load_inputs(p)

    w = 1.0 / se_y**2  # inverse-variance weights
    den = float(np.sum(w * bx**2))
    if den <= 0:
        _fail("Degenerate instruments: sum(w * betaExposure^2) is not positive.")

    estimate = float(np.sum(w * bx * by) / den)
    se = float(np.sqrt(1.0 / den))  # fixed-effect standard error
    z = estimate / se
    pval = float(2.0 * stats.norm.sf(abs(z)))
    ci95 = [estimate - 1.959963984540054 * se, estimate + 1.959963984540054 * se]

    # Cochran's Q heterogeneity: sum of squared weighted residuals about the
    # through-origin fit. Q = sum_i (by_i - beta*bx_i)^2 / se_y_i^2.
    residuals = by - estimate * bx
    cochran_q = float(np.sum(w * residuals**2))
    q_df = n - 1
    q_pvalue = float(stats.chi2.sf(cochran_q, q_df)) if q_df > 0 else None

    analysis = (
        f"IVW MR (fixed-effect, through origin) over {n} instruments: "
        f"causal estimate = {estimate:.6g} (SE {se:.6g}, 95% CI "
        f"[{ci95[0]:.6g}, {ci95[1]:.6g}]), z = {z:.4g}, p = {pval:.4g}. "
        f"Cochran's Q = {cochran_q:.4g} on {q_df} df"
        + (f" (p = {q_pvalue:.4g})." if q_pvalue is not None else ".")
    )

    het = "no significant" if (q_pvalue is None or q_pvalue >= 0.05) else "significant"
    sig = "significant" if pval < 0.05 else "non-significant"
    research_log = (
        "# Inverse-variance-weighted Mendelian randomization\n\n"
        f"Weighted regression of the SNP-outcome effects on the SNP-exposure "
        f"effects through the origin, with inverse-variance weights "
        f"w = 1 / seOutcome^2, over **n = {n}** instruments.\n\n"
        "    causalEstimate = sum(w * bx * by) / sum(w * bx^2)\n"
        "    SE             = sqrt(1 / sum(w * bx^2))\n\n"
        "| Quantity | Value |\n| --- | --- |\n"
        f"| Causal estimate | {estimate:.6g} |\n"
        f"| Standard error | {se:.6g} |\n"
        f"| 95% CI | [{ci95[0]:.6g}, {ci95[1]:.6g}] |\n"
        f"| z | {z:.6g} |\n"
        f"| p-value | {pval:.6g} |\n"
        f"| Cochran's Q ({q_df} df) | {cochran_q:.6g} |\n"
        f"| Q p-value | {q_pvalue if q_pvalue is None else round(q_pvalue, 10)} |\n\n"
        f"The causal effect is **{sig}** at alpha = 0.05, with **{het}** "
        "between-instrument heterogeneity (Cochran's Q). Heterogeneity can "
        "indicate horizontal pleiotropy; MR-Egger regression estimates and "
        "corrects for its directional component."
    )

    return {
        "status": "success",
        "analysis": analysis,
        "method": "IVW",
        "causalEstimate": round(estimate, 10),
        "se": round(se, 10),
        "ci95": [round(ci95[0], 10), round(ci95[1], 10)],
        "z": round(z, 10),
        "pValue": round(pval, 12),
        "cochranQ": round(cochran_q, 10),
        "qDf": q_df,
        "qPvalue": None if q_pvalue is None else round(q_pvalue, 12),
        "nSnps": n,
        "researchLog": research_log,
    }


def task_mr_egger(p):
    """MR-Egger regression: weighted linear regression WITH an intercept."""
    import numpy as np
    from scipy import stats

    bx, by, se_y, se_x, n = _load_inputs(p)

    dof = n - 2
    if dof < 1:
        _fail("MR-Egger requires at least 3 instruments (need n - 2 >= 1 df).")

    w = 1.0 / se_y**2
    sw = np.sqrt(w)

    # Weighted least squares via numpy.linalg.lstsq on the sqrt(w)-scaled design.
    # Design columns: [1, betaExposure]; coefficients: [intercept, slope].
    design = np.column_stack([np.ones_like(bx), bx])
    design_w = design * sw[:, None]
    y_w = by * sw
    coef, *_ = np.linalg.lstsq(design_w, y_w, rcond=None)
    intercept, slope = float(coef[0]), float(coef[1])

    # Residual dispersion (estimated) -> covariance of the coefficients.
    resid_w = y_w - design_w @ coef
    rss = float(np.sum(resid_w**2))
    sigma2 = rss / dof
    xtx_inv = np.linalg.inv(design_w.T @ design_w)
    cov = sigma2 * xtx_inv
    intercept_se = float(np.sqrt(cov[0, 0]))
    slope_se = float(np.sqrt(cov[1, 1]))

    t_slope = slope / slope_se if slope_se > 0 else float("inf")
    t_intercept = intercept / intercept_se if intercept_se > 0 else float("inf")
    slope_p = float(2.0 * stats.t.sf(abs(t_slope), dof))
    intercept_p = float(2.0 * stats.t.sf(abs(t_intercept), dof))

    slope_ci = [slope - 1.959963984540054 * slope_se, slope + 1.959963984540054 * slope_se]

    pleio = "directional pleiotropy DETECTED" if intercept_p < 0.05 else "no directional pleiotropy detected"
    analysis = (
        f"MR-Egger regression over {n} instruments: slope (pleiotropy-corrected "
        f"causal estimate) = {slope:.6g} (SE {slope_se:.6g}, p {slope_p:.4g}); "
        f"Egger intercept = {intercept:.6g} (SE {intercept_se:.6g}, p "
        f"{intercept_p:.4g}) -> {pleio}."
    )

    research_log = (
        "# MR-Egger regression\n\n"
        f"Weighted linear regression of the SNP-outcome effects on the "
        f"SNP-exposure effects WITH an intercept, inverse-variance weights "
        f"w = 1 / seOutcome^2, solved by weighted least squares "
        f"(numpy.linalg.lstsq on the sqrt(w)-scaled design), over **n = {n}** "
        f"instruments ({dof} residual df).\n\n"
        "    by = intercept + slope * bx    (weighted by 1/seOutcome^2)\n\n"
        "| Parameter | Estimate | SE | p |\n| --- | --- | --- | --- |\n"
        f"| Slope (causal) | {slope:.6g} | {slope_se:.6g} | {slope_p:.4g} |\n"
        f"| Intercept (pleiotropy) | {intercept:.6g} | {intercept_se:.6g} | {intercept_p:.4g} |\n\n"
        "The **slope** is the causal estimate corrected for directional "
        "horizontal pleiotropy. The **intercept** (Egger intercept) estimates "
        "the average pleiotropic effect: an intercept significantly different "
        f"from zero indicates directional pleiotropy. Here: **{pleio}** "
        "(intercept p = "
        f"{intercept_p:.4g}). When the intercept is ~0 the MR-Egger slope and "
        "the IVW estimate agree; a non-zero intercept means the IVW estimate is "
        "biased by pleiotropy and the Egger slope is preferred."
    )

    return {
        "status": "success",
        "analysis": analysis,
        "method": "MR-Egger",
        "causalEstimate": round(slope, 10),
        "slopeSE": round(slope_se, 10),
        "slopeP": round(slope_p, 12),
        "slopeCi95": [round(slope_ci[0], 10), round(slope_ci[1], 10)],
        "eggerIntercept": round(intercept, 10),
        "interceptSE": round(intercept_se, 10),
        "interceptP": round(intercept_p, 12),
        "nSnps": n,
        "researchLog": research_log,
    }


TASKS = {
    "mr_ivw": task_mr_ivw,
    "mr_egger": task_mr_egger,
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
        _fail(f"mendelian_randomization requires numpy and scipy: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
