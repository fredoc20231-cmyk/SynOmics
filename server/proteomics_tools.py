#!/usr/bin/env python3
"""Proteomics utilities (biopython) — one dispatch.

Tasks: tryptic_digest (in-silico trypsin digestion), peptide_mass (monoisotopic +
average), fragment_ions (b/y ion ladder). Reads JSON on stdin.
"""
import json
import re
import sys

# Monoisotopic residue masses (Da)
MONO = {
    "G": 57.02146, "A": 71.03711, "S": 87.03203, "P": 97.05276, "V": 99.06841,
    "T": 101.04768, "C": 103.00919, "L": 113.08406, "I": 113.08406, "N": 114.04293,
    "D": 115.02694, "Q": 128.05858, "K": 128.09496, "E": 129.04259, "M": 131.04049,
    "H": 137.05891, "F": 147.06841, "R": 156.10111, "Y": 163.06333, "W": 186.07931,
}
WATER = 18.010565
PROTON = 1.007276


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _clean(seq):
    return "".join(c for c in str(seq).upper() if c in MONO)


def task_peptide_mass(p):
    seq = _clean(p.get("peptide", ""))
    if not seq:
        _fail("peptide_mass needs a `peptide` (standard amino acids).")
    mono = sum(MONO[c] for c in seq) + WATER
    return {"status": "success", "analysis": "peptide mass", "peptide": seq, "length": len(seq),
            "monoisotopicMass": round(mono, 5), "mzSinglyCharged": round(mono + PROTON, 5),
            "mzDoublyCharged": round((mono + 2 * PROTON) / 2, 5)}


def task_tryptic_digest(p):
    seq = _clean(p.get("protein", ""))
    if not seq:
        _fail("tryptic_digest needs a `protein` sequence.")
    missed = int(p.get("missedCleavages", 0))
    # cut after K or R, not before P
    sites = [0]
    for m in re.finditer(r"[KR](?!P)", seq):
        sites.append(m.end())
    if sites[-1] != len(seq):
        sites.append(len(seq))
    base = [seq[sites[i]:sites[i + 1]] for i in range(len(sites) - 1)]
    peptides = []
    for i in range(len(base)):
        for mc in range(missed + 1):
            if i + mc < len(base):
                pep = "".join(base[i:i + mc + 1])
                if pep:
                    peptides.append(pep)
    uniq = sorted(set(peptides))
    out = [{"peptide": pep, "length": len(pep), "monoisotopicMass": round(sum(MONO[c] for c in pep) + WATER, 4)}
           for pep in uniq]
    return {"status": "success", "analysis": "in-silico tryptic digest", "nPeptides": len(out),
            "missedCleavages": missed, "peptides": out}


def task_fragment_ions(p):
    seq = _clean(p.get("peptide", ""))
    if len(seq) < 2:
        _fail("fragment_ions needs a `peptide` of length >=2.")
    b = []
    running = 0.0
    for i in range(len(seq) - 1):
        running += MONO[seq[i]]
        b.append(round(running + PROTON, 4))
    y = []
    running = WATER
    for i in range(len(seq) - 1, 0, -1):
        running += MONO[seq[i]]
        y.append(round(running + PROTON, 4))
    return {"status": "success", "analysis": "b/y fragment ions (singly charged)",
            "peptide": seq, "bIons": b, "yIons": y}


TASKS = {"peptide_mass": task_peptide_mass, "tryptic_digest": task_tryptic_digest, "fragment_ions": task_fragment_ions}


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
