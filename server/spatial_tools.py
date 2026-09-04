#!/usr/bin/env python3
"""Spatial statistics (numpy/scipy) — one dispatch. Reads JSON on stdin, prints JSON on stdout."""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _as_values(p):
    import numpy as np

    vals = p.get("values")
    if vals is None:
        raise ValueError("missing 'values' (list of numbers)")
    arr = np.asarray(vals, dtype=float).ravel()
    if arr.size == 0:
        raise ValueError("'values' is empty")
    if not np.all(np.isfinite(arr)):
        raise ValueError("'values' contains non-finite entries")
    return arr


def _as_weights(p, n):
    import numpy as np

    w = p.get("weights")
    if w is None:
        raise ValueError("missing 'weights' (n x n matrix)")
    W = np.asarray(w, dtype=float)
    if W.ndim != 2 or W.shape[0] != W.shape[1]:
        raise ValueError("'weights' must be a square n x n matrix")
    if W.shape[0] != n:
        raise ValueError(
            f"'weights' shape {W.shape} does not match number of values ({n})"
        )
    if not np.all(np.isfinite(W)):
        raise ValueError("'weights' contains non-finite entries")
    return W


def _morans_i_value(z, W, s0):
    """Moran's I for mean-centered vector z and weight matrix W (S0 = sum W)."""
    import numpy as np

    num = float(z @ W @ z)
    den = float(np.sum(z * z))
    n = z.size
    if den == 0.0 or s0 == 0.0:
        return None
    return (n / s0) * (num / den)


def task_morans_i(p):
    import numpy as np

    x = _as_values(p)
    n = x.size
    if n < 2:
        return {"status": "error", "error": "need at least 2 values"}
    W = _as_weights(p, n)
    s0 = float(np.sum(W))
    z = x - x.mean()
    I = _morans_i_value(z, W, s0)
    if I is None:
        return {
            "status": "error",
            "error": "Moran's I undefined (zero variance or zero total weight)",
        }
    expected = -1.0 / (n - 1)

    # z-score under the normality assumption.
    zscore = None
    variance = None
    if s0 > 0:
        s1 = 0.5 * float(np.sum((W + W.T) ** 2))
        row = np.asarray(W.sum(axis=1)).ravel()
        col = np.asarray(W.sum(axis=0)).ravel()
        s2 = float(np.sum((row + col) ** 2))
        var = (n * n * s1 - n * s2 + 3.0 * s0 * s0) / (
            s0 * s0 * (n * n - 1)
        ) - expected * expected
        if var > 0:
            variance = var
            zscore = (I - expected) / np.sqrt(var)

    out = {
        "status": "success",
        "analysis": "morans_i",
        "n": int(n),
        "moransI": float(I),
        "expectedI": float(expected),
        "s0": s0,
    }
    if zscore is not None:
        out["zScore"] = float(zscore)
        out["variance"] = float(variance)
        # Two-sided normal p-value.
        try:
            from scipy.stats import norm

            out["pValueNormal"] = float(2.0 * norm.sf(abs(zscore)))
        except Exception:
            pass
    return out


def task_gearys_c(p):
    import numpy as np

    x = _as_values(p)
    n = x.size
    if n < 2:
        return {"status": "error", "error": "need at least 2 values"}
    W = _as_weights(p, n)
    s0 = float(np.sum(W))
    z = x - x.mean()
    den = float(np.sum(z * z))
    if den == 0.0 or s0 == 0.0:
        return {
            "status": "error",
            "error": "Geary's C undefined (zero variance or zero total weight)",
        }
    diff2 = (x[:, None] - x[None, :]) ** 2
    num = float(np.sum(W * diff2))
    C = ((n - 1) * num) / (2.0 * s0 * den)
    return {
        "status": "success",
        "analysis": "gearys_c",
        "n": int(n),
        "gearysC": float(C),
        "expectedC": 1.0,
        "s0": s0,
    }


def task_getis_ord_general_g(p):
    import numpy as np

    x = _as_values(p)
    n = x.size
    if n < 2:
        return {"status": "error", "error": "need at least 2 values"}
    if np.any(x < 0):
        return {
            "status": "error",
            "error": "Getis-Ord General G requires non-negative values",
        }
    W = _as_weights(p, n)
    # Off-diagonal cross products only (i != j).
    xx = np.outer(x, x)
    np.fill_diagonal(xx, 0.0)
    Wn = W.copy()
    np.fill_diagonal(Wn, 0.0)
    den = float(np.sum(xx))
    if den == 0.0:
        return {
            "status": "error",
            "error": "General G undefined (all cross-products zero)",
        }
    num = float(np.sum(Wn * xx))
    G = num / den
    s0 = float(np.sum(Wn))
    expected = s0 / (n * (n - 1))
    return {
        "status": "success",
        "analysis": "getis_ord_general_g",
        "n": int(n),
        "generalG": float(G),
        "expectedG": float(expected),
        "s0": s0,
    }


def task_ripleys_k(p):
    import numpy as np

    pts = p.get("points")
    if pts is None:
        return {"status": "error", "error": "missing 'points' (list of [x, y])"}
    P = np.asarray(pts, dtype=float)
    if P.ndim != 2 or P.shape[1] != 2:
        return {"status": "error", "error": "'points' must be an N x 2 array"}
    n = P.shape[0]
    if n < 2:
        return {"status": "error", "error": "need at least 2 points"}
    if not np.all(np.isfinite(P)):
        return {"status": "error", "error": "'points' contains non-finite entries"}
    radii = p.get("radii")
    if radii is None:
        return {"status": "error", "error": "missing 'radii' (list of numbers)"}
    R = np.asarray(radii, dtype=float).ravel()
    if R.size == 0:
        return {"status": "error", "error": "'radii' is empty"}
    if np.any(R < 0):
        return {"status": "error", "error": "'radii' must be non-negative"}
    area = p.get("area")
    if area is None:
        return {"status": "error", "error": "missing 'area' (study region area)"}
    area = float(area)
    if area <= 0:
        return {"status": "error", "error": "'area' must be positive"}

    # Pairwise distances (excluding self-pairs on the diagonal).
    diff = P[:, None, :] - P[None, :, :]
    dist = np.sqrt(np.sum(diff * diff, axis=2))
    np.fill_diagonal(dist, np.inf)

    k_vals = []
    l_vals = []
    factor = area / (n * (n - 1))
    for r in R:
        count = float(np.sum(dist <= r))  # ordered pairs i != j within r
        k = factor * count
        k_vals.append(float(k))
        l_vals.append(float(np.sqrt(k / np.pi)))
    return {
        "status": "success",
        "analysis": "ripleys_k",
        "n": int(n),
        "area": area,
        "radii": [float(r) for r in R],
        "kValues": k_vals,
        "lValues": l_vals,
    }


def task_moran_permutation_test(p):
    import numpy as np

    x = _as_values(p)
    n = x.size
    if n < 3:
        return {"status": "error", "error": "need at least 3 values"}
    W = _as_weights(p, n)
    s0 = float(np.sum(W))
    z = x - x.mean()
    I_obs = _morans_i_value(z, W, s0)
    if I_obs is None:
        return {
            "status": "error",
            "error": "Moran's I undefined (zero variance or zero total weight)",
        }
    n_perm = int(p.get("nPermutations", 999))
    if n_perm < 1:
        return {"status": "error", "error": "'nPermutations' must be >= 1"}
    seed = int(p.get("seed", 0))
    rng = np.random.default_rng(seed)

    ge = 0  # permuted I >= observed I (one-sided greater: positive autocorrelation)
    perm = z.copy()
    for _ in range(n_perm):
        rng.shuffle(perm)
        I_perm = _morans_i_value(perm, W, s0)
        if I_perm is not None and I_perm >= I_obs:
            ge += 1
    p_value = (ge + 1) / (n_perm + 1)
    return {
        "status": "success",
        "analysis": "moran_permutation_test",
        "n": int(n),
        "observedI": float(I_obs),
        "expectedI": float(-1.0 / (n - 1)),
        "nPermutations": n_perm,
        "seed": seed,
        "pValue": float(p_value),
        "significant": bool(p_value < 0.05),
    }


TASKS = {
    "morans_i": task_morans_i,
    "gearys_c": task_gearys_c,
    "getis_ord_general_g": task_getis_ord_general_g,
    "ripleys_k": task_ripleys_k,
    "moran_permutation_test": task_moran_permutation_test,
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
        _fail(f"spatial_tools requires numpy/scipy: {e}", status="unavailable")
    try:
        print(json.dumps(TASKS[task](payload)))
    except Exception as e:
        _fail(f"{task} failed: {e}")


if __name__ == "__main__":
    main()
