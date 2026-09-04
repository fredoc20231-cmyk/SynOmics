#!/usr/bin/env python3
"""Epigenomics analyses (numpy/scipy) — one dispatch.

Tasks: interval_jaccard (base-pair overlap of two interval sets),
pwm_scan (position-weight-matrix hits over a sequence),
methylation_mvalues (beta -> M values), dmr_test (per-site Welch + BH).
Reads JSON on stdin.
"""
import json
import math
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _merge(intervals):
    iv = sorted([(int(a), int(b)) for a, b in intervals if b > a])
    merged = []
    for s, e in iv:
        if merged and s <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], e))
        else:
            merged.append((s, e))
    return merged


def task_interval_jaccard(p):
    a = p.get("setA"); b = p.get("setB")
    if not (isinstance(a, list) and isinstance(b, list)):
        _fail("interval_jaccard needs `setA` and `setB` = [[start,end],...].")
    A = _merge(a); B = _merge(b)

    def total(iv):
        return sum(e - s for s, e in iv)
    # intersection length
    inter = 0
    for s1, e1 in A:
        for s2, e2 in B:
            inter += max(0, min(e1, e2) - max(s1, s2))
    union = total(A) + total(B) - inter
    return {"status": "success", "analysis": "interval (peak) Jaccard",
            "bpA": total(A), "bpB": total(B), "bpIntersection": inter,
            "jaccard": round(inter / union, 6) if union else 0.0}


def task_pwm_scan(p):
    import numpy as np
    pwm = p.get("pwm"); seq = p.get("sequence")
    if not (isinstance(pwm, dict) and isinstance(seq, str)):
        _fail("pwm_scan needs `pwm` {A/C/G/T: [per-position probs]} and `sequence`.")
    seq = seq.strip().upper()
    bases = ["A", "C", "G", "T"]
    try:
        M = np.array([pwm[b] for b in bases], float)  # 4 x L
    except Exception:
        _fail("pwm must have A,C,G,T rows of equal length.")
    L = M.shape[1]
    logM = np.log2((M + 1e-9) / 0.25)  # log-odds vs uniform background
    thr = float(p.get("threshold", 0.0))
    hits = []
    idx = {b: i for i, b in enumerate(bases)}
    for i in range(len(seq) - L + 1):
        window = seq[i:i + L]
        if any(c not in idx for c in window):
            continue
        score = float(sum(logM[idx[window[j]], j] for j in range(L)))
        if score >= thr:
            hits.append({"position": i, "match": window, "score": round(score, 4)})
    hits.sort(key=lambda h: -h["score"])
    return {"status": "success", "analysis": "PWM scan (log-odds)", "motifLength": L,
            "nHits": len(hits), "hits": hits[:200]}


def task_methylation_mvalues(p):
    betas = p.get("betas")
    if not isinstance(betas, list) or not betas:
        _fail("methylation_mvalues needs `betas` (0..1).")
    out = []
    for bta in betas:
        bt = min(max(float(bta), 1e-6), 1 - 1e-6)
        out.append(round(math.log2(bt / (1 - bt)), 6))
    return {"status": "success", "analysis": "beta -> M-value transform", "mValues": out}


def task_dmr_test(p):
    import numpy as np
    from scipy.stats import ttest_ind
    from statsmodels.stats.multitest import multipletests
    g1 = p.get("group1"); g2 = p.get("group2")
    if not (isinstance(g1, list) and isinstance(g2, list)):
        _fail("dmr_test needs `group1` and `group2` = samples x sites beta matrices.")
    A = np.asarray(g1, float); B = np.asarray(g2, float)
    if A.shape[1] != B.shape[1]:
        _fail("group1 and group2 must have the same number of sites.")
    rows = []
    for j in range(A.shape[1]):
        a, b = A[:, j], B[:, j]
        if np.std(a) == 0 and np.std(b) == 0:
            rows.append({"site": j, "deltaBeta": round(float(b.mean() - a.mean()), 4), "pvalue": 1.0})
            continue
        _, pv = ttest_ind(a, b, equal_var=False)
        rows.append({"site": j, "deltaBeta": round(float(b.mean() - a.mean()), 4), "pvalue": float(pv)})
    rej, padj, *_ = multipletests([r["pvalue"] for r in rows], method="fdr_bh")
    for r, rj, pa in zip(rows, rej, padj):
        r["padj"] = float(pa); r["significant"] = bool(rj and pa < 0.05)
    rows.sort(key=lambda r: r["padj"])
    return {"status": "success", "analysis": "differentially methylated sites (Welch + BH)",
            "nSites": len(rows), "nSignificant": sum(1 for r in rows if r["significant"]), "results": rows}


TASKS = {"interval_jaccard": task_interval_jaccard, "pwm_scan": task_pwm_scan,
         "methylation_mvalues": task_methylation_mvalues, "dmr_test": task_dmr_test}


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        _fail(f"Invalid JSON payload: {e}")
    task = payload.get("task")
    if task not in TASKS:
        _fail(f"Unknown task {task!r}. Available: {', '.join(TASKS)}.")
    if task in ("pwm_scan", "dmr_test"):
        try:
            import numpy  # noqa: F401
        except Exception as e:
            _fail(f"epigenomics requires numpy: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
