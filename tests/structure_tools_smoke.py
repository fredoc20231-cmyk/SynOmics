#!/usr/bin/env python3
"""Tests for protein-structure tools (biopython PDB). Run: python tests/structure_tools_smoke.py"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "structure_tools.py")

try:
    import Bio  # noqa: F401
except Exception as e:
    print(f"SKIP: biopython not available ({e}).")
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
    return json.loads(r.stdout.decode())

def atom(i, x, y, z, chain="A"):
    return f"ATOM  {i:>5}  CA  ALA {chain}{i:>4}    {x:8.3f}{y:8.3f}{z:8.3f}  1.00  0.00           C"

pdb3 = "\n".join(atom(i + 1, 3 * i, 0, 0) for i in range(3)) + "\nEND\n"
pdb5 = "\n".join(atom(i + 1, 4 * i, 0, 0) for i in range(5)) + "\nEND\n"

s = run({"task": "structure_summary", "pdb": pdb3})
check("summary: 1 chain, 3 residues", s["nChains"] == 1 and s["totalResidues"] == 3, s)

rg = run({"task": "radius_of_gyration", "pdb": pdb3})
check("Rg of collinear 0/3/6 == sqrt(6)", abs(rg["radiusOfGyration"] - 6 ** 0.5) < 1e-3, rg)

cm = run({"task": "contact_map", "pdb": pdb5, "threshold": 8.0, "minSeqSep": 1})
check("contact map finds 7 contacts (<=8A over 5 residues @4A)", cm["nContacts"] == 7, cm)

d = run({"task": "distance", "pdb": pdb5, "atomA": {"chain": "A", "resid": 1}, "atomB": {"chain": "A", "resid": 3}})
check("distance res1-res3 == 8.0", abs(d["distance"] - 8.0) < 1e-6, d)

check("missing pdb -> honest error", run({"task": "structure_summary"}).get("status") == "error")
check("unknown task -> honest error", run({"task": "nope", "pdb": pdb3}).get("status") == "error")

print(f"\nALL {passed} STRUCTURE-TOOLS TESTS PASSED")
