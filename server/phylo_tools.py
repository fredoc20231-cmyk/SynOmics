#!/usr/bin/env python3
"""Phylogenetics (biopython) — one dispatch.

Tasks: distance_matrix, nj_tree (Newick), upgma_tree (Newick), patristic.
Input `sequences`: {name: aligned_sequence} (equal length). Reads JSON on stdin.
"""
import io
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _aln(p):
    from Bio.Align import MultipleSeqAlignment
    from Bio.Seq import Seq
    from Bio.SeqRecord import SeqRecord
    seqs = p.get("sequences")
    if not isinstance(seqs, dict) or len(seqs) < 3:
        _fail("Provide `sequences`: {name: aligned_seq} with >=3 taxa.")
    lens = {len(v) for v in seqs.values()}
    if len(lens) != 1:
        _fail("All sequences must be the same (aligned) length.")
    recs = [SeqRecord(Seq(str(v)), id=str(k)) for k, v in seqs.items()]
    return MultipleSeqAlignment(recs)


def _dm(aln):
    from Bio.Phylo.TreeConstruction import DistanceCalculator
    return DistanceCalculator("identity").get_distance(aln)


def task_distance_matrix(p):
    aln = _aln(p)
    dm = _dm(aln)
    names = list(dm.names)
    mat = [[round(float(dm[i, j]), 6) for j in range(len(names))] for i in range(len(names))]
    return {"status": "success", "analysis": "identity distance matrix", "names": names, "matrix": mat}


def _newick(tree):
    buf = io.StringIO()
    from Bio import Phylo
    Phylo.write(tree, buf, "newick")
    return buf.getvalue().strip()


def task_nj_tree(p):
    from Bio.Phylo.TreeConstruction import DistanceTreeConstructor
    aln = _aln(p)
    tree = DistanceTreeConstructor().nj(_dm(aln))
    return {"status": "success", "analysis": "neighbor-joining tree", "newick": _newick(tree),
            "nTerminals": tree.count_terminals()}


def task_upgma_tree(p):
    from Bio.Phylo.TreeConstruction import DistanceTreeConstructor
    aln = _aln(p)
    tree = DistanceTreeConstructor().upgma(_dm(aln))
    return {"status": "success", "analysis": "UPGMA tree", "newick": _newick(tree),
            "nTerminals": tree.count_terminals()}


def task_patristic(p):
    from Bio.Phylo.TreeConstruction import DistanceTreeConstructor
    aln = _aln(p)
    tree = DistanceTreeConstructor().nj(_dm(aln))
    terms = tree.get_terminals()
    names = [t.name for t in terms]
    pat = {}
    for i in range(len(terms)):
        for j in range(i + 1, len(terms)):
            d = tree.distance(terms[i], terms[j])
            pat[f"{names[i]}|{names[j]}"] = round(float(d), 6)
    return {"status": "success", "analysis": "patristic distances (from NJ tree)", "distances": pat}


TASKS = {"distance_matrix": task_distance_matrix, "nj_tree": task_nj_tree,
         "upgma_tree": task_upgma_tree, "patristic": task_patristic}


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
        _fail(f"phylo_tools requires biopython: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
