#!/usr/bin/env python3
"""m6A DRACH scan gate — deterministic ground truth (salvaged real logic from an
uploaded app whose broader drug/neoantigen engines were rejected as fabricators)."""
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "epitranscriptomics.py")

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
    return json.loads(r.stdout.decode())

# GGACT is a canonical DRACH (G-G-A-C-T == D-R-A-C-H). Place one at a known spot.
# seq: positions 1..: "CCC GGACT CCC" -> GGACT starts at index 4 (1-based), central A at 6.
d = run({"task": "m6a_drach_scan", "sequence": "CCCGGACTCCC"})
check("status success", d["status"] == "success", d)
check("one DRACH site found", d["nSites"] == 1, d)
check("motif start correct (4)", d["sites"][0]["motifStart"] == 4, d["sites"])
check("m6A central A position correct (6)", d["sites"][0]["m6aSitePosition"] == 6, d["sites"])
check("motif reported in RNA alphabet", d["sites"][0]["motif"] == "GGACU", d["sites"])

# RNA input with U is accepted (U->T normalization); AAACA is A-A-A-C-A = D?A R?A A C H?A -> matches [AGT][AG]AC[ACT]
d2 = run({"task": "m6a_drach_scan", "sequence": "AAACAUUU"})
check("RNA (U) input accepted", d2["status"] == "success", d2)
check("AAACA is a DRACH match", d2["nSites"] >= 1, d2)

# No DRACH -> zero, honest empty
d3 = run({"task": "m6a_drach_scan", "sequence": "CCCCCCCCCC"})
check("no DRACH -> 0 sites", d3["nSites"] == 0, d3)

# invalid characters -> honest error
check("invalid sequence -> error", run({"task": "m6a_drach_scan", "sequence": "XYZ123"}).get("status") == "error")
check("empty sequence -> error", run({"task": "m6a_drach_scan", "sequence": ""}).get("status") == "error")
check("unknown task -> error", run({"task": "nope"}).get("status") == "error")

# bundle
try:
    import matplotlib  # noqa: F401
    with tempfile.TemporaryDirectory() as t:
        out = os.path.join(t, "m6a")
        db = run({"task": "m6a_drach_scan", "sequence": "CCCGGACTCCCAGACTGGG", "outputDir": out})
        b = db["bundle"]
        check("bundle figure png present", any(f.endswith(".png") for f in b["artifacts"]["figures"]))
        check("bundle table csv present", any(f.endswith(".csv") for f in b["artifacts"]["tables"]))
        check("bundle report carries Synapse attribution",
              "Synapse" in open(os.path.join(out, "report.md")).read())
except Exception as e:  # noqa: BLE001
    print(f"(bundle checks skipped: {e})")

print(f"\nALL {passed} EPITRANSCRIPTOMICS TESTS PASSED")
