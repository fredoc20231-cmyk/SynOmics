#!/usr/bin/env python3
"""Gene-set enrichment (over-representation) — one dispatch (scipy/statsmodels).

Tasks: ora (hypergeometric over-representation across gene sets + BH FDR +
fold enrichment), geneset_overlap (Jaccard/overlap coefficient between sets).
Reads JSON on stdin.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def task_ora(p):
    from scipy.stats import hypergeom
    from statsmodels.stats.multitest import multipletests
    query = p.get("query")
    gene_sets = p.get("geneSets")
    universe = p.get("universe")
    if not (isinstance(query, list) and isinstance(gene_sets, dict)):
        _fail("ora needs `query` (gene list) and `geneSets` (name -> [genes]).")
    q = set(map(str, query))
    if isinstance(universe, list):
        N = len(set(map(str, universe)))
    else:
        allg = set(q)
        for gs in gene_sets.values():
            allg |= set(map(str, gs))
        N = len(allg)
    n = len(q)
    rows = []
    for name, gs in gene_sets.items():
        S = set(map(str, gs))
        K = len(S)
        k = len(q & S)
        if K == 0:
            continue
        # P(X >= k) hypergeometric
        pval = float(hypergeom.sf(k - 1, N, K, n))
        expected = n * K / N if N else 0
        fold = (k / expected) if expected > 0 else None
        rows.append({"term": str(name), "overlap": k, "setSize": K,
                     "expected": round(expected, 3), "foldEnrichment": round(fold, 3) if fold else None,
                     "pValue": pval, "genes": sorted(q & S)})
    if rows:
        rej, padj, *_ = multipletests([r["pValue"] for r in rows], method="fdr_bh")
        for r, rj, pa in zip(rows, rej, padj):
            r["padj"] = float(pa); r["significant"] = bool(rj and pa < 0.05)
    rows.sort(key=lambda r: r.get("padj", 2.0))
    return {"status": "success", "analysis": "over-representation analysis (hypergeometric + BH)",
            "universeSize": N, "querySize": n, "nSignificant": sum(1 for r in rows if r.get("significant")),
            "results": rows}


def task_geneset_overlap(p):
    a = p.get("setA"); b = p.get("setB")
    if not (isinstance(a, list) and isinstance(b, list)):
        _fail("geneset_overlap needs `setA` and `setB`.")
    A, B = set(map(str, a)), set(map(str, b))
    inter = A & B
    union = A | B
    jaccard = len(inter) / len(union) if union else 0.0
    overlap_coef = len(inter) / min(len(A), len(B)) if A and B else 0.0
    return {"status": "success", "analysis": "gene-set overlap",
            "intersection": len(inter), "union": len(union),
            "jaccard": round(jaccard, 6), "overlapCoefficient": round(overlap_coef, 6),
            "sharedGenes": sorted(inter)}


TASKS = {"ora": task_ora, "geneset_overlap": task_geneset_overlap}


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
        _fail(f"enrichment_tools requires scipy: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
