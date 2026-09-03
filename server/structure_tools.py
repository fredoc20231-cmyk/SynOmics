#!/usr/bin/env python3
"""Protein-structure analyses from a PDB (biopython) — one dispatch, several tools.

Tasks (payload.task):
  structure_summary : chains, residue/atom counts, resolution (if present).
  radius_of_gyration: Rg from CA atoms (compactness).
  contact_map       : CA-CA residue contacts under a distance threshold (Angstrom).
  distance          : distance between two atoms (chain/resid/atom).

Input: `pdb` = full PDB text. Every value is computed by Biopython from real
coordinates. Reads JSON on stdin; honest 'unavailable' if biopython is missing.
"""
import io
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _structure(p):
    from Bio.PDB import PDBParser
    text = p.get("pdb")
    if not isinstance(text, str) or "ATOM" not in text:
        _fail("Provide `pdb`: PDB-format text containing ATOM records.")
    parser = PDBParser(QUIET=True)
    try:
        return parser.get_structure("s", io.StringIO(text))
    except Exception as e:
        _fail(f"Could not parse PDB: {e}")


def _ca_atoms(structure):
    cas = []
    for model in structure:
        for chain in model:
            for res in chain:
                if "CA" in res:
                    cas.append((chain.id, res.id[1], res.resname, res["CA"]))
        break  # first model only
    return cas


def task_structure_summary(p):
    structure = _structure(p)
    model = next(iter(structure))
    chains = {}
    n_atoms = 0
    for chain in model:
        n_res = sum(1 for _ in chain)
        chains[chain.id] = n_res
        for res in chain:
            n_atoms += sum(1 for _ in res)
    return {"status": "success", "analysis": "structure summary",
            "nChains": len(chains), "residuesPerChain": chains,
            "totalResidues": sum(chains.values()), "totalAtoms": n_atoms}


def task_radius_of_gyration(p):
    import numpy as np
    structure = _structure(p)
    coords = np.array([atom.coord for (_, _, _, atom) in _ca_atoms(structure)], dtype=float)
    if coords.shape[0] < 2:
        _fail("Need >=2 CA atoms for radius of gyration.")
    center = coords.mean(axis=0)
    rg = float(np.sqrt(((coords - center) ** 2).sum(axis=1).mean()))
    return {"status": "success", "analysis": "radius of gyration (CA)",
            "nResidues": int(coords.shape[0]), "radiusOfGyration": round(rg, 4),
            "centerOfMass": [round(float(v), 4) for v in center]}


def task_contact_map(p):
    import numpy as np
    structure = _structure(p)
    cas = _ca_atoms(structure)
    if len(cas) < 2:
        _fail("Need >=2 CA atoms for a contact map.")
    thr = float(p.get("threshold", 8.0))
    coords = np.array([a.coord for (_, _, _, a) in cas], dtype=float)
    diff = coords[:, None, :] - coords[None, :, :]
    dist = np.sqrt((diff ** 2).sum(axis=2))
    seq_sep = int(p.get("minSeqSep", 3))
    contacts = []
    n = len(cas)
    for i in range(n):
        for j in range(i + seq_sep, n):
            if dist[i, j] <= thr:
                contacts.append({"resA": cas[i][1], "resB": cas[j][1], "distance": round(float(dist[i, j]), 3)})
    return {"status": "success", "analysis": "CA-CA contact map", "threshold": thr,
            "nResidues": n, "nContacts": len(contacts),
            "contactOrder": round(sum(abs(c["resB"] - c["resA"]) for c in contacts) / (len(contacts) * n), 5) if contacts else 0.0,
            "contacts": contacts[:500]}


def task_distance(p):
    import numpy as np
    structure = _structure(p)
    model = next(iter(structure))

    def get(spec):
        ch = model[spec["chain"]]
        res = ch[(" ", int(spec["resid"]), " ")]
        return np.array(res[spec.get("atom", "CA")].coord, float)
    a, b = p.get("atomA"), p.get("atomB")
    if not (isinstance(a, dict) and isinstance(b, dict)):
        _fail("distance needs atomA/atomB = {chain, resid, atom?}.")
    try:
        d = float(np.linalg.norm(get(a) - get(b)))
    except Exception as e:
        _fail(f"Atom not found: {e}")
    return {"status": "success", "analysis": "inter-atomic distance", "distance": round(d, 4)}


TASKS = {"structure_summary": task_structure_summary, "radius_of_gyration": task_radius_of_gyration,
         "contact_map": task_contact_map, "distance": task_distance}


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
        import Bio  # noqa: F401
    except Exception as e:
        _fail(f"structure_tools requires biopython: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
