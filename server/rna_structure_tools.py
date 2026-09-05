#!/usr/bin/env python3
"""RNA secondary-structure feature analysis from dot-bracket notation — one dispatch.

Task: analyze_rna_secondary_structure_features. Given an RNA secondary structure in
dot-bracket notation, compute purely topological features (base pairs, stems, paired
fraction). Reads JSON on stdin, prints JSON on stdout.

Design adapted from the Apache-2.0 Biomni project
(biochemistry.analyze_rna_secondary_structure_features). Reimplemented cleanly.
NOTE: the upstream reference added a fabricated "free energy" estimate from magic
per-pair constants — that is NOT a real thermodynamic computation, so it is dropped
entirely here (ZERO HALLUCINATION). Only exactly-computable topological features are
reported.

Conventions (documented, zero hallucination — all values are computed):
  * Notation: '(' ')', '[' ']', '{' '}' denote paired bases (three independent
    pairing systems, so crossing/pseudoknot pairs are representable); '.' is an
    unpaired base. Any other character is a hard error.
  * Matching: a stack PER bracket type. A closing bracket pops its own type's stack;
    popping an empty stack (a closer with no matching opener) or leaving openers on
    a stack at the end is an "unbalanced/mismatched" hard error — never guessed.
  * Stem: a maximal run of consecutively STACKED pairs i·j, (i+1)·(j-1), (i+2)·(j-2),
    ... (each next pair has its opener one position to the right and its closer one
    position to the left of the previous pair). Pairs are grouped positionally, so a
    crossing (pseudoknot) pair breaks a stem.
  * pairedPercent = 100 * pairedBases / length, rounded to 1 dp.
"""
import json
import sys

_OPENERS = {"(": ")", "[": "]", "{": "}"}
_CLOSERS = {")": "(", "]": "[", "}": "{"}
_VALID = set(_OPENERS) | set(_CLOSERS) | {"."}


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _parse_pairs(structure):
    """Match brackets with a stack per type. Returns a sorted list of (i, j) pairs
    with i < j (0-based), or calls _fail() on any invalid/unbalanced input."""
    # Stack per bracket type keyed by the OPENING character.
    stacks = {opener: [] for opener in _OPENERS}
    pairs = []
    for idx, ch in enumerate(structure):
        if ch == ".":
            continue
        if ch in _OPENERS:
            stacks[ch].append(idx)
        elif ch in _CLOSERS:
            opener = _CLOSERS[ch]
            if not stacks[opener]:
                _fail(
                    f"Unbalanced/mismatched structure: closing '{ch}' at position "
                    f"{idx} has no matching opening '{opener}'."
                )
            i = stacks[opener].pop()
            pairs.append((i, idx))
        else:
            _fail(
                f"Invalid character {ch!r} at position {idx}. Allowed characters are "
                "'(', ')', '[', ']', '{', '}', and '.'."
            )
    leftover = [(opener, pos) for opener, st in stacks.items() for pos in st]
    if leftover:
        leftover.sort(key=lambda t: t[1])
        n = len(leftover)
        positions = ", ".join(f"'{o}'@{p}" for o, p in leftover)
        _fail(
            f"Unbalanced structure: {n} unmatched opening bracket(s) at "
            f"position(s) {positions}."
        )
    pairs.sort()
    return pairs


def _group_stems(pairs):
    """Group sorted (i, j) pairs into maximal stacked runs (stems).
    Returns a list of stem lengths."""
    if not pairs:
        return []
    stems = []
    run = 1
    for k in range(1, len(pairs)):
        pi, pj = pairs[k - 1]
        i, j = pairs[k]
        if i == pi + 1 and j == pj - 1:
            run += 1
        else:
            stems.append(run)
            run = 1
    stems.append(run)
    return stems


def task_analyze_rna_secondary_structure_features(p):
    structure = p.get("dot_bracket_structure")
    if not isinstance(structure, str) or structure == "":
        _fail(
            "analyze_rna_secondary_structure_features needs `dot_bracket_structure`: "
            "a non-empty dot-bracket string (e.g. '(((...)))')."
        )

    length = len(structure)
    pairs = _parse_pairs(structure)

    total_base_pairs = len(pairs)
    paired_bases = 2 * total_base_pairs
    unpaired_bases = length - paired_bases
    paired_percent = round(100.0 * paired_bases / length, 1) if length else 0.0

    stem_lengths = _group_stems(pairs)
    num_stems = len(stem_lengths)
    longest_stem = max(stem_lengths) if stem_lengths else 0
    average_stem = round(sum(stem_lengths) / num_stems, 2) if num_stems else 0.0

    analysis = (
        f"Analyzed a {length}-nt dot-bracket structure: {total_base_pairs} base "
        f"pair(s) organized into {num_stems} stem(s) (longest {longest_stem}, "
        f"average {average_stem} pairs). {paired_bases}/{length} bases are paired "
        f"({paired_percent}%)."
    )

    result = {
        "status": "success",
        "analysis": analysis,
        "length": length,
        "totalBasePairs": total_base_pairs,
        "numStems": num_stems,
        "longestStemLength": longest_stem,
        "averageStemLength": average_stem,
        "pairedBases": paired_bases,
        "unpairedBases": unpaired_bases,
        "pairedPercent": paired_percent,
        "pairs": [[i, j] for (i, j) in pairs],
        "researchLog": _research_log(
            structure, length, total_base_pairs, num_stems, longest_stem,
            average_stem, paired_bases, unpaired_bases, paired_percent,
            stem_lengths,
        ),
    }
    return result


def _research_log(structure, length, total_bp, num_stems, longest, average,
                  paired, unpaired, paired_pct, stem_lengths):
    lines = [
        "# RNA secondary-structure feature analysis",
        "",
        f"- Structure (dot-bracket): `{structure}`",
        f"- Length: **{length}** nt",
        f"- Total base pairs: **{total_bp}**",
        f"- Paired bases: **{paired}**  |  Unpaired bases: **{unpaired}**",
        f"- Paired percent: **{paired_pct}%**",
        f"- Stems: **{num_stems}** "
        f"(lengths: {stem_lengths if stem_lengths else 'none'})",
        f"- Longest stem: **{longest}**  |  Average stem length: **{average}**",
        "",
        "## Method",
        "Brackets are matched with an independent stack per pair type ('()', '[]', "
        "'{}'), so pseudoknot/crossing pairs are representable. A stem is a maximal "
        "run of consecutively stacked pairs i·j, (i+1)·(j-1), … grouped by position. "
        "Paired percent = 100 · pairedBases / length. No thermodynamic free energy "
        "is estimated (that would require a real nearest-neighbour model, not "
        "assumed constants).",
    ]
    return "\n".join(lines)


TASKS = {
    "analyze_rna_secondary_structure_features":
        task_analyze_rna_secondary_structure_features,
}


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        _fail(f"Invalid JSON payload: {e}")
    task = payload.get("task")
    if task not in TASKS:
        _fail(f"Unknown task {task!r}. Available: {', '.join(TASKS)}.")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
