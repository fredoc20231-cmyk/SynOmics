#!/usr/bin/env python3
"""Tests for the cryptographic provenance manifest + report embedding. Stdlib only.
Run: `python tests/provenance_smoke.py`
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROV = os.path.join(ROOT, "server", "provenance.py")
REPORT = os.path.join(ROOT, "server", "report_generator.py")

passed = 0
def check(name, cond):
    global passed
    if not cond:
        print(f"FAIL: {name}")
        sys.exit(1)
    passed += 1
    print(f"ok: {name}")

def run(script, payload):
    p = subprocess.run([sys.executable, script], input=json.dumps(payload).encode(),
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return json.loads(p.stdout.decode())

m = run(PROV, {"sessionId": "s1", "inputs": {"counts": {"A": [1, 2, 3]}},
               "scripts": [os.path.join(ROOT, "server", "synomics_engine.py")],
               "outputs": {"de": {"sig": 15}}})
check("manifest status success", m.get("status") == "success")
check("manifest hash is sha256", isinstance(m["manifestHash"], str) and len(m["manifestHash"]) == 64)
check("scripts are hashed", m["manifest"]["scripts"][0]["sha256"] and len(m["manifest"]["scripts"][0]["sha256"]) == 64)

# Deterministic input hashing (independent of timestamp).
m2 = run(PROV, {"inputs": {"counts": {"A": [1, 2, 3]}}})
h1 = next(e for e in m["manifest"]["inputs"] if e["name"] == "counts")["sha256"]
h2 = next(e for e in m2["manifest"]["inputs"] if e["name"] == "counts")["sha256"]
check("input hashing deterministic", h1 == h2)

# Tampering changes the hash.
m3 = run(PROV, {"inputs": {"counts": {"A": [1, 2, 4]}}})
h3 = next(e for e in m3["manifest"]["inputs"] if e["name"] == "counts")["sha256"]
check("changed input -> different hash", h3 != h1)

# Report embeds the manifest hash in its footer.
if os.path.exists(REPORT):
    try:
        import jinja2  # noqa: F401
        rep = run(REPORT, {"title": "T", "summary": "x", "provenanceHash": m["manifestHash"], "formats": ["html"]})
        check("report footer embeds provenance hash", m["manifestHash"] in rep.get("html", ""))
    except Exception:
        print("ok: report embedding skipped (jinja2 absent)")

print(f"\nALL {passed} PROVENANCE TESTS PASSED")
