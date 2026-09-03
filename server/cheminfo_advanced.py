#!/usr/bin/env python3
"""Advanced cheminformatics (RDKit) — one dispatch, several real analyses.

Tasks (payload.task):
  tanimoto            : Morgan-fingerprint Tanimoto similarity between two SMILES.
  similarity_matrix   : pairwise Tanimoto over a list of SMILES.
  substructure_search : which molecules contain a SMARTS/SMILES query substructure.
  murcko_scaffold     : Bemis-Murcko scaffold of a molecule.
  pains_filter        : flag PAINS (pan-assay interference) substructures.

Every molecule is RDKit-sanitized; nothing is fabricated. Reads JSON on stdin.
Honest 'unavailable' if rdkit is missing.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _mol(smiles, Chem):
    m = Chem.MolFromSmiles(smiles)
    if m is None:
        _fail(f"Invalid SMILES: {smiles!r}")
    return m


def _fp(mol):
    from rdkit.Chem import rdMolDescriptors
    return rdMolDescriptors.GetMorganFingerprintAsBitVect(mol, radius=2, nBits=2048)


def task_tanimoto(p):
    from rdkit import Chem, DataStructs
    a, b = p.get("smiles1"), p.get("smiles2")
    if not (isinstance(a, str) and isinstance(b, str)):
        _fail("tanimoto needs `smiles1` and `smiles2`.")
    fa, fb = _fp(_mol(a, Chem)), _fp(_mol(b, Chem))
    sim = DataStructs.TanimotoSimilarity(fa, fb)
    return {"status": "success", "analysis": "Tanimoto similarity (Morgan r=2, 2048 bits)",
            "smiles1": Chem.CanonSmiles(a), "smiles2": Chem.CanonSmiles(b), "tanimoto": round(float(sim), 4)}


def task_similarity_matrix(p):
    from rdkit import Chem, DataStructs
    smis = p.get("smiles")
    if not isinstance(smis, list) or len(smis) < 2:
        _fail("similarity_matrix needs a `smiles` list (>=2).")
    fps = [_fp(_mol(s, Chem)) for s in smis]
    n = len(fps)
    M = [[1.0 if i == j else round(float(DataStructs.TanimotoSimilarity(fps[i], fps[j])), 4)
          for j in range(n)] for i in range(n)]
    return {"status": "success", "analysis": "pairwise Tanimoto matrix", "n": n,
            "canonical": [Chem.CanonSmiles(s) for s in smis], "matrix": M}


def task_substructure_search(p):
    from rdkit import Chem
    query = p.get("query")
    smis = p.get("smiles")
    if not isinstance(query, str) or not isinstance(smis, list):
        _fail("substructure_search needs `query` (SMARTS/SMILES) and `smiles` list.")
    patt = Chem.MolFromSmarts(query) or Chem.MolFromSmiles(query)
    if patt is None:
        _fail(f"Invalid query pattern: {query!r}")
    hits = []
    for s in smis:
        m = Chem.MolFromSmiles(s)
        if m is None:
            hits.append({"smiles": s, "valid": False, "match": None})
        else:
            hits.append({"smiles": Chem.MolToSmiles(m), "valid": True, "match": bool(m.HasSubstructMatch(patt))})
    return {"status": "success", "analysis": "substructure search", "query": query,
            "nMatches": sum(1 for h in hits if h.get("match")), "results": hits}


def task_murcko_scaffold(p):
    from rdkit import Chem
    from rdkit.Chem.Scaffolds import MurckoScaffold
    s = p.get("smiles")
    if not isinstance(s, str):
        _fail("murcko_scaffold needs a `smiles` string.")
    m = _mol(s, Chem)
    scaf = MurckoScaffold.GetScaffoldForMol(m)
    generic = MurckoScaffold.MakeScaffoldGeneric(scaf) if scaf.GetNumAtoms() else scaf
    return {"status": "success", "analysis": "Bemis-Murcko scaffold",
            "input": Chem.MolToSmiles(m), "scaffold": Chem.MolToSmiles(scaf),
            "genericScaffold": Chem.MolToSmiles(generic)}


def task_pains_filter(p):
    from rdkit import Chem
    from rdkit.Chem import FilterCatalog
    smis = p.get("smiles")
    if isinstance(smis, str):
        smis = [smis]
    if not isinstance(smis, list):
        _fail("pains_filter needs `smiles` (string or list).")
    params = FilterCatalog.FilterCatalogParams()
    params.AddCatalog(FilterCatalog.FilterCatalogParams.FilterCatalogs.PAINS)
    catalog = FilterCatalog.FilterCatalog(params)
    results = []
    for s in smis:
        m = Chem.MolFromSmiles(s)
        if m is None:
            results.append({"smiles": s, "valid": False, "pains": None})
            continue
        entry = catalog.GetFirstMatch(m)
        flagged = entry is not None
        results.append({"smiles": Chem.MolToSmiles(m), "valid": True, "painsFlagged": flagged,
                        "alert": entry.GetDescription() if flagged else None})
    return {"status": "success", "analysis": "PAINS (pan-assay interference) filter",
            "nFlagged": sum(1 for r in results if r.get("painsFlagged")), "results": results}


TASKS = {"tanimoto": task_tanimoto, "similarity_matrix": task_similarity_matrix,
         "substructure_search": task_substructure_search, "murcko_scaffold": task_murcko_scaffold,
         "pains_filter": task_pains_filter}


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
        from rdkit import Chem, RDLogger  # noqa: F401
        RDLogger.DisableLog("rdApp.*")
    except Exception as e:
        _fail(f"cheminfo requires rdkit: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
