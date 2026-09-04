#!/usr/bin/env python3
"""Regression models (statsmodels) — one dispatch, several real GLMs.

Tasks: ols, logistic_glm, poisson_glm, mixedlm, robust_regression.
Every fit is a real statsmodels model. Reads JSON on stdin, prints JSON.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _Xy(p):
    import numpy as np
    X = p.get("X"); y = p.get("y")
    if not isinstance(X, list) or not isinstance(y, list):
        _fail("Provide `X` (samples x features) and `y` (target).")
    Xa = np.asarray(X, float)
    if Xa.ndim == 1:
        Xa = Xa.reshape(-1, 1)
    ya = np.asarray(y, float)
    names = p.get("featureNames") or [f"x{i}" for i in range(Xa.shape[1])]
    return Xa, ya, names


def _coefs(model, names):
    import numpy as np  # noqa: F401
    params = list(model.params)
    pvals = list(model.pvalues)
    out = [{"term": "const", "coef": round(float(params[0]), 6), "pValue": float(pvals[0])}]
    for i, nm in enumerate(names):
        out.append({"term": nm, "coef": round(float(params[i + 1]), 6), "pValue": float(pvals[i + 1])})
    return out


def task_ols(p):
    import statsmodels.api as sm
    X, y, names = _Xy(p)
    m = sm.OLS(y, sm.add_constant(X)).fit()
    return {"status": "success", "analysis": "OLS linear regression",
            "coefficients": _coefs(m, names), "rSquared": round(float(m.rsquared), 5),
            "adjRSquared": round(float(m.rsquared_adj), 5), "fPValue": float(m.f_pvalue)}


def task_logistic_glm(p):
    import numpy as np
    import statsmodels.api as sm
    X, y, names = _Xy(p)
    m = sm.GLM(y, sm.add_constant(X), family=sm.families.Binomial()).fit()
    coefs = _coefs(m, names)
    for c in coefs:
        c["oddsRatio"] = round(float(np.exp(c["coef"])), 6)
    return {"status": "success", "analysis": "logistic regression (GLM binomial)",
            "coefficients": coefs, "logLikelihood": round(float(m.llf), 4), "aic": round(float(m.aic), 4)}


def task_poisson_glm(p):
    import numpy as np
    import statsmodels.api as sm
    X, y, names = _Xy(p)
    m = sm.GLM(y, sm.add_constant(X), family=sm.families.Poisson()).fit()
    coefs = _coefs(m, names)
    for c in coefs:
        c["rateRatio"] = round(float(np.exp(c["coef"])), 6)
    return {"status": "success", "analysis": "Poisson regression (GLM)", "coefficients": coefs, "aic": round(float(m.aic), 4)}


def task_mixedlm(p):
    import pandas as pd
    import statsmodels.formula.api as smf
    X, y, names = _Xy(p)
    groups = p.get("groups")
    if not isinstance(groups, list) or len(groups) != len(y):
        _fail("mixedlm needs `groups` (random-effect grouping, len == y).")
    df = pd.DataFrame(X, columns=names)
    df["y"] = y
    df["grp"] = [str(g) for g in groups]
    formula = "y ~ " + " + ".join(names)
    m = smf.mixedlm(formula, df, groups=df["grp"]).fit()
    coefs = [{"term": k, "coef": round(float(v), 6), "pValue": float(m.pvalues.get(k, float("nan")))}
             for k, v in m.params.items() if k != "Group Var"]
    return {"status": "success", "analysis": "linear mixed-effects model (random intercept)",
            "coefficients": coefs, "groupVar": round(float(m.cov_re.iloc[0, 0]), 6)}


def task_robust_regression(p):
    import statsmodels.api as sm
    X, y, names = _Xy(p)
    m = sm.RLM(y, sm.add_constant(X), M=sm.robust.norms.HuberT()).fit()
    return {"status": "success", "analysis": "robust regression (Huber M-estimator)",
            "coefficients": _coefs(m, names)}


TASKS = {"ols": task_ols, "logistic_glm": task_logistic_glm, "poisson_glm": task_poisson_glm,
         "mixedlm": task_mixedlm, "robust_regression": task_robust_regression}


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
        import statsmodels  # noqa: F401
    except Exception as e:
        _fail(f"regression_tools requires statsmodels: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
