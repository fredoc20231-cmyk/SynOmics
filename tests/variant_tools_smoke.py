#!/usr/bin/env python3
"""Tests for variant / population-genetics tools. Run: python tests/variant_tools_smoke.py"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "variant_tools.py")

try:
    import scipy  # noqa: F401
except Exception as e:
    print(f"SKIP: scipy not available ({e}).")
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

hwe = run({"task": "hardy_weinberg", "AA": 25, "Aa": 50, "aa": 25})
check("HWE perfect equilibrium: chi2 ~0, in equilibrium", abs(hwe["chi2"]) < 1e-6 and hwe["inEquilibrium"] is True, hwe)
dis = run({"task": "hardy_weinberg", "AA": 50, "Aa": 0, "aa": 50})
check("HWE no heterozygotes: out of equilibrium", dis["inEquilibrium"] is False and dis["pValue"] < 0.01, dis)

af = run({"task": "allele_frequency", "AA": 25, "Aa": 50, "aa": 25})
check("allele frequency A=a=0.5", abs(af["alleleFrequency"]["A"] - 0.5) < 1e-9, af)

ts = run({"task": "ts_tv", "variants": [{"ref": "A", "alt": "G"}, {"ref": "C", "alt": "T"}, {"ref": "A", "alt": "C"}]})
check("Ts/Tv: 2 transitions, 1 transversion -> 2.0", ts["transitions"] == 2 and ts["transversions"] == 1 and ts["tsTvRatio"] == 2.0, ts)

vs = run({"task": "vcf_summary", "variants": [{"chrom": "1", "ref": "A", "alt": "G"}, {"chrom": "1", "ref": "AT", "alt": "A"}, {"chrom": "2", "ref": "C", "alt": "T"}]})
check("VCF summary: 2 SNV, 1 indel, 2 chroms", vs["snv"] == 2 and vs["indel"] == 1 and len(vs["variantsPerChromosome"]) == 2, vs)

check("unknown task -> honest error", run({"task": "nope"}).get("status") == "error")

print(f"\nALL {passed} VARIANT-TOOLS TESTS PASSED")
