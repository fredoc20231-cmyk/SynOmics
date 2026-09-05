#!/usr/bin/env python3
"""Spatial-transcriptomics neighborhood analysis — single dispatch.

Reads a JSON payload on stdin and prints a JSON result on stdout. Zero
hallucination: every reported value is computed by real spatial statistics on
the provided cell coordinates + cell-type labels; nothing is fabricated. The
permutation null uses an explicit, logged seed for deterministic reproducibility.

Tasks
-----
- neighborhood_enrichment : squidpy-style cell-type neighborhood enrichment.
  Build a kNN spatial graph, count type-type contact edges, and z-score each
  type pair against a seeded label-permutation null (positive z = the two types
  are neighbors more often than chance; negative z = spatially segregated).
- cooccurrence            : co-occurrence ratio of cell types across distance
  bins — P(type=t | within distance d of a center type) / P(type=t). Ratio >1
  means enrichment of that type near the center type at that distance.
- infiltration_score      : fraction of `target` cells within radius r of any
  `source` cell (e.g. immune infiltration into tumor) + counts.
- neighbor_composition    : per-cell-type average neighbor-type composition over
  each cell's k nearest neighbors (a descriptive neighborhood profile).

Concepts adapted from squidpy (gr.nhood_enrichment / gr.co_occurrence);
implementation original, validated numerically against known spatial geometry.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _load_coords_labels(np, p):
    """Validate + return (coords Nx2/Nx3, labels list[str], type_names list[str])."""
    coords = p.get("coordinates")
    labels = p.get("labels")
    if not isinstance(coords, list) or not coords:
        _fail("Provide `coordinates` (N x 2 or N x 3 array of cell positions).")
    if not isinstance(labels, list) or not labels:
        _fail("Provide `labels` (cell-type label per cell, length N).")
    try:
        X = np.asarray(coords, float)
    except Exception as e:
        _fail(f"`coordinates` must be numeric: {e}")
    if X.ndim != 2 or X.shape[1] not in (2, 3):
        _fail(f"`coordinates` must be N x 2 or N x 3; got shape {X.shape}.")
    if X.shape[0] != len(labels):
        _fail(
            f"`coordinates` has {X.shape[0]} rows but `labels` has {len(labels)} "
            f"entries — length mismatch."
        )
    if not np.all(np.isfinite(X)):
        _fail("`coordinates` must be finite numbers.")
    lab = [str(x) for x in labels]
    type_names = sorted(set(lab))
    if len(type_names) < 1:
        _fail("No cell-type labels found.")
    return X, lab, type_names


def _knn_edges(np, X, k):
    """Undirected edge list (i<j) from a symmetric kNN graph via scipy cKDTree."""
    from scipy.spatial import cKDTree

    n = X.shape[0]
    k_eff = min(k, n - 1)
    tree = cKDTree(X)
    # query k+1 because the first neighbor is the point itself.
    _dist, idx = tree.query(X, k=k_eff + 1)
    if idx.ndim == 1:
        idx = idx.reshape(n, 1)
    edges = set()
    for i in range(n):
        for j in idx[i]:
            j = int(j)
            if j == i:
                continue
            a, b = (i, j) if i < j else (j, i)
            edges.add((a, b))
    return np.array(sorted(edges), dtype=int), k_eff


def _contact_matrix(np, edges, codes, n_types):
    """Symmetric type-type edge-count matrix for an undirected edge list."""
    C = np.zeros((n_types, n_types), dtype=float)
    for a, b in edges:
        ta, tb = codes[a], codes[b]
        C[ta, tb] += 1
        if ta != tb:
            C[tb, ta] += 1
    return C


# --------------------------------------------------------------------------- #
# Task 1 — neighborhood enrichment (permutation z-scores)
# --------------------------------------------------------------------------- #
def task_neighborhood_enrichment(p):
    try:
        import numpy as np
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"neighborhood_enrichment requires numpy: {e}", status="unavailable")
    try:
        from scipy.spatial import cKDTree  # noqa: F401
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"neighborhood_enrichment requires scipy: {e}", status="unavailable")

    X, lab, type_names = _load_coords_labels(np, p)
    n = X.shape[0]
    if n < 3:
        _fail("Need at least 3 cells for a neighborhood graph.")
    try:
        k = int(p.get("k", 6))
    except Exception:
        _fail("`k` must be an integer.")
    if k < 1:
        _fail("`k` must be >= 1.")
    try:
        n_perm = int(p.get("nPermutations", 1000))
    except Exception:
        _fail("`nPermutations` must be an integer.")
    if n_perm < 10:
        _fail("`nPermutations` must be >= 10 for a stable null.")
    seed = int(p.get("seed", 0))

    type_index = {t: i for i, t in enumerate(type_names)}
    codes = np.array([type_index[t] for t in lab], dtype=int)
    n_types = len(type_names)

    edges, k_eff = _knn_edges(np, X, k)
    if edges.size == 0:
        _fail("Spatial graph has no edges (need k>=1 and >=2 cells).")

    observed = _contact_matrix(np, edges, codes, n_types)

    rng = np.random.default_rng(seed)
    # Accumulate permutation moments (streamed to avoid holding all matrices).
    sum_c = np.zeros((n_types, n_types))
    sum_c2 = np.zeros((n_types, n_types))
    perm_codes = codes.copy()
    for _ in range(n_perm):
        rng.shuffle(perm_codes)
        Cp = _contact_matrix(np, edges, perm_codes, n_types)
        sum_c += Cp
        sum_c2 += Cp * Cp
    mean_c = sum_c / n_perm
    var_c = np.maximum(sum_c2 / n_perm - mean_c**2, 0.0)
    std_c = np.sqrt(var_c)
    with np.errstate(divide="ignore", invalid="ignore"):
        zscore = np.where(std_c > 0, (observed - mean_c) / std_c, 0.0)

    zmat = [[round(float(zscore[i, j]), 6) for j in range(n_types)] for i in range(n_types)]
    obsmat = [[int(observed[i, j]) for j in range(n_types)] for i in range(n_types)]

    # Rank the strongest enriched / depleted pairs (upper triangle incl. diagonal).
    pairs = []
    for i in range(n_types):
        for j in range(i, n_types):
            pairs.append({
                "typeA": type_names[i],
                "typeB": type_names[j],
                "zscore": round(float(zscore[i, j]), 6),
                "observed": int(observed[i, j]),
                "expected": round(float(mean_c[i, j]), 4),
            })
    enriched = sorted(pairs, key=lambda r: -r["zscore"])
    top = enriched[0] if enriched else None

    analysis = (
        f"Neighborhood enrichment over {n} cells / {n_types} type(s) on a "
        f"k={k_eff} nearest-neighbor graph ({len(edges)} edges), z-scored against "
        f"{n_perm} label permutations (seed={seed}). Positive z = types are "
        f"neighbors more than chance; negative z = spatial segregation."
    )
    if top is not None:
        analysis += (
            f" Strongest enrichment: {top['typeA']}–{top['typeB']} "
            f"(z={top['zscore']:.3g})."
        )
    research_log = (
        "# Cell-type neighborhood enrichment\n\n"
        f"A k={k_eff} nearest-neighbor spatial graph was built over **{n}** cells "
        f"({len(edges)} undirected edges). For every ordered pair of cell types "
        "the number of graph edges connecting them was counted, then compared to "
        f"a null of **{n_perm}** random label permutations (seed **{seed}**). The "
        "enrichment z-score is `(observed - mean_null) / sd_null`.\n\n"
        f"| Metric | Value |\n| --- | --- |\n"
        f"| Cells | {n} |\n| Cell types | {n_types} |\n"
        f"| Graph edges | {len(edges)} |\n| Permutations | {n_perm} |\n"
    )
    if top is not None:
        research_log += (
            f"| Top pair | {top['typeA']}–{top['typeB']} |\n"
            f"| Top z-score | {top['zscore']:.3g} |\n"
        )

    return {
        "status": "success",
        "analysis": analysis,
        "typeNames": type_names,
        "zscore": zmat,
        "observed": obsmat,
        "pairs": enriched,
        "nCells": n,
        "nTypes": n_types,
        "nEdges": int(len(edges)),
        "k": k_eff,
        "nPermutations": n_perm,
        "seed": seed,
        "researchLog": research_log,
    }


# --------------------------------------------------------------------------- #
# Task 2 — co-occurrence across distance bins
# --------------------------------------------------------------------------- #
def task_cooccurrence(p):
    try:
        import numpy as np
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"cooccurrence requires numpy: {e}", status="unavailable")
    try:
        from scipy.spatial import cKDTree
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"cooccurrence requires scipy: {e}", status="unavailable")

    X, lab, type_names = _load_coords_labels(np, p)
    n = X.shape[0]
    if n < 3:
        _fail("Need at least 3 cells.")
    type_index = {t: i for i, t in enumerate(type_names)}
    codes = np.array([type_index[t] for t in lab], dtype=int)
    n_types = len(type_names)

    # Distance bins.
    edges_in = p.get("distanceBins")
    if edges_in is not None:
        try:
            bin_edges = np.asarray(edges_in, float)
        except Exception as e:
            _fail(f"`distanceBins` must be numeric: {e}")
        if bin_edges.ndim != 1 or bin_edges.size < 2 or np.any(np.diff(bin_edges) <= 0):
            _fail("`distanceBins` must be a strictly increasing 1D array of edges.")
    else:
        try:
            n_bins = int(p.get("nBins", 10))
        except Exception:
            _fail("`nBins` must be an integer.")
        if n_bins < 2:
            _fail("`nBins` must be >= 2.")
        # Max distance defaults to half the coordinate diagonal (interior support).
        span = float(np.linalg.norm(X.max(axis=0) - X.min(axis=0)))
        max_d = float(p.get("maxDistance", span / 2.0))
        if max_d <= 0:
            _fail("`maxDistance` must be > 0.")
        bin_edges = np.linspace(0.0, max_d, n_bins + 1)

    tree = cKDTree(X)
    global_freq = np.array([np.mean(codes == t) for t in range(n_types)])

    # For each distance bin, P(type=t | within that annulus of a center type c).
    n_intervals = bin_edges.size - 1
    # counts[c, t, b] = number of (center c, neighbor t) pairs in bin b.
    counts = np.zeros((n_types, n_types, n_intervals), dtype=float)
    for b in range(n_intervals):
        lo, hi = bin_edges[b], bin_edges[b + 1]
        # Pairs within hi minus pairs within lo = pairs in the annulus (lo, hi].
        pairs_hi = tree.query_pairs(hi, output_type="ndarray")
        pairs_lo = tree.query_pairs(lo, output_type="ndarray") if lo > 0 else np.empty((0, 2), int)
        lo_set = set(map(tuple, pairs_lo.tolist()))
        for a, c in pairs_hi.tolist():
            if (a, c) in lo_set:
                continue
            ta, tc = codes[a], codes[c]
            # symmetric: each endpoint acts as a center for the other.
            counts[ta, tc, b] += 1
            counts[tc, ta, b] += 1

    ratio = np.ones((n_types, n_types, n_intervals), dtype=float)
    for c in range(n_types):
        for b in range(n_intervals):
            total = counts[c, :, b].sum()
            if total > 0:
                for t in range(n_types):
                    cond = counts[c, t, b] / total  # P(t | near c, bin b)
                    ratio[c, t, b] = cond / global_freq[t] if global_freq[t] > 0 else 0.0

    bins_out = [
        {"low": round(float(bin_edges[b]), 6), "high": round(float(bin_edges[b + 1]), 6)}
        for b in range(n_intervals)
    ]
    ratio_out = {
        type_names[c]: {
            type_names[t]: [round(float(ratio[c, t, b]), 6) for b in range(n_intervals)]
            for t in range(n_types)
        }
        for c in range(n_types)
    }

    analysis = (
        f"Co-occurrence ratios over {n} cells / {n_types} type(s) across "
        f"{n_intervals} distance bin(s). ratio[c][t][b] = P(type=t within bin b of "
        f"a type-c cell) / P(type=t); >1 = enrichment near that center type."
    )
    research_log = (
        "# Cell-type co-occurrence across distance\n\n"
        f"For **{n}** cells and **{n_intervals}** distance annuli, the conditional "
        "probability of encountering each cell type within a distance band of a "
        "center type was divided by that type's global frequency. A ratio above 1 "
        "at short distances indicates spatial attraction/clustering; below 1 "
        "indicates avoidance.\n\n"
        f"| Metric | Value |\n| --- | --- |\n| Cells | {n} |\n"
        f"| Types | {n_types} |\n| Distance bins | {n_intervals} |\n"
    )

    return {
        "status": "success",
        "analysis": analysis,
        "typeNames": type_names,
        "bins": bins_out,
        "ratio": ratio_out,
        "globalFrequency": {type_names[t]: round(float(global_freq[t]), 6) for t in range(n_types)},
        "nCells": n,
        "nTypes": n_types,
        "researchLog": research_log,
    }


# --------------------------------------------------------------------------- #
# Task 3 — infiltration score
# --------------------------------------------------------------------------- #
def task_infiltration_score(p):
    try:
        import numpy as np
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"infiltration_score requires numpy: {e}", status="unavailable")
    try:
        from scipy.spatial import cKDTree
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"infiltration_score requires scipy: {e}", status="unavailable")

    X, lab, type_names = _load_coords_labels(np, p)
    source = p.get("source")
    target = p.get("target")
    if source is None or target is None:
        _fail("Provide `source` and `target` cell-type labels.")
    source = str(source)
    target = str(target)
    if source not in type_names:
        _fail(f"`source` type {source!r} not found. Available: {', '.join(type_names)}.")
    if target not in type_names:
        _fail(f"`target` type {target!r} not found. Available: {', '.join(type_names)}.")
    try:
        radius = float(p.get("radius"))
    except Exception:
        _fail("Provide a numeric `radius` (contact/infiltration distance).")
    if radius <= 0:
        _fail("`radius` must be > 0.")

    lab_arr = np.array(lab)
    src_mask = lab_arr == source
    tgt_mask = lab_arr == target
    n_src = int(np.sum(src_mask))
    n_tgt = int(np.sum(tgt_mask))
    if n_src == 0 or n_tgt == 0:
        _fail("Both source and target must have at least one cell.")

    src_pts = X[src_mask]
    tgt_pts = X[tgt_mask]
    src_tree = cKDTree(src_pts)
    # A target cell is "infiltrating" if any source cell is within `radius`.
    dists, _ = src_tree.query(tgt_pts, k=1)
    infiltrating = int(np.sum(dists <= radius))
    infiltration_fraction = infiltrating / n_tgt

    # Mean number of source cells within radius of each target (contact density).
    neighbor_counts = src_tree.query_ball_point(tgt_pts, r=radius)
    mean_contacts = float(np.mean([len(c) for c in neighbor_counts]))

    analysis = (
        f"Infiltration of '{target}' into '{source}' at radius {radius:g}: "
        f"{infiltrating}/{n_tgt} target cells ({infiltration_fraction:.3g}) lie "
        f"within {radius:g} of a source cell; mean {mean_contacts:.3g} source "
        f"contacts per target cell."
    )
    research_log = (
        "# Infiltration score\n\n"
        f"Of **{n_tgt}** '{target}' cells, those with at least one '{source}' cell "
        f"within a radius of **{radius:g}** were counted as infiltrating (nearest-"
        "source distance via a KD-tree).\n\n"
        f"| Metric | Value |\n| --- | --- |\n"
        f"| Source '{source}' cells | {n_src} |\n"
        f"| Target '{target}' cells | {n_tgt} |\n"
        f"| Infiltrating target cells | {infiltrating} |\n"
        f"| Infiltration fraction | {infiltration_fraction:.4g} |\n"
        f"| Mean source contacts / target | {mean_contacts:.4g} |\n"
    )

    return {
        "status": "success",
        "analysis": analysis,
        "source": source,
        "target": target,
        "radius": radius,
        "nSource": n_src,
        "nTarget": n_tgt,
        "infiltratingCells": infiltrating,
        "infiltrationFraction": round(infiltration_fraction, 8),
        "meanSourceContactsPerTarget": round(mean_contacts, 8),
        "researchLog": research_log,
    }


# --------------------------------------------------------------------------- #
# Task 4 — neighbor composition
# --------------------------------------------------------------------------- #
def task_neighbor_composition(p):
    try:
        import numpy as np
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"neighbor_composition requires numpy: {e}", status="unavailable")
    try:
        from scipy.spatial import cKDTree  # noqa: F401
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"neighbor_composition requires scipy: {e}", status="unavailable")

    X, lab, type_names = _load_coords_labels(np, p)
    n = X.shape[0]
    if n < 3:
        _fail("Need at least 3 cells.")
    try:
        k = int(p.get("k", 6))
    except Exception:
        _fail("`k` must be an integer.")
    if k < 1:
        _fail("`k` must be >= 1.")

    type_index = {t: i for i, t in enumerate(type_names)}
    codes = np.array([type_index[t] for t in lab], dtype=int)
    n_types = len(type_names)

    from scipy.spatial import cKDTree as _KD
    k_eff = min(k, n - 1)
    tree = _KD(X)
    _dist, idx = tree.query(X, k=k_eff + 1)
    if idx.ndim == 1:
        idx = idx.reshape(n, 1)

    # For each center type, sum the neighbor-type counts across its cells.
    comp = np.zeros((n_types, n_types), dtype=float)
    per_type_cells = np.zeros(n_types, dtype=int)
    for i in range(n):
        ci = codes[i]
        per_type_cells[ci] += 1
        for j in idx[i]:
            j = int(j)
            if j == i:
                continue
            comp[ci, codes[j]] += 1
    # Normalize each center-type row to a composition fraction.
    composition = {}
    for c in range(n_types):
        row_total = comp[c, :].sum()
        if row_total > 0:
            frac = comp[c, :] / row_total
        else:
            frac = np.zeros(n_types)
        composition[type_names[c]] = {
            type_names[t]: round(float(frac[t]), 6) for t in range(n_types)
        }

    analysis = (
        f"Neighbor composition over {n} cells / {n_types} type(s) on a k={k_eff} "
        f"nearest-neighbor graph: for each center type, the average fraction of "
        f"each cell type among its neighbors."
    )
    research_log = (
        "# Neighbor composition profile\n\n"
        f"For each of **{n_types}** center cell types, the neighbor labels of its "
        f"cells (k={k_eff} nearest neighbors each) were pooled and normalized to a "
        "composition vector. A high self-fraction indicates homotypic clustering.\n\n"
        f"| Metric | Value |\n| --- | --- |\n| Cells | {n} |\n"
        f"| Types | {n_types} |\n| k | {k_eff} |\n"
    )

    return {
        "status": "success",
        "analysis": analysis,
        "typeNames": type_names,
        "composition": composition,
        "cellsPerType": {type_names[t]: int(per_type_cells[t]) for t in range(n_types)},
        "nCells": n,
        "nTypes": n_types,
        "k": k_eff,
        "researchLog": research_log,
    }


# --------------------------------------------------------------------------- #
# Dispatch
# --------------------------------------------------------------------------- #
TASKS = {
    "neighborhood_enrichment": task_neighborhood_enrichment,
    "cooccurrence": task_cooccurrence,
    "infiltration_score": task_infiltration_score,
    "neighbor_composition": task_neighbor_composition,
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
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
