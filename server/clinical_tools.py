#!/usr/bin/env python3
"""Clinical epidemiology / diagnostics (numpy/scipy) — one dispatch.

Tasks: odds_ratio_rr (2x2 -> OR/RR/ARR/NNT + 95% CIs), diagnostic_metrics
(sens/spec/PPV/NPV/accuracy/F1), number_needed_to_treat, meta_analysis
(inverse-variance fixed-effect pooling). Reads JSON on stdin.
"""
import json
import math
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def task_odds_ratio_rr(p):
    # table = [[exposed_event, exposed_noevent],[unexposed_event, unexposed_noevent]]
    t = p.get("table")
    if not (isinstance(t, list) and len(t) == 2 and len(t[0]) == 2):
        _fail("odds_ratio_rr needs a 2x2 `table` [[a,b],[c,d]].")
    a, b = float(t[0][0]), float(t[0][1])
    c, d = float(t[1][0]), float(t[1][1])
    # Haldane correction for zeros
    if 0 in (a, b, c, d):
        a += 0.5; b += 0.5; c += 0.5; d += 0.5
    orr = (a * d) / (b * c)
    se_lor = math.sqrt(1 / a + 1 / b + 1 / c + 1 / d)
    lor = math.log(orr)
    or_ci = [round(math.exp(lor - 1.96 * se_lor), 4), round(math.exp(lor + 1.96 * se_lor), 4)]
    risk_e = a / (a + b); risk_u = c / (c + d)
    rr = risk_e / risk_u
    arr = risk_u - risk_e
    nnt = (1 / abs(arr)) if arr != 0 else None
    return {"status": "success", "analysis": "odds ratio & relative risk (2x2)",
            "oddsRatio": round(orr, 4), "oddsRatio95CI": or_ci,
            "relativeRisk": round(rr, 4), "absoluteRiskReduction": round(arr, 4),
            "numberNeededToTreat": round(nnt, 2) if nnt else None,
            "riskExposed": round(risk_e, 4), "riskUnexposed": round(risk_u, 4)}


def task_diagnostic_metrics(p):
    tp = float(p.get("tp", 0)); fp = float(p.get("fp", 0))
    fn = float(p.get("fn", 0)); tn = float(p.get("tn", 0))
    if tp + fp + fn + tn == 0:
        _fail("Provide tp, fp, fn, tn counts.")
    sens = tp / (tp + fn) if (tp + fn) else None
    spec = tn / (tn + fp) if (tn + fp) else None
    ppv = tp / (tp + fp) if (tp + fp) else None
    npv = tn / (tn + fn) if (tn + fn) else None
    acc = (tp + tn) / (tp + fp + fn + tn)
    f1 = (2 * ppv * sens / (ppv + sens)) if (ppv and sens and (ppv + sens)) else None
    return {"status": "success", "analysis": "diagnostic test metrics",
            "sensitivity": round(sens, 4) if sens is not None else None,
            "specificity": round(spec, 4) if spec is not None else None,
            "ppv": round(ppv, 4) if ppv is not None else None,
            "npv": round(npv, 4) if npv is not None else None,
            "accuracy": round(acc, 4), "f1": round(f1, 4) if f1 is not None else None,
            "youdenJ": round((sens + spec - 1), 4) if (sens is not None and spec is not None) else None}


def task_number_needed_to_treat(p):
    ce = p.get("controlEventRate"); te = p.get("treatedEventRate")
    if ce is None or te is None:
        _fail("number_needed_to_treat needs controlEventRate and treatedEventRate (0..1).")
    arr = float(ce) - float(te)
    if arr == 0:
        return {"status": "success", "analysis": "NNT", "absoluteRiskReduction": 0.0, "nnt": None, "note": "No risk difference."}
    return {"status": "success", "analysis": "number needed to treat",
            "absoluteRiskReduction": round(arr, 4), "nnt": round(1 / abs(arr), 2),
            "benefit": bool(arr > 0)}


def task_meta_analysis(p):
    import numpy as np
    studies = p.get("studies")
    if not isinstance(studies, list) or len(studies) < 2:
        _fail("meta_analysis needs `studies`: [{effect, se}, ...] (>=2).")
    eff = np.array([float(s["effect"]) for s in studies])
    se = np.array([float(s["se"]) for s in studies])
    if np.any(se <= 0):
        _fail("All standard errors must be > 0.")
    w = 1 / se ** 2
    pooled = float(np.sum(w * eff) / np.sum(w))
    pooled_se = float(np.sqrt(1 / np.sum(w)))
    # Cochran's Q heterogeneity
    Q = float(np.sum(w * (eff - pooled) ** 2))
    dfree = len(studies) - 1
    i2 = max(0.0, (Q - dfree) / Q) * 100 if Q > 0 else 0.0
    ci = [round(pooled - 1.96 * pooled_se, 4), round(pooled + 1.96 * pooled_se, 4)]
    return {"status": "success", "analysis": "inverse-variance fixed-effect meta-analysis",
            "pooledEffect": round(pooled, 4), "se": round(pooled_se, 4), "ci95": ci,
            "cochranQ": round(Q, 4), "iSquaredPercent": round(i2, 2), "nStudies": len(studies)}


TASKS = {"odds_ratio_rr": task_odds_ratio_rr, "diagnostic_metrics": task_diagnostic_metrics,
         "number_needed_to_treat": task_number_needed_to_treat, "meta_analysis": task_meta_analysis}


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        _fail(f"Invalid JSON payload: {e}")
    task = payload.get("task")
    if task not in TASKS:
        _fail(f"Unknown task {task!r}. Available: {', '.join(TASKS)}.")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
