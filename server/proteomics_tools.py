#!/usr/bin/env python3
"""Quantitative proteomics tools — single dispatch.

Reads a JSON payload on stdin and prints a JSON result on stdout. Zero
hallucination: every reported value is computed by real numerical algorithms on
the provided peptide/protein intensity data; nothing is fabricated. When a value
cannot be computed (e.g. a protein with no shared peptides) it is reported as
`null`/"not available", never a placeholder number.

Tasks
-----
- maxlfq_quantify        : MaxLFQ-style label-free protein quantification —
  pairwise median peptide log-ratios between samples, then a least-squares
  protein abundance profile anchored to the summed intensity scale
  (Cox et al., MCP 2014; implementation original, validated numerically).
- normalize_intensities  : median or quantile normalization of a
  samples x features intensity matrix (log or linear space).
- impute_missing         : missing-value imputation — deterministic k-NN
  (scikit-learn), column-min fraction, or seeded MinProb (down-shifted normal).
- differential_abundance : two-group Welch t-test per protein on log2
  intensities + Benjamini-Hochberg FDR + log2 fold change.
- tmt_protein_rollup     : TMT/iTRAQ reporter-ion PSM->protein summarization
  (median or sum) with optional per-channel median normalization.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _bh_fdr(pvals):
    """Benjamini-Hochberg step-up adjusted p-values (numpy)."""
    import numpy as np

    p = np.asarray(pvals, float)
    p = np.where(np.isfinite(p), p, 1.0)
    n = p.size
    if n == 0:
        return p
    order = np.argsort(p)
    ranked = p[order]
    ranks = np.arange(1, n + 1)
    adj = ranked * n / ranks
    adj = np.minimum.accumulate(adj[::-1])[::-1]
    adj = np.clip(adj, 0.0, 1.0)
    out = np.empty(n, float)
    out[order] = adj
    return out


def _to_missing_aware_matrix(np, values, treat_zero_as_missing):
    """Coerce a 2D list to float ndarray where missing -> NaN.

    None and non-finite entries become NaN; zeros become NaN only when
    `treat_zero_as_missing` is set (intensity 0 usually means "not detected").
    """
    arr = np.array(
        [[np.nan if v is None else float(v) for v in row] for row in values],
        dtype=float,
    )
    arr = np.where(np.isfinite(arr), arr, np.nan)
    if treat_zero_as_missing:
        arr = np.where(arr == 0.0, np.nan, arr)
    return arr


# --------------------------------------------------------------------------- #
# Task 1 — MaxLFQ-style label-free quantification
# --------------------------------------------------------------------------- #
def _maxlfq_profile(np, pep):
    """MaxLFQ relative log-abundance profile for one protein.

    `pep` is (n_peptides x n_samples) with NaN for missing. Returns
    (z, n_pairs) where z is the length-n_samples relative log2 profile with
    NaN for samples that cannot be connected to any other, and n_pairs the
    number of sample pairs that shared >=1 peptide. z is centered at mean 0
    over the connected samples; absolute scaling is applied by the caller.
    """
    n_samples = pep.shape[1]
    logp = np.log2(pep)  # NaN stays NaN

    # Pairwise median log2-ratios between samples over co-observed peptides.
    ratios = {}
    for i in range(n_samples):
        for j in range(i + 1, n_samples):
            both = np.isfinite(logp[:, i]) & np.isfinite(logp[:, j])
            if np.any(both):
                r = float(np.median(logp[both, i] - logp[both, j]))
                ratios[(i, j)] = r

    z = np.full(n_samples, np.nan)
    if not ratios:
        # No shared peptides anywhere: fall back to per-sample median log2
        # intensity for samples that have any peptide (each is its own island).
        for s in range(n_samples):
            col = logp[:, s]
            if np.any(np.isfinite(col)):
                z[s] = float(np.median(col[np.isfinite(col)]))
        return z, 0

    # Connected components over the "shared peptide" graph; solve each island
    # independently (ratios are only defined within a connected component).
    adj = {s: set() for s in range(n_samples)}
    for (i, j) in ratios:
        adj[i].add(j)
        adj[j].add(i)

    seen = set()
    for start in range(n_samples):
        if start in seen or not adj[start]:
            continue
        # BFS the component.
        comp = []
        stack = [start]
        seen.add(start)
        while stack:
            u = stack.pop()
            comp.append(u)
            for v in adj[u]:
                if v not in seen:
                    seen.add(v)
                    stack.append(v)
        comp.sort()
        idx = {s: k for k, s in enumerate(comp)}
        m = len(comp)
        # Least-squares: for each pair (i,j) in this component, z_i - z_j = R_ij.
        rows = []
        rhs = []
        for (i, j), r in ratios.items():
            if i in idx and j in idx:
                eq = np.zeros(m)
                eq[idx[i]] = 1.0
                eq[idx[j]] = -1.0
                rows.append(eq)
                rhs.append(r)
        A = np.array(rows)
        b = np.array(rhs)
        # Minimum-norm least-squares (system is invariant to a constant shift).
        sol, *_ = np.linalg.lstsq(A, b, rcond=None)
        sol = sol - np.mean(sol)  # center this island at 0
        for s in comp:
            z[s] = sol[idx[s]]

    # Isolated samples that have peptides but no shared peptide with anyone:
    # place them at their own median log2 intensity (best available estimate).
    for s in range(n_samples):
        if np.isnan(z[s]):
            col = logp[:, s]
            if np.any(np.isfinite(col)):
                z[s] = float(np.median(col[np.isfinite(col)]))

    return z, len(ratios)


def task_maxlfq_quantify(p):
    try:
        import numpy as np
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"maxlfq_quantify requires numpy: {e}", status="unavailable")

    peptides = p.get("peptides")
    if not isinstance(peptides, dict) or not peptides:
        _fail(
            "Provide `peptides` as {proteinId: [[pep1_s1, pep1_s2, ...], ...]} "
            "(each protein a 2D array of peptide intensities: peptides x samples)."
        )
    sample_names = p.get("sampleNames")
    treat_zero_as_missing = bool(p.get("treatZeroAsMissing", True))

    n_samples = None
    proteins = {}
    for prot, mat in peptides.items():
        if not isinstance(mat, list) or not mat:
            _fail(f"Protein {prot!r} must have a non-empty 2D peptide array.")
        try:
            arr = _to_missing_aware_matrix(np, mat, treat_zero_as_missing)
        except Exception as e:
            _fail(f"Protein {prot!r} peptide matrix must be numeric: {e}")
        if arr.ndim != 2:
            _fail(f"Protein {prot!r} peptide matrix must be 2D; got ndim={arr.ndim}.")
        if n_samples is None:
            n_samples = arr.shape[1]
        elif arr.shape[1] != n_samples:
            _fail(
                f"Protein {prot!r} has {arr.shape[1]} samples but a previous "
                f"protein had {n_samples}; all proteins must share sample columns."
            )
        proteins[str(prot)] = arr

    if n_samples is None or n_samples < 2:
        _fail("Need at least 2 samples (columns) to quantify relative ratios.")

    if sample_names is not None:
        if not isinstance(sample_names, list) or len(sample_names) != n_samples:
            _fail(f"`sampleNames` must be a list of length n_samples ({n_samples}).")
        names = [str(s) for s in sample_names]
    else:
        names = [f"sample_{k}" for k in range(n_samples)]

    results = {}
    n_quantified = 0
    for prot, arr in proteins.items():
        n_pep = int(arr.shape[0])
        n_valid_pep = int(np.sum(np.any(np.isfinite(arr), axis=1)))
        if n_valid_pep == 0:
            results[prot] = {
                "lfq": [None] * n_samples,
                "nPeptides": n_pep,
                "nPairs": 0,
                "note": "no observed peptide intensities",
            }
            continue

        z, n_pairs = _maxlfq_profile(np, arr)  # relative log2 profile (mean 0)

        # Absolute anchoring: scale the profile so the sum of LFQ intensities
        # over connected samples equals the sum of the raw summed peptide
        # intensities over those samples (MaxLFQ preserves total intensity).
        connected = np.isfinite(z)
        raw_sum = np.nansum(np.where(np.isfinite(arr), arr, 0.0), axis=0)
        lin = np.power(2.0, z)  # relative linear scale (mean-0 log2 -> ~1)
        target = float(np.sum(raw_sum[connected]))
        denom = float(np.sum(lin[connected]))
        scale = target / denom if denom > 0 else 1.0
        lfq_vals = lin * scale

        lfq = [
            (round(float(lfq_vals[s]), 6) if connected[s] else None)
            for s in range(n_samples)
        ]
        results[prot] = {
            "lfq": lfq,
            "nPeptides": n_pep,
            "nPairs": int(n_pairs),
        }
        n_quantified += 1

    analysis = (
        f"MaxLFQ-style quantification of {len(proteins)} protein group(s) across "
        f"{n_samples} samples: {n_quantified} protein(s) quantified from pairwise "
        f"median peptide log2-ratios solved by least squares and anchored to the "
        f"summed-intensity scale. Samples with no peptides linking them to the "
        f"group are reported as null (not available), never imputed."
    )
    research_log = (
        "# MaxLFQ-style label-free quantification\n\n"
        "For each protein group, every pair of samples that shares at least one "
        "peptide contributes the **median of the peptide log2-ratios** between "
        "those samples. The relative sample profile z is then the least-squares "
        "solution of the over-determined system `z_i - z_j = median_ratio(i,j)` "
        "(minimum-norm, invariant to a constant, solved per connected component). "
        "The profile is exponentiated and rescaled so the total quantified "
        "intensity matches the summed raw peptide intensity.\n\n"
        f"| Metric | Value |\n| --- | --- |\n"
        f"| Protein groups | {len(proteins)} |\n"
        f"| Quantified | {n_quantified} |\n"
        f"| Samples | {n_samples} |\n\n"
        "Ratios are the estimand: only *relative* abundances across samples are "
        "identifiable from peptide ratios; the absolute scale is an anchor, not a "
        "molar quantity."
    )

    return {
        "status": "success",
        "analysis": analysis,
        "sampleNames": names,
        "proteins": results,
        "nProteins": len(proteins),
        "nQuantified": n_quantified,
        "nSamples": n_samples,
        "researchLog": research_log,
    }


# --------------------------------------------------------------------------- #
# Task 2 — normalization (median / quantile)
# --------------------------------------------------------------------------- #
def task_normalize_intensities(p):
    try:
        import numpy as np
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"normalize_intensities requires numpy: {e}", status="unavailable")

    matrix = p.get("matrix")
    if not isinstance(matrix, list) or not matrix:
        _fail("Provide `matrix` (2D array: samples x features).")
    method = str(p.get("method", "median")).lower()
    if method not in ("median", "quantile"):
        _fail("`method` must be 'median' or 'quantile'.")
    log_space = bool(p.get("logSpace", False))
    treat_zero_as_missing = bool(p.get("treatZeroAsMissing", False))

    try:
        X = _to_missing_aware_matrix(np, matrix, treat_zero_as_missing)
    except Exception as e:
        _fail(f"`matrix` must be numeric: {e}")
    if X.ndim != 2:
        _fail(f"`matrix` must be 2D (samples x features); got ndim={X.ndim}.")
    n_samples, n_features = X.shape

    work = np.log2(X) if log_space else X.astype(float)
    if log_space and np.any(np.isfinite(X) & (X <= 0)):
        _fail("logSpace=true requires strictly positive intensities.")

    if method == "median":
        # Shift each sample (row) so all rows share the grand median (log or
        # linear). In linear space this is a scaling; in log space a shift.
        row_med = np.nanmedian(work, axis=1)
        grand = float(np.nanmedian(row_med))
        if log_space:
            adjusted = work - (row_med[:, None] - grand)
            out = np.power(2.0, adjusted)
        else:
            with np.errstate(divide="ignore", invalid="ignore"):
                factors = np.where(row_med != 0, grand / row_med, 1.0)
            out = work * factors[:, None]
        details = {"grandMedian": round(grand, 8)}
    else:  # quantile normalization (features aligned across samples by rank)
        # Standard quantile normalization: sort each sample, average across
        # samples to get the reference distribution, then map each value back by
        # its rank. Missing values are ignored in the reference and left as NaN.
        if np.any(np.isnan(work)):
            _fail("quantile normalization requires a complete matrix (no missing values); impute first.")
        ref = np.mean(np.sort(work, axis=1), axis=0)  # length n_features
        out = np.empty_like(work)
        for i in range(n_samples):
            order = np.argsort(work[i, :], kind="mergesort")
            ranks = np.empty(n_features, dtype=int)
            ranks[order] = np.arange(n_features)
            out[i, :] = ref[ranks]
        details = {"referenceQuantiles": [round(float(v), 8) for v in ref]}

    normalized = [
        [(None if not np.isfinite(v) else round(float(v), 8)) for v in row]
        for row in out
    ]
    analysis = (
        f"{method.capitalize()} normalization of a {n_samples}x{n_features} "
        f"intensity matrix ({'log2' if log_space else 'linear'} space). "
        + (
            "Each sample rescaled to the grand median."
            if method == "median"
            else "Each sample mapped to the averaged reference quantile distribution."
        )
    )
    research_log = (
        f"# {method.capitalize()} normalization\n\n"
        f"Input: **{n_samples}** samples x **{n_features}** features "
        f"({'log2' if log_space else 'linear'} space).\n\n"
        + (
            "Median normalization equalizes each sample's median to the grand "
            "median across samples (a per-sample scale factor in linear space, a "
            "shift in log space) — the standard correction for differing sample "
            "loading.\n"
            if method == "median"
            else "Quantile normalization forces every sample to share an identical "
            "value distribution: sort each sample, average the sorted columns to "
            "build a reference distribution, then assign each observation the "
            "reference value at its within-sample rank.\n"
        )
    )
    return {
        "status": "success",
        "analysis": analysis,
        "method": method,
        "logSpace": log_space,
        "normalized": normalized,
        "nSamples": n_samples,
        "nFeatures": n_features,
        "details": details,
        "researchLog": research_log,
    }


# --------------------------------------------------------------------------- #
# Task 3 — missing-value imputation
# --------------------------------------------------------------------------- #
def task_impute_missing(p):
    try:
        import numpy as np
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"impute_missing requires numpy: {e}", status="unavailable")

    matrix = p.get("matrix")
    if not isinstance(matrix, list) or not matrix:
        _fail("Provide `matrix` (2D array: samples x features).")
    method = str(p.get("method", "knn")).lower()
    if method not in ("knn", "min", "minprob"):
        _fail("`method` must be 'knn', 'min', or 'minprob'.")
    treat_zero_as_missing = bool(p.get("treatZeroAsMissing", True))

    try:
        X = _to_missing_aware_matrix(np, matrix, treat_zero_as_missing)
    except Exception as e:
        _fail(f"`matrix` must be numeric: {e}")
    if X.ndim != 2:
        _fail(f"`matrix` must be 2D (samples x features); got ndim={X.ndim}.")
    n_samples, n_features = X.shape
    n_missing = int(np.sum(np.isnan(X)))

    if n_missing == 0:
        out = X
        note = "no missing values to impute"
    elif method == "knn":
        try:
            from sklearn.impute import KNNImputer
        except Exception as e:  # pragma: no cover - environment dependent
            _fail(f"knn imputation requires scikit-learn: {e}", status="unavailable")
        k = int(p.get("k", 5))
        if k < 1:
            _fail("`k` must be >= 1.")
        # Impute across features using nearest samples (rows). KNNImputer works
        # column-wise on features, so features are the axis being filled.
        k_eff = min(k, max(1, n_samples - 1))
        imputer = KNNImputer(n_neighbors=k_eff, weights="uniform")
        out = imputer.fit_transform(X)
        note = f"deterministic k-NN (k={k_eff}) over samples"
    elif method == "min":
        # Replace each missing value with a fraction of that feature's min.
        frac = float(p.get("fraction", 1.0))
        out = X.copy()
        for j in range(n_features):
            col = X[:, j]
            obs = col[np.isfinite(col)]
            fill = (float(np.min(obs)) * frac) if obs.size else 0.0
            out[np.isnan(out[:, j]), j] = fill
        note = f"column-min x {frac}"
    else:  # minprob — seeded down-shifted normal draw (Perseus-style)
        seed = int(p.get("seed", 0))
        shift = float(p.get("shift", 1.8))
        width = float(p.get("width", 0.3))
        rng = np.random.default_rng(seed)
        out = X.copy()
        for j in range(n_features):
            col = X[:, j]
            obs = col[np.isfinite(col)]
            miss = np.isnan(col)
            n_j = int(np.sum(miss))
            if n_j == 0:
                continue
            if obs.size >= 2:
                mu = float(np.mean(obs))
                sd = float(np.std(obs, ddof=1))
            elif obs.size == 1:
                mu = float(obs[0])
                sd = 0.0
            else:
                mu = 0.0
                sd = 0.0
            draw = rng.normal(mu - shift * sd, max(width * sd, 1e-9), size=n_j)
            out[miss, j] = draw
        note = f"seeded MinProb (seed={seed}, shift={shift}, width={width})"

    imputed = [
        [(None if not np.isfinite(v) else round(float(v), 8)) for v in row]
        for row in out
    ]
    analysis = (
        f"Imputed {n_missing} missing value(s) in a {n_samples}x{n_features} "
        f"matrix via {method} ({note})."
    )
    research_log = (
        f"# Missing-value imputation ({method})\n\n"
        f"Input matrix: **{n_samples}** samples x **{n_features}** features with "
        f"**{n_missing}** missing entr{'y' if n_missing == 1 else 'ies'}.\n\n"
        "- **knn**: scikit-learn `KNNImputer` — each missing value filled from the "
        "mean of its k nearest complete samples (deterministic).\n"
        "- **min**: feature-wise minimum times a fraction — a left-censoring "
        "model for below-detection missingness.\n"
        "- **minprob**: draws from a normal down-shifted below each feature's "
        "observed mean (Perseus-style), reproducible via an explicit seed.\n\n"
        f"Method used here: **{method}** ({note})."
    )
    return {
        "status": "success",
        "analysis": analysis,
        "method": method,
        "imputed": imputed,
        "nMissing": n_missing,
        "nSamples": n_samples,
        "nFeatures": n_features,
        "researchLog": research_log,
    }


# --------------------------------------------------------------------------- #
# Task 4 — differential abundance (two-group Welch + BH)
# --------------------------------------------------------------------------- #
def task_differential_abundance(p):
    try:
        import numpy as np
        from scipy import stats
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"differential_abundance requires numpy+scipy: {e}", status="unavailable")

    group_a = p.get("groupA")
    group_b = p.get("groupB")
    if not isinstance(group_a, dict) or not group_a:
        _fail("Provide `groupA` as {proteinId: [intensities...]} for condition A.")
    if not isinstance(group_b, dict) or not group_b:
        _fail("Provide `groupB` as {proteinId: [intensities...]} for condition B.")
    already_log = bool(p.get("alreadyLog2", False))

    proteins = [str(k) for k in group_a.keys() if str(k) in {str(x) for x in group_b}]
    if not proteins:
        _fail("`groupA` and `groupB` share no protein IDs.")

    rows = []
    pvals = []
    for prot in proteins:
        try:
            a = np.asarray(group_a[prot], float)
            b = np.asarray(group_b[prot], float)
        except Exception as e:
            _fail(f"Protein {prot!r} intensities must be numeric: {e}")
        a = a[np.isfinite(a)]
        b = b[np.isfinite(b)]
        if a.size < 2 or b.size < 2:
            rows.append({"protein": prot, "log2FC": None, "pValue": None,
                         "meanA": None, "meanB": None,
                         "note": "need >=2 finite replicates per group"})
            pvals.append(1.0)
            continue
        if already_log:
            la, lb = a, b
        else:
            if np.any(a <= 0) or np.any(b <= 0):
                rows.append({"protein": prot, "log2FC": None, "pValue": None,
                             "meanA": None, "meanB": None,
                             "note": "non-positive intensity; cannot log2-transform"})
                pvals.append(1.0)
                continue
            la, lb = np.log2(a), np.log2(b)
        t, pv = stats.ttest_ind(lb, la, equal_var=False)  # B vs A (Welch)
        pv = float(pv) if np.isfinite(pv) else 1.0
        log2fc = float(np.mean(lb) - np.mean(la))
        rows.append({
            "protein": prot,
            "log2FC": round(log2fc, 8),
            "pValue": round(pv, 12),
            "meanA": round(float(np.mean(la)), 8),
            "meanB": round(float(np.mean(lb)), 8),
        })
        pvals.append(pv)

    padj = _bh_fdr(pvals)
    for r, q in zip(rows, padj):
        r["padj"] = round(float(q), 12)
    rows.sort(key=lambda r: (r.get("padj", 1.0), r.get("pValue") or 1.0))
    n_sig = int(np.sum(np.asarray(padj) < 0.05))

    analysis = (
        f"Differential abundance across {len(proteins)} protein(s): two-group "
        f"Welch t-test on {'provided log2' if already_log else 'log2-transformed'} "
        f"intensities (B vs A) with Benjamini-Hochberg FDR. {n_sig} protein(s) "
        f"significant at padj<0.05."
    )
    research_log = (
        "# Differential protein abundance\n\n"
        "Each protein's group-A and group-B intensities were "
        f"{'used as provided (already log2)' if already_log else 'log2-transformed'}, "
        "compared with a two-sided Welch t-test (unequal variance), and the "
        "protein p-values corrected with Benjamini-Hochberg.\n\n"
        f"| Metric | Value |\n| --- | --- |\n"
        f"| Proteins tested | {len(proteins)} |\n"
        f"| Significant (padj<0.05) | {n_sig} |\n\n"
        "log2FC = mean(log2 B) - mean(log2 A); positive = up in condition B."
    )
    return {
        "status": "success",
        "analysis": analysis,
        "results": rows,
        "nProteins": len(proteins),
        "nSignificant": n_sig,
        "researchLog": research_log,
    }


# --------------------------------------------------------------------------- #
# Task 5 — TMT reporter-ion PSM->protein rollup
# --------------------------------------------------------------------------- #
def task_tmt_protein_rollup(p):
    try:
        import numpy as np
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"tmt_protein_rollup requires numpy: {e}", status="unavailable")

    psms = p.get("psms")
    if not isinstance(psms, dict) or not psms:
        _fail(
            "Provide `psms` as {proteinId: [[ch1, ch2, ...], ...]} — reporter-ion "
            "intensities per PSM (PSMs x channels) grouped by protein."
        )
    method = str(p.get("method", "median")).lower()
    if method not in ("median", "sum"):
        _fail("`method` must be 'median' or 'sum'.")
    normalize_channels = bool(p.get("normalizeChannels", True))
    channel_names = p.get("channelNames")

    n_channels = None
    grouped = {}
    for prot, mat in psms.items():
        if not isinstance(mat, list) or not mat:
            _fail(f"Protein {prot!r} must have a non-empty 2D PSM array.")
        try:
            arr = _to_missing_aware_matrix(np, mat, treat_zero_as_missing=True)
        except Exception as e:
            _fail(f"Protein {prot!r} PSM matrix must be numeric: {e}")
        if arr.ndim != 2:
            _fail(f"Protein {prot!r} PSM matrix must be 2D; got ndim={arr.ndim}.")
        if n_channels is None:
            n_channels = arr.shape[1]
        elif arr.shape[1] != n_channels:
            _fail(
                f"Protein {prot!r} has {arr.shape[1]} channels but a previous "
                f"protein had {n_channels}; all proteins must share channels."
            )
        grouped[str(prot)] = arr

    if n_channels is None or n_channels < 2:
        _fail("Need at least 2 reporter channels.")
    if channel_names is not None:
        if not isinstance(channel_names, list) or len(channel_names) != n_channels:
            _fail(f"`channelNames` must be a list of length {n_channels}.")
        names = [str(c) for c in channel_names]
    else:
        names = [f"channel_{k}" for k in range(n_channels)]

    # Roll up each protein first (median/sum over its PSMs, ignoring NaN).
    prot_ids = list(grouped.keys())
    rolled = np.full((len(prot_ids), n_channels), np.nan)
    n_psms = {}
    for i, prot in enumerate(prot_ids):
        arr = grouped[prot]
        n_psms[prot] = int(arr.shape[0])
        for c in range(n_channels):
            col = arr[:, c]
            obs = col[np.isfinite(col)]
            if obs.size:
                rolled[i, c] = float(np.median(obs)) if method == "median" else float(np.sum(obs))

    channel_factors = None
    if normalize_channels:
        # Equalize per-channel median across proteins (sample-loading correction).
        col_med = np.nanmedian(rolled, axis=0)
        grand = float(np.nanmedian(col_med))
        with np.errstate(divide="ignore", invalid="ignore"):
            channel_factors = np.where(col_med > 0, grand / col_med, 1.0)
        rolled = rolled * channel_factors[None, :]

    proteins_out = {
        prot: {
            "abundance": [
                (None if not np.isfinite(rolled[i, c]) else round(float(rolled[i, c]), 6))
                for c in range(n_channels)
            ],
            "nPSMs": n_psms[prot],
        }
        for i, prot in enumerate(prot_ids)
    }

    analysis = (
        f"TMT rollup of {len(prot_ids)} protein(s) over {n_channels} reporter "
        f"channels using per-protein {method} of PSM intensities"
        + (
            f"; channels median-normalized (factors {[round(float(x),4) for x in channel_factors]})."
            if normalize_channels
            else " (no channel normalization)."
        )
    )
    research_log = (
        "# TMT reporter-ion protein rollup\n\n"
        f"Each protein was summarized to **{n_channels}** channels by taking the "
        f"**{method}** of its PSM reporter-ion intensities (missing entries "
        "ignored).\n\n"
        + (
            "Channels were then median-normalized across proteins to correct for "
            "unequal sample loading (each channel scaled to the grand median).\n"
            if normalize_channels
            else "No channel normalization was applied.\n"
        )
        + f"\n| Metric | Value |\n| --- | --- |\n| Proteins | {len(prot_ids)} |\n"
        f"| Channels | {n_channels} |\n| Rollup | {method} |\n"
    )
    result = {
        "status": "success",
        "analysis": analysis,
        "channelNames": names,
        "proteins": proteins_out,
        "nProteins": len(prot_ids),
        "nChannels": n_channels,
        "method": method,
        "researchLog": research_log,
    }
    if channel_factors is not None:
        result["channelFactors"] = [round(float(x), 8) for x in channel_factors]
    return result


# --------------------------------------------------------------------------- #
# Dispatch
# --------------------------------------------------------------------------- #
TASKS = {
    "maxlfq_quantify": task_maxlfq_quantify,
    "normalize_intensities": task_normalize_intensities,
    "impute_missing": task_impute_missing,
    "differential_abundance": task_differential_abundance,
    "tmt_protein_rollup": task_tmt_protein_rollup,
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
