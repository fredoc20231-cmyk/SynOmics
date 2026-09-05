#!/usr/bin/env python3
"""Ground-truth smoke tests for server/rna_structure_tools.py (RNA secondary-
structure feature analysis from dot-bracket notation). All asserted numbers are
verifiable by hand."""
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))

import rna_structure_tools as rst  # noqa: E402

passed = 0


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
        rst.main()
    except SystemExit:
        pass
    out = sys.stdout.getvalue()
    sys.stdin, sys.stdout = old_in, old_out
    return json.loads(out)


def run(structure):
    """Success-path helper: call the task directly on a dot-bracket string."""
    return rst.task_analyze_rna_secondary_structure_features(
        {"dot_bracket_structure": structure}
    )


# 1) '(((...)))' -> a single clean 3-pair hairpin stem (hand-verified ground truth).
r = run("(((...)))")
check("hairpin: status success", r["status"] == "success", r)
check("hairpin: totalBasePairs 3", r["totalBasePairs"] == 3, r)
check("hairpin: numStems 1", r["numStems"] == 1, r)
check("hairpin: longestStemLength 3", r["longestStemLength"] == 3, r)
check("hairpin: averageStemLength 3.0", r["averageStemLength"] == 3.0, r)
check("hairpin: pairedBases 6", r["pairedBases"] == 6, r)
check("hairpin: unpairedBases 3", r["unpairedBases"] == 3, r)
check("hairpin: pairedPercent 66.7", r["pairedPercent"] == 66.7, r)
check("hairpin: pairs (0-based, sorted)",
      r["pairs"] == [[0, 8], [1, 7], [2, 6]], r["pairs"])
check("hairpin: researchLog is markdown str",
      isinstance(r["researchLog"], str) and r["researchLog"].startswith("#"), r)

# 2) '((..))..((..))' -> two separate 2-pair stems, 4 base pairs total.
r = run("((..))..((..))")
check("two-stem: status success", r["status"] == "success", r)
check("two-stem: numStems 2", r["numStems"] == 2, r)
check("two-stem: totalBasePairs 4", r["totalBasePairs"] == 4, r)
check("two-stem: longestStemLength 2", r["longestStemLength"] == 2, r)
check("two-stem: averageStemLength 2.0", r["averageStemLength"] == 2.0, r)
check("two-stem: pairedBases 8", r["pairedBases"] == 8, r)

# 3) All-unpaired '.....' -> zero pairs, zero stems, 0.0% (no division blow-up).
r = run(".....")
check("unpaired: totalBasePairs 0", r["totalBasePairs"] == 0, r)
check("unpaired: numStems 0", r["numStems"] == 0, r)
check("unpaired: longestStemLength 0", r["longestStemLength"] == 0, r)
check("unpaired: averageStemLength 0.0", r["averageStemLength"] == 0.0, r)
check("unpaired: pairedPercent 0.0", r["pairedPercent"] == 0.0, r)

# 4) Unbalanced '(((.' -> honest error (3 unmatched openers).
r = dispatch({"task": "analyze_rna_secondary_structure_features",
              "dot_bracket_structure": "(((."})
check("unbalanced -> error", r["status"] == "error", r)
check("unbalanced -> message mentions unmatched/unbalanced",
      "unmatched" in r["error"].lower() or "unbalanced" in r["error"].lower(), r)

# 5) Invalid character 'xyz' -> honest error.
r = dispatch({"task": "analyze_rna_secondary_structure_features",
              "dot_bracket_structure": "xyz"})
check("invalid char -> error", r["status"] == "error", r)
check("invalid char -> message mentions invalid",
      "invalid" in r["error"].lower(), r)

# 6) Missing / empty structure -> error.
check("missing structure -> error",
      dispatch({"task": "analyze_rna_secondary_structure_features"})["status"]
      == "error")
check("empty structure -> error",
      dispatch({"task": "analyze_rna_secondary_structure_features",
                "dot_bracket_structure": ""})["status"] == "error")

# 7) Unknown task via main dispatch -> error; known task -> success.
check("unknown task -> error", dispatch({"task": "nope"})["status"] == "error")
check("known task via main dispatch -> success",
      dispatch({"task": "analyze_rna_secondary_structure_features",
                "dot_bracket_structure": "(((...)))"})["status"] == "success")

# Sanity: 6/9 = 66.666..., which rounds to 66.7 at 1 dp (matches asserted GT).
assert round(100.0 * 6 / 9, 1) == 66.7

print(f"\nALL {passed} RNA-STRUCTURE TESTS PASSED")
