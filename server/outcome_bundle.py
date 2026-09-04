#!/usr/bin/env python3
"""Biomni-style outcome bundle writer for SynOmics analysis tools.

Given a computed (REAL, never fabricated) result, this writes a structured
outcome directory mirroring Biomni's output shape:

    <outputDir>/
      result.json          # Results  — the structured numeric result
      research_log.md      # Results  — human-readable summary (Biomni "research log")
      figures/<name>.png   # Figures  — matplotlib, on the SynOmics §2 palette
      figures/<name>.svg
      tables/<name>.csv    # Tables   — CSV
      code/analysis.py     # Codes    — a standalone runnable reproducer script
      report.html          # Report   — self-contained HTML (Results/Methods/Figures/Tables)
      report.md            # Report   — markdown mirror
      README.md            # Docs
      MANIFEST.json        # index of every artifact + SHA-256 (provenance)

Zero-hallucination contract: this module only *serializes* content the caller has
already computed from real data. It never invents values, figures, or table rows.
A figure is written only if the caller passes a real matplotlib Figure; a table
only if the caller passes real rows.

Design attribution: the outcome-artifact shape (research log + figures/tables +
saved code) follows the Biomni project (Apache-2.0). Implementation is original.
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import json
import os

# SynOmics palette (CLAUDE.md §2)
PALETTE = {
    "bg": "#FFFFFF",
    "primary": "#0A192F",
    "secondary": "#00B4D8",
    "neutral": "#F8F9FA",
}


def apply_palette(ax):
    """Style a matplotlib Axes on the SynOmics palette. Returns the Axes."""
    ax.set_facecolor(PALETTE["bg"])
    fig = ax.get_figure()
    fig.set_facecolor(PALETTE["bg"])
    for spine in ("bottom", "left"):
        ax.spines[spine].set_color(PALETTE["primary"])
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    ax.tick_params(colors=PALETTE["primary"])
    ax.title.set_color(PALETTE["primary"])
    ax.xaxis.label.set_color(PALETTE["primary"])
    ax.yaxis.label.set_color(PALETTE["primary"])
    return ax


def _sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _write_csv(path, rows):
    """rows: list[dict] (uniform keys) — written as CSV via stdlib csv."""
    import csv

    if not rows:
        with open(path, "w", newline="") as fh:
            fh.write("")
        return
    keys = list(rows[0].keys())
    with open(path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=keys)
        w.writeheader()
        for r in rows:
            w.writerow(r)


def _md_table(rows, max_rows=50):
    if not rows:
        return "_(empty)_"
    keys = list(rows[0].keys())
    out = ["| " + " | ".join(keys) + " |", "| " + " | ".join("---" for _ in keys) + " |"]
    for r in rows[:max_rows]:
        out.append("| " + " | ".join(str(r.get(k, "")) for k in keys) + " |")
    if len(rows) > max_rows:
        out.append(f"_… and {len(rows) - max_rows} more rows_")
    return "\n".join(out)


def _esc(s):
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def build_bundle(
    output_dir,
    *,
    tool,
    title,
    result,
    research_log,
    figures=None,
    tables=None,
    code=None,
    methods="",
    interpretation="",
    attachments=None,
):
    """Write a full outcome bundle and return a manifest dict.

    Parameters
    ----------
    output_dir : str        target directory (created if missing)
    tool : str              tool name
    title : str             human title for the report
    result : dict           the structured numeric result (Results)
    research_log : str      markdown summary (Biomni "research log")
    figures : list[(name, matplotlib.figure.Figure)] | None
    tables : list[(name, list[dict])] | None
    code : str | None       a standalone, runnable Python reproducer script
    methods : str           methods prose for the report
    interpretation : str    interpretation prose for the report
    attachments : list[dict] | None
        Extra pre-rendered artifacts to include in the bundle + manifest, each
        {"category": <one of figures/tables/code/report/docs/results>,
         "filename": <relative path under output_dir>,
         "content": <str (text) | bytes (binary)>}. Used e.g. for a DOCX document
         or a full article.md the caller rendered itself. Only real content —
         never fabricated.
    """
    os.makedirs(output_dir, exist_ok=True)
    fig_dir = os.path.join(output_dir, "figures")
    tab_dir = os.path.join(output_dir, "tables")
    code_dir = os.path.join(output_dir, "code")

    artifacts = {"figures": [], "tables": [], "code": [], "report": [], "docs": [], "results": []}

    # --- Results ---
    res_path = os.path.join(output_dir, "result.json")
    with open(res_path, "w") as fh:
        json.dump(result, fh, indent=2, default=str)
    artifacts["results"].append("result.json")

    log_path = os.path.join(output_dir, "research_log.md")
    with open(log_path, "w") as fh:
        fh.write(research_log.rstrip() + "\n")
    artifacts["results"].append("research_log.md")

    # --- Figures (png + svg) ---
    fig_html = []
    if figures:
        os.makedirs(fig_dir, exist_ok=True)
        for name, fig in figures:
            for ext in ("png", "svg"):
                p = os.path.join(fig_dir, f"{name}.{ext}")
                fig.savefig(p, format=ext, bbox_inches="tight", dpi=150, facecolor=PALETTE["bg"])
                artifacts["figures"].append(os.path.join("figures", f"{name}.{ext}"))
            fig_html.append(f'<figure><img src="figures/{name}.png" alt="{_esc(name)}" style="max-width:100%"><figcaption>{_esc(name)}</figcaption></figure>')

    # --- Tables (csv) ---
    tab_md = []
    if tables:
        os.makedirs(tab_dir, exist_ok=True)
        for name, rows in tables:
            p = os.path.join(tab_dir, f"{name}.csv")
            _write_csv(p, rows)
            artifacts["tables"].append(os.path.join("tables", f"{name}.csv"))
            tab_md.append(f"### {name}\n\n{_md_table(rows)}\n")

    # --- Code (runnable .py) ---
    if code:
        os.makedirs(code_dir, exist_ok=True)
        p = os.path.join(code_dir, "analysis.py")
        with open(p, "w") as fh:
            fh.write(code.rstrip() + "\n")
        artifacts["code"].append(os.path.join("code", "analysis.py"))

    # --- Report (md + html) ---
    ts = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ")
    md = [f"# {title}", "", f"*SynOmics outcome report — tool `{tool}` — {ts}*", ""]
    md += ["## Results", "", research_log.rstrip(), ""]
    if methods:
        md += ["## Methods", "", methods.rstrip(), ""]
    if tab_md:
        md += ["## Tables", "", *tab_md]
    if figures:
        md += ["## Figures", ""]
        for name, _ in figures:
            md += [f"![{name}](figures/{name}.png)", ""]
    if interpretation:
        md += ["## Interpretation", "", interpretation.rstrip(), ""]
    md_text = "\n".join(md)
    md_path = os.path.join(output_dir, "report.md")
    with open(md_path, "w") as fh:
        fh.write(md_text + "\n")
    artifacts["report"].append("report.md")

    html = [
        "<!doctype html><html><head><meta charset='utf-8'>",
        f"<title>{_esc(title)}</title>",
        "<style>",
        f"body{{font-family:Inter,Roboto,system-ui,sans-serif;background:{PALETTE['bg']};color:{PALETTE['primary']};max-width:900px;margin:2rem auto;padding:0 1rem}}",
        f"h1,h2,h3{{color:{PALETTE['primary']}}}",
        f"table{{border-collapse:collapse;width:100%;background:{PALETTE['neutral']}}}",
        "th,td{border:1px solid #d5dbe3;padding:4px 8px;font-family:'Fira Code','JetBrains Mono',monospace;font-size:13px}",
        f"th{{background:{PALETTE['primary']};color:#fff}}",
        f"a{{color:{PALETTE['secondary']}}} figcaption{{color:{PALETTE['secondary']};font-size:13px}}",
        f"pre{{background:{PALETTE['neutral']};padding:8px;overflow:auto}}",
        "</style></head><body>",
        f"<h1>{_esc(title)}</h1>",
        f"<p><em>SynOmics outcome report — tool <code>{_esc(tool)}</code> — {ts}</em></p>",
        "<h2>Results</h2><pre>" + _esc(research_log.rstrip()) + "</pre>",
    ]
    if methods:
        html.append("<h2>Methods</h2><p>" + _esc(methods) + "</p>")
    if tables:
        html.append("<h2>Tables</h2>")
        for name, rows in tables:
            html.append(f"<h3>{_esc(name)}</h3>")
            if rows:
                keys = list(rows[0].keys())
                html.append("<table><tr>" + "".join(f"<th>{_esc(k)}</th>" for k in keys) + "</tr>")
                for r in rows[:200]:
                    html.append("<tr>" + "".join(f"<td>{_esc(r.get(k,''))}</td>" for k in keys) + "</tr>")
                html.append("</table>")
    if fig_html:
        html.append("<h2>Figures</h2>" + "".join(fig_html))
    if interpretation:
        html.append("<h2>Interpretation</h2><p>" + _esc(interpretation) + "</p>")
    html.append("</body></html>")
    html_path = os.path.join(output_dir, "report.html")
    with open(html_path, "w") as fh:
        fh.write("\n".join(html))
    artifacts["report"].append("report.html")

    # --- Docs (README) ---
    readme = [
        f"# {title} — outcome bundle",
        "",
        f"Generated by SynOmics tool `{tool}` at {ts}.",
        "",
        "## Contents",
        "- `result.json` — structured numeric result (Results)",
        "- `research_log.md` — human-readable summary",
        "- `report.html` / `report.md` — full report",
    ]
    if artifacts["figures"]:
        readme.append("- `figures/` — publication figures (PNG + SVG, SynOmics palette)")
    if artifacts["tables"]:
        readme.append("- `tables/` — result tables (CSV)")
    if artifacts["code"]:
        readme.append("- `code/analysis.py` — standalone runnable reproducer")
    readme += ["- `MANIFEST.json` — artifact index with SHA-256 checksums", ""]
    readme_path = os.path.join(output_dir, "README.md")
    with open(readme_path, "w") as fh:
        fh.write("\n".join(readme) + "\n")
    artifacts["docs"].append("README.md")

    # --- Extra attachments (caller-rendered: DOCX document, article.md, …) ---
    if attachments:
        for att in attachments:
            cat = att.get("category", "docs")
            if cat not in artifacts:
                artifacts[cat] = []
            rel = att["filename"]
            dest = os.path.join(output_dir, rel)
            os.makedirs(os.path.dirname(dest) or output_dir, exist_ok=True)
            content = att["content"]
            mode = "wb" if isinstance(content, (bytes, bytearray)) else "w"
            with open(dest, mode) as fh:
                fh.write(content)
            artifacts[cat].append(rel)

    # --- Manifest with checksums (provenance) ---
    all_rel = [a for group in artifacts.values() for a in group]
    checksums = {rel: _sha256(os.path.join(output_dir, rel)) for rel in all_rel}
    manifest = {
        "tool": tool,
        "title": title,
        "generatedAt": ts,
        "outputDir": os.path.abspath(output_dir),
        "artifacts": artifacts,
        "sha256": checksums,
    }
    man_path = os.path.join(output_dir, "MANIFEST.json")
    with open(man_path, "w") as fh:
        json.dump(manifest, fh, indent=2)
    manifest["artifacts"]["docs"].append("MANIFEST.json")
    return manifest
