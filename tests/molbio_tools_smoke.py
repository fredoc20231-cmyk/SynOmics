#!/usr/bin/env python3
"""Ground-truth smoke tests for server/molbio_tools.py.

Every asserted number is hand-verifiable on the small fixtures below. Success
paths call the task functions directly; error / dispatch paths go through main()
(stdin JSON -> stdout JSON), tolerating _fail's sys.exit(0). Pure stdlib — no
biopython, matplotlib, or numpy required.
"""
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))

import molbio_tools as mb  # noqa: E402

passed = 0


def check(name, cond, ctx=None):
    global passed
    if not cond:
        print(f"FAIL: {name}\n  {ctx}")
        sys.exit(1)
    passed += 1
    print(f"ok: {name}")


def dispatch(payload):
    """Drive main() end-to-end so error paths can be asserted safely."""
    old_in, old_out = sys.stdin, sys.stdout
    sys.stdin = io.StringIO(json.dumps(payload))
    sys.stdout = io.StringIO()
    try:
        mb.main()
    except SystemExit:
        pass
    out = sys.stdout.getvalue()
    sys.stdin, sys.stdout = old_in, old_out
    return json.loads(out)


# Independent reverse complement for the test's own ground truth.
def rc(s):
    return s.translate(str.maketrans("ACGT", "TGCA"))[::-1]


# --------------------------------------------------------------------------- #
# 1) in_silico_pcr — deterministic amplicon we build by hand.
# --------------------------------------------------------------------------- #
# amplicon = "ATGCCCCGGGGTAG" (14 nt); template = "TTT" + amplicon + "CCC".
# forward primer = first 4 nt of amplicon = "ATGC".
# reverse primer = revcomp(last 4 nt of amplicon) = revcomp("GTAG") = "CTAC".
amplicon = "ATGCCCCGGGGTAG"
template = "TTT" + amplicon + "CCC"
fwd = "ATGC"
rev = rc("GTAG")
check("pcr: hand-check reverse primer == CTAC", rev == "CTAC", rev)

r = mb.in_silico_pcr({"template": template, "forwardPrimer": fwd, "reversePrimer": rev})
check("pcr: status success", r["status"] == "success", r)
check("pcr: productFound True", r["productFound"] is True, r)
check("pcr: ampliconLength == 14", r["ampliconLength"] == 14, r)
check("pcr: amplicon exact", r["amplicon"] == amplicon, r)
check("pcr: forwardStart == 4", r["forwardStart"] == 4, r)  # 'ATGC' at 0-based 3

# forward primer absent -> error
r = dispatch({"task": "in_silico_pcr", "template": template,
              "forwardPrimer": "TTTTTTTT", "reversePrimer": rev})
check("pcr: forward not found -> error", r["status"] == "error", r)

# reverse primer absent -> error ("AAAA" is not in the reverse-complement strand)
r = dispatch({"task": "in_silico_pcr", "template": template,
              "forwardPrimer": fwd, "reversePrimer": "AAAA"})
check("pcr: reverse not found -> error", r["status"] == "error", r)


# --------------------------------------------------------------------------- #
# 2) restriction_digest_fragments — EcoRI (GAATTC) on a 21 bp sequence.
# --------------------------------------------------------------------------- #
# 'AAA GAATTC TTT GAATTC GGG' -> 2 sites at 0-based 3 and 12 -> 3 linear fragments.
seq = "AAAGAATTCTTTGAATTCGGG"
check("digest: fixture length 21", len(seq) == 21, len(seq))
r = mb.restriction_digest_fragments({"sequence": seq, "enzyme": "EcoRI"})
check("digest: status success", r["status"] == "success", r)
check("digest: siteCount 2", r["siteCount"] == 2, r)
check("digest: 3 fragments", len(r["fragments"]) == 3, r["fragments"])
check("digest: fragmentLengths sum == len(sequence)",
      sum(r["fragmentLengths"]) == len(seq), r["fragmentLengths"])
# Fragments tile the sequence exactly (concatenation reconstructs the input).
check("digest: fragments reconstruct sequence",
      "".join(f["sequence"] for f in r["fragments"]) == seq, r["fragments"])
# EcoRI cuts G^AATTC (offset 1) -> boundaries at 4 and 13 -> lengths [4, 9, 8].
check("digest: fragmentLengths == [4, 9, 8]", r["fragmentLengths"] == [4, 9, 8],
      r["fragmentLengths"])

# custom recognitionSite path matches the named enzyme's site (offset defaults 0).
r2 = mb.restriction_digest_fragments({"sequence": seq, "recognitionSite": "GAATTC"})
check("digest: custom site siteCount 2", r2["siteCount"] == 2, r2)
check("digest: custom site 3 fragments", len(r2["fragments"]) == 3, r2["fragments"])
check("digest: custom site lengths sum == len(sequence)",
      sum(r2["fragmentLengths"]) == len(seq), r2["fragmentLengths"])

# no site present -> single uncut fragment covering the whole sequence.
r3 = mb.restriction_digest_fragments({"sequence": "AAAAAAAA", "enzyme": "EcoRI"})
check("digest: no site -> 1 fragment", len(r3["fragments"]) == 1, r3)
check("digest: no site -> full length", r3["fragmentLengths"] == [8], r3)

# unknown enzyme and no recognitionSite -> error.
check("digest: unknown enzyme -> error",
      dispatch({"task": "restriction_digest_fragments", "sequence": seq,
                "enzyme": "NotAReal"})["status"] == "error")
# neither enzyme nor recognitionSite -> error.
check("digest: no enzyme/site -> error",
      dispatch({"task": "restriction_digest_fragments", "sequence": seq})["status"] == "error")


# --------------------------------------------------------------------------- #
# 3) find_sequence_mutations — ref='ACGTACGT', query='ACCTACGA'.
# --------------------------------------------------------------------------- #
# pos 3: G->C, pos 8: T->A  => 2 substitutions, identity (6/8)*100 = 75.0.
r = mb.find_sequence_mutations({"reference": "ACGTACGT", "query": "ACCTACGA"})
check("mut: status success", r["status"] == "success", r)
check("mut: mutationCount 2", r["mutationCount"] == 2, r)
check("mut: percentIdentity 75.0", r["percentIdentity"] == 75.0, r)
check("mut: mutation 1 == pos3 G->C substitution",
      r["mutations"][0] == {"position": 3, "ref": "G", "alt": "C", "type": "substitution"},
      r["mutations"])
check("mut: mutation 2 == pos8 T->A substitution",
      r["mutations"][1] == {"position": 8, "ref": "T", "alt": "A", "type": "substitution"},
      r["mutations"])

# identical sequences -> 0 mutations, 100% identity.
r = mb.find_sequence_mutations({"reference": "ACGT", "query": "ACGT"})
check("mut: identical -> 0 mutations", r["mutationCount"] == 0, r)
check("mut: identical -> 100.0", r["percentIdentity"] == 100.0, r)

# unequal length -> error.
check("mut: unequal length -> error",
      dispatch({"task": "find_sequence_mutations",
                "reference": "ACGT", "query": "ACG"})["status"] == "error")


# --------------------------------------------------------------------------- #
# 4) design_primer — 44 nt sequence; verify the spec independently.
# --------------------------------------------------------------------------- #
dseq = "ATGCGACTGGCATTGCCAGTCAGGTACCGATGCTAGCTAGGCTA"
check("primer: fixture length 44", len(dseq) == 44, len(dseq))
TARGET, MIN_L, MAX_L = 60.0, 18, 25


def spec_tm(s):
    n = len(s)
    gc = sum(1 for c in s if c in "GC")
    if n < 14:
        return float(4 * gc + 2 * (n - gc))
    return 64.9 + 41.0 * (gc - 16.4) / n


def best_len(from_5):
    best = None
    for L in range(MIN_L, MAX_L + 1):
        cand = dseq[:L] if from_5 else rc(dseq[-L:])
        d = abs(spec_tm(cand) - TARGET)
        if best is None or d < best[0]:
            best = (d, L, cand)
    return best[1], best[2]


exp_f_len, exp_f = best_len(True)
exp_r_len, exp_r = best_len(False)

r = mb.design_primer({"sequence": dseq, "targetTm": TARGET,
                      "minLen": MIN_L, "maxLen": MAX_L})
check("primer: status success", r["status"] == "success", r)
check("primer: forward primer matches spec-optimal", r["forwardPrimer"] == exp_f, r)
check("primer: reverse primer matches spec-optimal", r["reversePrimer"] == exp_r, r)
check("primer: forward length in window",
      MIN_L <= r["forwardLength"] <= MAX_L and r["forwardLength"] == exp_f_len, r)
check("primer: reverse length in window",
      MIN_L <= r["reverseLength"] <= MAX_L and r["reverseLength"] == exp_r_len, r)
check("primer: forwardTm equals spec Tm of chosen primer",
      abs(r["forwardTm"] - spec_tm(exp_f)) < 1e-6, r)
check("primer: forwardTm within a few degrees of target",
      abs(r["forwardTm"] - TARGET) <= 3.0, r)
check("primer: reverseTm within a few degrees of target",
      abs(r["reverseTm"] - TARGET) <= 3.0, r)
check("primer: reversePrimer is revcomp of the 3' segment",
      r["reversePrimer"] == rc(dseq[-r["reverseLength"]:]), r)
check("primer: forwardGC matches hand count (4 dp)",
      r["forwardGC"] == round(100.0 * sum(1 for c in exp_f if c in "GC") / len(exp_f), 4), r)


# --------------------------------------------------------------------------- #
# 5) primer_binding_scan — primer occurring exactly twice on the + strand.
# --------------------------------------------------------------------------- #
# template = 'ATGC' TTTT 'ATGC' GGGG -> 'ATGC' at 0-based 0 and 8.
btmpl = "ATGCTTTTATGCGGGG"
r = mb.primer_binding_scan({"template": btmpl, "primer": "ATGC"})
check("scan: status success", r["status"] == "success", r)
plus_sites = [s for s in r["bindingSites"] if s["strand"] == "+"]
check("scan: exactly 2 + strand sites", len(plus_sites) == 2, r["bindingSites"])
check("scan: + sites at 1 and 9 with 0 mismatches",
      sorted((s["start"], s["mismatches"]) for s in plus_sites) == [(1, 0), (9, 0)],
      plus_sites)
check("scan: siteCount == 2 (no - strand hits for this fixture)",
      r["siteCount"] == 2, r)

# mismatch tolerance: primer 'ATGG' (1 mismatch vs 'ATGC') found with maxMismatches=1.
r = mb.primer_binding_scan({"template": btmpl, "primer": "ATGG", "maxMismatches": 1})
plus_sites = [s for s in r["bindingSites"] if s["strand"] == "+"]
check("scan: mismatch-tolerant finds >=2 near-matches",
      len([s for s in plus_sites if s["mismatches"] == 1]) >= 2, plus_sites)
# ...and none at 0 mismatches (exact 'ATGG' is absent on the + strand).
r0 = mb.primer_binding_scan({"template": btmpl, "primer": "ATGG"})
check("scan: exact 'ATGG' absent on + strand at 0 mismatches",
      not [s for s in r0["bindingSites"] if s["strand"] == "+"], r0["bindingSites"])


# --------------------------------------------------------------------------- #
# 6) Dispatch-level guards.
# --------------------------------------------------------------------------- #
check("dispatch: unknown task -> error", dispatch({"task": "nope"})["status"] == "error")
check("dispatch: missing task -> error", dispatch({})["status"] == "error")
check("dispatch: known task via main -> success",
      dispatch({"task": "find_sequence_mutations",
                "reference": "ACGT", "query": "ACCT"})["status"] == "success")

print(f"\nALL {passed} MOLBIO TESTS PASSED")
