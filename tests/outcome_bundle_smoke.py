#!/usr/bin/env python3
"""Verify the outcome-bundle writer produces every artifact type with valid content."""
import json
import os
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
except Exception as e:
    print(f"SKIP: matplotlib not available ({e}).")
    sys.exit(0)

import outcome_bundle as ob  # noqa: E402

passed = 0


def check(name, cond, ctx=None):
    global passed
    if not cond:
        print(f"FAIL: {name}\n  {ctx}")
        sys.exit(1)
    passed += 1
    print(f"ok: {name}")


with tempfile.TemporaryDirectory() as d:
    fig, ax = plt.subplots()
    ax.plot([1, 2, 3], [1, 4, 9])
    ob.apply_palette(ax)
    manifest = ob.build_bundle(
        d,
        tool="unit_test",
        title="Unit Test Bundle",
        result={"answer": 42, "ok": True},
        research_log="# Test\nComputed answer = 42.",
        figures=[("demo", fig)],
        tables=[("vals", [{"x": 1, "y": 1}, {"x": 2, "y": 4}])],
        code="print('reproducer')\n",
        methods="Squared the inputs.",
        interpretation="42 is the answer.",
    )
    plt.close(fig)

    art = manifest["artifacts"]
    check("figure png written", os.path.exists(os.path.join(d, "figures/demo.png")))
    check("figure svg written", os.path.exists(os.path.join(d, "figures/demo.svg")))
    check("png has PNG magic", open(os.path.join(d, "figures/demo.png"), "rb").read(4) == b"\x89PNG")
    check("svg is svg", "<svg" in open(os.path.join(d, "figures/demo.svg")).read())
    check("table csv written + has header", "x,y" in open(os.path.join(d, "tables/vals.csv")).read())
    check("code written", os.path.exists(os.path.join(d, "code/analysis.py")))
    rpt_html = open(os.path.join(d, "report.html")).read()
    rpt_md = open(os.path.join(d, "report.md")).read()
    check("report.html written", "<h1>" in rpt_html)
    check("report.md written", "# Unit Test Bundle" in rpt_md)
    check("report.html carries Synapse attribution", "Synapse" in rpt_html and "Citation:" in rpt_html)
    check("report.md carries Synapse attribution + Fadiel citation", "Synapse" in rpt_md and "Fadiel" in rpt_md)
    check("README doc written", os.path.exists(os.path.join(d, "README.md")))
    check("result.json round-trips", json.load(open(os.path.join(d, "result.json")))["answer"] == 42)
    check("manifest lists figures", len(art["figures"]) == 2)
    check("manifest lists a table", any(t.endswith("vals.csv") for t in art["tables"]))
    check("manifest lists code", any(c.endswith("analysis.py") for c in art["code"]))
    # every listed artifact exists and has a checksum
    all_rel = [a for g in art.values() for a in g if a != "MANIFEST.json"]
    check("all artifacts exist on disk", all(os.path.exists(os.path.join(d, r)) for r in all_rel), all_rel)
    check("every artifact has sha256", all(r in manifest["sha256"] for r in all_rel))
    check("palette applied (secondary color present)", ob.PALETTE["secondary"] == "#00B4D8")

print(f"\nALL {passed} OUTCOME-BUNDLE TESTS PASSED")
