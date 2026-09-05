#!/usr/bin/env python3
"""Gene regulatory network (GRN) inference — one dispatch, real methods.

Tasks (payload.task, EXACT clean names):
  genie3      Tree-based GRN inference (Huynh-Thu et al., PLoS ONE 2010).
              For each TARGET gene, a Random Forest regresses its expression on
              the other candidate regulator genes; the RF feature importances are
              read directly as regulator->target edge weights. Importances are
              normalised per target (they sum to 1 over a target's regulators),
              exactly as in the original GENIE3, so weights are comparable across
              targets.
  aracne_mi   Mutual-information network with Data Processing Inequality (DPI)
              pruning (Margolin et al., ARACNe, BMC Bioinformatics 2006). Pairwise
              MI is estimated with a k-NN estimator
              (sklearn.feature_selection.mutual_info_regression, symmetrised), an
              edge is kept when MI > miThreshold, then for every fully-connected
              triangle (i,j,k) the weakest of the three edges is removed when it is
              strictly below both other edges — the DPI test that removes indirect
              (mediated) associations such as X-Z in a chain X->Y->Z.

Every number is computed by numpy / scikit-learn on the real inputs; nothing is
fabricated. Reads JSON on stdin, prints JSON on stdout, single dispatch. Honest
'unavailable' if numpy / scikit-learn are missing.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _expression(p):
    """Parse `expression` (samples x genes) and `geneNames` (required)."""
    import numpy as np

    expr = p.get("expression")
    if not isinstance(expr, list) or not expr:
        _fail("Provide `expression` (2-D array: samples x genes).")
    try:
        X = np.asarray(expr, dtype=float)
    except Exception as e:
        _fail(f"`expression` is not a numeric 2-D array: {e}")
    if X.ndim != 2:
        _fail("`expression` must be a 2-D array (samples x genes).")
    if not np.all(np.isfinite(X)):
        _fail("`expression` contains non-finite entries.")
    n_samples, n_genes = X.shape
    if n_genes < 2:
        _fail("Need at least 2 genes.")
    if n_samples < 3:
        _fail("Need at least 3 samples.")

    names = p.get("geneNames")
    if not isinstance(names, list) or not names:
        _fail("Provide `geneNames` (list of gene names, required).")
    names = [str(g) for g in names]
    if len(names) != n_genes:
        _fail(
            f"`geneNames` length ({len(names)}) must match number of genes "
            f"({n_genes})."
        )
    if len(set(names)) != len(names):
        _fail("`geneNames` must be unique.")
    return X, names, n_samples, n_genes


def genie3(p):
    import numpy as np
    from sklearn.ensemble import RandomForestRegressor

    X, names, n_samples, n_genes = _expression(p)
    idx_of = {g: i for i, g in enumerate(names)}

    regs = p.get("regulators")
    if regs is None:
        reg_names = list(names)
    else:
        if not isinstance(regs, list) or not regs:
            _fail("`regulators`, if given, must be a non-empty list of gene names.")
        reg_names = [str(g) for g in regs]
        unknown = [g for g in reg_names if g not in idx_of]
        if unknown:
            _fail(f"`regulators` not found in geneNames: {unknown}.")
    reg_idx = [idx_of[g] for g in reg_names]

    try:
        top_edges = int(p.get("topEdges", 20))
    except Exception:
        _fail("`topEdges` must be an integer.")
    if top_edges < 1:
        _fail("`topEdges` must be >= 1.")
    try:
        n_estimators = int(p.get("nEstimators", 100))
    except Exception:
        _fail("`nEstimators` must be an integer.")
    if n_estimators < 1:
        _fail("`nEstimators` must be >= 1.")
    try:
        seed = int(p.get("seed", 0))
    except Exception:
        _fail("`seed` must be an integer.")

    all_edges = []
    scored_targets = 0
    for t in range(n_genes):
        # Candidate regulators for this target = regulators excluding the target.
        feats = [r for r in reg_idx if r != t]
        if not feats:
            continue
        rf = RandomForestRegressor(
            n_estimators=n_estimators, random_state=seed
        )
        rf.fit(X[:, feats], X[:, t])
        importances = np.asarray(rf.feature_importances_, dtype=float)
        # Per-target normalisation (GENIE3): importances sum to 1 over the
        # target's regulators (guard the degenerate all-zero case).
        total = float(importances.sum())
        if total > 0:
            weights = importances / total
        else:
            weights = importances
        scored_targets += 1
        for w, r in zip(weights, feats):
            all_edges.append(
                {
                    "regulator": names[r],
                    "target": names[t],
                    "weight": round(float(w), 8),
                }
            )

    if not all_edges:
        _fail("No regulator->target edges could be scored (need >=2 distinct genes).")

    all_edges.sort(key=lambda e: e["weight"], reverse=True)
    edges = all_edges[:top_edges]

    research_log = "\n".join(
        [
            "# GENIE3 — tree-based gene regulatory network inference",
            "",
            f"- Samples: **{n_samples}**   Genes: **{n_genes}**   "
            f"Candidate regulators: **{len(reg_idx)}**",
            f"- Model per target: **RandomForestRegressor** "
            f"(nEstimators={n_estimators}, seed={seed})",
            "- Edge weight regulator->target = the regulator's RF "
            "`feature_importances_` when predicting the target's expression.",
            "- **Per-target normalisation:** importances are divided by their sum "
            "so a target's incoming weights total 1 (original GENIE3 convention), "
            "making weights comparable across targets.",
            f"- Targets scored: **{scored_targets}**   "
            f"Total directed edges: **{len(all_edges)}**   "
            f"Reported (topEdges): **{len(edges)}**",
            "",
            "Reference: Huynh-Thu et al., \"Inferring Regulatory Networks from "
            "Expression Data Using Tree-Based Methods\", PLoS ONE 2010.",
        ]
    )

    return {
        "status": "success",
        "analysis": "GENIE3 tree-based gene regulatory network inference",
        "method": "RandomForestRegressor feature_importances_ per target",
        "nSamples": n_samples,
        "nGenes": n_genes,
        "regulators": reg_names,
        "nEstimators": n_estimators,
        "seed": seed,
        "targetsScored": scored_targets,
        "totalEdges": len(all_edges),
        "topEdges": len(edges),
        "normalization": (
            "per-target: feature importances divided by their sum so a target's "
            "incoming regulator weights total 1 (GENIE3 convention)"
        ),
        "edges": edges,
        "researchLog": research_log,
    }


def aracne_mi(p):
    import numpy as np
    from sklearn.feature_selection import mutual_info_regression

    X, names, n_samples, n_genes = _expression(p)

    try:
        mi_threshold = float(p.get("miThreshold", 0.0))
    except Exception:
        _fail("`miThreshold` must be a number.")
    try:
        seed = int(p.get("seed", 0))
    except Exception:
        _fail("`seed` must be an integer.")

    # --- Pairwise MI matrix (k-NN estimator, symmetrised) --------------------- #
    # mutual_info_regression(features, target) returns MI of each feature column
    # with the target. Running it once per gene-as-target and averaging the two
    # off-diagonal estimates gives a symmetric MI matrix.
    M = np.zeros((n_genes, n_genes), dtype=float)
    for j in range(n_genes):
        others = [c for c in range(n_genes) if c != j]
        mi = mutual_info_regression(
            X[:, others], X[:, j], random_state=seed
        )
        for k, c in enumerate(others):
            M[c, j] += float(mi[k])
    M = (M + M.T) / 2.0
    # MI is non-negative; clip tiny negative estimator noise to 0.
    M = np.clip(M, 0.0, None)

    # --- Candidate edges above threshold -------------------------------------- #
    present = set()
    for i in range(n_genes):
        for j in range(i + 1, n_genes):
            if M[i, j] > mi_threshold:
                present.add((i, j))

    # --- Data Processing Inequality pruning ----------------------------------- #
    # For every triangle (i,j,k) with all three edges present, remove the weakest
    # edge when it is strictly below both other edges (an indirect association).
    def _key(a, b):
        return (a, b) if a < b else (b, a)

    to_remove = set()
    for i in range(n_genes):
        for j in range(i + 1, n_genes):
            for k in range(j + 1, n_genes):
                e_ij, e_ik, e_jk = _key(i, j), _key(i, k), _key(j, k)
                if e_ij not in present or e_ik not in present or e_jk not in present:
                    continue
                mij, mik, mjk = M[i, j], M[i, k], M[j, k]
                # Identify the weakest of the three; prune it if strictly < both.
                trio = [(mij, e_ij), (mik, e_ik), (mjk, e_jk)]
                trio.sort(key=lambda t: t[0])
                weakest_val, weakest_edge = trio[0]
                if weakest_val < trio[1][0] and weakest_val < trio[2][0]:
                    to_remove.add(weakest_edge)

    retained = sorted(present - to_remove)

    edges = [
        {
            "geneA": names[i],
            "geneB": names[j],
            "mi": round(float(M[i, j]), 8),
        }
        for (i, j) in retained
    ]
    edges.sort(key=lambda e: e["mi"], reverse=True)

    research_log = "\n".join(
        [
            "# ARACNe — mutual-information network with DPI pruning",
            "",
            f"- Samples: **{n_samples}**   Genes: **{n_genes}**",
            "- MI estimator: **sklearn.feature_selection.mutual_info_regression** "
            f"(k-NN based), symmetrised, seed={seed}.",
            f"- Edge kept when MI > miThreshold (**{mi_threshold:g}**): "
            f"**{len(present)}** candidate edges.",
            "- **Data Processing Inequality:** for each triangle the weakest edge "
            "is removed when strictly below both others, dropping indirect "
            "(mediated) links such as X-Z in a chain X->Y->Z.",
            f"- Edges pruned by DPI: **{len(to_remove)}**   "
            f"Edges retained: **{len(retained)}**",
            "",
            "Reference: Margolin et al., \"ARACNE: An Algorithm for the "
            "Reconstruction of Gene Regulatory Networks in a Mammalian Cellular "
            "Context\", BMC Bioinformatics 2006.",
        ]
    )

    return {
        "status": "success",
        "analysis": "ARACNe mutual-information network with DPI pruning",
        "method": (
            "mutual_info_regression (k-NN) pairwise MI, symmetrised, "
            "Data Processing Inequality triangle pruning"
        ),
        "nSamples": n_samples,
        "nGenes": n_genes,
        "miThreshold": mi_threshold,
        "seed": seed,
        "candidateEdges": len(present),
        "prunedCount": len(to_remove),
        "retainedCount": len(retained),
        "edges": edges,
        "researchLog": research_log,
    }


TASKS = {
    "genie3": genie3,
    "aracne_mi": aracne_mi,
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
        import sklearn  # noqa: F401
    except Exception as e:
        _fail(f"grn_inference requires numpy + scikit-learn: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
