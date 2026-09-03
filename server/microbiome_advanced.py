#!/usr/bin/env python3
"""Advanced microbiome analyses — one dispatch, several real methods (numpy/scipy).

Tasks (payload.task):
  chao1                 : Chao1 richness estimator per sample (+ observed richness).
  differential_abundance: CLR transform + Welch t-test per taxon between two groups,
                          Benjamini-Hochberg FDR (ALDEx2-style compositional DA).
  rarefaction           : rarefaction curve (expected richness vs sampling depth,
                          analytic Hurlbert rarefaction).

Reads JSON on stdin, prints JSON. `counts`: sample -> {taxon: count}.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _matrix(counts):
    import numpy as np
    if not isinstance(counts, dict) or not counts:
        _fail("Provide `counts`: sample -> {taxon: count}.")
    samples = list(counts.keys())
    taxa = sorted({t for s in counts.values() for t in s})
    M = np.array([[float(counts[s].get(t, 0)) for t in taxa] for s in samples])
    return samples, taxa, M


def task_chao1(p):
    samples, taxa, M = _matrix(p.get("counts"))
    out = {}
    for i, s in enumerate(samples):
        row = M[i]
        obs = int((row > 0).sum())
        f1 = int((row == 1).sum())
        f2 = int((row == 2).sum())
        chao1 = obs + (f1 * (f1 - 1)) / (2 * (f2 + 1))  # bias-corrected Chao1
        out[s] = {"observedRichness": obs, "singletons": f1, "doubletons": f2, "chao1": round(float(chao1), 3)}
    return {"status": "success", "analysis": "Chao1 richness estimator", "nTaxa": len(taxa), "perSample": out}


def task_differential_abundance(p):
    import numpy as np
    from scipy.stats import ttest_ind
    from statsmodels.stats.multitest import multipletests
    counts = p.get("counts")
    groups = p.get("groups")
    if not isinstance(groups, dict):
        _fail("differential_abundance needs `groups`: sample -> group label.")
    samples, taxa, M = _matrix(counts)
    labels = [groups.get(s) for s in samples]
    uniq = sorted(set(x for x in labels if x is not None))
    if len(uniq) != 2:
        _fail("Need exactly two groups.")
    # CLR transform (add pseudocount, log, subtract per-sample geometric mean).
    P = M + 0.5
    logP = np.log(P)
    clr = logP - logP.mean(axis=1, keepdims=True)
    g0 = [i for i, x in enumerate(labels) if x == uniq[0]]
    g1 = [i for i, x in enumerate(labels) if x == uniq[1]]
    rows = []
    for j, t in enumerate(taxa):
        a, b = clr[g0, j], clr[g1, j]
        if np.std(a) == 0 and np.std(b) == 0:
            continue
        stat, pval = ttest_ind(a, b, equal_var=False)
        rows.append({"taxon": t, "clrMeanDiff": round(float(b.mean() - a.mean()), 4), "pvalue": float(pval)})
    if rows:
        rej, padj, *_ = multipletests([r["pvalue"] for r in rows], method="fdr_bh")
        for r, rj, pa in zip(rows, rej, padj):
            r["padj"] = float(pa); r["significant"] = bool(rj and pa < 0.05)
    rows.sort(key=lambda r: r.get("padj", 2.0))
    return {"status": "success", "analysis": "CLR differential abundance (Welch + BH)",
            "groups": uniq, "nTaxaTested": len(rows),
            "nSignificant": sum(1 for r in rows if r.get("significant")), "results": rows}


def task_rarefaction(p):
    from math import comb

    counts = p.get("counts")
    samples, taxa, M = _matrix(counts)
    steps = int(p.get("steps", 10))
    out = {}
    for i, s in enumerate(samples):
        row = M[i].astype(int)
        N = int(row.sum())
        if N == 0:
            out[s] = []
            continue
        depths = [max(1, int(round(N * k / steps))) for k in range(1, steps + 1)]
        curve = []
        for n in depths:
            # Hurlbert expected species at depth n: S - sum C(N-Ni, n)/C(N, n)
            denom = comb(N, n)
            exp_absent = sum(comb(N - int(ni), n) / denom for ni in row if ni > 0 and (N - int(ni)) >= n)
            exp_richness = int((row > 0).sum()) - exp_absent
            curve.append({"depth": n, "expectedRichness": round(float(exp_richness), 3)})
        out[s] = curve
    return {"status": "success", "analysis": "rarefaction (Hurlbert expected richness)", "perSample": out}


TASKS = {"chao1": task_chao1, "differential_abundance": task_differential_abundance, "rarefaction": task_rarefaction}


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
        _fail(f"microbiome_advanced requires numpy: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
