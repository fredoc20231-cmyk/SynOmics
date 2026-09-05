#!/usr/bin/env python3
"""Spatial transcriptomics deconvolution & cell-to-spot mapping (scipy/POT).

Real, deterministic alternatives to the deep-learning sc<->spatial mapping goal of
Tangram (Biancalani et al. 2021), implemented on the installed stack (no PyTorch):

  nnls_deconvolution   — per-spot cell-type proportions via non-negative least
                         squares of the spot profile onto reference signatures
                         (SPOTlight/NNLS-style). scipy.optimize.nnls.
  ot_map_cells_to_spots — map single cells onto spatial spots by entropic optimal
                         transport with a (1 - cosine similarity) cost on shared
                         genes (POT). Returns a probabilistic cell x spot map.

Validated against synthetic ground truth (known mixtures / known cell origins are
recovered). Reads JSON on stdin, prints JSON on stdout.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _mat(v, name):
    import numpy as np
    if not isinstance(v, list):
        _fail(f"`{name}` must be a 2-D array.")
    a = np.asarray(v, float)
    if a.ndim != 2:
        _fail(f"`{name}` must be 2-D.")
    return a


def task_nnls_deconvolution(p):
    import numpy as np
    from scipy.optimize import nnls
    spots = _mat(p.get("spots"), "spots")            # spots x genes
    sig = _mat(p.get("signatures"), "signatures")    # celltypes x genes
    if spots.shape[1] != sig.shape[1]:
        _fail("spots and signatures must share the same number of genes (columns).")
    cell_types = p.get("cellTypes") or [f"type{i}" for i in range(sig.shape[0])]
    spot_ids = p.get("spotIds") or [f"spot{i}" for i in range(spots.shape[0])]
    A = sig.T   # genes x celltypes
    props = []
    resid = []
    for si in range(spots.shape[0]):
        coef, rnorm = nnls(A, spots[si])
        tot = coef.sum()
        frac = (coef / tot) if tot > 0 else np.zeros_like(coef)
        props.append({cell_types[k]: round(float(frac[k]), 6) for k in range(len(cell_types))})
        resid.append(round(float(rnorm), 6))
    return {
        "status": "success",
        "analysis": "spatial cell-type deconvolution (non-negative least squares)",
        "nSpots": spots.shape[0],
        "nCellTypes": sig.shape[0],
        "nGenes": spots.shape[1],
        "proportions": {spot_ids[i]: props[i] for i in range(len(spot_ids))},
        "residualNorm": {spot_ids[i]: resid[i] for i in range(len(spot_ids))},
    }


def task_ot_map_cells_to_spots(p):
    import numpy as np
    cells = _mat(p.get("cells"), "cells")     # cells x genes
    spots = _mat(p.get("spots"), "spots")     # spots x genes
    if cells.shape[1] != spots.shape[1]:
        _fail("cells and spots must share the same genes (columns).")
    try:
        import ot as pot
    except Exception as e:  # noqa: BLE001
        _fail(f"ot_map_cells_to_spots requires POT (ot): {e}", status="unavailable")
    reg = float(p.get("reg", 0.05))

    def _norm(M):
        n = np.linalg.norm(M, axis=1, keepdims=True)
        n[n == 0] = 1.0
        return M / n
    C = 1.0 - _norm(cells) @ _norm(spots).T   # cost = 1 - cosine similarity (cells x spots)
    a = np.ones(cells.shape[0]) / cells.shape[0]
    b = np.ones(spots.shape[0]) / spots.shape[0]
    P = pot.sinkhorn(a, b, C, reg)            # entropic OT plan (cells x spots)
    row = P / P.sum(axis=1, keepdims=True)    # per-cell distribution over spots
    assign = [int(np.argmax(row[i])) for i in range(cells.shape[0])]
    spot_ids = p.get("spotIds") or [f"spot{j}" for j in range(spots.shape[0])]
    return {
        "status": "success",
        "analysis": "cell-to-spot mapping via entropic optimal transport (1 - cosine cost)",
        "nCells": cells.shape[0],
        "nSpots": spots.shape[0],
        "reg": reg,
        "assignedSpot": [spot_ids[a] for a in assign],
        "assignedSpotIndex": assign,
        "mapping": [[round(float(x), 6) for x in row[i]] for i in range(cells.shape[0])],
    }


TASKS = {
    "nnls_deconvolution": task_nnls_deconvolution,
    "ot_map_cells_to_spots": task_ot_map_cells_to_spots,
}


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:  # noqa: BLE001
        _fail(f"Invalid JSON payload: {e}")
    task = payload.get("task")
    if task not in TASKS:
        _fail(f"Unknown task {task!r}. Available: {', '.join(TASKS)}.")
    try:
        import numpy  # noqa: F401
        import scipy  # noqa: F401
    except Exception as e:  # noqa: BLE001
        _fail(f"spatial_deconvolution requires numpy/scipy: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
