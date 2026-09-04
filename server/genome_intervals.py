#!/usr/bin/env python3
"""Genomic interval arithmetic (BEDTools-style, stdlib) — one dispatch.

All coordinates are half-open, 0-based: an interval [start, end) covers the
positions start, start+1, ..., end-1 and has length (end - start).
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _parse_intervals(value, name):
    """Validate a list of [start, end] integer pairs; return list of [int,int]."""
    if not isinstance(value, list):
        raise ValueError(f"{name!r} must be a list of [start, end] pairs.")
    out = []
    for i, item in enumerate(value):
        if not isinstance(item, (list, tuple)) or len(item) != 2:
            raise ValueError(f"{name}[{i}] must be a [start, end] pair.")
        s, e = item
        if isinstance(s, bool) or isinstance(e, bool) or not isinstance(s, int) or not isinstance(e, int):
            raise ValueError(f"{name}[{i}] start/end must be integers.")
        if e < s:
            raise ValueError(f"{name}[{i}] has end < start ({e} < {s}).")
        out.append([s, e])
    return out


def _merge(intervals, min_gap=0):
    """Merge overlapping / within-min_gap intervals. Returns sorted, disjoint list."""
    if not intervals:
        return []
    ordered = sorted(intervals, key=lambda iv: (iv[0], iv[1]))
    merged = [list(ordered[0])]
    for s, e in ordered[1:]:
        last = merged[-1]
        # merge when this interval starts at/before last.end + min_gap
        if s <= last[1] + min_gap:
            if e > last[1]:
                last[1] = e
        else:
            merged.append([s, e])
    return merged


def _union_length(intervals):
    """Total length of the union of a set of intervals."""
    total = 0
    for s, e in _merge(intervals, 0):
        total += e - s
    return total


# ----------------------------------------------------------------------------
# task functions (pure python)
# ----------------------------------------------------------------------------

def task_interval_merge(p):
    intervals = _parse_intervals(p.get("intervals", []), "intervals")
    min_gap = p.get("minGap", 0)
    if isinstance(min_gap, bool) or not isinstance(min_gap, int):
        raise ValueError("'minGap' must be an integer.")
    if min_gap < 0:
        raise ValueError("'minGap' must be >= 0.")
    merged = _merge(intervals, min_gap)
    return {
        "status": "success",
        "analysis": "interval_merge",
        "merged": merged,
        "mergedCount": len(merged),
        "inputCount": len(intervals),
        "minGap": min_gap,
    }


def task_interval_intersect(p):
    a = _parse_intervals(p.get("a", []), "a")
    b = _parse_intervals(p.get("b", []), "b")
    intersections = []
    total = 0
    for as_, ae in a:
        for bs, be in b:
            s = max(as_, bs)
            e = min(ae, be)
            if s < e:  # strict: half-open overlap of positive length
                intersections.append([s, e])
                total += e - s
    return {
        "status": "success",
        "analysis": "interval_intersect",
        "intersections": intersections,
        "totalOverlapBp": total,
    }


def task_interval_subtract(p):
    a = _parse_intervals(p.get("a", []), "a")
    b = _parse_intervals(p.get("b", []), "b")
    b_merged = _merge(b, 0)
    remaining = []
    for as_, ae in a:
        cur_start = as_
        for bs, be in b_merged:
            if be <= cur_start:
                continue  # b entirely left of remaining piece
            if bs >= ae:
                break  # b (and all later, sorted) entirely right of A
            # b overlaps [cur_start, ae)
            if bs > cur_start:
                remaining.append([cur_start, min(bs, ae)])
            cur_start = max(cur_start, be)
            if cur_start >= ae:
                break
        if cur_start < ae:
            remaining.append([cur_start, ae])
    return {
        "status": "success",
        "analysis": "interval_subtract",
        "remaining": remaining,
    }


def task_interval_coverage(p):
    intervals = _parse_intervals(p.get("intervals", []), "intervals")
    if "regionStart" in p or "regionEnd" in p:
        region_start = p.get("regionStart", 0)
        region_end = p.get("regionEnd")
        if region_end is None:
            raise ValueError("Provide 'regionEnd' when using 'regionStart'.")
        for nm, val in (("regionStart", region_start), ("regionEnd", region_end)):
            if isinstance(val, bool) or not isinstance(val, int):
                raise ValueError(f"'{nm}' must be an integer.")
    elif "regionLength" in p:
        region_start = 0
        region_end = p.get("regionLength")
        if isinstance(region_end, bool) or not isinstance(region_end, int):
            raise ValueError("'regionLength' must be an integer.")
    else:
        raise ValueError("Provide 'regionLength' or 'regionStart'/'regionEnd'.")
    if region_end < region_start:
        raise ValueError("region end < region start.")
    region_bp = region_end - region_start
    # clip intervals to region, then take union length
    clipped = []
    for s, e in intervals:
        cs = max(s, region_start)
        ce = min(e, region_end)
        if cs < ce:
            clipped.append([cs, ce])
    covered = _union_length(clipped)
    fraction = (covered / region_bp) if region_bp > 0 else 0.0
    return {
        "status": "success",
        "analysis": "interval_coverage",
        "coveredBp": covered,
        "regionBp": region_bp,
        "coverageFraction": fraction,
        "regionStart": region_start,
        "regionEnd": region_end,
    }


def task_interval_nearest(p):
    query = _parse_intervals(p.get("query", []), "query")
    features = _parse_intervals(p.get("features", []), "features")
    results = []
    for qs, qe in query:
        best = None
        best_dist = None
        best_signed = None
        for fs, fe in features:
            if qs < fe and fs < qe:
                dist = 0
                signed = 0
            elif fs >= qe:
                dist = fs - qe          # feature is downstream (right)
                signed = dist
            else:  # fe <= qs, feature is upstream (left)
                dist = qs - fe
                signed = -dist
            # <= so that on distance ties the later feature in input order wins
            if best_dist is None or dist <= best_dist:
                best_dist = dist
                best = [fs, fe]
                best_signed = signed
        results.append({
            "query": [qs, qe],
            "nearest": best,
            "distance": best_dist,
            "signedDistance": best_signed,
        })
    return {
        "status": "success",
        "analysis": "interval_nearest",
        "results": results,
    }


TASKS = {
    "interval_merge": task_interval_merge,
    "interval_intersect": task_interval_intersect,
    "interval_subtract": task_interval_subtract,
    "interval_coverage": task_interval_coverage,
    "interval_nearest": task_interval_nearest,
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
    try:
        result = TASKS[task](payload)
    except ValueError as e:
        _fail(str(e))
    except Exception as e:  # pragma: no cover - defensive
        _fail(f"{type(e).__name__}: {e}")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
