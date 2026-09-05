#!/usr/bin/env python3
"""ADMET / drug-likeness / medicinal-chemistry tools — single dispatch.

Reads a JSON payload on stdin and prints a JSON result on stdout. Zero
hallucination: every reported value is computed by real RDKit descriptor
calculators, published rule sets, the Ertl synthetic-accessibility scorer, or
the RDKit FilterCatalog — nothing is fabricated. If a molecule's SMILES cannot
be parsed by RDKit, that entry is honestly marked as an error; if RDKit (or the
SA-score contrib) is not importable, the task returns status "unavailable".

Tasks
-----
- admet_profile        : physicochemical / ADMET descriptor panel per molecule
  (MW, logP, TPSA, HBD, HBA, rotatable bonds, aromatic rings, Fsp3, molar
  refractivity, heavy atoms, formal charge, ring count, QED). Batch-safe.
- druglikeness_rules   : Lipinski Ro5, Veber, Ghose, Egan, Muegge pass/fail with
  the exact violated criteria for each rule set.
- synthetic_accessibility : Ertl SA score (1 easy .. 10 hard) via the RDKit
  contrib scorer, plus a plain-language interpretation.
- structural_alerts    : PAINS + BRENK + NIH FilterCatalog substructure alerts.

All thresholds are the published constants for each rule; no value is invented.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


# --------------------------------------------------------------------------- #
# Shared helper — compute the full RDKit descriptor panel for one molecule.
# --------------------------------------------------------------------------- #
def _descriptors(mol):
    """Return the rounded descriptor dict for a sanitized RDKit mol."""
    from rdkit import Chem
    from rdkit.Chem import QED, Crippen, Descriptors, Lipinski, rdMolDescriptors

    return {
        "molecularWeight": round(float(Descriptors.MolWt(mol)), 4),
        "logP": round(float(Crippen.MolLogP(mol)), 4),
        "tpsa": round(float(rdMolDescriptors.CalcTPSA(mol)), 4),
        "hBondDonors": int(Lipinski.NumHDonors(mol)),
        "hBondAcceptors": int(Lipinski.NumHAcceptors(mol)),
        "rotatableBonds": int(Lipinski.NumRotatableBonds(mol)),
        "aromaticRings": int(rdMolDescriptors.CalcNumAromaticRings(mol)),
        "fractionCsp3": round(float(rdMolDescriptors.CalcFractionCSP3(mol)), 4),
        "molarRefractivity": round(float(Crippen.MolMR(mol)), 4),
        "heavyAtoms": int(mol.GetNumHeavyAtoms()),
        "formalCharge": int(Chem.GetFormalCharge(mol)),
        "numRings": int(rdMolDescriptors.CalcNumRings(mol)),
        "qed": round(float(QED.qed(mol)), 4),
    }


def _collect_smiles(p):
    """Normalise `smiles` / `smilesList` into a list; validate presence."""
    smiles_list = p.get("smilesList")
    if smiles_list is not None:
        if not isinstance(smiles_list, list) or not smiles_list:
            _fail("`smilesList` must be a non-empty list of SMILES strings.")
        return [str(s) for s in smiles_list]
    smiles = p.get("smiles")
    if smiles is None:
        _fail("Provide `smiles` (a SMILES string) or `smilesList` (list of them).")
    return [str(smiles)]


# --------------------------------------------------------------------------- #
# Task 1 — ADMET / physicochemical descriptor profile
# --------------------------------------------------------------------------- #
def task_admet_profile(p):
    try:
        from rdkit import Chem, RDLogger
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"admet_profile requires rdkit: {e}", status="unavailable")

    RDLogger.DisableLog("rdApp.*")  # silence parse warnings on invalid SMILES
    smiles_inputs = _collect_smiles(p)

    profiles = []
    n_valid = 0
    for smi in smiles_inputs:
        mol = Chem.MolFromSmiles(smi)
        if mol is None:
            # Honest error entry — an unparsable SMILES never crashes the batch.
            profiles.append({"smiles": smi, "error": "RDKit could not parse this SMILES."})
            continue
        entry = {"smiles": smi}
        entry.update(_descriptors(mol))
        profiles.append(entry)
        n_valid += 1

    n_total = len(profiles)
    n_invalid = n_total - n_valid
    analysis = (
        f"Computed a 13-descriptor ADMET/physicochemical panel for {n_valid} of "
        f"{n_total} molecule(s) via RDKit"
        + (f" ({n_invalid} unparsable and flagged)." if n_invalid else ".")
    )

    rows = ""
    for e in profiles:
        if "error" in e:
            rows += f"| `{e['smiles']}` | (unparsable) |\n"
        else:
            rows += (
                f"| `{e['smiles']}` | MW={e['molecularWeight']}, "
                f"logP={e['logP']}, TPSA={e['tpsa']}, QED={e['qed']} |\n"
            )
    research_log = (
        "# ADMET / physicochemical descriptor profile\n\n"
        f"For each input SMILES the molecule was parsed with RDKit "
        "(`Chem.MolFromSmiles`) and, when valid, profiled with 13 real "
        "descriptor calculators:\n\n"
        "- **molecularWeight** `Descriptors.MolWt`\n"
        "- **logP** `Crippen.MolLogP`\n"
        "- **tpsa** `rdMolDescriptors.CalcTPSA`\n"
        "- **hBondDonors / hBondAcceptors** `Lipinski.NumHDonors/NumHAcceptors`\n"
        "- **rotatableBonds** `Lipinski.NumRotatableBonds`\n"
        "- **aromaticRings** `rdMolDescriptors.CalcNumAromaticRings`\n"
        "- **fractionCsp3** `rdMolDescriptors.CalcFractionCSP3`\n"
        "- **molarRefractivity** `Crippen.MolMR`\n"
        "- **heavyAtoms** `Mol.GetNumHeavyAtoms`\n"
        "- **formalCharge** `Chem.GetFormalCharge`\n"
        "- **numRings** `rdMolDescriptors.CalcNumRings`\n"
        "- **qed** `QED.qed` (quantitative estimate of drug-likeness)\n\n"
        f"| Molecule | Key descriptors |\n| --- | --- |\n{rows}\n"
        "Unparsable SMILES are reported as error entries rather than crashing "
        "the batch; no descriptor value is fabricated."
    )

    return {
        "status": "success",
        "analysis": analysis,
        "profiles": profiles,
        "nMolecules": n_total,
        "nValid": n_valid,
        "nInvalid": n_invalid,
        "researchLog": research_log,
    }


# --------------------------------------------------------------------------- #
# Task 2 — drug-likeness rule sets (Lipinski, Veber, Ghose, Egan, Muegge)
# --------------------------------------------------------------------------- #
def _druglikeness(d):
    """Evaluate the five published rule sets against a descriptor dict `d`."""
    mw = d["molecularWeight"]
    logp = d["logP"]
    tpsa = d["tpsa"]
    hbd = d["hBondDonors"]
    hba = d["hBondAcceptors"]
    rot = d["rotatableBonds"]
    mr = d["molarRefractivity"]
    atoms = d["heavyAtoms"]
    rings = d["numRings"]

    rules = {}

    # Lipinski rule of five: <=1 violation is the classic pass criterion.
    lip_v = []
    if mw > 500:
        lip_v.append(f"MW {mw} > 500")
    if logp > 5:
        lip_v.append(f"logP {logp} > 5")
    if hbd > 5:
        lip_v.append(f"HBD {hbd} > 5")
    if hba > 10:
        lip_v.append(f"HBA {hba} > 10")
    rules["lipinski"] = {
        "pass": len(lip_v) <= 1,
        "nViolations": len(lip_v),
        "violations": lip_v,
    }

    # Veber: oral bioavailability — rotatable bonds and polar surface area.
    veb_v = []
    if rot > 10:
        veb_v.append(f"rotatableBonds {rot} > 10")
    if tpsa > 140:
        veb_v.append(f"TPSA {tpsa} > 140")
    rules["veber"] = {"pass": len(veb_v) == 0, "violations": veb_v}

    # Ghose: drug-like range on MW, logP, molar refractivity, heavy-atom count.
    gho_v = []
    if not (160 <= mw <= 480):
        gho_v.append(f"MW {mw} outside [160, 480]")
    if not (-0.4 <= logp <= 5.6):
        gho_v.append(f"logP {logp} outside [-0.4, 5.6]")
    if not (40 <= mr <= 130):
        gho_v.append(f"molarRefractivity {mr} outside [40, 130]")
    if not (20 <= atoms <= 70):
        gho_v.append(f"heavyAtoms {atoms} outside [20, 70]")
    rules["ghose"] = {"pass": len(gho_v) == 0, "violations": gho_v}

    # Egan: absorption model on TPSA and logP.
    egan_v = []
    if tpsa > 131.6:
        egan_v.append(f"TPSA {tpsa} > 131.6")
    if logp > 5.88:
        egan_v.append(f"logP {logp} > 5.88")
    rules["egan"] = {"pass": len(egan_v) == 0, "violations": egan_v}

    # Muegge: pharmacophore-point / property-window filter.
    mue_v = []
    if not (200 <= mw <= 600):
        mue_v.append(f"MW {mw} outside [200, 600]")
    if not (-2 <= logp <= 5):
        mue_v.append(f"logP {logp} outside [-2, 5]")
    if tpsa > 150:
        mue_v.append(f"TPSA {tpsa} > 150")
    if rings > 7:
        mue_v.append(f"numRings {rings} > 7")
    if rot > 15:
        mue_v.append(f"rotatableBonds {rot} > 15")
    if hba > 10:
        mue_v.append(f"HBA {hba} > 10")
    if hbd > 5:
        mue_v.append(f"HBD {hbd} > 5")
    rules["muegge"] = {"pass": len(mue_v) == 0, "violations": mue_v}

    return rules


def task_druglikeness_rules(p):
    try:
        from rdkit import Chem, RDLogger
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"druglikeness_rules requires rdkit: {e}", status="unavailable")

    RDLogger.DisableLog("rdApp.*")
    smiles = p.get("smiles")
    if smiles is None:
        _fail("Provide `smiles` (a SMILES string).")
    smiles = str(smiles)

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        _fail(f"RDKit could not parse SMILES {smiles!r}.")

    d = _descriptors(mol)
    rules = _druglikeness(d)

    n_pass = sum(1 for r in rules.values() if r["pass"])
    passed_names = [name for name, r in rules.items() if r["pass"]]
    failed_names = [name for name, r in rules.items() if not r["pass"]]
    analysis = (
        f"Evaluated 5 drug-likeness rule sets for `{smiles}`: passes "
        f"{n_pass}/5 ({', '.join(passed_names) or 'none'})"
        + (f"; fails {', '.join(failed_names)}." if failed_names else ".")
    )

    rule_rows = ""
    for name, r in rules.items():
        viols = "; ".join(r["violations"]) if r["violations"] else "none"
        rule_rows += f"| {name} | {'PASS' if r['pass'] else 'FAIL'} | {viols} |\n"
    research_log = (
        "# Drug-likeness rule-set evaluation\n\n"
        f"Descriptors were computed for `{smiles}` with RDKit and tested against "
        "five published filters using their exact thresholds:\n\n"
        "- **Lipinski Ro5**: MW<=500, logP<=5, HBD<=5, HBA<=10 (pass if "
        "<=1 violation).\n"
        "- **Veber**: rotatableBonds<=10 and TPSA<=140.\n"
        "- **Ghose**: 160<=MW<=480, -0.4<=logP<=5.6, 40<=MR<=130, "
        "20<=heavyAtoms<=70.\n"
        "- **Egan**: TPSA<=131.6 and logP<=5.88.\n"
        "- **Muegge**: 200<=MW<=600, -2<=logP<=5, TPSA<=150, numRings<=7, "
        "rotatableBonds<=15, HBA<=10, HBD<=5.\n\n"
        f"| Rule | Result | Violations |\n| --- | --- | --- |\n{rule_rows}\n"
        f"Underlying descriptors: MW={d['molecularWeight']}, logP={d['logP']}, "
        f"TPSA={d['tpsa']}, HBD={d['hBondDonors']}, HBA={d['hBondAcceptors']}, "
        f"rotatableBonds={d['rotatableBonds']}, MR={d['molarRefractivity']}, "
        f"heavyAtoms={d['heavyAtoms']}, numRings={d['numRings']}."
    )

    return {
        "status": "success",
        "analysis": analysis,
        "smiles": smiles,
        "descriptors": d,
        "rules": rules,
        "nRulesPassed": n_pass,
        "nRulesTotal": len(rules),
        "researchLog": research_log,
    }


# --------------------------------------------------------------------------- #
# Task 3 — synthetic accessibility (Ertl SA score, RDKit contrib scorer)
# --------------------------------------------------------------------------- #
def task_synthetic_accessibility(p):
    try:
        from rdkit import Chem, RDLogger
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"synthetic_accessibility requires rdkit: {e}", status="unavailable")

    # The Ertl SA scorer lives in RDKit's contrib tree, not the main package.
    try:
        import os
        import sys as _sys

        from rdkit.Chem import RDConfig

        _sys.path.append(os.path.join(RDConfig.RDContribDir, "SA_Score"))
        import sascorer
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(
            f"synthetic_accessibility requires the RDKit SA_Score contrib "
            f"(sascorer): {e}",
            status="unavailable",
        )

    RDLogger.DisableLog("rdApp.*")
    smiles = p.get("smiles")
    if smiles is None:
        _fail("Provide `smiles` (a SMILES string).")
    smiles = str(smiles)

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        _fail(f"RDKit could not parse SMILES {smiles!r}.")

    score = float(sascorer.calculateScore(mol))
    if score <= 3.0:
        interpretation = "easy"
    elif score <= 6.0:
        interpretation = "moderate"
    else:
        interpretation = "difficult"

    analysis = (
        f"Ertl synthetic-accessibility score for `{smiles}` = "
        f"{round(score, 3)} (1=easy .. 10=hard) -> {interpretation} synthesis."
    )
    research_log = (
        "# Synthetic accessibility (Ertl SA score)\n\n"
        f"The molecule `{smiles}` was scored with the RDKit contrib "
        "implementation of the Ertl & Schuffenhauer synthetic-accessibility "
        "score (`SA_Score/sascorer.calculateScore`), which combines fragment "
        "contributions (frequency in PubChem) with a complexity penalty.\n\n"
        f"| Metric | Value |\n| --- | --- |\n"
        f"| SA score | {round(score, 3)} |\n"
        f"| Scale | 1 (easy) .. 10 (hard) |\n"
        f"| Interpretation | {interpretation} |\n\n"
        "Cutoffs: <=3 easy, 3-6 moderate, >6 difficult synthesis."
    )

    return {
        "status": "success",
        "analysis": analysis,
        "smiles": smiles,
        "saScore": round(score, 3),
        "interpretation": interpretation,
        "researchLog": research_log,
    }


# --------------------------------------------------------------------------- #
# Task 4 — structural alerts (PAINS + BRENK + NIH FilterCatalog)
# --------------------------------------------------------------------------- #
def task_structural_alerts(p):
    try:
        from rdkit import Chem, RDLogger
        from rdkit.Chem import FilterCatalog
        from rdkit.Chem.FilterCatalog import FilterCatalogParams
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"structural_alerts requires rdkit: {e}", status="unavailable")

    RDLogger.DisableLog("rdApp.*")
    smiles = p.get("smiles")
    if smiles is None:
        _fail("Provide `smiles` (a SMILES string).")
    smiles = str(smiles)

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        _fail(f"RDKit could not parse SMILES {smiles!r}.")

    params = FilterCatalogParams()
    for cat in (
        FilterCatalogParams.FilterCatalogs.PAINS,
        FilterCatalogParams.FilterCatalogs.BRENK,
        FilterCatalogParams.FilterCatalogs.NIH,
    ):
        params.AddCatalog(cat)
    fc = FilterCatalog.FilterCatalog(params)

    matches = fc.GetMatches(mol)
    alerts = []
    for m in matches:
        try:
            catalog = m.GetProp("FilterSet")
        except Exception:
            catalog = "unknown"
        alerts.append({"description": m.GetDescription(), "catalog": catalog})

    n_alerts = len(alerts)
    analysis = (
        f"Screened `{smiles}` against PAINS + BRENK + NIH structural-alert "
        f"catalogs: {n_alerts} alert(s) matched"
        + (
            f" ({', '.join(sorted({a['catalog'] for a in alerts}))})."
            if n_alerts
            else " — clean (no known problematic substructures)."
        )
    )
    alert_rows = "".join(
        f"| {a['description']} | {a['catalog']} |\n" for a in alerts
    )
    research_log = (
        "# Structural alerts (PAINS / BRENK / NIH)\n\n"
        f"The molecule `{smiles}` was screened with the RDKit `FilterCatalog` "
        "loaded with three published substructure catalogs:\n\n"
        "- **PAINS**: pan-assay interference compounds (frequent-hitter "
        "substructures).\n"
        "- **BRENK**: unstable / reactive / toxicophore fragments.\n"
        "- **NIH**: NIH annotated reactive/undesirable substructures.\n\n"
        + (
            f"| Alert | Catalog |\n| --- | --- |\n{alert_rows}\n"
            if n_alerts
            else "No catalog substructure matched — a clean result.\n\n"
        )
        + f"Total alerts: **{n_alerts}**. Zero matches is a valid, honest "
        "clean result; matches are reported exactly as returned by the catalog."
    )

    return {
        "status": "success",
        "analysis": analysis,
        "smiles": smiles,
        "alerts": alerts,
        "nAlerts": n_alerts,
        "researchLog": research_log,
    }


# --------------------------------------------------------------------------- #
# Dispatch
# --------------------------------------------------------------------------- #
TASKS = {
    "admet_profile": task_admet_profile,
    "druglikeness_rules": task_druglikeness_rules,
    "synthetic_accessibility": task_synthetic_accessibility,
    "structural_alerts": task_structural_alerts,
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
