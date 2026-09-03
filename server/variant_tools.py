#!/usr/bin/env python3
"""Variant & population-genetics analyses — one dispatch, several real methods.

Tasks (payload.task):
  hardy_weinberg   : HWE exact/chi-square test from genotype counts (AA, Aa, aa).
  allele_frequency : allele + genotype frequencies from genotype counts.
  ts_tv            : transition/transversion ratio from a list of ref/alt SNVs.
  vcf_summary      : summarize parsed VCF variants (types, Ts/Tv, per-chrom counts).

Pure Python + scipy (chi-square only). Reads JSON on stdin, prints JSON.
"""
import json
import sys

_PURINES = {"A", "G"}
_PYRIMIDINES = {"C", "T"}


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _is_transition(ref, alt):
    ref, alt = ref.upper(), alt.upper()
    return (ref in _PURINES and alt in _PURINES) or (ref in _PYRIMIDINES and alt in _PYRIMIDINES)


def task_allele_frequency(p):
    aa = int(p.get("AA", 0)); ab = int(p.get("Aa", p.get("AB", 0))); bb = int(p.get("aa", p.get("BB", 0)))
    n = aa + ab + bb
    if n == 0:
        _fail("Provide genotype counts AA, Aa, aa (at least one > 0).")
    p_allele = (2 * aa + ab) / (2 * n)
    q_allele = 1 - p_allele
    return {"status": "success", "analysis": "allele & genotype frequencies", "nIndividuals": n,
            "alleleFrequency": {"A": round(p_allele, 6), "a": round(q_allele, 6)},
            "genotypeFrequency": {"AA": round(aa / n, 6), "Aa": round(ab / n, 6), "aa": round(bb / n, 6)}}


def task_hardy_weinberg(p):
    from scipy.stats import chi2
    aa = int(p.get("AA", 0))
    ab = int(p.get("Aa", p.get("AB", 0)))
    bb = int(p.get("aa", p.get("BB", 0)))
    n = aa + ab + bb
    if n == 0:
        _fail("Provide genotype counts AA, Aa, aa.")
    p_allele = (2 * aa + ab) / (2 * n)
    q_allele = 1 - p_allele
    exp = {"AA": n * p_allele ** 2, "Aa": n * 2 * p_allele * q_allele, "aa": n * q_allele ** 2}
    obs = {"AA": aa, "Aa": ab, "aa": bb}
    chi = sum((obs[g] - exp[g]) ** 2 / exp[g] for g in obs if exp[g] > 0)
    pval = float(chi2.sf(chi, 1))  # 1 dof (3 genotypes - 1 - 1 allele param)
    return {"status": "success", "analysis": "Hardy-Weinberg equilibrium test",
            "observed": obs, "expected": {g: round(v, 3) for g, v in exp.items()},
            "chi2": round(float(chi), 4), "pValue": pval, "dof": 1,
            "inEquilibrium": bool(pval > 0.05),
            "alleleFrequency": {"A": round(p_allele, 6), "a": round(q_allele, 6)}}


def task_ts_tv(p):
    variants = p.get("variants")
    if not isinstance(variants, list) or not variants:
        _fail("ts_tv needs `variants`: [{ref, alt}, ...].")
    ts = tv = skipped = 0
    for v in variants:
        ref, alt = str(v.get("ref", "")).upper(), str(v.get("alt", "")).upper()
        if len(ref) != 1 or len(alt) != 1 or ref == alt or ref not in "ACGT" or alt not in "ACGT":
            skipped += 1
            continue
        if _is_transition(ref, alt):
            ts += 1
        else:
            tv += 1
    ratio = (ts / tv) if tv > 0 else None
    return {"status": "success", "analysis": "transition/transversion ratio",
            "transitions": ts, "transversions": tv, "tsTvRatio": round(ratio, 4) if ratio is not None else None,
            "nonSNV_skipped": skipped}


def task_vcf_summary(p):
    variants = p.get("variants")
    if not isinstance(variants, list) or not variants:
        _fail("vcf_summary needs `variants`: [{chrom, ref, alt}, ...].")
    per_chrom = {}
    snv = indel = ts = tv = 0
    for v in variants:
        chrom = str(v.get("chrom", v.get("chr", "?")))
        per_chrom[chrom] = per_chrom.get(chrom, 0) + 1
        ref, alt = str(v.get("ref", "")).upper(), str(v.get("alt", "")).upper()
        if len(ref) == 1 and len(alt) == 1 and ref in "ACGT" and alt in "ACGT" and ref != alt:
            snv += 1
            if _is_transition(ref, alt):
                ts += 1
            else:
                tv += 1
        elif len(ref) != len(alt):
            indel += 1
    return {"status": "success", "analysis": "VCF summary", "nVariants": len(variants),
            "snv": snv, "indel": indel, "transitions": ts, "transversions": tv,
            "tsTvRatio": round(ts / tv, 4) if tv > 0 else None,
            "variantsPerChromosome": dict(sorted(per_chrom.items()))}


TASKS = {"hardy_weinberg": task_hardy_weinberg, "allele_frequency": task_allele_frequency,
         "ts_tv": task_ts_tv, "vcf_summary": task_vcf_summary}


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
