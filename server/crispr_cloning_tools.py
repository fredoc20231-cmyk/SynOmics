#!/usr/bin/env python3
"""CRISPR / molecular-cloning tools — one dispatch, real deterministic computation.

Tasks (payload.task):
  crispr_cut_site             — locate a Cas9 protospacer + PAM and its blunt cut site
  cas9_indel_spectrum         — classify edited amplicon reads (WT/ins/del/sub)
  golden_gate_assembly        — order + join overhang-compatible fragments
  design_verification_primers — genotyping primers that flank an edit

Zero-hallucination contract: every returned value (coordinates, cut sites, indel
lengths, assembled sequence, primer sequences and melting temperatures) is
computed directly from the caller-supplied sequences using explicit, documented
rules. Nothing is fabricated. Reverse complements are computed here (pure stdlib;
no biopython). Reads JSON on stdin, prints JSON on stdout.

Design adapted from the Apache-2.0 Biomni genetics / molecular_biology tools;
implementation is original and validated against hand-computed ground truth
(tests/crispr_cloning_tools_smoke.py).
"""
import json
import sys

# --- Nucleotide constants --------------------------------------------------
_COMP = {"A": "T", "T": "A", "G": "C", "C": "G"}

# IUPAC ambiguity codes -> the set of concrete bases each matches. Used only for
# PAM patterns (e.g. the default 'NGG' where N = any base).
_IUPAC = {
    "A": "A", "C": "C", "G": "G", "T": "T",
    "R": "AG", "Y": "CT", "S": "GC", "W": "AT", "K": "GT", "M": "AC",
    "B": "CGT", "D": "AGT", "H": "ACT", "V": "ACG", "N": "ACGT",
}


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _clean_dna(s, name):
    """Uppercase + strip whitespace; require a non-empty A/C/G/T string."""
    if not isinstance(s, str) or not s.strip():
        _fail(f"Provide `{name}` as a non-empty DNA string.")
    seq = s.strip().upper().replace(" ", "").replace("\n", "").replace("\r", "").replace("\t", "")
    if not seq:
        _fail(f"`{name}` is empty after cleaning.")
    bad = set(seq) - set("ACGT")
    if bad:
        _fail(f"`{name}` contains non-ACGT characters: {sorted(bad)}.")
    return seq


def _revcomp(seq):
    """Reverse complement of an A/C/G/T string (computed here, no dependencies)."""
    return "".join(_COMP[b] for b in reversed(seq))


def _pam_matches(sub, pattern):
    """True iff concrete `sub` matches an IUPAC `pattern` of equal length."""
    if len(sub) != len(pattern):
        return False
    for base, code in zip(sub, pattern):
        allowed = _IUPAC.get(code)
        if allowed is None or base not in allowed:
            return False
    return True


# ---------------------------------------------------------------------------
# 1. crispr_cut_site
# ---------------------------------------------------------------------------
def crispr_cut_site(p):
    sequence = _clean_dna(p.get("sequence"), "sequence")
    guide = _clean_dna(p.get("guide"), "guide")
    pam = p.get("pam", "NGG")
    if not isinstance(pam, str) or not pam.strip():
        _fail("Provide `pam` as an IUPAC pattern string (default 'NGG').")
    pam = pam.strip().upper()
    bad_pam = set(pam) - set(_IUPAC)
    if bad_pam:
        _fail(f"`pam` contains non-IUPAC characters: {sorted(bad_pam)}.")

    g = len(guide)
    plen = len(pam)
    if g < 1:
        _fail("`guide` must be at least 1 nt.")
    if g > len(sequence):
        _fail("`guide` is longer than `sequence`.")

    n = len(sequence)
    rc = _revcomp(sequence)
    sites = []

    # Plus strand: protospacer (guide) then PAM immediately 3'. Cut is 3 bp 5' of
    # the PAM => index (pam_start - 3), i.e. protospacerStart + g - 3 (for a 20 nt
    # guide this is protospacerStart + 17, between positions 17 and 18).
    for i in range(0, n - g + 1):
        if sequence[i:i + g] != guide:
            continue
        pam_start = i + g
        pam_seq = sequence[pam_start:pam_start + plen]
        if _pam_matches(pam_seq, pam):
            sites.append({
                "strand": "+",
                "protospacerStart": i,
                "cutSite": pam_start - 3,
                "pamSequence": pam_seq,
            })

    # Minus strand: search the reverse complement; map coordinates back to the
    # plus-strand frame of `sequence`. The blunt cut is symmetric (3 bp 5' of the
    # PAM on the minus strand); in plus coordinates that is protospacerStart + 3.
    for j in range(0, n - g + 1):
        if rc[j:j + g] != guide:
            continue
        pam_start_rc = j + g
        pam_seq = rc[pam_start_rc:pam_start_rc + plen]
        if _pam_matches(pam_seq, pam):
            proto_start_plus = n - (j + g)
            sites.append({
                "strand": "-",
                "protospacerStart": proto_start_plus,
                "cutSite": proto_start_plus + 3,
                "pamSequence": pam_seq,
            })

    if not sites:
        _fail(
            f"No protospacer matching the guide with an adjacent {pam} PAM was "
            "found on either strand."
        )

    # Deterministic ordering: leftmost plus-strand coordinate first, '+' before '-'.
    sites.sort(key=lambda s: (s["protospacerStart"], s["strand"]))
    primary = sites[0]

    analysis = (
        f"Found {len(sites)} Cas9 target site(s) for the {g} nt guide with a "
        f"{pam} PAM. Primary site: {primary['strand']} strand, protospacer at "
        f"index {primary['protospacerStart']}, PAM '{primary['pamSequence']}', "
        f"predicted blunt cut 3' of index {primary['cutSite'] - 1} "
        f"(base {primary['cutSite']} is immediately 3' of the break)."
    )
    research_log = (
        "# CRISPR Cut-Site Prediction\n\n"
        f"- Sequence length: {n} nt\n"
        f"- Guide (spacer): `{guide}` ({g} nt)\n"
        f"- PAM pattern: `{pam}`\n"
        f"- Sites found: **{len(sites)}**\n"
        f"- Primary strand: {primary['strand']}\n"
        f"- Protospacer start (0-based): {primary['protospacerStart']}\n"
        f"- PAM sequence: `{primary['pamSequence']}`\n"
        f"- Predicted cut site (index 3' of break): {primary['cutSite']}\n\n"
        "## Method\n"
        "The guide (protospacer) is matched on both strands; a match is a target "
        "only when an IUPAC-compatible PAM sits immediately 3' of the protospacer. "
        "SpCas9 makes a blunt double-strand break 3 bp 5' of the PAM (between "
        "protospacer positions 17 and 18 for a canonical 20 nt guide). Minus-strand "
        "hits are found on the reverse complement and mapped back to plus-strand "
        "coordinates.\n"
    )

    return {
        "status": "success",
        "analysis": analysis,
        "found": True,
        "strand": primary["strand"],
        "protospacerStart": primary["protospacerStart"],
        "cutSite": primary["cutSite"],
        "pamSequence": primary["pamSequence"],
        "guide": guide,
        "pam": pam,
        "nSites": len(sites),
        "sites": sites,
        "researchLog": research_log,
    }


# ---------------------------------------------------------------------------
# 2. cas9_indel_spectrum
# ---------------------------------------------------------------------------
def cas9_indel_spectrum(p):
    reference = _clean_dna(p.get("reference"), "reference")
    edited = p.get("editedSequences")
    if not isinstance(edited, list) or len(edited) == 0:
        _fail("Provide `editedSequences` as a non-empty list of DNA strings.")

    ref_len = len(reference)
    per_read = []
    counts = {"wt": 0, "insertion": 0, "deletion": 0, "substitution": 0}

    for idx, raw in enumerate(edited):
        seq = _clean_dna(raw, f"editedSequences[{idx}]")
        indel = len(seq) - ref_len
        if seq == reference:
            kind = "wt"
        elif len(seq) > ref_len:
            kind = "insertion"
        elif len(seq) < ref_len:
            kind = "deletion"
        else:  # equal length, not identical
            kind = "substitution"
        counts[kind] += 1
        frameshift = (indel % 3) != 0
        per_read.append({
            "type": kind,
            "indelLength": indel,
            "frameshift": frameshift,
        })

    total = len(per_read)
    n_frameshift = sum(1 for r in per_read if r["frameshift"])
    n_edited = total - counts["wt"]
    frameshift_fraction = n_frameshift / total
    edited_fraction = n_edited / total

    analysis = (
        f"Classified {total} edited read(s) against a {ref_len} nt reference: "
        f"{counts['wt']} WT, {counts['insertion']} insertion(s), "
        f"{counts['deletion']} deletion(s), {counts['substitution']} substitution(s). "
        f"Editing efficiency {edited_fraction:.4f}; frameshift fraction "
        f"{frameshift_fraction:.4f}."
    )
    research_log = (
        "# Cas9 Indel Spectrum\n\n"
        f"- Reference length: {ref_len} nt\n"
        f"- Reads analysed: {total}\n"
        f"- WT: {counts['wt']}  |  insertion: {counts['insertion']}  |  "
        f"deletion: {counts['deletion']}  |  substitution: {counts['substitution']}\n"
        f"- Edited fraction: **{edited_fraction:.6f}**\n"
        f"- Frameshift fraction: **{frameshift_fraction:.6f}**\n\n"
        "## Method\n"
        "Each read is compared to the reference: identical -> WT; longer -> "
        "insertion; shorter -> deletion; equal length but different -> substitution. "
        "Indel length = len(edited) - len(reference); a read is frameshifting when "
        "indel length is not a multiple of 3 (Python modulo handles negatives, so a "
        "1 bp deletion (-1) is frameshifting while a 3 bp deletion (-3) is in-frame).\n"
    )

    return {
        "status": "success",
        "analysis": analysis,
        "perRead": per_read,
        "frameshiftFraction": frameshift_fraction,
        "editedFraction": edited_fraction,
        "counts": counts,
        "nReads": total,
        "referenceLength": ref_len,
        "researchLog": research_log,
    }


# ---------------------------------------------------------------------------
# 3. golden_gate_assembly
# ---------------------------------------------------------------------------
def golden_gate_assembly(p):
    frags_raw = p.get("fragments")
    if not isinstance(frags_raw, list) or len(frags_raw) < 2:
        _fail("Provide `fragments` as a list of at least 2 DNA strings.")

    oh = p.get("overhangLength", 4)
    if isinstance(oh, bool) or not isinstance(oh, int) or oh < 1:
        _fail("`overhangLength` must be a positive integer (default 4).")

    frags = []
    for idx, f in enumerate(frags_raw):
        seq = _clean_dna(f, f"fragments[{idx}]")
        if len(seq) < oh:
            _fail(
                f"fragments[{idx}] (length {len(seq)}) is shorter than "
                f"overhangLength {oh}."
            )
        frags.append(seq)

    n = len(frags)
    five_of = {i: frags[i][:oh] for i in range(n)}
    three_of = {i: frags[i][-oh:] for i in range(n)}
    three_set = set(three_of.values())

    # Head candidates: fragments whose 5' overhang is produced by no fragment's
    # 3' overhang. Exactly one head => linear chain; zero => candidate circular.
    heads = [i for i in range(n) if five_of[i] not in three_set]
    if len(heads) == 1:
        start = heads[0]
        expect_circular = False
    elif len(heads) == 0:
        start = 0
        expect_circular = True
    else:
        _fail(
            "No single consistent assembly: multiple fragments have unmatched 5' "
            "overhangs (the fragments do not chain uniquely)."
        )

    order = [start]
    used = {start}
    current = start
    while True:
        nxt = [j for j in range(n) if j not in used and five_of[j] == three_of[current]]
        if not nxt:
            break
        if len(nxt) > 1:
            _fail(
                "Ambiguous assembly: fragment 3' overhang "
                f"'{three_of[current]}' matches multiple fragment 5' overhangs."
            )
        current = nxt[0]
        order.append(current)
        used.add(current)

    if len(order) != n:
        _fail(
            "Fragments do not chain into a single assembly (overhangs are "
            "inconsistent or the graph is disconnected)."
        )

    closes = three_of[order[-1]] == five_of[order[0]]
    if expect_circular and not closes:
        _fail("Fragments do not form a consistent circular assembly.")
    circular = closes

    # Join, deduplicating the shared overhang at every junction.
    assembled = frags[order[0]]
    for k in order[1:]:
        assembled += frags[k][oh:]
    if circular:
        # The final 3' overhang equals the first 5' overhang (the closing
        # junction); drop it so the circular molecule is represented once.
        assembled = assembled[:-oh]

    analysis = (
        f"Assembled {n} fragment(s) via {oh} nt Golden Gate overhangs into a "
        f"{'circular' if circular else 'linear'} product of {len(assembled)} nt. "
        f"Fragment order (input indices): {order}."
    )
    research_log = (
        "# Golden Gate Assembly\n\n"
        f"- Fragments: {n}\n"
        f"- Overhang length: {oh} nt\n"
        f"- Ordered fragment indices: {order}\n"
        f"- Topology: {'circular' if circular else 'linear'}\n"
        f"- Assembled length: {len(assembled)} nt\n\n"
        "## Method\n"
        "Each fragment's 3' overhang (last N nt) is matched to the next fragment's "
        "5' overhang (first N nt). A unique head fragment (5' overhang produced by "
        "no other 3' overhang) defines a linear chain; if every 5' overhang is "
        "consumed, the chain is tested for a single closing junction (circular). "
        "The product is built by concatenation with each shared overhang counted "
        "once; ambiguous or disconnected overhang sets are rejected with an error.\n"
    )

    return {
        "status": "success",
        "analysis": analysis,
        "assembledSequence": assembled,
        "assembledLength": len(assembled),
        "orderedFragmentIndices": order,
        "circular": circular,
        "overhangLength": oh,
        "nFragments": n,
        "researchLog": research_log,
    }


# ---------------------------------------------------------------------------
# 4. design_verification_primers
# ---------------------------------------------------------------------------
def _tm(primer):
    """Melting temperature (deg C).

    len >= 14 : Tm = 64.9 + 41 * (nGC - 16.4) / len   (nGC = G+C count)
    len < 14  : Wallace rule  Tm = 2*(A+T) + 4*(G+C)
    """
    a = primer.count("A")
    t = primer.count("T")
    g = primer.count("G")
    c = primer.count("C")
    ln = len(primer)
    if ln >= 14:
        return 64.9 + 41.0 * ((g + c) - 16.4) / ln
    return 2.0 * (a + t) + 4.0 * (g + c)


def design_verification_primers(p):
    sequence = _clean_dna(p.get("sequence"), "sequence")
    edit_position = p.get("editPosition")
    if isinstance(edit_position, bool) or not isinstance(edit_position, int):
        _fail("Provide `editPosition` as a 0-based integer index.")
    n = len(sequence)
    if edit_position < 0 or edit_position >= n:
        _fail(f"`editPosition` {edit_position} is outside the sequence [0, {n}).")

    flank = p.get("flank", 200)
    if isinstance(flank, bool) or not isinstance(flank, int) or flank < 1:
        _fail("`flank` must be a positive integer (default 200).")
    primer_len = p.get("primerLen", 20)
    if isinstance(primer_len, bool) or not isinstance(primer_len, int) or primer_len < 1:
        _fail("`primerLen` must be a positive integer (default 20).")

    # Amplicon window, clamped to the sequence; it must strictly span the edit.
    amplicon_start = max(0, edit_position - flank)
    amplicon_end = min(n, edit_position + flank)  # exclusive
    if not (amplicon_start <= edit_position < amplicon_end):
        _fail("Could not build an amplicon spanning the edit position.")

    # Forward primer must lie entirely upstream of the edit; reverse primer
    # (reverse complement) entirely downstream. Fail honestly if the edit is too
    # close to an end to fit flanking primers.
    if amplicon_start + primer_len > edit_position:
        _fail(
            "Insufficient upstream sequence to place a forward primer that flanks "
            "the edit (edit too close to the 5' end for the given primerLen)."
        )
    if amplicon_end - primer_len <= edit_position:
        _fail(
            "Insufficient downstream sequence to place a reverse primer that flanks "
            "the edit (edit too close to the 3' end for the given primerLen)."
        )

    forward_primer = sequence[amplicon_start:amplicon_start + primer_len]
    reverse_region = sequence[amplicon_end - primer_len:amplicon_end]
    reverse_primer = _revcomp(reverse_region)
    amplicon_length = amplicon_end - amplicon_start
    forward_tm = _tm(forward_primer)
    reverse_tm = _tm(reverse_primer)

    analysis = (
        f"Designed genotyping primers flanking an edit at index {edit_position}. "
        f"Amplicon spans [{amplicon_start}, {amplicon_end}) = {amplicon_length} bp. "
        f"Forward primer Tm {forward_tm:.1f} degC; reverse primer Tm {reverse_tm:.1f} degC."
    )
    research_log = (
        "# Verification Primer Design\n\n"
        f"- Sequence length: {n} nt\n"
        f"- Edit position (0-based): {edit_position}\n"
        f"- Flank target: {flank} nt  |  primer length: {primer_len} nt\n"
        f"- Amplicon: [{amplicon_start}, {amplicon_end}) ({amplicon_length} bp)\n"
        f"- Forward primer: `{forward_primer}` (Tm {forward_tm:.2f} degC)\n"
        f"- Reverse primer: `{reverse_primer}` (Tm {reverse_tm:.2f} degC)\n\n"
        "## Method\n"
        "The forward primer is taken from the plus strand upstream of the edit and "
        "the reverse primer is the reverse complement of a downstream window, so the "
        "amplicon strictly spans the edit. Melting temperature uses the "
        "64.9 + 41*(GC - 16.4)/length rule for primers >= 14 nt and the Wallace rule "
        "2*(A+T) + 4*(G+C) for shorter primers, where GC/A/T/G/C are base counts.\n"
    )

    return {
        "status": "success",
        "analysis": analysis,
        "forwardPrimer": forward_primer,
        "reversePrimer": reverse_primer,
        "ampliconStart": amplicon_start,
        "ampliconEnd": amplicon_end,
        "ampliconLength": amplicon_length,
        "forwardTm": forward_tm,
        "reverseTm": reverse_tm,
        "editPosition": edit_position,
        "researchLog": research_log,
    }


TASKS = {
    "crispr_cut_site": crispr_cut_site,
    "cas9_indel_spectrum": cas9_indel_spectrum,
    "golden_gate_assembly": golden_gate_assembly,
    "design_verification_primers": design_verification_primers,
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
