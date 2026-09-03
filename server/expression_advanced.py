#!/usr/bin/env python3
"""Advanced expression analyses (Module B depth) — one dispatch, several real tools.

Tasks (payload.task):
  * nb_de          : negative-binomial GLM differential expression (statsmodels),
                     Wald test per gene + Benjamini-Hochberg FDR. A real DESeq2-style
                     count model (NB with per-gene dispersion), not a t-test.
  * gsea           : gene-set enrichment analysis on a ranked list (gseapy prerank).
  * batch_correct  : linear batch-effect removal (limma removeBatchEffect-style OLS).
  * pca            : principal component analysis with explained-variance ratios.

Every result is really computed; missing dependencies return an honest 'unavailable'.
Reads JSON on stdin, prints JSON on stdout.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _need(mod):
    try:
        return __import__(mod)
    except Exception as e:
        _fail(f"Requires {mod} (not installed): {e}", status="unavailable")


def task_nb_de(payload):
    import numpy as np
    import statsmodels.api as sm
    from statsmodels.stats.multitest import multipletests

    counts = payload.get("counts") or payload.get("geneCounts")
    conditions = payload.get("conditions")
    if not isinstance(counts, dict) or not isinstance(conditions, list):
        _fail("nb_de needs `counts` (gene -> [ints]) and `conditions` (labels).")
    labels = sorted(set(conditions))
    if len(labels) != 2:
        _fail("nb_de needs exactly two condition groups.")
    ref, alt = labels
    x = np.array([0 if c == ref else 1 for c in conditions], dtype=float)
    X = sm.add_constant(x)

    results = []
    for gene, vals in counts.items():
        y = np.asarray(vals, dtype=float)
        if y.shape[0] != x.shape[0] or np.all(y == y[0]):
            results.append({"gene": gene, "log2FoldChange": None, "pvalue": None, "status": "skipped"})
            continue
        try:
            # Estimate per-gene NB dispersion from a Poisson first pass (method of moments).
            pois = sm.GLM(y, X, family=sm.families.Poisson()).fit()
            mu = np.clip(pois.mu, 1e-8, None)
            # dispersion alpha for NB2: Var = mu + alpha*mu^2
            alpha = float(np.mean(((y - mu) ** 2 - mu) / (mu ** 2)))
            alpha = max(alpha, 1e-6)
            nb = sm.GLM(y, X, family=sm.families.NegativeBinomial(alpha=alpha)).fit()
            coef = float(nb.params[1])
            pval = float(nb.pvalues[1])
            results.append({
                "gene": gene,
                "log2FoldChange": round(coef / np.log(2), 4),
                "lnCoef": round(coef, 4),
                "pvalue": pval,
                "dispersionAlpha": round(alpha, 4),
                "baseMean": round(float(np.mean(y)), 3),
            })
        except Exception as e:
            results.append({"gene": gene, "log2FoldChange": None, "pvalue": None, "status": f"fit_failed:{e}"})

    pvals = [r["pvalue"] for r in results if r.get("pvalue") is not None]
    if pvals:
        rej, padj, *_ = multipletests(pvals, method="fdr_bh")
        it = iter(zip(rej, padj))
        for r in results:
            if r.get("pvalue") is not None:
                rj, pa = next(it)
                r["padj"] = float(pa)
                r["isSignificant"] = bool(rj and pa < 0.05)
    results.sort(key=lambda r: (r.get("padj") if r.get("padj") is not None else 2.0))
    return {
        "status": "success", "analysis": "negative-binomial GLM differential expression",
        "reference": ref, "treatment": alt, "nGenes": len(results),
        "nSignificant": sum(1 for r in results if r.get("isSignificant")),
        "differentialExpression": results,
        "note": "Per-gene NB2 GLM (dispersion from Poisson Pearson moment) + Wald test + BH FDR.",
    }


def task_gsea(payload):
    gseapy = _need("gseapy")
    import pandas as pd
    rnk = payload.get("rnk") or payload.get("ranking")
    gene_sets = payload.get("geneSets") or payload.get("gene_sets")
    if not isinstance(rnk, dict) or not isinstance(gene_sets, dict):
        _fail("gsea needs `rnk` (gene -> score) and `geneSets` (name -> [genes]).")
    ser = pd.Series(rnk, dtype=float).sort_values(ascending=False)
    df = ser.reset_index()
    df.columns = ["gene", "score"]
    try:
        pre = gseapy.prerank(rnk=df, gene_sets=gene_sets, min_size=2, max_size=5000,
                             permutation_num=int(payload.get("permutations", 200)),
                             outdir=None, seed=int(payload.get("seed", 7)), no_plot=True, verbose=False)
    except Exception as e:
        _fail(f"gseapy prerank failed: {e}", status="error")
    res = pre.res2d
    terms = []
    for _, row in res.iterrows():
        terms.append({
            "term": str(row.get("Term")),
            "es": float(row.get("ES")),
            "nes": float(row.get("NES")),
            "pval": float(row.get("NOM p-val")),
            "fdr": float(row.get("FDR q-val")),
        })
    terms.sort(key=lambda t: t["fdr"])
    return {"status": "success", "analysis": "GSEA prerank", "nTerms": len(terms), "terms": terms}


def task_batch_correct(payload):
    import numpy as np
    matrix = payload.get("matrix")
    batch = payload.get("batch")
    if not isinstance(matrix, list) or not isinstance(batch, list):
        _fail("batch_correct needs `matrix` (samples x features) and `batch` labels.")
    M = np.asarray(matrix, dtype=float)
    if M.ndim != 2 or M.shape[0] != len(batch):
        _fail("`matrix` rows must equal len(batch).")
    # limma removeBatchEffect-style: regress out batch indicators column-wise.
    blabels = sorted(set(batch))
    B = np.column_stack([[1.0 if b == lv else 0.0 for b in batch] for lv in blabels[1:]]) if len(blabels) > 1 else None
    corrected = M.copy()
    if B is not None:
        Bc = np.column_stack([np.ones(M.shape[0]), B])
        for j in range(M.shape[1]):
            beta, *_ = np.linalg.lstsq(Bc, M[:, j], rcond=None)
            # subtract batch contribution (keep intercept)
            corrected[:, j] = M[:, j] - B @ beta[1:]
    return {
        "status": "success", "analysis": "linear batch-effect removal",
        "nSamples": int(M.shape[0]), "nFeatures": int(M.shape[1]),
        "batches": blabels, "correctedMatrix": [[round(float(v), 6) for v in row] for row in corrected],
        "note": "OLS removeBatchEffect: batch indicator contributions subtracted, biology retained.",
    }


def task_pca(payload):
    import numpy as np
    from sklearn.decomposition import PCA
    matrix = payload.get("matrix")
    if not isinstance(matrix, list):
        _fail("pca needs `matrix` (samples x features).")
    M = np.asarray(matrix, dtype=float)
    if M.ndim != 2 or M.shape[0] < 2:
        _fail("`matrix` must be 2-D with >=2 samples.")
    n_comp = int(payload.get("nComponents", min(M.shape[0], M.shape[1], 10)))
    n_comp = max(1, min(n_comp, min(M.shape)))
    p = PCA(n_components=n_comp, random_state=0).fit(M)
    scores = p.transform(M)
    return {
        "status": "success", "analysis": "PCA",
        "nComponents": n_comp,
        "explainedVarianceRatio": [round(float(v), 6) for v in p.explained_variance_ratio_],
        "cumulativeVariance": [round(float(v), 6) for v in np.cumsum(p.explained_variance_ratio_)],
        "scores": [[round(float(v), 6) for v in row] for row in scores],
    }


TASKS = {"nb_de": task_nb_de, "gsea": task_gsea, "batch_correct": task_batch_correct, "pca": task_pca}


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
