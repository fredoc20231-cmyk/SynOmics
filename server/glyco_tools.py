#!/usr/bin/env python3
"""Glycosylation site-prediction tools — one dispatch, real sequence logic.

Tasks (payload.task):
  n_glycosylation_motifs   scan for N-linked sequons N-X-[S/T], X != Proline
  o_glycosylation_hotspots scan for Ser/Thr-rich hotspots via a sliding window

Every value is computed by exact string logic on the provided protein sequence —
nothing is fabricated. Reads JSON on stdin, prints JSON on stdout, single dispatch.
When the payload carries an ``outputDir`` a full Biomni-style outcome bundle
(figures/tables/code/report) is also written and its manifest returned; that path
needs matplotlib + numpy and returns an honest 'unavailable' if they are missing.
"""
import json
import sys

# Standard amino-acid alphabet for validation.
_AA = set("ACDEFGHIKLMNPQRSTVWY")


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _seq(p, key="sequence"):
    s = p.get(key)
    if not isinstance(s, str) or not s.strip():
        _fail(f"Provide a `{key}` string.")
    return s.strip().upper().replace(" ", "").replace("\n", "").replace("\r", "")


# --------------------------------------------------------------------------- #
# Task 1 — N-linked glycosylation sequons
# --------------------------------------------------------------------------- #
def _scan_n_sequons(seq, allow_overlap):
    """Return list of {position (1-based), motif} for N-X-[S/T], X != Proline."""
    sequons = []
    n = len(seq)
    i = 0
    while i <= n - 3:
        a, x, c = seq[i], seq[i + 1], seq[i + 2]
        if a == "N" and x != "P" and c in ("S", "T"):
            sequons.append({"position": i + 1, "motif": seq[i:i + 3]})
            i += 1 if allow_overlap else 3
        else:
            i += 1
    return sequons


def n_glycosylation_motifs(p):
    seq = _seq(p)
    allow_overlap = bool(p.get("allowOverlap", False))
    sequons = _scan_n_sequons(seq, allow_overlap)
    count = len(sequons)
    seqlen = len(seq)

    positions = [s["position"] for s in sequons]
    log = [
        "# N-linked glycosylation sequon scan",
        "",
        f"- Sequence length: **{seqlen}** residues",
        "- Motif definition: **N-X-[S/T]** with X != Proline (canonical N-X-S/T sequon)",
        f"- Overlapping matches allowed: **{allow_overlap}**",
        f"- Sequons found: **{count}**",
        "",
    ]
    if sequons:
        log.append("| position (1-based) | motif |")
        log.append("| --- | --- |")
        for s in sequons:
            log.append(f"| {s['position']} | {s['motif']} |")
    else:
        log.append("_No N-linked sequon detected._")
    research_log = "\n".join(log)

    result = {
        "status": "success",
        "analysis": "N-linked glycosylation sequon scan (N-X-[S/T], X != Proline)",
        "sequons": sequons,
        "count": count,
        "sequenceLength": seqlen,
        "allowOverlap": allow_overlap,
        "positions": positions,
        "researchLog": research_log,
    }

    out_dir = p.get("outputDir")
    if out_dir:
        _plt, _np = _require_plotting()

        def make_fig():
            fig, ax = _plt.subplots(figsize=(8, 3))
            ax.set_xlim(0, seqlen + 1)
            ax.hlines(0, 0, seqlen + 1, color="#0A192F", linewidth=1)
            if positions:
                markerline, stemlines, baseline = ax.stem(
                    positions, [1] * len(positions), basefmt=" "
                )
                _plt.setp(stemlines, color="#00B4D8", linewidth=1.5)
                _plt.setp(markerline, color="#00B4D8", markersize=7)
                for pos in positions:
                    ax.annotate(str(pos), (pos, 1), textcoords="offset points",
                                xytext=(0, 5), ha="center", fontsize=8, color="#0A192F")
            ax.set_ylim(-0.2, 1.4)
            ax.set_yticks([])
            ax.set_xlabel("Residue position (1-based)")
            ax.set_title(f"N-linked sequon position map ({count} site(s))")
            _apply_palette(ax)
            return fig

        code = _reproducer_n(seq, allow_overlap)
        result["bundle"] = _build(
            out_dir,
            tool="n_glycosylation_motifs",
            title="N-linked Glycosylation Sequon Scan",
            result={k: v for k, v in result.items() if k != "researchLog"},
            research_log=research_log,
            figures=[("n_sequon_position_map", make_fig())],
            tables=[("n_sequons", sequons)],
            code=code,
            methods=(
                "Each 3-residue window of the protein is tested against the canonical "
                "N-linked sequon N-X-[S/T] where X is any residue except Proline. "
                "Positions are reported 1-based at the asparagine. Overlapping matches "
                f"{'are' if allow_overlap else 'are not'} counted."
            ),
            interpretation=(
                f"{count} candidate N-linked glycosylation site(s) were detected. "
                "Sequon presence is necessary but not sufficient for glycosylation; "
                "occupancy depends on structural accessibility and the cellular context."
            ),
        )
    return result


# --------------------------------------------------------------------------- #
# Task 2 — O-linked (Ser/Thr-rich) glycosylation hotspots
# --------------------------------------------------------------------------- #
def _scan_st_windows(seq, window, threshold):
    n = len(seq)
    win = window if n >= window else n
    windows = []
    if win <= 0:
        return windows
    for start in range(0, n - win + 1):
        sub = seq[start:start + win]
        st = sum(1 for ch in sub if ch in ("S", "T"))
        frac = st / win
        windows.append({
            "start": start + 1,
            "end": start + win,
            "stFraction": round(frac, 6),
            "flagged": frac >= threshold,
        })
    return windows


def o_glycosylation_hotspots(p):
    seq = _seq(p)
    window = int(p.get("window", 10))
    if window <= 0:
        _fail("`window` must be a positive integer.")
    threshold = float(p.get("threshold", 0.5))
    windows = _scan_st_windows(seq, window, threshold)
    hotspot_count = sum(1 for w in windows if w["flagged"])
    seqlen = len(seq)

    log = [
        "# O-linked glycosylation hotspot scan (Ser/Thr density)",
        "",
        f"- Sequence length: **{seqlen}** residues",
        f"- Sliding window: **{window}** residues",
        f"- S/T fraction threshold: **{threshold}**",
        f"- Windows evaluated: **{len(windows)}**",
        f"- Flagged hotspot windows: **{hotspot_count}**",
        "",
    ]
    flagged = [w for w in windows if w["flagged"]]
    if flagged:
        log.append("| start | end | S/T fraction |")
        log.append("| --- | --- | --- |")
        for w in flagged[:50]:
            log.append(f"| {w['start']} | {w['end']} | {w['stFraction']} |")
    else:
        log.append("_No Ser/Thr-rich hotspot window at this threshold._")
    research_log = "\n".join(log)

    result = {
        "status": "success",
        "analysis": "O-linked glycosylation hotspot scan (Ser/Thr density, sliding window)",
        "windows": windows,
        "hotspotCount": hotspot_count,
        "sequenceLength": seqlen,
        "window": window,
        "threshold": threshold,
        "researchLog": research_log,
    }

    out_dir = p.get("outputDir")
    if out_dir:
        _plt, _np = _require_plotting()

        def make_fig():
            starts = [w["start"] for w in windows]
            fracs = [w["stFraction"] for w in windows]
            fig, ax = _plt.subplots(figsize=(8, 3.5))
            if starts:
                ax.plot(starts, fracs, color="#00B4D8", linewidth=1.6, marker="o",
                        markersize=3, label="S/T fraction")
                flg = [(w["start"], w["stFraction"]) for w in windows if w["flagged"]]
                if flg:
                    fx, fy = zip(*flg)
                    ax.scatter(fx, fy, color="#0A192F", s=28, zorder=5, label="flagged")
            ax.axhline(threshold, color="#0A192F", linestyle="--", linewidth=1,
                       label=f"threshold={threshold}")
            ax.set_ylim(0, 1.05)
            ax.set_xlabel("Window start (1-based)")
            ax.set_ylabel("S/T fraction")
            ax.set_title(f"O-linked S/T density (window={window})")
            ax.legend(loc="upper right", fontsize=8)
            _apply_palette(ax)
            return fig

        code = _reproducer_o(seq, window, threshold)
        result["bundle"] = _build(
            out_dir,
            tool="o_glycosylation_hotspots",
            title="O-linked Glycosylation Hotspot Scan",
            result={k: v for k, v in result.items() if k != "researchLog"},
            research_log=research_log,
            figures=[("o_st_density", make_fig())],
            tables=[("o_windows", windows)],
            code=code,
            methods=(
                f"A sliding window of {window} residues traverses the protein; for each "
                "window the fraction of Ser/Thr residues is computed. Windows with an "
                f"S/T fraction >= {threshold} are flagged as candidate O-linked "
                "glycosylation hotspots."
            ),
            interpretation=(
                f"{hotspot_count} window(s) exceeded the S/T-density threshold, marking "
                "Ser/Thr-rich stretches that are enriched for potential O-linked "
                "glycosylation. Density is a heuristic; site occupancy requires "
                "experimental confirmation."
            ),
        )
    return result


# --------------------------------------------------------------------------- #
# Bundle plumbing (deps imported lazily; honest 'unavailable' on failure)
# --------------------------------------------------------------------------- #
def _require_plotting():
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import numpy as np
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"glyco outcome bundle requires matplotlib + numpy: {e}", status="unavailable")
    return plt, np


def _apply_palette(ax):
    from outcome_bundle import apply_palette
    return apply_palette(ax)


def _build(output_dir, **kwargs):
    from outcome_bundle import build_bundle
    manifest = build_bundle(output_dir, **kwargs)
    import matplotlib.pyplot as plt
    plt.close("all")
    return manifest


def _reproducer_n(seq, allow_overlap):
    return f'''#!/usr/bin/env python3
"""Reproduce the N-linked glycosylation sequon scan."""

SEQUENCE = {seq!r}
ALLOW_OVERLAP = {allow_overlap!r}


def scan(seq, allow_overlap):
    out = []
    n = len(seq)
    i = 0
    while i <= n - 3:
        a, x, c = seq[i], seq[i + 1], seq[i + 2]
        if a == "N" and x != "P" and c in ("S", "T"):
            out.append({{"position": i + 1, "motif": seq[i:i + 3]}})
            i += 1 if allow_overlap else 3
        else:
            i += 1
    return out


if __name__ == "__main__":
    sequons = scan(SEQUENCE, ALLOW_OVERLAP)
    print("count:", len(sequons))
    for s in sequons:
        print(s["position"], s["motif"])
'''


def _reproducer_o(seq, window, threshold):
    return f'''#!/usr/bin/env python3
"""Reproduce the O-linked glycosylation hotspot scan."""

SEQUENCE = {seq!r}
WINDOW = {window!r}
THRESHOLD = {threshold!r}


def scan(seq, window, threshold):
    n = len(seq)
    win = window if n >= window else n
    out = []
    if win <= 0:
        return out
    for start in range(0, n - win + 1):
        sub = seq[start:start + win]
        st = sum(1 for ch in sub if ch in ("S", "T"))
        frac = st / win
        out.append({{"start": start + 1, "end": start + win,
                     "stFraction": round(frac, 6), "flagged": frac >= threshold}})
    return out


if __name__ == "__main__":
    windows = scan(SEQUENCE, WINDOW, THRESHOLD)
    hotspots = [w for w in windows if w["flagged"]]
    print("windows:", len(windows), "hotspots:", len(hotspots))
    for w in hotspots:
        print(w["start"], w["end"], w["stFraction"])
'''


# --------------------------------------------------------------------------- #
# Dispatch
# --------------------------------------------------------------------------- #
TASKS = {
    "n_glycosylation_motifs": n_glycosylation_motifs,
    "o_glycosylation_hotspots": o_glycosylation_hotspots,
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
