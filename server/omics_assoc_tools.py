#!/usr/bin/env python3
"""Omics association & structure-comparison tools — single dispatch.

Reads a JSON payload on stdin and prints a JSON result on stdout. Zero
hallucination: every reported value is computed by real statistics / linear
algebra on the provided data; nothing is fabricated.

Tasks
-----
- methylome_wide_association : per-CpG OLS association test + Benjamini-Hochberg
  FDR (a methylome-wide association study, MWAS).
- compare_protein_structures : RMSD before/after optimal Kabsch superposition of
  two matched C-alpha coordinate sets (or two PDB strings).
- barcode_sequencing : assign reads to sample barcodes within a mismatch budget
  and summarise counts + Shannon diversity.

Design adapted from the Apache-2.0 Biomni project
(pharmacology.perform_mwas..., systems_biology.compare_protein_structures,
synthetic_biology.analyze_barcode_sequencing_data); reimplemented cleanly.
"""
import json
import math
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


# --------------------------------------------------------------------------- #
# Task 1 — methylome-wide association (per-CpG OLS + BH FDR)
# --------------------------------------------------------------------------- #
def _bh_fdr(pvals):
    """Benjamini-Hochberg step-up adjusted p-values (numpy)."""
    import numpy as np

    p = np.asarray(pvals, float)
    # Non-finite p-values are conservatively set to 1.0 so they never survive.
    p = np.where(np.isfinite(p), p, 1.0)
    n = p.size
    order = np.argsort(p)
    ranked = p[order]
    ranks = np.arange(1, n + 1)
    adj = ranked * n / ranks
    # Enforce monotonicity (running minimum from the largest p downward).
    adj = np.minimum.accumulate(adj[::-1])[::-1]
    adj = np.clip(adj, 0.0, 1.0)
    out = np.empty(n, float)
    out[order] = adj
    return out


def task_methylome_wide_association(p):
    try:
        import numpy as np
        from scipy import stats
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"methylome_wide_association requires numpy+scipy: {e}", status="unavailable")

    methylation = p.get("methylation")
    phenotype = p.get("phenotype")
    if not isinstance(methylation, list) or not methylation:
        _fail("Provide `methylation` (2D array: samples x sites).")
    if not isinstance(phenotype, list) or not phenotype:
        _fail("Provide `phenotype` (array of length = n_samples).")

    try:
        M = np.asarray(methylation, float)
    except Exception as e:
        _fail(f"`methylation` must be numeric: {e}")
    if M.ndim != 2:
        _fail(f"`methylation` must be 2D (samples x sites); got ndim={M.ndim}.")
    n_samples, n_sites = M.shape

    try:
        y_pheno = np.asarray(phenotype, float)
    except Exception as e:
        _fail(f"`phenotype` must be numeric: {e}")
    if y_pheno.ndim != 1:
        _fail("`phenotype` must be a 1D array.")
    if y_pheno.shape[0] != n_samples:
        _fail(
            f"`phenotype` length ({y_pheno.shape[0]}) must equal n_samples "
            f"({n_samples}) — shape mismatch."
        )
    if not (np.all(np.isfinite(M)) and np.all(np.isfinite(y_pheno))):
        _fail("`methylation`/`phenotype` must be finite numbers.")

    site_ids = p.get("siteIds")
    if site_ids is not None:
        if not isinstance(site_ids, list) or len(site_ids) != n_sites:
            _fail(f"`siteIds` must be a list of length n_sites ({n_sites}).")
        site_names = [str(s) for s in site_ids]
    else:
        site_names = [f"site_{j}" for j in range(n_sites)]

    # Design matrix: [intercept, phenotype, covariate_1..covariate_k].
    columns = [np.ones(n_samples), y_pheno]
    covariates = p.get("covariates")
    if covariates is not None:
        try:
            C = np.asarray(covariates, float)
        except Exception as e:
            _fail(f"`covariates` must be numeric: {e}")
        if C.ndim == 1:
            C = C.reshape(n_samples, 1)
        if C.ndim != 2 or C.shape[0] != n_samples:
            _fail(
                f"`covariates` must be 2D (samples x k) with samples={n_samples} "
                f"— shape mismatch."
            )
        if not np.all(np.isfinite(C)):
            _fail("`covariates` must be finite numbers.")
        for k in range(C.shape[1]):
            columns.append(C[:, k])
    X = np.column_stack(columns)
    n_params = X.shape[1]
    dof = n_samples - n_params
    if dof <= 0:
        _fail(
            f"Not enough samples ({n_samples}) for {n_params} model parameters "
            f"(residual dof={dof})."
        )

    # Shared design across all sites -> solve every response column at once.
    try:
        XtX_inv = np.linalg.inv(X.T @ X)
    except np.linalg.LinAlgError as e:
        _fail(f"Design matrix is singular (collinear predictors): {e}")
    beta = XtX_inv @ X.T @ M  # (n_params, n_sites)
    resid = M - X @ beta
    rss = np.sum(resid**2, axis=0)  # (n_sites,)
    sigma2 = rss / dof
    var_coef1 = sigma2 * XtX_inv[1, 1]  # variance of the phenotype coefficient
    se = np.sqrt(var_coef1)
    coef1 = beta[1, :]

    with np.errstate(divide="ignore", invalid="ignore"):
        tvals = np.where(se > 0, coef1 / se, np.nan)
    pvals = 2.0 * stats.t.sf(np.abs(tvals), dof)
    pvals = np.where(np.isfinite(pvals), pvals, 1.0)

    padj = _bh_fdr(pvals)

    results = [
        {
            "site": site_names[j],
            "beta": round(float(coef1[j]), 10),
            "pValue": round(float(pvals[j]), 12),
            "padj": round(float(padj[j]), 12),
        }
        for j in range(n_sites)
    ]
    results.sort(key=lambda r: (r["padj"], r["pValue"]))
    n_significant = int(np.sum(padj < 0.05))

    covariate_note = ""
    if covariates is not None:
        covariate_note = f" adjusting for {X.shape[1] - 2} covariate(s)"
    top = results[0] if results else None
    analysis = (
        f"Methylome-wide association across {n_sites} CpG sites in {n_samples} "
        f"samples via per-site OLS (methylation ~ phenotype{covariate_note}); "
        f"Benjamini-Hochberg FDR applied. {n_significant} site(s) significant at "
        f"padj<0.05."
    )
    if top is not None:
        analysis += (
            f" Top site: {top['site']} (beta={top['beta']:.4g}, "
            f"p={top['pValue']:.3g}, padj={top['padj']:.3g})."
        )

    research_log = (
        "# Methylome-wide association study (MWAS)\n\n"
        f"Fitted, for each of **{n_sites}** CpG sites, an ordinary least-squares "
        "regression\n\n"
        "    methylation_site = b0 + b1*phenotype (+ covariates)\n\n"
        f"on **{n_samples}** samples (residual dof = {dof}). The phenotype "
        "coefficient b1 was tested with a two-sided t-test "
        "(p = 2*sf(|t|, dof)), and site p-values were corrected with the "
        "Benjamini-Hochberg step-up procedure.\n\n"
        f"| Metric | Value |\n| --- | --- |\n"
        f"| Sites tested | {n_sites} |\n"
        f"| Samples | {n_samples} |\n"
        f"| Model parameters | {n_params} |\n"
        f"| Significant (padj<0.05) | {n_significant} |\n"
    )
    if top is not None:
        research_log += (
            f"| Top site | {top['site']} |\n"
            f"| Top site padj | {top['padj']:.3g} |\n"
        )

    return {
        "status": "success",
        "analysis": analysis,
        "results": results,
        "nSignificant": n_significant,
        "nSites": n_sites,
        "nSamples": n_samples,
        "nParams": n_params,
        "researchLog": research_log,
    }


# --------------------------------------------------------------------------- #
# Task 2 — protein structure comparison (Kabsch superposition RMSD)
# --------------------------------------------------------------------------- #
def _parse_ca_coords(pdb_text):
    """Extract CA atom coordinates (in order) from a PDB string via biopython."""
    import io

    from Bio.PDB import PDBParser

    parser = PDBParser(QUIET=True)
    structure = parser.get_structure("s", io.StringIO(pdb_text))
    coords = []
    for atom in structure.get_atoms():
        if atom.get_id() == "CA":
            coords.append([float(c) for c in atom.get_coord()])
    return coords


def _rmsd(a, b):
    import numpy as np

    diff = a - b
    return float(np.sqrt(np.mean(np.sum(diff**2, axis=1))))


def _kabsch_rotation(mobile_centered, ref_centered):
    """Optimal rotation (3x3) rotating `mobile` onto `ref` (points as rows)."""
    import numpy as np

    H = mobile_centered.T @ ref_centered
    U, _s, Vt = np.linalg.svd(H)
    d = np.sign(np.linalg.det(Vt.T @ U.T))
    D = np.diag([1.0, 1.0, d])
    return Vt.T @ D @ U.T


def task_compare_protein_structures(p):
    try:
        import numpy as np
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"compare_protein_structures requires numpy: {e}", status="unavailable")

    coords_a = p.get("coordsA")
    coords_b = p.get("coordsB")
    pdb_a = p.get("pdbA")
    pdb_b = p.get("pdbB")

    if coords_a is not None and coords_b is not None:
        try:
            A = np.asarray(coords_a, float)
            B = np.asarray(coords_b, float)
        except Exception as e:
            _fail(f"`coordsA`/`coordsB` must be numeric: {e}")
    elif pdb_a is not None and pdb_b is not None:
        try:
            A = np.asarray(_parse_ca_coords(pdb_a), float)
            B = np.asarray(_parse_ca_coords(pdb_b), float)
        except ImportError as e:  # pragma: no cover - environment dependent
            _fail(f"Parsing PDB strings requires biopython: {e}", status="unavailable")
        except Exception as e:
            _fail(f"Failed to parse PDB strings: {e}")
        if A.size == 0 or B.size == 0:
            _fail("No CA atoms found in one or both PDB strings.")
    else:
        _fail("Provide `coordsA`+`coordsB` (N x 3 arrays) or `pdbA`+`pdbB` (PDB strings).")

    if A.ndim != 2 or A.shape[1] != 3:
        _fail(f"`coordsA` must be N x 3; got shape {A.shape}.")
    if B.ndim != 2 or B.shape[1] != 3:
        _fail(f"`coordsB` must be N x 3; got shape {B.shape}.")
    if A.shape[0] != B.shape[0]:
        _fail(
            f"Structures have different atom counts ({A.shape[0]} vs "
            f"{B.shape[0]}) — shape mismatch; coordinates must be matched order."
        )
    if not (np.all(np.isfinite(A)) and np.all(np.isfinite(B))):
        _fail("Coordinates must be finite numbers.")
    n_atoms = int(A.shape[0])
    if n_atoms < 1:
        _fail("Need at least one atom to compare.")

    rmsd_before = _rmsd(A, B)

    # Kabsch: superpose B (mobile) onto A (reference).
    centroid_a = A.mean(axis=0)
    centroid_b = B.mean(axis=0)
    A_c = A - centroid_a
    B_c = B - centroid_b
    R = _kabsch_rotation(B_c, A_c)
    B_aligned = B_c @ R.T
    rmsd_after = _rmsd(B_aligned, A_c)

    analysis = (
        f"Compared two structures of {n_atoms} matched CA atoms. RMSD before "
        f"superposition = {rmsd_before:.6g} A; after optimal Kabsch "
        f"superposition = {rmsd_after:.6g} A."
    )
    research_log = (
        "# Protein structure comparison (Kabsch RMSD)\n\n"
        f"Two matched C-alpha coordinate sets of **{n_atoms}** atoms were "
        "compared.\n\n"
        "1. **RMSD before**: root-mean-square deviation of the coordinates as "
        "given (no alignment).\n"
        "2. **Kabsch superposition**: both sets centered on their centroids; the "
        "optimal rotation was obtained from the SVD of the cross-covariance "
        "matrix (with a reflection guard via det sign), then applied to the "
        "mobile set.\n"
        "3. **RMSD after**: RMSD of the aligned coordinates.\n\n"
        f"| Metric | Value (A) |\n| --- | --- |\n"
        f"| RMSD before | {rmsd_before:.6g} |\n"
        f"| RMSD after | {rmsd_after:.6g} |\n"
        f"| Atoms | {n_atoms} |\n\n"
        "A rmsdAfter of ~0 for a positive rmsdBefore indicates the two "
        "structures differ only by a rigid-body transform (rotation + "
        "translation)."
    )

    return {
        "status": "success",
        "analysis": analysis,
        "rmsdBefore": round(rmsd_before, 10),
        "rmsdAfter": round(rmsd_after, 10),
        "nAtoms": n_atoms,
        "researchLog": research_log,
    }


# --------------------------------------------------------------------------- #
# Task 3 — barcode sequencing demultiplex
# --------------------------------------------------------------------------- #
def _hamming(a, b):
    """Number of mismatched positions between equal-length strings."""
    return sum(1 for x, y in zip(a, b) if x != y)


def task_barcode_sequencing(p):
    reads = p.get("reads")
    barcodes = p.get("barcodes")
    if not isinstance(reads, list) or not reads:
        _fail("Provide `reads` (non-empty list of DNA strings).")
    if not all(isinstance(r, str) for r in reads):
        _fail("`reads` must all be strings.")

    if isinstance(barcodes, dict):
        if not barcodes:
            _fail("`barcodes` map is empty.")
        barcode_map = {str(name): str(seq) for name, seq in barcodes.items()}
    elif isinstance(barcodes, list):
        if not barcodes:
            _fail("`barcodes` list is empty.")
        barcode_map = {str(seq): str(seq) for seq in barcodes}
    else:
        _fail("Provide `barcodes` as a map {name: seq} or a list [seq, ...].")

    for name, seq in barcode_map.items():
        if not seq:
            _fail(f"Barcode {name!r} has an empty sequence.")

    try:
        max_mismatches = int(p.get("maxMismatches", 0))
    except Exception:
        _fail("`maxMismatches` must be an integer.")
    if max_mismatches < 0:
        _fail("`maxMismatches` must be >= 0.")
    try:
        barcode_start = int(p.get("barcodeStart", 0))
    except Exception:
        _fail("`barcodeStart` must be an integer.")
    if barcode_start < 0:
        _fail("`barcodeStart` must be >= 0.")

    counts = {name: 0 for name in barcode_map}
    unassigned = 0
    items = list(barcode_map.items())

    for read in reads:
        best_name = None
        best_mm = None
        for name, seq in items:
            region = read[barcode_start : barcode_start + len(seq)]
            if len(region) != len(seq):
                continue  # read too short at this offset for this barcode
            mm = _hamming(region, seq)
            if mm <= max_mismatches and (best_mm is None or mm < best_mm):
                best_mm = mm
                best_name = name
                if mm == 0:
                    break  # exact match cannot be beaten
        if best_name is None:
            unassigned += 1
        else:
            counts[best_name] += 1

    total_reads = len(reads)
    assigned = total_reads - unassigned

    # Shannon diversity (natural log) over the assigned barcode count distribution.
    shannon = 0.0
    if assigned > 0:
        for c in counts.values():
            if c > 0:
                frac = c / assigned
                shannon -= frac * math.log(frac)

    analysis = (
        f"Demultiplexed {total_reads} reads against {len(barcode_map)} barcodes "
        f"(barcodeStart={barcode_start}, maxMismatches={max_mismatches}): "
        f"{assigned} assigned, {unassigned} unassigned; Shannon diversity "
        f"H'={shannon:.6g} nats over the assigned distribution."
    )
    count_rows = "".join(f"| {name} | {c} |\n" for name, c in counts.items())
    research_log = (
        "# Barcode sequencing demultiplex\n\n"
        f"Each read's barcode region `read[{barcode_start}:{barcode_start}+len(bc)]` "
        "was compared to every barcode by Hamming distance; the read was assigned "
        f"to the best barcode within a budget of **{max_mismatches}** mismatch(es), "
        "otherwise counted as unassigned.\n\n"
        f"| Barcode | Count |\n| --- | --- |\n{count_rows}"
        f"| _unassigned_ | {unassigned} |\n"
        f"| _total_ | {total_reads} |\n\n"
        f"Shannon diversity H' = -sum(p_i * ln p_i) over the assigned barcode "
        f"fractions = **{shannon:.6g}** nats."
    )

    return {
        "status": "success",
        "analysis": analysis,
        "counts": counts,
        "unassignedCount": unassigned,
        "totalReads": total_reads,
        "assignedCount": assigned,
        "shannonDiversity": round(shannon, 12),
        "researchLog": research_log,
    }


# --------------------------------------------------------------------------- #
# Dispatch
# --------------------------------------------------------------------------- #
TASKS = {
    "methylome_wide_association": task_methylome_wide_association,
    "compare_protein_structures": task_compare_protein_structures,
    "barcode_sequencing": task_barcode_sequencing,
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
