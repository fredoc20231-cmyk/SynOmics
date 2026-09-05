#!/usr/bin/env python3
"""Smoke + ground-truth tests for server/crispr_cloning_tools.py.

Every asserted value is hand-computed and checked against the module's REAL
computed output (run through its stdin/stdout single dispatch). Nothing is mocked.
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MODULE = os.path.join(HERE, "..", "server", "crispr_cloning_tools.py")


def run(payload):
    proc = subprocess.run(
        [sys.executable, MODULE],
        input=json.dumps(payload),
        capture_output=True, text=True,
    )
    assert proc.returncode == 0, f"nonzero exit: {proc.stderr}"
    return json.loads(proc.stdout)


def approx(a, b, tol=1e-9):
    return abs(a - b) <= tol


def revcomp(seq):
    comp = {"A": "T", "T": "A", "G": "C", "C": "G"}
    return "".join(comp[b] for b in reversed(seq))


def tm(primer):
    a = primer.count("A")
    t = primer.count("T")
    g = primer.count("G")
    c = primer.count("C")
    ln = len(primer)
    if ln >= 14:
        return 64.9 + 41.0 * ((g + c) - 16.4) / ln
    return 2.0 * (a + t) + 4.0 * (g + c)


def main():
    passed = 0

    # ---------------------------------------------------------------
    # 1) crispr_cut_site: guide flanked by CGG (NGG) PAM on the + strand.
    # ---------------------------------------------------------------
    flank5 = "TTATT"
    guide = "AGGTCCATGGCAATTCGACT"  # 20 nt, not self-complementary
    assert len(guide) == 20
    flank3 = "AATTAA"
    sequence = flank5 + guide + "CGG" + flank3
    proto_start = len(flank5)  # 5

    out = run({"task": "crispr_cut_site", "sequence": sequence,
               "guide": guide, "pam": "NGG"})
    assert out["status"] == "success", out
    assert out["found"] is True, out
    assert out["strand"] == "+", out
    assert out["protospacerStart"] == proto_start, out
    # blunt cut 3 bp 5' of the PAM => between protospacer positions 17 and 18
    assert out["cutSite"] == proto_start + 17, (out["cutSite"], proto_start)
    assert out["pamSequence"].startswith("C") and out["pamSequence"] == "CGG", out
    assert out["pamSequence"].endswith("GG"), out
    passed += 1

    # no-PAM case -> found False or error (here: honest error, no adjacent NGG)
    seq_no_pam = flank5 + guide + "CTT" + flank3
    out = run({"task": "crispr_cut_site", "sequence": seq_no_pam,
               "guide": guide, "pam": "NGG"})
    assert out.get("status") == "error" or out.get("found") is False, out
    passed += 1

    # ---------------------------------------------------------------
    # 2) cas9_indel_spectrum: WT / 1-bp del (frameshift) / 3-bp ins (in-frame).
    # ---------------------------------------------------------------
    reference = "ACGTACGTAC"  # len 10
    edited = [
        "ACGTACGTAC",     # WT
        "ACGTACGTA",      # 1-bp deletion (indel -1) -> frameshift
        "ACGTACGTACGGG",  # 3-bp insertion (indel +3) -> in-frame
    ]
    out = run({"task": "cas9_indel_spectrum", "reference": reference,
               "editedSequences": edited})
    assert out["status"] == "success", out
    pr = out["perRead"]
    assert len(pr) == 3, pr
    assert pr[0] == {"type": "wt", "indelLength": 0, "frameshift": False}, pr[0]
    assert pr[1] == {"type": "deletion", "indelLength": -1, "frameshift": True}, pr[1]
    assert pr[2] == {"type": "insertion", "indelLength": 3, "frameshift": False}, pr[2]
    assert approx(out["frameshiftFraction"], 1.0 / 3.0), out["frameshiftFraction"]
    assert approx(out["editedFraction"], 2.0 / 3.0), out["editedFraction"]
    assert out["counts"] == {"wt": 1, "insertion": 1, "deletion": 1,
                             "substitution": 0}, out["counts"]
    passed += 1

    # substitution path (separate call so it doesn't disturb the fractions above)
    out = run({"task": "cas9_indel_spectrum", "reference": "ACGT",
               "editedSequences": ["AGGT"]})
    assert out["status"] == "success", out
    assert out["perRead"][0] == {"type": "substitution", "indelLength": 0,
                                 "frameshift": False}, out["perRead"][0]
    assert out["counts"]["substitution"] == 1, out["counts"]
    passed += 1

    # ---------------------------------------------------------------
    # 3) golden_gate_assembly: 3 fragments with matching 4 nt overhangs.
    #    A (5'AAAA/3'GGGG) -> B (5'GGGG/3'CCCC) -> C (5'CCCC/3'TTTT)
    #    Provided out of order [B, C, A] to exercise the ordering.
    # ---------------------------------------------------------------
    A = "AAAA" + "ACGT" + "GGGG"  # AAAAACGTGGGG
    B = "GGGG" + "TTAA" + "CCCC"  # GGGGTTAACCCC
    C = "CCCC" + "GATC" + "TTTT"  # CCCCGATCTTTT
    expected = A + B[4:] + C[4:]  # AAAAACGTGGGGTTAACCCCGATCTTTT
    assert expected == "AAAAACGTGGGGTTAACCCCGATCTTTT"

    out = run({"task": "golden_gate_assembly", "fragments": [B, C, A],
               "overhangLength": 4})
    assert out["status"] == "success", out
    assert out["assembledSequence"] == expected, out["assembledSequence"]
    assert out["assembledLength"] == len(expected) == 28, out["assembledLength"]
    assert out["orderedFragmentIndices"] == [2, 0, 1], out["orderedFragmentIndices"]
    assert out["circular"] is False, out
    passed += 1

    # circular case: A->B->C->A (every 5' overhang consumed, closing junction).
    Ac = "AAAA" + "AT" + "GGGG"  # AAAAATGGGG
    Bc = "GGGG" + "CG" + "CCCC"  # GGGGCGCCCC
    Cc = "CCCC" + "TA" + "AAAA"  # CCCCTAAAAA
    out = run({"task": "golden_gate_assembly", "fragments": [Ac, Bc, Cc],
               "overhangLength": 4})
    assert out["status"] == "success", out
    assert out["circular"] is True, out
    # circular length = sum(len) - n*overhang = 30 - 12 = 18
    assert out["assembledLength"] == 18, out["assembledLength"]
    passed += 1

    # no consistent assembly -> honest error (overhangs don't chain)
    out = run({"task": "golden_gate_assembly",
               "fragments": ["AAAAGGGGCCCC", "TTTTAAAAGGGG"],
               "overhangLength": 4})
    assert out["status"] == "error", out
    passed += 1

    # ---------------------------------------------------------------
    # 4) design_verification_primers: 500 nt sequence, edit at 250.
    # ---------------------------------------------------------------
    seq500 = ("ACGTACGTAG" * 50)
    assert len(seq500) == 500
    out = run({"task": "design_verification_primers", "sequence": seq500,
               "editPosition": 250})
    assert out["status"] == "success", out
    assert out["ampliconStart"] < 250 < out["ampliconEnd"], out
    assert out["ampliconStart"] == 50 and out["ampliconEnd"] == 450, out
    assert out["ampliconLength"] == 400, out
    assert len(out["forwardPrimer"]) == 20, out["forwardPrimer"]
    assert len(out["reversePrimer"]) == 20, out["reversePrimer"]
    assert out["forwardPrimer"] == seq500[50:70], out["forwardPrimer"]
    assert out["reversePrimer"] == revcomp(seq500[430:450]), out["reversePrimer"]
    # Tm values are the REAL formula applied to the returned primers.
    assert approx(out["forwardTm"], tm(out["forwardPrimer"]), 1e-9), out["forwardTm"]
    assert approx(out["reverseTm"], tm(out["reversePrimer"]), 1e-9), out["reverseTm"]
    passed += 1

    # edit too close to the 5' end for a flanking forward primer -> error
    out = run({"task": "design_verification_primers", "sequence": seq500,
               "editPosition": 5})
    assert out["status"] == "error", out
    passed += 1

    # editPosition out of range -> error
    out = run({"task": "design_verification_primers", "sequence": seq500,
               "editPosition": 600})
    assert out["status"] == "error", out
    passed += 1

    # ---------------------------------------------------------------
    # 5) unknown task -> error
    # ---------------------------------------------------------------
    out = run({"task": "not_a_task"})
    assert out["status"] == "error", out
    passed += 1

    print(f"ALL {passed} CRISPR-CLONING TESTS PASSED")


if __name__ == "__main__":
    main()
