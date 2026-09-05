#!/usr/bin/env python3
"""Ligand-based virtual-screening & cheminformatics tools — single dispatch.

Reads a JSON payload on stdin and prints a JSON result on stdout. Zero
hallucination: every reported value (Tanimoto similarity, pharmacophore feature
count, Murcko scaffold, diversity pick) is computed by real RDKit on the
provided molecules; nothing is fabricated. A missing dependency (RDKit / numpy)
is reported honestly with status "unavailable".

Tasks
-----
- similarity_screen    : ECFP (Morgan) Tanimoto ligand-based virtual screen of a
  query molecule against a compound library; ranked hits at/above a threshold.
- pharmacophore_profile: RDKit BaseFeatures pharmacophore feature perception
  (Donor/Acceptor/Aromatic/Hydrophobe/...) per molecule.
- scaffold_clustering  : Bemis-Murcko scaffold grouping of a molecule set.
- diversity_selection  : MaxMin diverse subset selection over Morgan
  fingerprints (RDKit MaxMinPicker).
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


# --------------------------------------------------------------------------- #
# Task 1 — similarity_screen (ECFP Morgan Tanimoto virtual screen)
# --------------------------------------------------------------------------- #
def task_similarity_screen(p):
    try:
        from rdkit import Chem, DataStructs
        from rdkit.Chem import rdMolDescriptors
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"similarity_screen requires rdkit: {e}", status="unavailable")

    query_smiles = p.get("querySmiles")
    library = p.get("library")
    if not isinstance(query_smiles, str) or not query_smiles.strip():
        _fail("Provide `querySmiles` (a SMILES string).")
    if not isinstance(library, list) or not library:
        _fail("Provide `library` (non-empty list of {name, smiles}).")

    try:
        threshold = float(p.get("threshold", 0.3))
    except Exception:
        _fail("`threshold` must be a number.")
    if not (0.0 <= threshold <= 1.0):
        _fail("`threshold` must be between 0 and 1.")
    try:
        top_n = int(p.get("topN", 20))
    except Exception:
        _fail("`topN` must be an integer.")
    if top_n < 1:
        _fail("`topN` must be >= 1.")
    try:
        radius = int(p.get("radius", 2))
    except Exception:
        _fail("`radius` must be an integer.")
    if radius < 0:
        _fail("`radius` must be >= 0.")
    try:
        n_bits = int(p.get("nBits", 2048))
    except Exception:
        _fail("`nBits` must be an integer.")
    if n_bits < 1:
        _fail("`nBits` must be >= 1.")

    q_mol = Chem.MolFromSmiles(query_smiles)
    if q_mol is None:
        _fail(f"`querySmiles` is not a valid SMILES: {query_smiles!r}")
    q_fp = rdMolDescriptors.GetMorganFingerprintAsBitVect(q_mol, radius, n_bits)

    notes = []
    hits = []
    n_screened = 0
    for i, entry in enumerate(library):
        if not isinstance(entry, dict):
            notes.append(f"library[{i}] is not an object; skipped.")
            continue
        smiles = entry.get("smiles")
        name = str(entry.get("name", f"mol_{i}"))
        if not isinstance(smiles, str) or not smiles.strip():
            notes.append(f"{name}: missing SMILES; skipped.")
            continue
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            notes.append(f"{name}: invalid SMILES {smiles!r}; skipped.")
            continue
        n_screened += 1
        fp = rdMolDescriptors.GetMorganFingerprintAsBitVect(mol, radius, n_bits)
        tan = DataStructs.TanimotoSimilarity(q_fp, fp)
        if tan >= threshold:
            hits.append({"name": name, "smiles": smiles, "tanimoto": round(float(tan), 6)})

    # Rank by Tanimoto descending, then name for stability; cap at topN.
    hits.sort(key=lambda h: (-h["tanimoto"], h["name"]))
    n_hits = len(hits)
    hits = hits[:top_n]

    top = hits[0] if hits else None
    analysis = (
        f"Ligand-based virtual screen of {n_screened} valid library molecule(s) "
        f"against the query via ECFP{2 * radius} Morgan ({n_bits}-bit) Tanimoto "
        f"similarity. {n_hits} hit(s) at Tanimoto >= {threshold:g}; reporting the "
        f"top {len(hits)}."
    )
    if top is not None:
        analysis += f" Top hit: {top['name']} (Tanimoto={top['tanimoto']:.4g})."

    hit_rows = "".join(
        f"| {h['name']} | {h['smiles']} | {h['tanimoto']:.4g} |\n" for h in hits
    )
    research_log = (
        "# Ligand-based virtual screen (ECFP Tanimoto)\n\n"
        f"Computed the Morgan circular fingerprint (radius {radius} -> "
        f"ECFP{2 * radius}, {n_bits} bits) of the query and each library molecule, "
        "then scored each pair with the Tanimoto coefficient "
        "(intersection / union of set bits).\n\n"
        f"| Metric | Value |\n| --- | --- |\n"
        f"| Query SMILES | {query_smiles} |\n"
        f"| Library size | {len(library)} |\n"
        f"| Valid molecules screened | {n_screened} |\n"
        f"| Tanimoto threshold | {threshold:g} |\n"
        f"| Hits (>= threshold) | {n_hits} |\n"
        f"| Reported (top N) | {len(hits)} |\n\n"
        f"## Ranked hits\n\n"
        f"| Name | SMILES | Tanimoto |\n| --- | --- | --- |\n{hit_rows}"
    )
    if notes:
        research_log += "\n**Skipped:** " + "; ".join(notes) + "\n"

    return {
        "status": "success",
        "analysis": analysis,
        "hits": hits,
        "nScreened": n_screened,
        "nHits": n_hits,
        "threshold": threshold,
        "notes": notes,
        "researchLog": research_log,
    }


# --------------------------------------------------------------------------- #
# Task 2 — pharmacophore_profile (RDKit BaseFeatures perception)
# --------------------------------------------------------------------------- #
def _profile_one(mol, factory):
    from collections import Counter

    feats = factory.GetFeaturesForMol(mol)
    family_counts = Counter()
    features = []
    for f in feats:
        family = f.GetFamily()
        family_counts[family] += 1
        features.append(
            {
                "family": family,
                "type": f.GetType(),
                "atomIds": [int(a) for a in f.GetAtomIds()],
            }
        )
    return dict(family_counts), features


def task_pharmacophore_profile(p):
    try:
        import os

        from rdkit import Chem
        from rdkit.Chem import ChemicalFeatures, RDConfig
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"pharmacophore_profile requires rdkit: {e}", status="unavailable")

    smiles = p.get("smiles")
    smiles_list = p.get("smilesList")
    if isinstance(smiles, str) and smiles.strip():
        inputs = [smiles]
    elif isinstance(smiles_list, list) and smiles_list:
        if not all(isinstance(s, str) for s in smiles_list):
            _fail("`smilesList` must be a list of SMILES strings.")
        inputs = smiles_list
    else:
        _fail("Provide `smiles` (a SMILES string) or `smilesList` (list of SMILES).")

    try:
        fdef = os.path.join(RDConfig.RDDataDir, "BaseFeatures.fdef")
        factory = ChemicalFeatures.BuildFeatureFactory(fdef)
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"Failed to build the RDKit BaseFeatures factory: {e}", status="unavailable")

    profiles = []
    for i, smi in enumerate(inputs):
        mol = Chem.MolFromSmiles(smi)
        if mol is None:
            _fail(f"Invalid SMILES at index {i}: {smi!r}")
        family_counts, features = _profile_one(mol, factory)
        profiles.append(
            {
                "smiles": smi,
                "familyCounts": family_counts,
                "totalFeatures": len(features),
                "features": features,
            }
        )

    single = len(profiles) == 1
    if single:
        prof = profiles[0]
        family_counts = prof["familyCounts"]
        total_features = prof["totalFeatures"]
        features = prof["features"]
        summary_counts = family_counts
    else:
        from collections import Counter

        agg = Counter()
        for prof in profiles:
            agg.update(prof["familyCounts"])
        summary_counts = dict(agg)
        total_features = sum(prof["totalFeatures"] for prof in profiles)

    fam_str = ", ".join(f"{k}={v}" for k, v in sorted(summary_counts.items())) or "none"
    analysis = (
        f"Pharmacophore feature perception (RDKit BaseFeatures) over "
        f"{len(profiles)} molecule(s): {total_features} feature(s) total "
        f"[{fam_str}]."
    )
    count_rows = "".join(
        f"| {k} | {v} |\n" for k, v in sorted(summary_counts.items())
    )
    research_log = (
        "# Pharmacophore profile (RDKit BaseFeatures)\n\n"
        "Perceived chemical features with the RDKit `BaseFeatures.fdef` feature "
        "factory (SMARTS-based pharmacophore definitions) and tallied them by "
        "family (Donor, Acceptor, Aromatic, Hydrophobe, PosIonizable, "
        "NegIonizable, LumpedHydrophobe, ZnBinder).\n\n"
        f"| Metric | Value |\n| --- | --- |\n"
        f"| Molecules | {len(profiles)} |\n"
        f"| Total features | {total_features} |\n\n"
        f"## Feature families\n\n"
        f"| Family | Count |\n| --- | --- |\n{count_rows}"
    )

    result = {
        "status": "success",
        "analysis": analysis,
        "profiles": profiles,
        "familyCounts": summary_counts,
        "totalFeatures": total_features,
        "researchLog": research_log,
    }
    if single:
        # Expose top-level convenience fields for the single-molecule case.
        result["features"] = features
    return result


# --------------------------------------------------------------------------- #
# Task 3 — scaffold_clustering (Bemis-Murcko scaffold grouping)
# --------------------------------------------------------------------------- #
def task_scaffold_clustering(p):
    try:
        from rdkit import Chem
        from rdkit.Chem.Scaffolds import MurckoScaffold
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"scaffold_clustering requires rdkit: {e}", status="unavailable")

    molecules = p.get("molecules")
    if not isinstance(molecules, list) or not molecules:
        _fail("Provide `molecules` (non-empty list of {name, smiles}).")

    notes = []
    groups = {}
    n_molecules = 0
    for i, entry in enumerate(molecules):
        if not isinstance(entry, dict):
            notes.append(f"molecules[{i}] is not an object; skipped.")
            continue
        smiles = entry.get("smiles")
        name = str(entry.get("name", f"mol_{i}"))
        if not isinstance(smiles, str) or not smiles.strip():
            notes.append(f"{name}: missing SMILES; skipped.")
            continue
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            notes.append(f"{name}: invalid SMILES {smiles!r}; skipped.")
            continue
        try:
            scaffold = MurckoScaffold.GetScaffoldForMol(mol)
            scaffold_smiles = Chem.MolToSmiles(scaffold)
        except Exception as e:
            notes.append(f"{name}: scaffold computation failed ({e}); skipped.")
            continue
        n_molecules += 1
        groups.setdefault(scaffold_smiles, []).append(name)

    clusters = [
        {"scaffold": scaf, "members": members, "size": len(members)}
        for scaf, members in groups.items()
    ]
    clusters.sort(key=lambda c: (-c["size"], c["scaffold"]))
    n_scaffolds = len(clusters)

    analysis = (
        f"Bemis-Murcko scaffold clustering of {n_molecules} valid molecule(s) "
        f"yielded {n_scaffolds} distinct scaffold(s)."
    )
    if clusters:
        top = clusters[0]
        analysis += (
            f" Largest cluster: scaffold {top['scaffold']!r} with "
            f"{top['size']} member(s)."
        )
    cluster_rows = "".join(
        f"| {c['scaffold']} | {c['size']} | {', '.join(c['members'])} |\n"
        for c in clusters
    )
    research_log = (
        "# Bemis-Murcko scaffold clustering\n\n"
        "Reduced each molecule to its Bemis-Murcko framework "
        "(`MurckoScaffold.GetScaffoldForMol`, canonicalised via `MolToSmiles`) "
        "and grouped molecules sharing an identical scaffold SMILES.\n\n"
        f"| Metric | Value |\n| --- | --- |\n"
        f"| Input molecules | {len(molecules)} |\n"
        f"| Valid molecules | {n_molecules} |\n"
        f"| Distinct scaffolds | {n_scaffolds} |\n\n"
        f"## Clusters\n\n"
        f"| Scaffold | Size | Members |\n| --- | --- | --- |\n{cluster_rows}"
    )
    if notes:
        research_log += "\n**Skipped:** " + "; ".join(notes) + "\n"

    return {
        "status": "success",
        "analysis": analysis,
        "clusters": clusters,
        "nScaffolds": n_scaffolds,
        "nMolecules": n_molecules,
        "notes": notes,
        "researchLog": research_log,
    }


# --------------------------------------------------------------------------- #
# Task 4 — diversity_selection (MaxMin diverse subset over Morgan fingerprints)
# --------------------------------------------------------------------------- #
def task_diversity_selection(p):
    try:
        from rdkit import Chem, DataStructs
        from rdkit.Chem import rdMolDescriptors
        from rdkit.SimDivFilters.rdSimDivPickers import MaxMinPicker
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"diversity_selection requires rdkit: {e}", status="unavailable")

    molecules = p.get("molecules")
    if not isinstance(molecules, list) or not molecules:
        _fail("Provide `molecules` (non-empty list of {name, smiles}).")

    try:
        n_pick = int(p.get("nPick", 5))
    except Exception:
        _fail("`nPick` must be an integer.")
    if n_pick < 1:
        _fail("`nPick` must be >= 1.")
    try:
        seed = int(p.get("seed", 42))
    except Exception:
        _fail("`seed` must be an integer.")
    try:
        radius = int(p.get("radius", 2))
    except Exception:
        _fail("`radius` must be an integer.")
    if radius < 0:
        _fail("`radius` must be >= 0.")
    try:
        n_bits = int(p.get("nBits", 2048))
    except Exception:
        _fail("`nBits` must be an integer.")
    if n_bits < 1:
        _fail("`nBits` must be >= 1.")

    notes = []
    valid = []  # (name, smiles, fp)
    for i, entry in enumerate(molecules):
        if not isinstance(entry, dict):
            notes.append(f"molecules[{i}] is not an object; skipped.")
            continue
        smiles = entry.get("smiles")
        name = str(entry.get("name", f"mol_{i}"))
        if not isinstance(smiles, str) or not smiles.strip():
            notes.append(f"{name}: missing SMILES; skipped.")
            continue
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            notes.append(f"{name}: invalid SMILES {smiles!r}; skipped.")
            continue
        fp = rdMolDescriptors.GetMorganFingerprintAsBitVect(mol, radius, n_bits)
        valid.append((name, smiles, fp))

    n_valid = len(valid)
    if n_valid == 0:
        _fail("No valid molecules to select from.")

    fps = [v[2] for v in valid]
    if n_pick >= n_valid:
        picked_idx = list(range(n_valid))
        capped = True
    else:
        picker = MaxMinPicker()
        picked_idx = list(picker.LazyBitVectorPick(fps, n_valid, n_pick, seed=seed))
        capped = False

    selected = [{"name": valid[i][0], "smiles": valid[i][1]} for i in picked_idx]

    # Mean pairwise Tanimoto among the picked set (lower = more diverse).
    sims = []
    for a in range(len(picked_idx)):
        for b in range(a + 1, len(picked_idx)):
            sims.append(
                DataStructs.TanimotoSimilarity(fps[picked_idx[a]], fps[picked_idx[b]])
            )
    mean_pairwise_tanimoto = round(float(sum(sims) / len(sims)), 6) if sims else None

    analysis = (
        f"MaxMin diversity selection picked {len(selected)} molecule(s) from "
        f"{n_valid} valid candidate(s) (ECFP{2 * radius} Morgan, {n_bits}-bit; "
        f"seed={seed})."
    )
    if capped:
        analysis += " nPick >= library size, so all molecules were returned."
    if mean_pairwise_tanimoto is not None:
        analysis += (
            f" Mean pairwise Tanimoto among the picked set = "
            f"{mean_pairwise_tanimoto:.4g} (lower = more diverse)."
        )
    sel_rows = "".join(f"| {s['name']} | {s['smiles']} |\n" for s in selected)
    research_log = (
        "# MaxMin diversity selection\n\n"
        "Computed Morgan fingerprints for each candidate and selected a maximally "
        "diverse subset with RDKit's `MaxMinPicker.LazyBitVectorPick` (greedy "
        "MaxMin over 1 - Tanimoto distance). The picker is seeded for "
        "reproducibility.\n\n"
        f"| Metric | Value |\n| --- | --- |\n"
        f"| Input molecules | {len(molecules)} |\n"
        f"| Valid candidates | {n_valid} |\n"
        f"| Requested picks | {n_pick} |\n"
        f"| Selected | {len(selected)} |\n"
        f"| Seed | {seed} |\n"
        f"| Mean pairwise Tanimoto | {mean_pairwise_tanimoto} |\n\n"
        f"## Selected molecules\n\n"
        f"| Name | SMILES |\n| --- | --- |\n{sel_rows}"
    )
    if notes:
        research_log += "\n**Skipped:** " + "; ".join(notes) + "\n"

    return {
        "status": "success",
        "analysis": analysis,
        "selected": selected,
        "nSelected": len(selected),
        "nCandidates": n_valid,
        "meanPairwiseTanimoto": mean_pairwise_tanimoto,
        "seed": seed,
        "notes": notes,
        "researchLog": research_log,
    }


# --------------------------------------------------------------------------- #
# Dispatch
# --------------------------------------------------------------------------- #
TASKS = {
    "similarity_screen": task_similarity_screen,
    "pharmacophore_profile": task_pharmacophore_profile,
    "scaffold_clustering": task_scaffold_clustering,
    "diversity_selection": task_diversity_selection,
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
