#!/usr/bin/env python3
"""Real molecular descriptors (RDKit) — replaces the former mock ADMET.

Computes genuine, deterministic cheminformatics from a SMILES string: molecular
weight, cLogP, TPSA, H-bond donors/acceptors, rotatable bonds, aromatic rings,
QED drug-likeness, and Lipinski/Veber rule compliance. Every value is computed
by RDKit — nothing is fabricated. An invalid SMILES returns an honest error.

ZERO-BS scope: binding affinity / docking is NOT computed here (that requires a
real docking engine such as AutoDock Vina, an external binary not bundled); the
response says so explicitly rather than inventing an affinity.

Reads JSON on stdin, prints JSON. Payload: { "smiles": "...", "name": "..." }
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        _fail(f"Invalid JSON: {e}")

    try:
        from rdkit import Chem, RDLogger
        from rdkit.Chem import QED, Crippen, Descriptors, Lipinski, rdMolDescriptors
        RDLogger.DisableLog("rdApp.*")
    except Exception as e:
        _fail(f"Molecular descriptors require rdkit: {e}", status="unavailable")

    smiles = payload.get("smiles")
    if not smiles or not isinstance(smiles, str):
        _fail("Provide a `smiles` string.")

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        _fail(f"Invalid SMILES: could not be parsed/sanitized by RDKit: {smiles!r}", status="error")

    mw = Descriptors.MolWt(mol)
    logp = Crippen.MolLogP(mol)
    tpsa = rdMolDescriptors.CalcTPSA(mol)
    hbd = Lipinski.NumHDonors(mol)
    hba = Lipinski.NumHAcceptors(mol)
    rot = Lipinski.NumRotatableBonds(mol)

    # Lipinski Rule of 5 violations (a compound "passes" with <= 1 violation).
    ro5_violations = sum([mw > 500, logp > 5, hbd > 5, hba > 10])
    # Veber oral-bioavailability rules.
    veber_pass = (rot <= 10) and (tpsa <= 140)

    descriptors = {
        "molecularWeight": round(mw, 3),
        "cLogP": round(logp, 3),
        "tpsa": round(tpsa, 3),
        "hBondDonors": int(hbd),
        "hBondAcceptors": int(hba),
        "rotatableBonds": int(rot),
        "aromaticRings": int(rdMolDescriptors.CalcNumAromaticRings(mol)),
        "heavyAtoms": int(mol.GetNumHeavyAtoms()),
        "molecularFormula": rdMolDescriptors.CalcMolFormula(mol),
        "qedDrugLikeness": round(QED.qed(mol), 4),
    }

    print(json.dumps({
        "status": "success",
        "engine": f"RDKit {Chem.rdBase.rdkitVersion}",
        "input": {"smiles": smiles, "name": payload.get("name")},
        "canonicalSmiles": Chem.MolToSmiles(mol),
        "descriptors": descriptors,
        "druglikeness": {
            "lipinskiRuleOf5Violations": int(ro5_violations),
            "passesLipinski": bool(ro5_violations <= 1),
            "passesVeber": bool(veber_pass),
        },
        "bindingAffinity": {
            "available": False,
            "note": "Binding affinity / docking is not computed: it requires a real docking engine (e.g. AutoDock Vina), which is not bundled. No affinity is fabricated.",
        },
        "note": "All descriptors are computed deterministically by RDKit from the parsed molecule.",
    }))


if __name__ == "__main__":
    main()
