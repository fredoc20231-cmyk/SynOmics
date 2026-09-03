#!/usr/bin/env python3
"""Sequence & molecular-biology tools (biopython) — one dispatch, many real utilities.

Tasks (payload.task):
  translate, revcomp, gc_content, orf_find, primer_tm, restriction_map,
  protein_params, codon_usage

Every value is computed by Biopython / exact string logic. Reads JSON on stdin.
Returns an honest 'unavailable' if biopython is missing.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _seq(p, key="sequence"):
    s = p.get(key) or p.get("seq")
    if not isinstance(s, str) or not s.strip():
        _fail(f"Provide a `{key}` string.")
    return s.strip().upper().replace(" ", "").replace("\n", "")


def task_translate(p):
    from Bio.Seq import Seq
    s = _seq(p)
    table = int(p.get("codonTable", 1))
    to_stop = bool(p.get("toStop", False))
    prot = str(Seq(s).translate(table=table, to_stop=to_stop))
    return {"status": "success", "analysis": "translation", "protein": prot, "length": len(prot)}


def task_revcomp(p):
    from Bio.Seq import Seq
    s = _seq(p)
    return {"status": "success", "analysis": "reverse complement",
            "reverseComplement": str(Seq(s).reverse_complement()),
            "complement": str(Seq(s).complement())}


def task_gc_content(p):
    s = _seq(p)
    if not s:
        _fail("Empty sequence.")
    gc = sum(s.count(b) for b in "GCgc")
    return {"status": "success", "analysis": "GC content",
            "gcContent": round(100.0 * gc / len(s), 3), "length": len(s),
            "counts": {b: s.count(b) for b in "ACGT"}}


def task_orf_find(p):
    from Bio.Seq import Seq
    s = _seq(p)
    min_aa = int(p.get("minAminoAcids", 20))
    seqobj = Seq(s)
    orfs = []
    for strand, nuc in (("+", seqobj), ("-", seqobj.reverse_complement())):
        n = str(nuc)
        for frame in range(3):
            i = frame
            while i < len(n) - 2:
                if n[i:i + 3] == "ATG":
                    j = i
                    while j < len(n) - 2:
                        codon = n[j:j + 3]
                        if codon in ("TAA", "TAG", "TGA"):
                            aa = (j - i) // 3
                            if aa >= min_aa:
                                orfs.append({"strand": strand, "frame": frame, "start": i, "end": j + 3, "lengthAA": aa,
                                             "protein": str(Seq(n[i:j]).translate())})
                            i = j
                            break
                        j += 3
                i += 3
    orfs.sort(key=lambda o: -o["lengthAA"])
    return {"status": "success", "analysis": "ORF finding", "nOrfs": len(orfs), "orfs": orfs[:50]}


def task_primer_tm(p):
    from Bio.SeqUtils import MeltingTemp as mt
    s = _seq(p, "primer")
    method = p.get("method", "nn")
    tm = mt.Tm_NN(s) if method == "nn" else mt.Tm_Wallace(s)
    gc = sum(s.count(b) for b in "GC")
    return {"status": "success", "analysis": "primer melting temperature",
            "primer": s, "length": len(s), "tmCelsius": round(float(tm), 2),
            "gcPercent": round(100.0 * gc / len(s), 2), "method": method}


def task_restriction_map(p):
    from Bio.Restriction import CommOnly
    from Bio.Seq import Seq
    s = _seq(p)
    enzymes = p.get("enzymes")
    seqobj = Seq(s)
    hits = {}
    batch = CommOnly
    for enz in batch:
        sites = enz.search(seqobj)
        if sites and (enzymes is None or str(enz) in enzymes):
            hits[str(enz)] = {"site": str(enz.site), "cutPositions": [int(x) for x in sites], "nCuts": len(sites)}
    top = dict(sorted(hits.items(), key=lambda kv: -kv[1]["nCuts"])[:40])
    return {"status": "success", "analysis": "restriction map", "length": len(s),
            "nEnzymesWithSites": len(hits), "enzymes": top}


def task_protein_params(p):
    from Bio.SeqUtils.ProtParam import ProteinAnalysis
    s = _seq(p, "protein")
    s = "".join(c for c in s if c in "ACDEFGHIKLMNPQRSTVWY")
    if not s:
        _fail("No standard amino acids in `protein`.")
    pa = ProteinAnalysis(s)
    return {"status": "success", "analysis": "protein parameters", "length": len(s),
            "molecularWeightDa": round(pa.molecular_weight(), 2),
            "isoelectricPoint": round(pa.isoelectric_point(), 3),
            "gravy": round(pa.gravy(), 4),
            "aromaticity": round(pa.aromaticity(), 4),
            "instabilityIndex": round(pa.instability_index(), 3),
            "secondaryStructureFraction": [round(x, 4) for x in pa.secondary_structure_fraction()]}


def task_codon_usage(p):
    s = _seq(p)
    if len(s) < 3:
        _fail("Sequence too short for codon usage.")
    codons = [s[i:i + 3] for i in range(0, len(s) - 2, 3)]
    total = len(codons)
    counts = {}
    for c in codons:
        counts[c] = counts.get(c, 0) + 1
    freq = {c: round(counts[c] / total, 5) for c in sorted(counts)}
    return {"status": "success", "analysis": "codon usage", "nCodons": total,
            "counts": {c: counts[c] for c in sorted(counts)}, "frequency": freq}


TASKS = {
    "translate": task_translate, "revcomp": task_revcomp, "gc_content": task_gc_content,
    "orf_find": task_orf_find, "primer_tm": task_primer_tm, "restriction_map": task_restriction_map,
    "protein_params": task_protein_params, "codon_usage": task_codon_usage,
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
        import Bio  # noqa: F401
    except Exception as e:
        _fail(f"seqtools requires biopython: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
