#!/usr/bin/env python3
"""Tests for glycosylation site-prediction tools. Run: python tests/glyco_tools_smoke.py

Asserts REAL computed ground truth (verified by hand), not merely "it runs".
"""
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "glyco_tools.py")

try:
    import matplotlib  # noqa: F401
    import numpy  # noqa: F401
except Exception as e:
    print(f"SKIP: matplotlib/numpy not available ({e}).")
    sys.exit(0)

passed = 0


def check(name, cond, ctx=None):
    global passed
    if not cond:
        print(f"FAIL: {name}\n  {ctx}")
        sys.exit(1)
    passed += 1
    print(f"ok: {name}")


def run(p):
    r = subprocess.run([sys.executable, SCRIPT], input=json.dumps(p).encode(),
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if not r.stdout.strip():
        raise AssertionError(f"no stdout; stderr={r.stderr.decode()}")
    return json.loads(r.stdout.decode())


# --- Task 1: N-linked sequons -------------------------------------------------
# "NPSNIT": N-P-S at pos 1 REJECTED (X=Proline); N-I-T at pos 4 IS a sequon.
r1 = run({"task": "n_glycosylation_motifs", "sequence": "NPSNIT"})
check("NPSNIT status", r1["status"] == "success", r1)
check("NPSNIT count == 1 (proline rejected)", r1["count"] == 1, r1)
check("NPSNIT sequon at position 4", r1["sequons"][0]["position"] == 4, r1["sequons"])
check("NPSNIT motif is NIT", r1["sequons"][0]["motif"] == "NIT", r1["sequons"])
check("NPSNIT sequenceLength 6", r1["sequenceLength"] == 6, r1)

# Two-sequon sequence: "NITNKS" -> N-I-T (pos1) and N-K-S (pos4).
r2 = run({"task": "n_glycosylation_motifs", "sequence": "NITNKS"})
check("NITNKS count == 2", r2["count"] == 2, r2)
check("NITNKS positions [1,4]", [s["position"] for s in r2["sequons"]] == [1, 4], r2["sequons"])
check("NITNKS motifs NIT,NKS",
      [s["motif"] for s in r2["sequons"]] == ["NIT", "NKS"], r2["sequons"])

# allowOverlap on "NNSS":
#   N-N-S (pos1) valid; N-S-S (pos2) valid; these overlap.
#   overlap=False -> after pos1 match, advance past window -> only pos1 counted (count 1).
#   overlap=True  -> both counted (count 2, positions [1,2]).
r3 = run({"task": "n_glycosylation_motifs", "sequence": "NNSS", "allowOverlap": False})
check("NNSS no-overlap count == 1", r3["count"] == 1, r3)
check("NNSS no-overlap position [1]", [s["position"] for s in r3["sequons"]] == [1], r3["sequons"])
r4 = run({"task": "n_glycosylation_motifs", "sequence": "NNSS", "allowOverlap": True})
check("NNSS overlap count == 2", r4["count"] == 2, r4)
check("NNSS overlap positions [1,2]",
      [s["position"] for s in r4["sequons"]] == [1, 2], r4["sequons"])

# No sequon at all.
r5 = run({"task": "n_glycosylation_motifs", "sequence": "AAAAAA"})
check("AAAAAA no sequons", r5["count"] == 0 and r5["sequons"] == [], r5)

# --- Task 2: O-linked hotspots ------------------------------------------------
# "AAAAASTSTSTSTAA" window=6 threshold=0.5:
#   window starting in the ST-rich region is pure S/T -> fraction 1.0 flagged True;
#   window over the all-A prefix has low fraction -> flagged False.
r6 = run({"task": "o_glycosylation_hotspots", "sequence": "AAAAASTSTSTSTAA",
          "window": 6, "threshold": 0.5})
check("O status", r6["status"] == "success", r6)
check("O hotspotCount >= 1", r6["hotspotCount"] >= 1, r6)
flagged = [w for w in r6["windows"] if w["flagged"]]
check("O has a window stFraction>0.5 flagged True",
      any(w["stFraction"] > 0.5 for w in flagged), flagged)
first_win = r6["windows"][0]  # start=1 over "AAAAAS"
check("O all-A region flagged False", first_win["flagged"] is False, first_win)
check("O all-A region low fraction", first_win["stFraction"] < 0.5, first_win)
# Verify the pure-ST window is exactly 1.0.
check("O pure-ST window fraction 1.0",
      any(abs(w["stFraction"] - 1.0) < 1e-9 and w["flagged"] for w in r6["windows"]),
      r6["windows"])

# All-A protein -> zero hotspots.
r7 = run({"task": "o_glycosylation_hotspots", "sequence": "AAAAAAAAAAAA",
          "window": 6, "threshold": 0.5})
check("all-A protein hotspotCount == 0", r7["hotspotCount"] == 0, r7)
check("all-A windows all flagged False",
      all(w["flagged"] is False for w in r7["windows"]), r7["windows"])

# --- Bundle: n_glycosylation_motifs with outputDir ---------------------------
with tempfile.TemporaryDirectory() as d:
    rb = run({"task": "n_glycosylation_motifs", "sequence": "NITNKS", "outputDir": d})
    check("bundle: manifest returned", "bundle" in rb and rb["bundle"], rb.get("bundle"))
    man = rb["bundle"]
    png = os.path.join(d, "figures", "n_sequon_position_map.png")
    svg = os.path.join(d, "figures", "n_sequon_position_map.svg")
    csv = os.path.join(d, "tables", "n_sequons.csv")
    code = os.path.join(d, "code", "analysis.py")
    html = os.path.join(d, "report.html")
    rmd = os.path.join(d, "report.md")
    check("bundle: png exists", os.path.exists(png), png)
    check("bundle: png has PNG magic", open(png, "rb").read(4) == b"\x89PNG")
    check("bundle: svg exists", os.path.exists(svg) and "<svg" in open(svg).read())
    check("bundle: csv exists", os.path.exists(csv))
    check("bundle: csv has sequon rows", "position" in open(csv).read(), open(csv).read())
    check("bundle: code/analysis.py exists non-empty",
          os.path.exists(code) and os.path.getsize(code) > 0)
    check("bundle: report.html non-empty",
          os.path.exists(html) and os.path.getsize(html) > 0)
    check("bundle: report.md non-empty",
          os.path.exists(rmd) and os.path.getsize(rmd) > 0)
    check("bundle: manifest lists a png",
          any(a.endswith(".png") for a in man["artifacts"]["figures"]), man["artifacts"]["figures"])
    check("bundle: manifest lists a svg",
          any(a.endswith(".svg") for a in man["artifacts"]["figures"]), man["artifacts"]["figures"])
    check("bundle: manifest lists a csv",
          any(a.endswith(".csv") for a in man["artifacts"]["tables"]), man["artifacts"]["tables"])

# --- Bundle: o_glycosylation_hotspots with outputDir -------------------------
with tempfile.TemporaryDirectory() as d:
    rb2 = run({"task": "o_glycosylation_hotspots", "sequence": "AAAAASTSTSTSTAA",
               "window": 6, "outputDir": d})
    check("o-bundle: manifest returned", "bundle" in rb2 and rb2["bundle"])
    opng = os.path.join(d, "figures", "o_st_density.png")
    check("o-bundle: png has PNG magic", open(opng, "rb").read(4) == b"\x89PNG")
    check("o-bundle: windows csv exists",
          os.path.exists(os.path.join(d, "tables", "o_windows.csv")))

# --- Error handling -----------------------------------------------------------
check("unknown task -> status error", run({"task": "nope"}).get("status") == "error")
check("missing sequence -> status error",
      run({"task": "n_glycosylation_motifs"}).get("status") == "error")

print(f"\nALL {passed} GLYCO TESTS PASSED")
