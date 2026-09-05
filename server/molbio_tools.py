#!/usr/bin/env python3
"""Molecular-biology bench tools — one dispatch, real deterministic sequence logic.

Tasks (payload.task):
  in_silico_pcr                 locate a primer pair and return the exact amplicon
  restriction_digest_fragments  cut DNA at a recognition site into real fragments
  find_sequence_mutations       diff two pre-aligned equal-length sequences
  design_primer                 pick 5'/3' primers whose Tm is closest to a target
  primer_binding_scan           scan both strands for near-match binding sites

Every reported value (amplicon, fragment lengths, mutations, Tm, GC, binding
sites) is computed by exact string/arithmetic logic on the provided sequences —
nothing is fabricated, simulated, or guessed. Reads JSON on stdin, prints JSON on
stdout, single dispatch. All five tasks are pure standard-library (no biopython);
per the module contract, biopython is only imported for a task that needs it.

Design adapted from the Apache-2.0 Biomni molecular_biology toolset and
reimplemented cleanly here.
"""
import json
import sys

# --------------------------------------------------------------------------- #
# Shared helpers (pure stdlib)
# --------------------------------------------------------------------------- #
_COMP = str.maketrans("ACGTNRYSWKMBDHVacgtnryswkmbdhv",
                      "TGCANYRSWMKVHDBtgcanyrswmkvhdb")


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _dna(p, key):
    """Fetch a required DNA string; uppercase and strip all whitespace."""
    s = p.get(key)
    if not isinstance(s, str) or not s.strip():
        _fail(f"Provide a `{key}` DNA string.")
    return "".join(s.split()).upper()


def _revcomp(s):
    """Reverse complement (IUPAC-aware); untranslatable chars pass through."""
    return s.translate(_COMP)[::-1]


def _gc_count(s):
    return sum(1 for c in s if c in "GC")


def _gc_percent(s):
    return round(100.0 * _gc_count(s) / len(s), 4) if s else 0.0


def _tm(s):
    """Melting temperature. Wallace rule (4*GC + 2*AT) for <14 nt, else the
    basic GC/length formula Tm = 64.9 + 41*(GC - 16.4)/length."""
    n = len(s)
    if n == 0:
        return 0.0
    gc = _gc_count(s)
    if n < 14:
        return float(4 * gc + 2 * (n - gc))
    return 64.9 + 41.0 * (gc - 16.4) / n


def _all_occurrences(hay, needle):
    """Non-overlapping left-to-right start indices of `needle` in `hay`."""
    out = []
    if not needle:
        return out
    i = hay.find(needle)
    while i != -1:
        out.append(i)
        i = hay.find(needle, i + len(needle))
    return out


# --------------------------------------------------------------------------- #
# Task 1 — in-silico PCR
# --------------------------------------------------------------------------- #
def in_silico_pcr(p):
    template = _dna(p, "template")
    fwd = _dna(p, "forwardPrimer")
    rev = _dna(p, "reversePrimer")

    i = template.find(fwd)
    if i < 0:
        _fail("Forward primer not found on the template (top strand).")
    rc = _revcomp(template)
    j = rc.find(rev)
    if j < 0:
        _fail("Reverse primer not found on the reverse-complement strand.")

    forward_start = i + 1                 # 1-based, top strand
    reverse_start = j + 1                 # 1-based, reverse-complement strand
    end = len(template) - j              # exclusive top-strand end of amplicon

    if end <= i:
        product_found = False
        amplicon = ""
        amplicon_len = 0
    else:
        product_found = True
        amplicon = template[i:end]
        amplicon_len = len(amplicon)

    log = [
        "# In-silico PCR",
        "",
        f"- Template length: **{len(template)}** bp",
        f"- Forward primer (`{fwd}`) found at position **{forward_start}** (top strand)",
        f"- Reverse primer (`{rev}`) found at position **{reverse_start}** "
        "(reverse-complement strand)",
        f"- Product formed: **{product_found}**",
        f"- Amplicon length: **{amplicon_len}** bp",
    ]
    if product_found:
        log += ["", f"Amplicon (5'->3'): `{amplicon}`"]

    return {
        "status": "success",
        "analysis": "In-silico PCR: primer-pair localization and amplicon extraction",
        "productFound": product_found,
        "amplicon": amplicon,
        "ampliconLength": amplicon_len,
        "forwardStart": forward_start,
        "reverseStart": reverse_start,
        "templateLength": len(template),
        "researchLog": "\n".join(log),
    }


# --------------------------------------------------------------------------- #
# Task 2 — restriction digest
# --------------------------------------------------------------------------- #
# name -> (recognition site, cut offset within the site on the top strand)
_ENZYMES = {
    "ECORI": ("GAATTC", 1),    # G^AATTC
    "BAMHI": ("GGATCC", 1),    # G^GATCC
    "HINDIII": ("AAGCTT", 1),  # A^AGCTT
}


def _resolve_enzyme(p):
    """Return (site, cut_offset, label) or _fail with an honest error."""
    enz = p.get("enzyme")
    rs = p.get("recognitionSite")
    if isinstance(enz, str) and enz.strip():
        key = "".join(enz.split()).upper()
        if key in _ENZYMES:
            site, offset = _ENZYMES[key]
            return site, offset, enz.strip()
    if isinstance(rs, str) and rs.strip():
        site = "".join(rs.split()).upper()
        offset = int(p.get("cutOffset", 0))
        if not (0 <= offset <= len(site)):
            _fail(f"`cutOffset` must be within [0, {len(site)}] for site {site}.")
        return site, offset, f"custom:{site}"
    if isinstance(enz, str) and enz.strip():
        _fail(
            f"Unknown enzyme {enz!r}. Known enzymes: "
            f"{', '.join(sorted(_ENZYMES))}. Provide `recognitionSite` for a custom site."
        )
    _fail("Provide `enzyme` (EcoRI/BamHI/HindIII) or a `recognitionSite`.")


def restriction_digest_fragments(p):
    seq = _dna(p, "sequence")
    site, offset, label = _resolve_enzyme(p)
    if not site:
        _fail("Empty recognition site.")
    circular = bool(p.get("circular", False))
    n = len(seq)

    occ = _all_occurrences(seq, site)                 # 0-based site starts
    cut_positions = sorted({o + offset for o in occ})  # 0-based top-strand cuts

    fragments = []
    if circular:
        # Keep cuts strictly within (0, n]; a cut at exactly n == 0 on a circle.
        cuts = sorted({c % n for c in cut_positions}) if n else []
        if not cuts:
            fragments.append(_frag(seq, 0, n))         # uncut circle -> 1 fragment
        else:
            k = len(cuts)
            for idx in range(k):
                a = cuts[idx]
                b = cuts[(idx + 1) % k]
                if idx == k - 1:                       # wrap-around fragment
                    subseq = seq[a:] + seq[:b]
                    fragments.append({
                        "start": a + 1,
                        "end": b,
                        "length": len(subseq),
                        "sequence": subseq,
                    })
                else:
                    fragments.append(_frag(seq, a, b))
    else:
        # Linear: only interior cuts (0 < c < n) create new boundaries.
        interior = sorted({c for c in cut_positions if 0 < c < n})
        boundaries = [0] + interior + [n]
        for a, b in zip(boundaries[:-1], boundaries[1:]):
            fragments.append(_frag(seq, a, b))

    fragment_lengths = [f["length"] for f in fragments]

    log = [
        "# Restriction digest",
        "",
        f"- Sequence length: **{n}** bp ({'circular' if circular else 'linear'})",
        f"- Enzyme / site: **{label}** (recognition `{site}`, cut offset {offset})",
        f"- Site occurrences: **{len(occ)}**",
        f"- Fragments produced: **{len(fragments)}**",
        f"- Fragment lengths: {fragment_lengths}",
    ]

    return {
        "status": "success",
        "analysis": "Restriction digest into fragments at every recognition-site occurrence",
        "enzyme": label,
        "recognitionSite": site,
        "cutOffset": offset,
        "circular": circular,
        "siteCount": len(occ),
        "fragments": fragments,
        "fragmentLengths": fragment_lengths,
        "sequenceLength": n,
        "researchLog": "\n".join(log),
    }


def _frag(seq, a, b):
    return {"start": a + 1, "end": b, "length": b - a, "sequence": seq[a:b]}


# --------------------------------------------------------------------------- #
# Task 3 — mutation calling between two pre-aligned sequences
# --------------------------------------------------------------------------- #
def find_sequence_mutations(p):
    ref = p.get("reference")
    query = p.get("query")
    if not isinstance(ref, str) or not ref.strip():
        _fail("Provide a `reference` sequence.")
    if not isinstance(query, str) or not query.strip():
        _fail("Provide a `query` sequence.")
    ref = "".join(ref.split()).upper()
    query = "".join(query.split()).upper()
    if len(ref) != len(query):
        _fail(
            "`reference` and `query` must be equal length (assumed pre-aligned): "
            f"got {len(ref)} vs {len(query)}."
        )

    n = len(ref)
    mutations = []
    for idx in range(n):
        if ref[idx] != query[idx]:
            mutations.append({
                "position": idx + 1,
                "ref": ref[idx],
                "alt": query[idx],
                "type": "substitution",
            })
    count = len(mutations)
    matches = n - count
    percent_identity = round(100.0 * matches / n, 4) if n else 0.0

    log = [
        "# Sequence mutation scan (pre-aligned)",
        "",
        f"- Aligned length: **{n}**",
        f"- Mutations (substitutions): **{count}**",
        f"- Percent identity: **{percent_identity}%**",
    ]
    if mutations:
        log += ["", "| position | ref | alt | type |", "| --- | --- | --- | --- |"]
        log += [f"| {m['position']} | {m['ref']} | {m['alt']} | {m['type']} |"
                for m in mutations]

    return {
        "status": "success",
        "analysis": "Position-wise mutation calling between two pre-aligned sequences",
        "mutations": mutations,
        "mutationCount": count,
        "percentIdentity": percent_identity,
        "alignedLength": n,
        "researchLog": "\n".join(log),
    }


# --------------------------------------------------------------------------- #
# Task 4 — primer design
# --------------------------------------------------------------------------- #
def design_primer(p):
    seq = _dna(p, "sequence")
    target_tm = float(p.get("targetTm", 60))
    min_len = int(p.get("minLen", 18))
    max_len = int(p.get("maxLen", 25))
    if min_len <= 0 or max_len < min_len:
        _fail("Require 0 < minLen <= maxLen.")
    if len(seq) < min_len:
        _fail(f"Sequence ({len(seq)} nt) shorter than minLen ({min_len}).")

    hi = min(max_len, len(seq))

    def best_end(from_5prime):
        best = None  # (distance, length, primer, tm)
        for length in range(min_len, hi + 1):
            if from_5prime:
                cand = seq[:length]
            else:
                cand = _revcomp(seq[-length:])
            tm = _tm(cand)
            dist = abs(tm - target_tm)
            if best is None or dist < best[0]:
                best = (dist, length, cand, tm)
        return best

    _, f_len, f_primer, f_tm = best_end(True)
    _, r_len, r_primer, r_tm = best_end(False)

    forward_tm = round(f_tm, 4)
    reverse_tm = round(r_tm, 4)
    forward_gc = _gc_percent(f_primer)
    reverse_gc = _gc_percent(r_primer)

    log = [
        "# Primer design (Tm-closest length selection)",
        "",
        f"- Target Tm: **{target_tm} C**, length window **[{min_len}, {max_len}]**",
        f"- Forward primer (5'): `{f_primer}` (len {f_len}, "
        f"Tm {forward_tm} C, GC {forward_gc}%)",
        f"- Reverse primer (3'): `{r_primer}` (len {r_len}, "
        f"Tm {reverse_tm} C, GC {reverse_gc}%)",
        "",
        "Tm: Wallace rule (<14 nt) else 64.9 + 41*(GC - 16.4)/length.",
    ]

    return {
        "status": "success",
        "analysis": "Primer design by Tm-closest length selection from the 5' and 3' ends",
        "forwardPrimer": f_primer,
        "reversePrimer": r_primer,
        "forwardTm": forward_tm,
        "reverseTm": reverse_tm,
        "forwardGC": forward_gc,
        "reverseGC": reverse_gc,
        "forwardLength": f_len,
        "reverseLength": r_len,
        "targetTm": target_tm,
        "researchLog": "\n".join(log),
    }


# --------------------------------------------------------------------------- #
# Task 5 — primer binding scan (both strands, mismatch-tolerant)
# --------------------------------------------------------------------------- #
def _scan_strand(hay, primer, max_mm, strand):
    sites = []
    m = len(primer)
    if m == 0 or m > len(hay):
        return sites
    for start in range(len(hay) - m + 1):
        mm = 0
        window = hay[start:start + m]
        for a, b in zip(window, primer):
            if a != b:
                mm += 1
                if mm > max_mm:
                    break
        if mm <= max_mm:
            sites.append({"strand": strand, "start": start + 1, "mismatches": mm})
    return sites


def primer_binding_scan(p):
    template = _dna(p, "template")
    primer = _dna(p, "primer")
    max_mm = int(p.get("maxMismatches", 0))
    if max_mm < 0:
        _fail("`maxMismatches` must be >= 0.")

    plus = _scan_strand(template, primer, max_mm, "+")
    minus = _scan_strand(_revcomp(template), primer, max_mm, "-")
    binding_sites = plus + minus

    log = [
        "# Primer binding scan (both strands)",
        "",
        f"- Template length: **{len(template)}** bp",
        f"- Primer (`{primer}`, {len(primer)} nt), max mismatches: **{max_mm}**",
        f"- Binding sites (+ strand): **{len(plus)}**",
        f"- Binding sites (- strand): **{len(minus)}**",
        f"- Total sites: **{len(binding_sites)}**",
    ]
    if binding_sites:
        log += ["", "| strand | start | mismatches |", "| --- | --- | --- |"]
        log += [f"| {s['strand']} | {s['start']} | {s['mismatches']} |"
                for s in binding_sites]

    return {
        "status": "success",
        "analysis": "Mismatch-tolerant primer binding scan across both template strands",
        "bindingSites": binding_sites,
        "siteCount": len(binding_sites),
        "plusStrandSites": len(plus),
        "minusStrandSites": len(minus),
        "maxMismatches": max_mm,
        "templateLength": len(template),
        "researchLog": "\n".join(log),
    }


# --------------------------------------------------------------------------- #
# Dispatch
# --------------------------------------------------------------------------- #
TASKS = {
    "in_silico_pcr": in_silico_pcr,
    "restriction_digest_fragments": restriction_digest_fragments,
    "find_sequence_mutations": find_sequence_mutations,
    "design_primer": design_primer,
    "primer_binding_scan": primer_binding_scan,
}

# Tasks that require biopython (none currently — all five are pure stdlib).
_NEEDS_BIOPYTHON = set()


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        _fail(f"Invalid JSON payload: {e}")
    task = payload.get("task")
    if task not in TASKS:
        _fail(f"Unknown task {task!r}. Available: {', '.join(TASKS)}.")
    if task in _NEEDS_BIOPYTHON:
        try:
            import Bio  # noqa: F401
        except Exception as e:  # pragma: no cover - depends on env
            _fail(f"Task {task!r} requires biopython: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
