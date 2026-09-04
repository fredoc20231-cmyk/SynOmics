#!/usr/bin/env python3
"""Codon-optimization tools — one dispatch, real deterministic computation.

Tasks (payload.task):
  codon_optimize

Zero-hallucination contract: every returned value (optimized sequence, CAI,
per-codon relative adaptiveness) is computed from the caller-supplied coding
sequence and host codon-usage table using the standard genetic code (NCBI
translation table 1), which is hardcoded below. Nothing is fabricated.

Host codon-usage table schema (documented, single chosen schema)
----------------------------------------------------------------
`hostCodonUsage` is a flat map ``{codon: relativeFrequency, ...}`` where each key
is an UPPERCASE DNA codon (A/C/G/T, length 3) and each value is a non-negative
number giving that codon's usage frequency in the host. Frequencies need not sum
to 1; only *relative* magnitudes within each synonymous-codon group matter. The
per-amino-acid synonymous groups are derived from the hardcoded standard genetic
code, so the table does NOT need to be grouped by amino acid. A table covering
all 64 codons is recommended, but a partial table is accepted as long as every
codon that appears in the input sequence is present in the table.

Reads JSON on stdin, prints JSON on stdout.
"""
import json
import math
import sys

# --- Standard genetic code (NCBI translation table 1), DNA codons -> 1-letter AA ---
CODON_TABLE = {
    "TTT": "F", "TTC": "F", "TTA": "L", "TTG": "L",
    "CTT": "L", "CTC": "L", "CTA": "L", "CTG": "L",
    "ATT": "I", "ATC": "I", "ATA": "I", "ATG": "M",
    "GTT": "V", "GTC": "V", "GTA": "V", "GTG": "V",
    "TCT": "S", "TCC": "S", "TCA": "S", "TCG": "S",
    "CCT": "P", "CCC": "P", "CCA": "P", "CCG": "P",
    "ACT": "T", "ACC": "T", "ACA": "T", "ACG": "T",
    "GCT": "A", "GCC": "A", "GCA": "A", "GCG": "A",
    "TAT": "Y", "TAC": "Y", "TAA": "*", "TAG": "*",
    "CAT": "H", "CAC": "H", "CAA": "Q", "CAG": "Q",
    "AAT": "N", "AAC": "N", "AAA": "K", "AAG": "K",
    "GAT": "D", "GAC": "D", "GAA": "E", "GAG": "E",
    "TGT": "C", "TGC": "C", "TGA": "*", "TGG": "W",
    "CGT": "R", "CGC": "R", "CGA": "R", "CGG": "R",
    "AGT": "S", "AGC": "S", "AGA": "R", "AGG": "R",
    "GGT": "G", "GGC": "G", "GGA": "G", "GGG": "G",
}

# amino acid -> list of synonymous codons (derived from the standard code)
SYNONYMS = {}
for _cod, _aa in CODON_TABLE.items():
    SYNONYMS.setdefault(_aa, []).append(_cod)
for _aa in SYNONYMS:
    SYNONYMS[_aa] = sorted(SYNONYMS[_aa])


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _clean_seq(s):
    if not isinstance(s, str) or not s.strip():
        _fail("Provide a coding DNA `sequence` string.")
    seq = s.strip().upper().replace(" ", "").replace("\n", "").replace("\r", "")
    if len(seq) == 0:
        _fail("Empty sequence.")
    if len(seq) % 3 != 0:
        _fail(f"Sequence length {len(seq)} is not a multiple of 3.")
    bad = set(seq) - set("ACGT")
    if bad:
        _fail(f"Sequence contains non-ACGT characters: {sorted(bad)}.")
    return seq


def _geometric_mean(ws):
    """Exact geometric mean via log-space (robust to underflow on long genes).

    If any relative adaptiveness is 0 the geometric mean is 0 (CAI convention)."""
    if not ws:
        return 0.0
    if any(w <= 0.0 for w in ws):
        return 0.0
    return math.exp(sum(math.log(w) for w in ws) / len(ws))


def codon_optimize(p):
    seq = _clean_seq(p.get("sequence"))
    host_raw = p.get("hostCodonUsage")
    if not isinstance(host_raw, dict) or not host_raw:
        _fail("Provide `hostCodonUsage` as a {codon: frequency} object.")

    # normalize host table keys; validate schema {codon: frequency}
    host = {}
    for k, v in host_raw.items():
        codon = str(k).strip().upper()
        if codon not in CODON_TABLE:
            _fail(f"hostCodonUsage key {k!r} is not a valid DNA codon.")
        try:
            f = float(v)
        except (TypeError, ValueError):
            _fail(f"hostCodonUsage[{k!r}] is not a number.")
        if f < 0:
            _fail(f"hostCodonUsage[{k!r}] must be non-negative.")
        host[codon] = f

    codons = [seq[i:i + 3] for i in range(0, len(seq), 3)]

    optimized = []
    per_codon = []
    ws_before = []
    ws_after = []
    changed = 0

    for idx, codon in enumerate(codons):
        aa = CODON_TABLE[codon]
        if codon not in host:
            _fail(f"Input codon {codon!r} (position {idx + 1}) is absent from hostCodonUsage.")
        # synonymous codons present in the host table
        syn = [c for c in SYNONYMS[aa] if c in host]
        if not syn:
            _fail(f"No synonymous codons for amino acid {aa!r} present in hostCodonUsage.")
        max_freq = max(host[c] for c in syn)

        # optimal = highest host frequency; keep original if it already ties the max
        if host[codon] == max_freq:
            optimal = codon
        else:
            best = [c for c in syn if host[c] == max_freq]
            optimal = sorted(best)[0]

        w_before = (host[codon] / max_freq) if max_freq > 0 else 0.0
        w_after = (host[optimal] / max_freq) if max_freq > 0 else 0.0
        ws_before.append(w_before)
        ws_after.append(w_after)

        optimized.append(optimal)
        if optimal != codon:
            changed += 1

        per_codon.append({
            "position": idx + 1,
            "aa": aa,
            "original": codon,
            "optimized": optimal,
            "wBefore": round(w_before, 6),
            "wAfter": round(w_after, 6),
        })

    optimized_seq = "".join(optimized)
    cai_before = _geometric_mean(ws_before)
    cai_after = _geometric_mean(ws_after)

    analysis = (
        f"Codon optimization of a {len(seq)} nt ({len(codons)} codon) coding sequence "
        f"for the supplied host. CAI improved from {cai_before:.4f} to {cai_after:.4f}; "
        f"{changed} of {len(codons)} codons changed."
    )

    research_log = (
        "# Codon Optimization\n\n"
        f"- Input length: {len(seq)} nt ({len(codons)} codons)\n"
        f"- Genetic code: NCBI standard translation table 1 (hardcoded)\n"
        f"- Host table codons provided: {len(host)}\n"
        f"- Codons changed: **{changed}** / {len(codons)}\n"
        f"- **CAI before:** {cai_before:.6f}\n"
        f"- **CAI after:** {cai_after:.6f}\n\n"
        "## Method\n"
        "For each codon the amino acid is looked up in the standard genetic code; the "
        "synonymous codon with the highest host usage frequency is selected as optimal. "
        "Relative adaptiveness w(codon) = freq(codon) / max(freq over synonymous codons). "
        "The Codon Adaptation Index (CAI) is the geometric mean of w over all codons "
        "(Sharp & Li, 1987), computed in log-space.\n"
    )

    result = {
        "status": "success",
        "analysis": analysis,
        "optimizedSequence": optimized_seq,
        "caiBefore": cai_before,
        "caiAfter": cai_after,
        "codonsChanged": changed,
        "nCodons": len(codons),
        "perCodon": per_codon,
        "researchLog": research_log,
    }

    output_dir = p.get("outputDir")
    if output_dir:
        try:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt
            from outcome_bundle import apply_palette, build_bundle
        except Exception as e:  # pragma: no cover - exercised only when deps present
            _fail(f"Bundle generation requires matplotlib/outcome_bundle: {e}", status="unavailable")

        fig, ax = plt.subplots(figsize=(4, 4))
        bars = ax.bar(["Before", "After"], [cai_before, cai_after],
                      color=["#0A192F", "#00B4D8"])
        ax.set_ylabel("Codon Adaptation Index (CAI)")
        ax.set_ylim(0, 1.05)
        ax.set_title("CAI before vs after optimization")
        for b, val in zip(bars, [cai_before, cai_after]):
            ax.text(b.get_x() + b.get_width() / 2, b.get_height(),
                    f"{val:.3f}", ha="center", va="bottom")
        apply_palette(ax)

        code = _reproducer(seq, host_raw)
        manifest = build_bundle(
            output_dir,
            tool="codon_optimize",
            title="Codon Optimization",
            result={k: v for k, v in result.items() if k != "researchLog"},
            research_log=research_log,
            figures=[("cai_before_after", fig)],
            tables=[("per_codon", per_codon)],
            code=code,
            methods=(
                "Amino acids assigned via the NCBI standard genetic code (table 1). "
                "Optimal synonymous codon = argmax host frequency. Relative adaptiveness "
                "w = freq/max(freq of synonyms); CAI = geometric mean of w (Sharp & Li 1987)."
            ),
            interpretation=(
                f"{changed} codon(s) were substituted to raise CAI from {cai_before:.4f} "
                f"to {cai_after:.4f}. A CAI near 1.0 indicates strong adaptation to the host's "
                "preferred codons."
            ),
        )
        plt.close(fig)
        result["bundle"] = manifest

    return result


def _reproducer(seq, host_raw):
    """Standalone runnable Python that reproduces the optimization from embedded inputs."""
    return (
        "#!/usr/bin/env python3\n"
        '"""Standalone reproducer for SynOmics codon_optimize (real computation)."""\n'
        "import json, math\n\n"
        f"SEQUENCE = {json.dumps(seq)}\n"
        f"HOST = {json.dumps(host_raw)}\n\n"
        f"CODON_TABLE = {json.dumps(CODON_TABLE)}\n\n"
        "SYN = {}\n"
        "for c, a in CODON_TABLE.items():\n"
        "    SYN.setdefault(a, []).append(c)\n\n"
        "host = {k.upper(): float(v) for k, v in HOST.items()}\n"
        "codons = [SEQUENCE[i:i+3] for i in range(0, len(SEQUENCE), 3)]\n"
        "wb, wa, opt, changed = [], [], [], 0\n"
        "for cod in codons:\n"
        "    aa = CODON_TABLE[cod]\n"
        "    syn = [c for c in SYN[aa] if c in host]\n"
        "    m = max(host[c] for c in syn)\n"
        "    best = cod if host[cod] == m else sorted(c for c in syn if host[c] == m)[0]\n"
        "    wb.append(host[cod]/m); wa.append(host[best]/m)\n"
        "    opt.append(best); changed += (best != cod)\n\n"
        "def gmean(ws):\n"
        "    return 0.0 if any(w <= 0 for w in ws) else math.exp(sum(math.log(w) for w in ws)/len(ws))\n\n"
        "print(json.dumps({\n"
        '    "optimizedSequence": "".join(opt),\n'
        '    "caiBefore": gmean(wb),\n'
        '    "caiAfter": gmean(wa),\n'
        '    "codonsChanged": changed,\n'
        "}, indent=2))\n"
    )


TASKS = {
    "codon_optimize": codon_optimize,
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
