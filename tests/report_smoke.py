#!/usr/bin/env python3
"""End-to-end test for the Module D report generator. Requires jinja2 + python-docx.
Run: `python tests/report_smoke.py`
"""
import base64
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "report_generator.py")

try:
    import jinja2  # noqa: F401
    import docx  # noqa: F401
except Exception as e:
    print(f"SKIP: jinja2/python-docx not available ({e}).")
    sys.exit(0)

passed = 0
def check(name, cond):
    global passed
    if not cond:
        print(f"FAIL: {name}")
        sys.exit(1)
    passed += 1
    print(f"ok: {name}")

def run(payload):
    p = subprocess.run([sys.executable, SCRIPT], input=json.dumps(payload).encode(),
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return json.loads(p.stdout.decode())

res = run({
    "title": "TP53 Pathway Differential Expression",
    "summary": "15 genes significant at FDR<0.05.",
    "methods": "Welch t-test on log2(count+1) + Benjamini-Hochberg FDR.",
    "results": "TP53 downregulated (log2FC -2.4).",
    # introduction + interpretations intentionally omitted
    "tables": [{"title": "Top genes", "columns": ["Gene", "log2FC", "FDR"], "rows": [["TP53", -2.4, "1e-11"]]}],
    "formats": ["html", "docx"],
})
check("status success", res.get("status") == "success")
check("HTML contains the title", "TP53 Pathway Differential Expression" in res["html"])
check("HTML uses the mandated accent color", "#00B4D8" in res["html"])
check("missing sections rendered as 'not provided'", "— (not provided)" in res["html"])
check("real results rendered (not fabricated)", "log2FC -2.4" in res["html"])
docx_bytes = base64.b64decode(res["docxBase64"])
check("DOCX is a valid OOXML zip", docx_bytes[:2] == b"PK" and len(docx_bytes) > 1000)

bad = run({"summary": "no title"})
check("missing title -> honest error", bad.get("status") == "error")

print(f"\nALL {passed} REPORT GENERATOR TESTS PASSED")
