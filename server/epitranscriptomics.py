#!/usr/bin/env python3
"""Epitranscriptomics — RNA modification MOTIF analysis (deterministic, stdlib).

Honest scope: this module performs only what can be computed from sequence alone
with zero fabrication — the m6A DRACH consensus motif scan. It does NOT call m6A
peaks (that needs MeRIP-seq/miCLIP read data), and it invents no methylation
"confidence scores". Modification calling from sequencing data is deployment-gated
and must never be faked.

Task: m6a_drach_scan. Reads JSON on stdin, prints JSON on stdout.
"""
import json
import re
import sys

# DRACH consensus for the m6A methyltophic site: D=[A/G/U], R=[A/G], A, C, H=[A/C/U].
# On a DNA alphabet (U->T): [AGT][AG]AC[ACT]. The methylated adenosine is the
# central 'A' (3rd position, 0-based index 2 within the 5-mer).
_DRACH = re.compile(r"[AGT][AG]AC[ACT]")


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def task_m6a_drach_scan(p):
    seq = (p.get("sequence") or "").upper().replace("U", "T").replace(" ", "").replace("\n", "")
    if not seq or any(c not in "ACGT" for c in seq):
        _fail("m6a_drach_scan needs an RNA/DNA `sequence` over A/C/G/U(T).")
    sites = []
    # overlapping scan: step 1 so adjacent DRACH windows are all reported
    for i in range(len(seq) - 4):
        w = seq[i:i + 5]
        if _DRACH.fullmatch(w):
            sites.append({
                "motifStart": i + 1,          # 1-based start of the 5-mer
                "m6aSitePosition": i + 3,     # 1-based position of the methylated A
                "motif": w.replace("T", "U"),  # report in RNA alphabet
            })
    log = [
        "# m6A DRACH consensus motif scan (D-R-A-C-H, methylated central A)",
        f"Sequence length: {len(seq)} nt",
        f"Candidate m6A DRACH sites: {len(sites)}",
    ]
    if sites:
        log.append("Positions (methylated A, 1-based): " + ", ".join(str(s["m6aSitePosition"]) for s in sites[:100]))
    else:
        log.append("No canonical DRACH sites detected.")
    result = {
        "status": "success",
        "analysis": "m6A DRACH consensus motif scan",
        "sequenceLength": len(seq),
        "nSites": len(sites),
        "sites": sites,
        "researchLog": "\n".join(log),
    }
    out = p.get("outputDir")
    if out:
        result["bundle"] = _bundle(out, p, seq, sites, result)
    return result


def _bundle(output_dir, p, seq, sites, result):
    import matplotlib
    matplotlib.use("Agg")
    import os

    import matplotlib.pyplot as plt
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from outcome_bundle import PALETTE, apply_palette, build_bundle

    fig, ax = plt.subplots(figsize=(8, 2.6))
    xs = [s["m6aSitePosition"] for s in sites]
    if xs:
        ax.vlines(xs, 0, 1, color=PALETTE["secondary"], lw=1.5)
    ax.set_xlim(0, max(len(seq), 1))
    ax.set_ylim(0, 1.2)
    ax.set_yticks([])
    ax.set_xlabel("Transcript position (nt)")
    ax.set_title(f"m6A DRACH sites (n={len(sites)})")
    apply_palette(ax)
    tables = [("m6a_drach_sites", sites)]
    code = (
        "#!/usr/bin/env python3\n"
        "import json, subprocess, sys\n"
        f"payload = {json.dumps({'task': 'm6a_drach_scan', 'sequence': p.get('sequence', seq)})}\n"
        "r = subprocess.run([sys.executable, 'server/epitranscriptomics.py'],\n"
        "                   input=json.dumps(payload).encode(), capture_output=True)\n"
        "print(r.stdout.decode())\n"
    )
    manifest = build_bundle(
        output_dir, tool="m6a_drach_scan", title="m6A DRACH consensus motif scan",
        result={k: result[k] for k in result if k != "sites"},
        research_log=result["researchLog"], figures=[("m6a_sites", fig)], tables=tables, code=code,
        methods="Deterministic scan of the DRACH consensus (D-R-A-C-H) over the transcript; "
                "the central adenosine of each match is a candidate m6A site. No read data "
                "or model is used, and no methylation confidence is invented.",
        interpretation="DRACH matches are candidate m6A sites by sequence context only; "
                       "experimental confirmation (MeRIP-seq/miCLIP) is required to call methylation.",
    )
    plt.close(fig)
    return manifest


TASKS = {"m6a_drach_scan": task_m6a_drach_scan}


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:  # noqa: BLE001
        _fail(f"Invalid JSON payload: {e}")
    task = payload.get("task")
    if task not in TASKS:
        _fail(f"Unknown task {task!r}. Available: {', '.join(TASKS)}.")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
