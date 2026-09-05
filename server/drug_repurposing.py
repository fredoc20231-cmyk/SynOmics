#!/usr/bin/env python3
"""Drug-repurposing tools — single dispatch.

Reads a JSON payload on stdin and prints a JSON result on stdout. Zero
hallucination: every reported value is computed by real statistics /
cheminformatics on the provided data; no drug, target, indication, score, or
p-value is ever fabricated. Indications and targets are only ever ECHOED from
user-provided input, never invented.

Tasks
-----
- connectivity_score : the Lamb et al. 2006 Connectivity Map (CMap) connectivity
  score between a query up/down gene signature and a drug's reference
  differential-expression signature (weighted KS enrichment; negative score =>
  the drug REVERSES the query => repurposing candidate).
- signature_reversal_screen : rank a library of drug expression signatures by how
  strongly each REVERSES a disease signature (reversal score = -Spearman rho over
  shared genes).
- target_based_repurposing : guilt-by-association by chemical similarity — ECFP4
  (Morgan radius 2, 2048-bit) Tanimoto between a query molecule and a library of
  known drugs; proposes candidate indications by similarity (efficacy NOT claimed).
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


# --------------------------------------------------------------------------- #
# Task 1 — CMap connectivity score (Lamb et al. 2006)
# --------------------------------------------------------------------------- #
def _cmap_ks(positions, n):
    """Weighted CMap KS enrichment statistic for a tag set.

    `positions` is the sorted (ascending) list of 1-based ranks of the tag-set
    genes within the ranked reference list of `n` genes (rank 1 = most
    up-regulated). Following Lamb et al. 2006:

        a = max_j ( j/t - V(j)/n )   (max deviation above)
        b = max_j ( V(j)/n - (j-1)/t )   (max deviation below)
        ES = a if a > b else -b
    """
    t = len(positions)
    if t == 0 or n == 0:
        return 0.0
    a = float("-inf")
    b = float("-inf")
    for j, v in enumerate(positions, start=1):
        a = max(a, j / t - v / n)
        b = max(b, v / n - (j - 1) / t)
    return a if a > b else -b


def task_connectivity_score(p):
    try:
        import numpy as np
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"connectivity_score requires numpy: {e}", status="unavailable")

    up_genes = p.get("upGenes")
    down_genes = p.get("downGenes")
    reference = p.get("referenceSignature")

    if up_genes is None:
        up_genes = []
    if down_genes is None:
        down_genes = []
    if not isinstance(up_genes, list) or not isinstance(down_genes, list):
        _fail("`upGenes` and `downGenes` must be lists of gene names.")
    if not up_genes and not down_genes:
        _fail("Provide at least one gene in `upGenes` or `downGenes`.")
    if not isinstance(reference, dict) or not reference:
        _fail("Provide `referenceSignature` as a non-empty map {gene: value}.")

    try:
        ref_items = [(str(g), float(v)) for g, v in reference.items()]
    except Exception as e:
        _fail(f"`referenceSignature` values must be numeric: {e}")
    ref_genes = [g for g, _ in ref_items]
    ref_values = np.asarray([v for _, v in ref_items], float)
    if not np.all(np.isfinite(ref_values)):
        _fail("`referenceSignature` values must be finite numbers.")
    n = len(ref_genes)

    # Rank all reference genes by value descending: rank 1 = highest value.
    order = np.argsort(-ref_values, kind="stable")
    rank_of_gene = {}
    for rank, idx in enumerate(order, start=1):
        rank_of_gene[ref_genes[idx]] = rank

    up_present = [g for g in map(str, up_genes) if g in rank_of_gene]
    down_present = [g for g in map(str, down_genes) if g in rank_of_gene]
    up_missing = [g for g in map(str, up_genes) if g not in rank_of_gene]
    down_missing = [g for g in map(str, down_genes) if g not in rank_of_gene]

    if not up_present and not down_present:
        _fail(
            "None of the query up/down genes are present in the reference "
            "signature — cannot compute a connectivity score."
        )

    ks_up = _cmap_ks(sorted(rank_of_gene[g] for g in up_present), n) if up_present else 0.0
    ks_down = _cmap_ks(sorted(rank_of_gene[g] for g in down_present), n) if down_present else 0.0

    # CMap combining rule: only if the two enrichment scores have opposite sign.
    if (ks_up > 0) != (ks_down > 0) and ks_up != 0.0 and ks_down != 0.0:
        connectivity = (ks_up - ks_down) / 2.0
    elif up_present and not down_present:
        connectivity = ks_up
    elif down_present and not up_present:
        connectivity = -ks_down
    else:
        connectivity = 0.0

    if connectivity < 0:
        direction = "REVERSES the query signature (candidate repurposing drug)"
    elif connectivity > 0:
        direction = "MIMICS the query signature"
    else:
        direction = "shows no coherent connectivity (opposite-sign rule not met)"

    analysis = (
        f"CMap connectivity score = {connectivity:.6g} (ksUp={ks_up:.6g}, "
        f"ksDown={ks_down:.6g}) over {n} reference genes; the drug {direction}."
    )
    research_log = (
        "# Connectivity Map (CMap) connectivity score\n\n"
        "The reference drug differential-expression signature was ranked by value "
        "in descending order (rank 1 = most up-regulated). For the query up set and "
        "down set, the weighted Kolmogorov-Smirnov enrichment statistic (Lamb et "
        "al. 2006) was computed against this ranked list:\n\n"
        "    a = max_j ( j/t - V(j)/n ),  b = max_j ( V(j)/n - (j-1)/t )\n"
        "    ES = a if a > b else -b\n\n"
        "The connectivity score is (ksUp - ksDown)/2 when the two enrichment scores "
        "have opposite sign (the CMap rule), else 0. A NEGATIVE score means the drug "
        "reverses the query signature (a repurposing candidate); a POSITIVE score "
        "means it mimics it.\n\n"
        f"| Metric | Value |\n| --- | --- |\n"
        f"| Reference genes (n) | {n} |\n"
        f"| Up genes used | {len(up_present)} |\n"
        f"| Down genes used | {len(down_present)} |\n"
        f"| ksUp | {ks_up:.6g} |\n"
        f"| ksDown | {ks_down:.6g} |\n"
        f"| Connectivity score | {connectivity:.6g} |\n"
    )
    if up_missing or down_missing:
        research_log += (
            f"\n_Note: {len(up_missing)} up and {len(down_missing)} down query "
            "gene(s) were absent from the reference signature and were dropped._\n"
        )

    return {
        "status": "success",
        "analysis": analysis,
        "ksUp": round(float(ks_up), 12),
        "ksDown": round(float(ks_down), 12),
        "connectivityScore": round(float(connectivity), 12),
        "nReferenceGenes": n,
        "nUpUsed": len(up_present),
        "nDownUsed": len(down_present),
        "upMissing": up_missing,
        "downMissing": down_missing,
        "researchLog": research_log,
    }


# --------------------------------------------------------------------------- #
# Task 2 — signature reversal screen (Spearman anti-correlation)
# --------------------------------------------------------------------------- #
def task_signature_reversal_screen(p):
    try:
        import numpy as np
        from scipy import stats
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"signature_reversal_screen requires numpy+scipy: {e}", status="unavailable")

    disease = p.get("diseaseSignature")
    drug_sigs = p.get("drugSignatures")
    if not isinstance(disease, dict) or not disease:
        _fail("Provide `diseaseSignature` as a non-empty map {gene: log2fc}.")
    if not isinstance(drug_sigs, dict) or not drug_sigs:
        _fail("Provide `drugSignatures` as a non-empty map {drugName: {gene: log2fc}}.")

    try:
        disease_map = {str(g): float(v) for g, v in disease.items()}
    except Exception as e:
        _fail(f"`diseaseSignature` values must be numeric: {e}")
    if not all(np.isfinite(list(disease_map.values()))):
        _fail("`diseaseSignature` values must be finite numbers.")

    ranked = []
    skipped = []
    for drug_name, sig in drug_sigs.items():
        drug_name = str(drug_name)
        if not isinstance(sig, dict) or not sig:
            skipped.append({"drug": drug_name, "note": "empty or invalid signature"})
            continue
        try:
            drug_map = {str(g): float(v) for g, v in sig.items()}
        except Exception:
            skipped.append({"drug": drug_name, "note": "non-numeric signature values"})
            continue
        shared = [g for g in drug_map if g in disease_map]
        if len(shared) < 3:
            skipped.append(
                {
                    "drug": drug_name,
                    "nSharedGenes": len(shared),
                    "note": "fewer than 3 shared genes; excluded from ranking",
                }
            )
            continue
        x = np.asarray([disease_map[g] for g in shared], float)
        y = np.asarray([drug_map[g] for g in shared], float)
        if not (np.all(np.isfinite(x)) and np.all(np.isfinite(y))):
            skipped.append({"drug": drug_name, "note": "non-finite shared values"})
            continue
        rho, pval = stats.spearmanr(x, y)
        if not np.isfinite(rho):
            skipped.append(
                {
                    "drug": drug_name,
                    "nSharedGenes": len(shared),
                    "note": "correlation undefined (constant signature)",
                }
            )
            continue
        ranked.append(
            {
                "drug": drug_name,
                "correlation": round(float(rho), 12),
                "reversalScore": round(float(-rho), 12),
                "nSharedGenes": len(shared),
                "pValue": round(float(pval), 12) if np.isfinite(pval) else None,
            }
        )

    ranked.sort(key=lambda r: r["reversalScore"], reverse=True)

    if not ranked:
        _fail(
            "No drug had >=3 genes shared with the disease signature; nothing to "
            "rank."
        )

    top = ranked[0]
    analysis = (
        f"Screened {len(drug_sigs)} drug signature(s) for reversal of the disease "
        f"signature ({len(disease_map)} genes) by Spearman anti-correlation over "
        f"shared genes; {len(ranked)} ranked, {len(skipped)} skipped. Top reversal "
        f"candidate: {top['drug']} (reversalScore={top['reversalScore']:.4g}, "
        f"rho={top['correlation']:.4g}, n={top['nSharedGenes']})."
    )
    rows = "".join(
        f"| {r['drug']} | {r['correlation']:.4g} | {r['reversalScore']:.4g} | "
        f"{r['nSharedGenes']} | {r['pValue']} |\n"
        for r in ranked
    )
    research_log = (
        "# Signature reversal screen\n\n"
        "For each drug, the Spearman rank correlation between the disease signature "
        "and the drug signature was computed over their shared genes. The reversal "
        "score is the negative of that correlation, so a strongly anti-correlated "
        "drug (one that pushes genes in the opposite direction to the disease) "
        "scores highest. Drugs with fewer than 3 shared genes are excluded from the "
        "ranking.\n\n"
        f"| Drug | Spearman rho | Reversal score | Shared genes | p-value |\n"
        f"| --- | --- | --- | --- | --- |\n{rows}"
    )
    if skipped:
        research_log += f"\n_{len(skipped)} drug(s) skipped (see `skipped`)._\n"

    return {
        "status": "success",
        "analysis": analysis,
        "ranking": ranked,
        "skipped": skipped,
        "nDrugs": len(drug_sigs),
        "nRanked": len(ranked),
        "nDiseaseGenes": len(disease_map),
        "researchLog": research_log,
    }


# --------------------------------------------------------------------------- #
# Task 3 — target-based repurposing by chemical similarity (ECFP4 Tanimoto)
# --------------------------------------------------------------------------- #
def task_target_based_repurposing(p):
    try:
        from rdkit import Chem, DataStructs
        from rdkit.Chem import AllChem
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"target_based_repurposing requires RDKit: {e}", status="unavailable")

    query_smiles = p.get("querySmiles")
    library = p.get("library")
    if not isinstance(query_smiles, str) or not query_smiles.strip():
        _fail("Provide `querySmiles` (a SMILES string).")
    if not isinstance(library, list) or not library:
        _fail("Provide `library` as a non-empty list of {name, smiles, ...}.")

    try:
        threshold = float(p.get("threshold", 0.3))
    except Exception:
        _fail("`threshold` must be a number.")
    try:
        top_n = int(p.get("topN", 10))
    except Exception:
        _fail("`topN` must be an integer.")
    if top_n <= 0:
        _fail("`topN` must be >= 1.")

    query_mol = Chem.MolFromSmiles(query_smiles)
    if query_mol is None:
        _fail(f"Invalid `querySmiles` (RDKit could not parse): {query_smiles!r}")
    query_fp = AllChem.GetMorganFingerprintAsBitVect(query_mol, 2, nBits=2048)

    hits = []
    skipped = []
    for i, entry in enumerate(library):
        if not isinstance(entry, dict):
            skipped.append({"index": i, "note": "library entry is not an object"})
            continue
        name = str(entry.get("name", f"compound_{i}"))
        smiles = entry.get("smiles")
        if not isinstance(smiles, str) or not smiles.strip():
            skipped.append({"name": name, "note": "missing SMILES"})
            continue
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            skipped.append({"name": name, "note": f"invalid SMILES: {smiles!r}"})
            continue
        fp = AllChem.GetMorganFingerprintAsBitVect(mol, 2, nBits=2048)
        tanimoto = float(DataStructs.TanimotoSimilarity(query_fp, fp))
        if tanimoto >= threshold:
            hits.append(
                {
                    "name": name,
                    "tanimoto": round(tanimoto, 12),
                    # indication/target are ECHOED from input, never invented.
                    "indication": entry.get("indication"),
                    "target": entry.get("target"),
                }
            )

    hits.sort(key=lambda h: h["tanimoto"], reverse=True)
    hits = hits[:top_n]

    analysis = (
        f"ECFP4 (Morgan r=2, 2048-bit) Tanimoto similarity of the query molecule to "
        f"{len(library)} library compound(s): {len(hits)} hit(s) at Tanimoto >= "
        f"{threshold:g}."
    )
    if hits:
        top = hits[0]
        analysis += (
            f" Top match: {top['name']} (Tanimoto={top['tanimoto']:.4g}"
            + (f", indication={top['indication']}" if top["indication"] else "")
            + "). Candidate indications are proposed by chemical similarity only; "
            "efficacy is NOT claimed."
        )
    else:
        analysis += " No library compound met the similarity threshold."

    rows = "".join(
        f"| {h['name']} | {h['tanimoto']:.4g} | {h['indication']} | {h['target']} |\n"
        for h in hits
    )
    research_log = (
        "# Target-based repurposing by chemical similarity\n\n"
        "The query molecule and each library compound were encoded as ECFP4 "
        "(Morgan radius 2, 2048-bit) fingerprints with RDKit, and their Tanimoto "
        "similarity computed. Library compounds with Tanimoto >= threshold are "
        "returned, sorted by similarity. Indications and targets are echoed verbatim "
        "from the input library (never invented); the method proposes candidate "
        "indications by structural analogy and makes NO efficacy claim.\n\n"
        f"| Metric | Value |\n| --- | --- |\n"
        f"| Library size | {len(library)} |\n"
        f"| Threshold | {threshold:g} |\n"
        f"| Hits returned | {len(hits)} |\n\n"
        f"| Compound | Tanimoto | Indication | Target |\n"
        f"| --- | --- | --- | --- |\n{rows}"
    )
    if skipped:
        research_log += f"\n_{len(skipped)} library entry/entries skipped (see `skipped`)._\n"

    return {
        "status": "success",
        "analysis": analysis,
        "hits": hits,
        "skipped": skipped,
        "nLibrary": len(library),
        "nHits": len(hits),
        "threshold": threshold,
        "researchLog": research_log,
    }


# --------------------------------------------------------------------------- #
# Dispatch
# --------------------------------------------------------------------------- #
TASKS = {
    "connectivity_score": task_connectivity_score,
    "signature_reversal_screen": task_signature_reversal_screen,
    "target_based_repurposing": task_target_based_repurposing,
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
