#!/usr/bin/env python3
"""Ground-truth smoke tests for server/conservation_tools.py (protein MSA
Shannon-entropy conservation). All asserted numbers are verifiable by hand."""
import math
import os
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt  # noqa: F401
    import numpy  # noqa: F401
except Exception as e:
    print(f"SKIP: matplotlib/numpy not available ({e}).")
    sys.exit(0)

import io  # noqa: E402
import json  # noqa: E402

import conservation_tools as ct  # noqa: E402

passed = 0
TOL = 1e-9


def check(name, cond, ctx=None):
    global passed
    if not cond:
        print(f"FAIL: {name}\n  {ctx}")
        sys.exit(1)
    passed += 1
    print(f"ok: {name}")


def dispatch(payload):
    """Drive main() end-to-end (stdin JSON -> stdout JSON), tolerating _fail's
    sys.exit(0) so error paths can be asserted without killing the test."""
    old_in, old_out = sys.stdin, sys.stdout
    sys.stdin = io.StringIO(json.dumps(payload))
    sys.stdout = io.StringIO()
    try:
        ct.main()
    except SystemExit:
        pass
    out = sys.stdout.getvalue()
    sys.stdin, sys.stdout = old_in, old_out
    return json.loads(out)


def run(payload):
    """Success-path helper: call the task directly (asserts numeric ground truth)."""
    return ct.task_protein_conservation(payload)


# 1) Fully conserved MSA -> every column entropy 0, meanEntropy 0.
r = run({"sequences": ["MKT", "MKT", "MKT"]})
check("fully conserved: status success", r["status"] == "success", r)
check("fully conserved: length 3", r["length"] == 3, r)
check("fully conserved: nSequences 3", r["nSequences"] == 3, r)
check("fully conserved: every column entropy 0.0",
      all(abs(c["entropyBits"]) < TOL for c in r["perColumn"]), r["perColumn"])
check("fully conserved: meanEntropy 0.0", abs(r["meanEntropy"]) < TOL, r)
check("fully conserved: mostConserved = all positions",
      r["mostConserved"] == [1, 2, 3], r["mostConserved"])
check("fully conserved: conservation 1.0 each",
      all(abs(c["conservation"] - 1.0) < TOL for c in r["perColumn"]), r["perColumn"])

# 2) ["MK","MR"] -> col1 entropy 0, col2 entropy exactly 1.0 bit.
r = run({"sequences": ["MK", "MR"]})
check("two-seq: col1 entropy 0.0", abs(r["perColumn"][0]["entropyBits"]) < TOL, r["perColumn"])
check("two-seq: col2 entropy exactly 1.0",
      abs(r["perColumn"][1]["entropyBits"] - 1.0) < TOL, r["perColumn"])
check("two-seq: meanEntropy = 0.5", abs(r["meanEntropy"] - 0.5) < TOL, r)
check("two-seq: mostConserved = [1]", r["mostConserved"] == [1], r["mostConserved"])

# 3) Column with 4 equally-likely residues -> entropy exactly 2.0 bits.
#    4 sequences identical except one column {A,C,G,T}.
r = run({"sequences": ["WAY", "WCY", "WGY", "WTY"]})
check("four-residue: col1 entropy 0.0", abs(r["perColumn"][0]["entropyBits"]) < TOL, r["perColumn"])
check("four-residue: col2 entropy exactly 2.0",
      abs(r["perColumn"][1]["entropyBits"] - 2.0) < TOL, r["perColumn"])
check("four-residue: col3 entropy 0.0", abs(r["perColumn"][2]["entropyBits"]) < TOL, r["perColumn"])

# 4) Gap treated as its own symbol: {A,-} equally likely -> entropy 1.0 bit.
r = run({"sequences": ["A", "-"]})
check("gap-as-symbol: entropy 1.0", abs(r["perColumn"][0]["entropyBits"] - 1.0) < TOL, r)

# 5) Unequal-length sequences -> status error (no silent padding).
r = dispatch({"task": "protein_conservation", "sequences": ["MKT", "MK"]})
check("unequal length -> error", r["status"] == "error", r)
check("unequal length -> message mentions aligned/length",
      "length" in r["error"].lower() or "align" in r["error"].lower(), r)

# 6) Missing/empty sequences -> error.
check("missing sequences -> error",
      dispatch({"task": "protein_conservation"})["status"] == "error")
check("empty sequences -> error",
      dispatch({"task": "protein_conservation", "sequences": []})["status"] == "error")

# 7) Unknown task via main dispatch -> error.
check("unknown task -> error", dispatch({"task": "nope"})["status"] == "error")
check("known task via main dispatch -> success",
      dispatch({"task": "protein_conservation", "sequences": ["MK", "MR"]})["status"] == "success")

# 8) Outcome bundle: outputDir -> full manifest with real artifacts.
with tempfile.TemporaryDirectory() as d:
    r = run({"sequences": ["WAY", "WCY", "WGY", "WTY"], "outputDir": d})
    check("bundle: present", "bundle" in r, r.keys())
    man = r["bundle"]
    png = os.path.join(d, "figures", "per_column_entropy.png")
    svg = os.path.join(d, "figures", "per_column_entropy.svg")
    csv = os.path.join(d, "tables", "per_column_conservation.csv")
    code = os.path.join(d, "code", "analysis.py")
    html = os.path.join(d, "report.html")
    md = os.path.join(d, "report.md")
    check("bundle: png magic + non-empty",
          open(png, "rb").read(4) == b"\x89PNG" and os.path.getsize(png) > 0, png)
    check("bundle: svg present + non-empty",
          "<svg" in open(svg).read() and os.path.getsize(svg) > 0, svg)
    check("bundle: table csv non-empty w/ header",
          "position" in open(csv).read() and os.path.getsize(csv) > 0, csv)
    check("bundle: code/analysis.py non-empty",
          os.path.getsize(code) > 0, code)
    check("bundle: report.html non-empty", os.path.getsize(html) > 0, html)
    check("bundle: report.md non-empty", os.path.getsize(md) > 0, md)
    check("bundle: manifest lists figures", len(man["artifacts"]["figures"]) == 2, man)

# Sanity: verify our by-hand ground truth against math for the 4-residue column.
assert abs((-4 * (0.25 * math.log2(0.25))) - 2.0) < TOL

print(f"\nALL {passed} CONSERVATION TESTS PASSED")
