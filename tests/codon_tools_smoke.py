#!/usr/bin/env python3
"""Smoke + ground-truth tests for server/codon_tools.py (codon_optimize).

Every asserted value is computed by hand from the host table below and checked
against the module's REAL computed output (run via its stdin/stdout dispatch).
"""
import json
import math
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
MODULE = os.path.join(HERE, "..", "server", "codon_tools.py")

# Host codon-usage table (flat {codon: frequency}).
# Lys: AAA (0.6) > AAG (0.2); Met ATG = 1.0 (single codon).
HOST = {"ATG": 1.0, "AAA": 0.6, "AAG": 0.2}


def run(payload):
    proc = subprocess.run(
        [sys.executable, MODULE],
        input=json.dumps(payload),
        capture_output=True, text=True,
    )
    assert proc.returncode == 0, f"nonzero exit: {proc.stderr}"
    return json.loads(proc.stdout)


def approx(a, b, tol=1e-6):
    return abs(a - b) == 0 or abs(a - b) <= tol


def main():
    passed = 0

    # 1) ATGAAG -> ATGAAA: Lys AAG (non-optimal) replaced by AAA (optimal).
    out = run({"task": "codon_optimize", "sequence": "ATGAAG", "hostCodonUsage": HOST})
    assert out["status"] == "success", out
    assert out["optimizedSequence"] == "ATGAAA", out["optimizedSequence"]
    assert out["codonsChanged"] == 1, out["codonsChanged"]
    assert approx(out["caiAfter"], 1.0), out["caiAfter"]
    cai_before_truth = math.sqrt(1.0 * (HOST["AAG"] / HOST["AAA"]))
    assert approx(out["caiBefore"], cai_before_truth), (out["caiBefore"], cai_before_truth)
    # per-codon detail
    pc = out["perCodon"]
    assert len(pc) == 2
    assert pc[0] == {"position": 1, "aa": "M", "original": "ATG",
                     "optimized": "ATG", "wBefore": 1.0, "wAfter": 1.0}, pc[0]
    assert pc[1]["aa"] == "K" and pc[1]["original"] == "AAG" and pc[1]["optimized"] == "AAA"
    assert approx(pc[1]["wBefore"], round(HOST["AAG"] / HOST["AAA"], 6))
    assert approx(pc[1]["wAfter"], 1.0)
    passed += 1

    # 2) already all-optimal sequence -> no change, CAI == 1.0 both sides.
    out = run({"task": "codon_optimize", "sequence": "ATGAAA", "hostCodonUsage": HOST})
    assert out["status"] == "success", out
    assert out["optimizedSequence"] == "ATGAAA"
    assert out["codonsChanged"] == 0, out["codonsChanged"]
    assert approx(out["caiBefore"], 1.0) and approx(out["caiAfter"], 1.0), out
    passed += 1

    # 3) invalid: length not multiple of 3
    out = run({"task": "codon_optimize", "sequence": "ATGA", "hostCodonUsage": HOST})
    assert out["status"] == "error", out
    passed += 1

    # 4) invalid: bad character
    out = run({"task": "codon_optimize", "sequence": "ATGXAA", "hostCodonUsage": HOST})
    assert out["status"] == "error", out
    passed += 1

    # 5) unknown task -> error
    out = run({"task": "not_a_task"})
    assert out["status"] == "error", out
    passed += 1

    # 6) bundle: outputDir produces a full manifest with real artifacts
    try:
        import matplotlib  # noqa: F401
        has_mpl = True
    except Exception:
        has_mpl = False

    if has_mpl:
        with tempfile.TemporaryDirectory() as td:
            out = run({"task": "codon_optimize", "sequence": "ATGAAG",
                       "hostCodonUsage": HOST, "outputDir": td})
            assert out["status"] == "success", out
            man = out["bundle"]
            arts = man["artifacts"]
            # figure png + svg
            pngs = [a for a in arts["figures"] if a.endswith(".png")]
            svgs = [a for a in arts["figures"] if a.endswith(".svg")]
            assert pngs and svgs, arts["figures"]
            png_path = os.path.join(td, pngs[0])
            with open(png_path, "rb") as fh:
                assert fh.read(4) == b"\x89PNG", "png magic"
            assert os.path.getsize(png_path) > 0
            assert os.path.getsize(os.path.join(td, svgs[0])) > 0
            # table csv
            csvs = [a for a in arts["tables"] if a.endswith(".csv")]
            assert csvs, arts["tables"]
            assert os.path.getsize(os.path.join(td, csvs[0])) > 0
            # code/analysis.py
            code_rel = os.path.join("code", "analysis.py")
            code_path = os.path.join(td, code_rel)
            assert os.path.exists(code_path) and os.path.getsize(code_path) > 0
            # report.html + report.md
            for rep in ("report.html", "report.md"):
                rp = os.path.join(td, rep)
                assert os.path.exists(rp) and os.path.getsize(rp) > 0, rep
        passed += 1
    else:
        print("SKIP bundle test (matplotlib unavailable)")

    print(f"ALL {passed} CODON TESTS PASSED")


if __name__ == "__main__":
    main()
