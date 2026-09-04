#!/usr/bin/env python3
"""Beta-diversity & ordination (numpy/scipy) — one dispatch."""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _matrix(p, key="matrix"):
    import numpy as np
    m = p.get(key)
    if m is None:
        _fail(f"Missing required parameter {key!r}.")
    try:
        arr = np.asarray(m, dtype=float)
    except Exception as e:
        _fail(f"{key} must be a numeric 2-D array: {e}")
    if arr.ndim != 2:
        _fail(f"{key} must be a 2-D array (rows x columns).")
    if arr.size == 0:
        _fail(f"{key} is empty.")
    if not np.all(np.isfinite(arr)):
        _fail(f"{key} contains non-finite values.")
    return arr


def _sample_ids(p, n):
    ids = p.get("sampleIds")
    if ids is None:
        return [f"S{i + 1}" for i in range(n)]
    if len(ids) != n:
        _fail(f"sampleIds length ({len(ids)}) != number of samples ({n}).")
    return [str(x) for x in ids]


def task_bray_curtis(p):
    """Pairwise Bray-Curtis dissimilarity matrix from a counts matrix."""
    import numpy as np
    x = _matrix(p)
    if np.any(x < 0):
        _fail("Bray-Curtis requires non-negative counts/abundances.")
    n = x.shape[0]
    ids = _sample_ids(p, n)
    d = np.zeros((n, n), dtype=float)
    for i in range(n):
        for j in range(i + 1, n):
            num = np.sum(np.abs(x[i] - x[j]))
            den = np.sum(x[i] + x[j])
            val = 0.0 if den == 0 else float(num / den)
            d[i, j] = val
            d[j, i] = val
    return {
        "status": "success",
        "analysis": "bray_curtis",
        "metric": "bray_curtis",
        "nSamples": n,
        "sampleIds": ids,
        "distanceMatrix": d.tolist(),
    }


def task_jaccard_distance(p):
    """Pairwise Jaccard dissimilarity on presence/absence (binarized at >0)."""
    import numpy as np
    x = _matrix(p)
    n = x.shape[0]
    ids = _sample_ids(p, n)
    b = (x > 0)
    d = np.zeros((n, n), dtype=float)
    for i in range(n):
        for j in range(i + 1, n):
            inter = int(np.sum(b[i] & b[j]))
            union = int(np.sum(b[i] | b[j]))
            val = 0.0 if union == 0 else float(1.0 - inter / union)
            d[i, j] = val
            d[j, i] = val
    return {
        "status": "success",
        "analysis": "jaccard_distance",
        "metric": "jaccard",
        "nSamples": n,
        "sampleIds": ids,
        "distanceMatrix": d.tolist(),
    }


def _distance_matrix(p, key="distanceMatrix"):
    import numpy as np
    d = _matrix(p, key)
    if d.shape[0] != d.shape[1]:
        _fail(f"{key} must be square.")
    if not np.allclose(d, d.T, atol=1e-8):
        _fail(f"{key} must be symmetric.")
    return d


def task_pcoa(p):
    """Classical Principal Coordinates Analysis (classical MDS) on a distance matrix."""
    import numpy as np
    d = _distance_matrix(p)
    n = d.shape[0]
    ids = _sample_ids(p, n)
    k = int(p.get("nComponents", 2))
    if k < 1:
        _fail("nComponents must be >= 1.")
    k = min(k, n)
    # Double centering: B = -1/2 J (D^2) J, J = I - 1/n ones
    d2 = d ** 2
    j = np.eye(n) - np.ones((n, n)) / n
    b = -0.5 * j.dot(d2).dot(j)
    b = (b + b.T) / 2.0  # enforce symmetry for numerical stability
    eigvals, eigvecs = np.linalg.eigh(b)
    # Sort descending
    order = np.argsort(eigvals)[::-1]
    eigvals = eigvals[order]
    eigvecs = eigvecs[:, order]
    pos = eigvals > 1e-9
    total_pos = float(np.sum(eigvals[pos]))
    kk = min(k, int(np.sum(pos))) if np.any(pos) else 0
    if kk == 0:
        _fail("No positive eigenvalues; cannot compute coordinates.")
    coords = eigvecs[:, :kk] * np.sqrt(eigvals[:kk])
    prop = [float(eigvals[i] / total_pos) if total_pos > 0 else 0.0 for i in range(kk)]
    return {
        "status": "success",
        "analysis": "pcoa",
        "nSamples": n,
        "sampleIds": ids,
        "nComponents": kk,
        "coordinates": coords.tolist(),
        "eigenvalues": [float(v) for v in eigvals[:kk]],
        "proportionExplained": prop,
    }


def _permanova_f(d2, labels, groups):
    import numpy as np
    n = d2.shape[0]
    a = len(groups)
    # Total SS = sum of squared distances (upper triangle) / n
    ss_t = float(np.sum(np.triu(d2, k=1))) / n
    ss_w = 0.0
    for g in groups:
        idx = np.where(labels == g)[0]
        ng = len(idx)
        if ng < 1:
            continue
        sub = d2[np.ix_(idx, idx)]
        ss_w += float(np.sum(np.triu(sub, k=1))) / ng
    ss_a = ss_t - ss_w
    denom = ss_w / (n - a)
    if denom <= 0:
        return float("inf") if ss_a > 0 else 0.0
    return (ss_a / (a - 1)) / denom


def task_permanova(p):
    """PERMANOVA (Anderson 2001): pseudo-F + permutation p-value on a distance matrix."""
    import numpy as np
    d = _distance_matrix(p)
    n = d.shape[0]
    groups_in = p.get("groups")
    if groups_in is None:
        _fail("Missing required parameter 'groups'.")
    if len(groups_in) != n:
        _fail(f"groups length ({len(groups_in)}) != number of samples ({n}).")
    labels = np.asarray([str(x) for x in groups_in])
    groups = list(dict.fromkeys(labels.tolist()))
    a = len(groups)
    if a < 2:
        _fail("PERMANOVA requires at least 2 groups.")
    if a >= n:
        _fail("PERMANOVA requires more samples than groups.")
    n_perm = int(p.get("nPermutations", 999))
    seed = int(p.get("seed", 0))
    d2 = d ** 2
    f_obs = _permanova_f(d2, labels, groups)
    rng = np.random.default_rng(seed)
    count = 0
    for _ in range(n_perm):
        perm = rng.permutation(labels)
        f_perm = _permanova_f(d2, perm, groups)
        if f_perm >= f_obs:
            count += 1
    p_value = (count + 1) / (n_perm + 1)
    return {
        "status": "success",
        "analysis": "permanova",
        "nSamples": n,
        "nGroups": a,
        "groups": groups,
        "nPermutations": n_perm,
        "seed": seed,
        "pseudoF": float(f_obs),
        "pValue": float(p_value),
        "significant": bool(p_value < 0.05),
    }


def task_mantel_test(p):
    """Mantel test: upper-triangle Pearson correlation between two distance matrices + permutation p-value."""
    import numpy as np
    a = _distance_matrix(p, "matrixA")
    b = _distance_matrix(p, "matrixB")
    if a.shape != b.shape:
        _fail("matrixA and matrixB must have the same shape.")
    n = a.shape[0]
    if n < 3:
        _fail("Mantel test requires at least 3 objects.")
    n_perm = int(p.get("nPermutations", 999))
    seed = int(p.get("seed", 0))
    iu = np.triu_indices(n, k=1)
    av = a[iu]
    bv = b[iu]

    def _pearson(x, y):
        xm = x - x.mean()
        ym = y - y.mean()
        denom = np.sqrt(np.sum(xm ** 2) * np.sum(ym ** 2))
        if denom == 0:
            return 0.0
        return float(np.sum(xm * ym) / denom)

    r_obs = _pearson(av, bv)
    rng = np.random.default_rng(seed)
    count = 0
    for _ in range(n_perm):
        perm = rng.permutation(n)
        bp = b[np.ix_(perm, perm)]
        r_perm = _pearson(av, bp[iu])
        if abs(r_perm) >= abs(r_obs):
            count += 1
    p_value = (count + 1) / (n_perm + 1)
    return {
        "status": "success",
        "analysis": "mantel_test",
        "nObjects": n,
        "nPermutations": n_perm,
        "seed": seed,
        "mantelR": float(r_obs),
        "pValue": float(p_value),
        "significant": bool(p_value < 0.05),
    }


TASKS = {
    "bray_curtis": task_bray_curtis,
    "jaccard_distance": task_jaccard_distance,
    "pcoa": task_pcoa,
    "permanova": task_permanova,
    "mantel_test": task_mantel_test,
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
    except Exception as e:
        _fail(f"beta_diversity requires numpy/scipy: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
