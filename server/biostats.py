#!/usr/bin/env python3
"""Core biostatistics — one dispatch, many real tests (scipy / statsmodels / sklearn).

Tasks (payload.task):
  fisher_exact, chi_square, anova, correlation, multiple_testing, power_ttest,
  normality, roc_auc, logrank, cox

Every value is computed by a real library routine. Reads JSON on stdin, prints JSON.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def task_fisher_exact(p):
    from scipy.stats import fisher_exact
    t = p.get("table")
    if not (isinstance(t, list) and len(t) == 2 and len(t[0]) == 2):
        _fail("fisher_exact needs a 2x2 `table`.")
    odds, pval = fisher_exact(t, alternative=p.get("alternative", "two-sided"))
    return {"status": "success", "analysis": "Fisher exact test", "oddsRatio": float(odds), "pValue": float(pval)}


def task_chi_square(p):
    from scipy.stats import chi2_contingency
    t = p.get("table")
    if not isinstance(t, list) or not t:
        _fail("chi_square needs a contingency `table`.")
    chi2, pval, dof, _ = chi2_contingency(t)
    return {"status": "success", "analysis": "Chi-square test of independence",
            "chi2": float(chi2), "pValue": float(pval), "dof": int(dof)}


def task_anova(p):
    from scipy.stats import f_oneway
    groups = p.get("groups")
    if not isinstance(groups, list) or len(groups) < 2:
        _fail("anova needs `groups`: a list of >=2 numeric arrays.")
    f, pval = f_oneway(*[list(map(float, g)) for g in groups])
    return {"status": "success", "analysis": "One-way ANOVA", "F": float(f), "pValue": float(pval), "nGroups": len(groups)}


def task_correlation(p):
    import numpy as np
    from scipy.stats import kendalltau, pearsonr, spearmanr
    x, y = p.get("x"), p.get("y")
    method = p.get("method", "pearson")
    if x is not None and y is not None:
        x = np.asarray(x, float); y = np.asarray(y, float)
        fn = {"pearson": pearsonr, "spearman": spearmanr, "kendall": kendalltau}.get(method)
        if fn is None:
            _fail("method must be pearson|spearman|kendall.")
        r, pval = fn(x, y)
        return {"status": "success", "analysis": f"{method} correlation", "r": float(r), "pValue": float(pval)}
    matrix = p.get("matrix")
    if isinstance(matrix, list):
        M = np.asarray(matrix, float)
        C = np.corrcoef(M, rowvar=False)
        return {"status": "success", "analysis": "correlation matrix (pearson)",
                "matrix": [[round(float(v), 6) for v in row] for row in C]}
    _fail("correlation needs (`x`,`y`) or `matrix`.")


def task_multiple_testing(p):
    from statsmodels.stats.multitest import multipletests
    pv = p.get("pvalues")
    method = p.get("method", "fdr_bh")
    if not isinstance(pv, list) or not pv:
        _fail("multiple_testing needs `pvalues`.")
    rej, padj, *_ = multipletests(pv, alpha=float(p.get("alpha", 0.05)), method=method)
    return {"status": "success", "analysis": f"multiple testing correction ({method})",
            "adjustedPValues": [float(v) for v in padj], "rejected": [bool(v) for v in rej],
            "nRejected": int(sum(rej))}


def task_power_ttest(p):
    from statsmodels.stats.power import TTestIndPower
    analysis = TTestIndPower()
    effect = p.get("effectSize"); n = p.get("nobs"); power = p.get("power")
    alpha = float(p.get("alpha", 0.05))
    provided = sum(v is not None for v in (effect, n, power))
    if provided != 2:
        _fail("power_ttest: provide exactly two of effectSize, nobs, power (solves the third).")
    solved = analysis.solve_power(effect_size=effect, nobs1=n, alpha=alpha, power=power, ratio=1.0)
    which = "power" if power is None else ("nobs" if n is None else "effectSize")
    return {"status": "success", "analysis": "two-sample t-test power", "solvedFor": which, "value": float(solved), "alpha": alpha}


def task_normality(p):
    import numpy as np
    from scipy.stats import kstest, shapiro
    x = p.get("x")
    if not isinstance(x, list) or len(x) < 3:
        _fail("normality needs `x` (>=3 values).")
    arr = np.asarray(x, float)
    w, pw = shapiro(arr)
    ks, pks = kstest((arr - arr.mean()) / (arr.std(ddof=1) or 1.0), "norm")
    return {"status": "success", "analysis": "normality tests",
            "shapiro": {"W": float(w), "pValue": float(pw)},
            "kolmogorovSmirnov": {"D": float(ks), "pValue": float(pks)},
            "isNormal": bool(pw > 0.05)}


def task_roc_auc(p):
    from sklearn.metrics import roc_auc_score, roc_curve
    y_true = p.get("yTrue"); y_score = p.get("yScore")
    if not (isinstance(y_true, list) and isinstance(y_score, list) and len(y_true) == len(y_score)):
        _fail("roc_auc needs equal-length `yTrue` (0/1) and `yScore`.")
    auc = roc_auc_score(y_true, y_score)
    fpr, tpr, thr = roc_curve(y_true, y_score)
    return {"status": "success", "analysis": "ROC / AUC", "auc": float(auc),
            "roc": {"fpr": [float(v) for v in fpr], "tpr": [float(v) for v in tpr]}}


def _logrank(dur, ev, grp):
    rows = sorted(zip(dur, ev, grp), key=lambda r: r[0])
    times = sorted(set(t for t, e, _ in rows if e == 1))
    o1 = e1 = v = 0.0
    for t in times:
        risk = [r for r in rows if r[0] >= t]
        tied = [r for r in rows if r[0] == t]
        d = sum(1 for r in tied if r[1] == 1)
        if d == 0:
            continue
        n = len(risk); n1 = sum(1 for r in risk if r[2] == 1)
        d1 = sum(1 for r in tied if r[1] == 1 and r[2] == 1)
        o1 += d1; e1 += d * n1 / n
        if n > 1:
            v += d * (n1 / n) * (1 - n1 / n) * (n - d) / (n - 1)
    return o1 - e1, v


def task_logrank(p):
    import math
    dur, ev, grp = p.get("durations"), p.get("events"), p.get("groups")
    if not (isinstance(dur, list) and isinstance(ev, list) and isinstance(grp, list)):
        _fail("logrank needs durations, events (0/1), groups (0/1).")
    ome, v = _logrank(dur, ev, grp)
    if v <= 0:
        _fail("No informative events for the log-rank test.")
    chi2 = (ome ** 2) / v
    from scipy.stats import chi2 as chi2dist
    pval = float(chi2dist.sf(chi2, 1))
    return {"status": "success", "analysis": "log-rank test", "observedMinusExpected": round(float(ome), 4),
            "variance": round(float(v), 4), "chi2": round(float(chi2), 4), "pValue": pval,
            "z": round(float(ome / math.sqrt(v)), 4)}


def task_cox(p):
    import numpy as np
    from statsmodels.duration.hazard_regression import PHReg
    dur = p.get("durations"); ev = p.get("events"); cov = p.get("covariates")
    names = p.get("covariateNames")
    if not (isinstance(dur, list) and isinstance(ev, list) and isinstance(cov, list)):
        _fail("cox needs durations, events (0/1), covariates (samples x k).")
    y = np.asarray(dur, float); status = np.asarray(ev, float); X = np.asarray(cov, float)
    if X.ndim == 1:
        X = X.reshape(-1, 1)
    if names is None:
        names = [f"cov{i}" for i in range(X.shape[1])]
    try:
        model = PHReg(y, X, status=status, ties="breslow").fit()
    except Exception as e:
        _fail(f"Cox fit failed: {e}")
    hr = [float(np.exp(b)) for b in model.params]
    return {"status": "success", "analysis": "Cox proportional hazards",
            "coefficients": [
                {"covariate": names[i], "logHR": round(float(model.params[i]), 4),
                 "hazardRatio": round(hr[i], 4), "pValue": float(model.pvalues[i])}
                for i in range(X.shape[1])],
            "note": "Partial-likelihood Cox PH (Breslow ties); hazardRatio = exp(coef)."}


TASKS = {
    "fisher_exact": task_fisher_exact, "chi_square": task_chi_square, "anova": task_anova,
    "correlation": task_correlation, "multiple_testing": task_multiple_testing,
    "power_ttest": task_power_ttest, "normality": task_normality, "roc_auc": task_roc_auc,
    "logrank": task_logrank, "cox": task_cox,
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
        import scipy  # noqa: F401
    except Exception as e:
        _fail(f"biostats requires scipy: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
