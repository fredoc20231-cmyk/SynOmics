#!/usr/bin/env python3
"""Protein multiple-sequence-alignment (MSA) conservation — one dispatch.

Task: protein_conservation. Given a PRE-ALIGNED MSA (sequences of EQUAL length),
compute per-column Shannon entropy and a conservation score. Reads JSON on stdin,
prints JSON on stdout.

Conventions (documented, zero hallucination — all values are computed):
  * Gaps: the gap character '-' is treated as ITS OWN symbol (not ignored), so a
    column of all gaps is "conserved" (entropy 0) and a mix of residue+gap raises
    entropy honestly.
  * Per-column Shannon entropy  H = -Σ p_i · log2(p_i)  over residue frequencies
    p_i = count_i / nSequences in that column (units: bits).
  * Conservation score = 1 - H / Hmax, where Hmax = log2(K) and K = the number of
    DISTINCT symbols observed across the ENTIRE alignment (gaps included). When
    K <= 1 (only one symbol in the whole MSA) Hmax is undefined (log2(1)=0); in
    that degenerate case every column has H=0 and conservation is defined as 1.0.
    The score is clamped to [0, 1].
"""
import json
import math
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _column_entropy(column):
    """Shannon entropy (bits) of one alignment column (list of symbols)."""
    n = len(column)
    counts = {}
    for sym in column:
        counts[sym] = counts.get(sym, 0) + 1
    h = 0.0
    for c in counts.values():
        p = c / n
        h -= p * math.log2(p)
    # -0.0 -> 0.0 for clean equality against ground truth
    return abs(h) if h == 0.0 else h


def task_protein_conservation(p):
    seqs = p.get("sequences")
    if not isinstance(seqs, list) or len(seqs) == 0:
        _fail("protein_conservation needs `sequences`: a non-empty array of "
              "aligned protein strings.")
    if not all(isinstance(s, str) for s in seqs):
        _fail("All entries in `sequences` must be strings.")
    if any(len(s) == 0 for s in seqs):
        _fail("Sequences must be non-empty.")

    lengths = {len(s) for s in seqs}
    if len(lengths) != 1:
        _fail(
            "Sequences are not aligned: they have unequal lengths "
            f"{sorted(lengths)}. Provide a pre-aligned MSA of EQUAL-length "
            "sequences (this tool does not pad or realign)."
        )

    n_seq = len(seqs)
    length = next(iter(lengths))

    # Distinct symbols across the whole alignment (gaps '-' counted as a symbol).
    distinct = set()
    for s in seqs:
        distinct.update(s)
    k = len(distinct)
    hmax = math.log2(k) if k > 1 else 0.0

    per_column = []
    entropies = []
    most_conserved = []
    for col_idx in range(length):
        column = [s[col_idx] for s in seqs]
        h = _column_entropy(column)
        if hmax > 0.0:
            conservation = 1.0 - h / hmax
        else:
            conservation = 1.0  # single-symbol MSA: fully conserved
        conservation = max(0.0, min(1.0, conservation))
        pos = col_idx + 1
        entropies.append(h)
        per_column.append({
            "position": pos,
            "entropyBits": round(h, 6),
            "conservation": round(conservation, 6),
        })
        if h == 0.0:
            most_conserved.append(pos)

    mean_entropy = sum(entropies) / len(entropies) if entropies else 0.0

    result = {
        "status": "success",
        "analysis": (
            f"Per-column Shannon-entropy conservation over an MSA of {n_seq} "
            f"sequences x {length} columns (K={k} distinct symbols, "
            f"Hmax=log2(K)={round(hmax, 6)} bits)."
        ),
        "perColumn": per_column,
        "meanEntropy": round(mean_entropy, 6),
        "mostConserved": most_conserved,
        "length": length,
        "nSequences": n_seq,
        "distinctSymbols": sorted(distinct),
        "hmaxBits": round(hmax, 6),
        "researchLog": _research_log(n_seq, length, k, hmax, mean_entropy,
                                     most_conserved, per_column),
    }

    output_dir = p.get("outputDir")
    if output_dir:
        result["bundle"] = _bundle(output_dir, seqs, result)
    return result


def _research_log(n_seq, length, k, hmax, mean_entropy, most_conserved, per_column):
    lines = [
        "# Protein MSA conservation analysis",
        "",
        f"- Sequences (rows): **{n_seq}**",
        f"- Alignment length (columns): **{length}**",
        f"- Distinct symbols observed (gaps counted): **{k}** "
        f"(Hmax = log2(K) = {round(hmax, 6)} bits)",
        f"- Mean per-column entropy: **{round(mean_entropy, 6)} bits**",
        f"- Fully conserved columns (entropy 0): **{len(most_conserved)}** "
        f"of {length}",
        "",
        "## Method",
        "For each column the Shannon entropy H = -Σ p_i·log2(p_i) is computed over "
        "residue frequencies (the gap '-' is treated as its own symbol). The "
        "conservation score is 1 - H/Hmax with Hmax = log2(K) over the K distinct "
        "symbols in the whole alignment, clamped to [0, 1].",
        "",
        "## Most conserved positions (entropy 0)",
        (", ".join(str(x) for x in most_conserved) if most_conserved
         else "_none_"),
    ]
    return "\n".join(lines)


def _reproducer_code(seqs):
    return (
        "#!/usr/bin/env python3\n"
        '"""Standalone reproducer for protein MSA conservation (Shannon entropy)."""\n'
        "import math\n\n"
        f"sequences = {seqs!r}\n\n"
        "lengths = {len(s) for s in sequences}\n"
        "assert len(lengths) == 1, f'unequal lengths {sorted(lengths)}'\n"
        "n = len(sequences); L = next(iter(lengths))\n"
        "distinct = set().union(*[set(s) for s in sequences])\n"
        "K = len(distinct)\n"
        "hmax = math.log2(K) if K > 1 else 0.0\n\n"
        "def col_entropy(col):\n"
        "    counts = {}\n"
        "    for c in col:\n"
        "        counts[c] = counts.get(c, 0) + 1\n"
        "    h = 0.0\n"
        "    for cnt in counts.values():\n"
        "        p = cnt / len(col)\n"
        "        h -= p * math.log2(p)\n"
        "    return abs(h) if h == 0.0 else h\n\n"
        "for j in range(L):\n"
        "    col = [s[j] for s in sequences]\n"
        "    h = col_entropy(col)\n"
        "    cons = (1.0 - h / hmax) if hmax > 0 else 1.0\n"
        "    cons = max(0.0, min(1.0, cons))\n"
        "    print(f'pos {j + 1}: entropy={h:.6f} bits  conservation={cons:.6f}')\n"
    )


def _bundle(output_dir, seqs, result):
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except Exception as e:  # pragma: no cover - exercised only w/o matplotlib
        _fail(f"Outcome bundle requires matplotlib: {e}", status="unavailable")
    from outcome_bundle import apply_palette, build_bundle

    per_column = result["perColumn"]
    positions = [row["position"] for row in per_column]
    entropies = [row["entropyBits"] for row in per_column]

    fig, ax = plt.subplots(figsize=(max(4, len(positions) * 0.4), 3.2))
    ax.bar(positions, entropies, color="#00B4D8")
    ax.set_xlabel("Alignment column (1-based)")
    ax.set_ylabel("Shannon entropy (bits)")
    ax.set_title("Per-column conservation (lower = more conserved)")
    apply_palette(ax)

    methods = (
        "Per-column Shannon entropy H = -Σ p_i·log2(p_i) over residue "
        "frequencies (gap '-' treated as its own symbol). Conservation score = "
        "1 - H/Hmax, Hmax = log2(K) over K distinct symbols in the alignment, "
        "clamped to [0, 1]."
    )
    interpretation = (
        f"{len(result['mostConserved'])} of {result['length']} columns are fully "
        f"conserved (entropy 0). Mean per-column entropy is "
        f"{result['meanEntropy']} bits."
    )

    manifest = build_bundle(
        output_dir,
        tool="protein_conservation",
        title="Protein MSA Conservation",
        result={k: v for k, v in result.items() if k not in ("researchLog",)},
        research_log=result["researchLog"],
        figures=[("per_column_entropy", fig)],
        tables=[("per_column_conservation", per_column)],
        code=_reproducer_code(seqs),
        methods=methods,
        interpretation=interpretation,
    )
    plt.close(fig)
    return manifest


TASKS = {"protein_conservation": task_protein_conservation}


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
