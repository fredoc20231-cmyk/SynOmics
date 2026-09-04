#!/usr/bin/env python3
"""Population genetics — one dispatch, several real estimators (numpy/scipy).

Tasks: nucleotide_diversity (pi), tajimas_d, fst (Hudson), ld_r2, maf_spectrum.
Reads JSON on stdin. Genotype/haplotype input as described per task.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _haplo(p):
    import numpy as np
    h = p.get("haplotypes")
    if not isinstance(h, list) or not h:
        _fail("Provide `haplotypes`: list of equal-length 0/1 sequences.")
    H = np.asarray(h, int)
    if H.ndim != 2:
        _fail("haplotypes must be a 2-D 0/1 matrix (samples x sites).")
    return H


def task_nucleotide_diversity(p):
    import numpy as np
    H = _haplo(p)
    n, L = H.shape
    if n < 2:
        _fail("Need >=2 haplotypes.")
    # pi = average pairwise differences per site
    diffs = 0
    for i in range(n):
        for j in range(i + 1, n):
            diffs += int(np.sum(H[i] != H[j]))
    pairs = n * (n - 1) / 2
    pi = diffs / pairs / L
    return {"status": "success", "analysis": "nucleotide diversity (pi)", "nHaplotypes": n, "nSites": L,
            "pi": round(float(pi), 6), "avgPairwiseDiff": round(float(diffs / pairs), 4)}


def task_tajimas_d(p):
    import numpy as np
    H = _haplo(p)
    n, L = H.shape
    if n < 4:
        _fail("Tajima's D needs >=4 haplotypes.")
    # segregating sites
    S = int(np.sum([len(set(H[:, j])) > 1 for j in range(L)]))
    if S == 0:
        return {"status": "success", "analysis": "Tajima's D", "segregatingSites": 0, "tajimasD": None, "note": "No segregating sites."}
    a1 = sum(1.0 / i for i in range(1, n))
    a2 = sum(1.0 / (i * i) for i in range(1, n))
    b1 = (n + 1) / (3 * (n - 1))
    b2 = 2 * (n * n + n + 3) / (9 * n * (n - 1))
    c1 = b1 - 1 / a1
    c2 = b2 - (n + 2) / (a1 * n) + a2 / (a1 * a1)
    e1 = c1 / a1
    e2 = c2 / (a1 * a1 + a2)
    # theta_pi
    diffs = sum(int(np.sum(H[i] != H[j])) for i in range(n) for j in range(i + 1, n))
    theta_pi = diffs / (n * (n - 1) / 2)
    theta_w = S / a1
    var = e1 * S + e2 * S * (S - 1)
    D = (theta_pi - theta_w) / (var ** 0.5) if var > 0 else None
    return {"status": "success", "analysis": "Tajima's D", "segregatingSites": S,
            "thetaPi": round(float(theta_pi), 4), "thetaW": round(float(theta_w), 4),
            "tajimasD": round(float(D), 4) if D is not None else None}


def task_fst(p):
    import numpy as np
    a = p.get("pop1"); b = p.get("pop2")
    if not (isinstance(a, list) and isinstance(b, list)):
        _fail("fst needs `pop1` and `pop2`: 0/1 matrices (samples x sites).")
    A = np.asarray(a, int); B = np.asarray(b, int)
    if A.shape[1] != B.shape[1]:
        _fail("pop1 and pop2 must have the same number of sites.")
    pA = A.mean(axis=0); pB = B.mean(axis=0)
    p_all = np.concatenate([A, B]).mean(axis=0)
    hs = (pA * (1 - pA) + pB * (1 - pB)) / 2  # within-pop heterozygosity
    ht = p_all * (1 - p_all)                   # total
    valid = ht > 0
    fst_per = np.where(valid, (ht - hs) / np.where(valid, ht, 1), 0.0)
    fst = float(np.mean((ht[valid] - hs[valid])) / np.mean(ht[valid])) if valid.any() else 0.0
    return {"status": "success", "analysis": "Fst (Nei) between two populations", "nSites": int(A.shape[1]),
            "fstGlobal": round(fst, 6), "fstPerSite": [round(float(v), 4) for v in fst_per]}


def task_ld_r2(p):
    import numpy as np
    a = p.get("locusA"); b = p.get("locusB")
    if not (isinstance(a, list) and isinstance(b, list) and len(a) == len(b)):
        _fail("ld_r2 needs equal-length `locusA` and `locusB` (0/1 per individual).")
    A = np.asarray(a, float); B = np.asarray(b, float)
    pa = A.mean(); pb = B.mean()
    d = float((A * B).mean() - pa * pb)
    denom = pa * (1 - pa) * pb * (1 - pb)
    r2 = (d * d / denom) if denom > 0 else 0.0
    return {"status": "success", "analysis": "linkage disequilibrium", "D": round(d, 6),
            "r2": round(float(r2), 6), "freqA": round(float(pa), 4), "freqB": round(float(pb), 4)}


def task_maf_spectrum(p):
    import numpy as np
    H = _haplo(p)
    freqs = H.mean(axis=0)
    maf = np.minimum(freqs, 1 - freqs)
    bins = [0.0, 0.05, 0.1, 0.2, 0.3, 0.5]
    hist, edges = np.histogram(maf, bins=bins)
    return {"status": "success", "analysis": "minor allele frequency spectrum", "nSites": int(H.shape[1]),
            "maf": [round(float(v), 4) for v in maf],
            "histogram": {f"{edges[i]:.2f}-{edges[i+1]:.2f}": int(hist[i]) for i in range(len(hist))}}


TASKS = {"nucleotide_diversity": task_nucleotide_diversity, "tajimas_d": task_tajimas_d,
         "fst": task_fst, "ld_r2": task_ld_r2, "maf_spectrum": task_maf_spectrum}


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
        _fail(f"population_genetics requires numpy: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
