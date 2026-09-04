#!/usr/bin/env python3
"""Pairwise alignment & sequence distance (biopython) — one dispatch.

Tasks: global_align, local_align, percent_identity, kmer_distance.
Reads JSON on stdin.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _pair(p):
    a, b = p.get("seq1"), p.get("seq2")
    if not (isinstance(a, str) and isinstance(b, str) and a and b):
        _fail("Provide `seq1` and `seq2`.")
    return a.strip().upper(), b.strip().upper()


def _aligner(mode, p):
    from Bio.Align import PairwiseAligner
    al = PairwiseAligner()
    al.mode = mode
    al.match_score = float(p.get("match", 2.0))
    al.mismatch_score = float(p.get("mismatch", -1.0))
    al.open_gap_score = float(p.get("gapOpen", -2.0))
    al.extend_gap_score = float(p.get("gapExtend", -0.5))
    return al


def _identity(aln):
    a, b = str(aln[0]), str(aln[1])
    same = sum(1 for x, y in zip(a, b) if x == y and x != "-")
    aligned = sum(1 for x, y in zip(a, b) if x != "-" and y != "-")
    return same, aligned


def task_global_align(p):
    s1, s2 = _pair(p)
    aln = _aligner("global", p).align(s1, s2)[0]
    same, aligned = _identity(aln)
    return {"status": "success", "analysis": "global (Needleman-Wunsch) alignment",
            "score": float(aln.score), "identity": round(100.0 * same / aligned, 3) if aligned else 0.0,
            "alignment": str(aln).strip().split("\n")}


def task_local_align(p):
    s1, s2 = _pair(p)
    aln = _aligner("local", p).align(s1, s2)[0]
    same, aligned = _identity(aln)
    return {"status": "success", "analysis": "local (Smith-Waterman) alignment",
            "score": float(aln.score), "identity": round(100.0 * same / aligned, 3) if aligned else 0.0,
            "alignment": str(aln).strip().split("\n")}


def task_percent_identity(p):
    s1, s2 = _pair(p)
    aln = _aligner("global", p).align(s1, s2)[0]
    same, aligned = _identity(aln)
    return {"status": "success", "analysis": "percent identity (global alignment)",
            "identity": round(100.0 * same / aligned, 3) if aligned else 0.0,
            "matches": same, "alignedColumns": aligned}


def task_kmer_distance(p):
    s1, s2 = _pair(p)
    k = int(p.get("k", 3))
    if len(s1) < k or len(s2) < k:
        _fail("Sequences shorter than k.")
    A = {s1[i:i + k] for i in range(len(s1) - k + 1)}
    B = {s2[i:i + k] for i in range(len(s2) - k + 1)}
    jac = len(A & B) / len(A | B) if (A | B) else 0.0
    return {"status": "success", "analysis": f"{k}-mer Jaccard distance", "k": k,
            "sharedKmers": len(A & B), "jaccardSimilarity": round(jac, 6), "distance": round(1 - jac, 6)}


TASKS = {"global_align": task_global_align, "local_align": task_local_align,
         "percent_identity": task_percent_identity, "kmer_distance": task_kmer_distance}


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
        _fail(f"align_tools requires biopython: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
