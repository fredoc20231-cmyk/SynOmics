#!/usr/bin/env python3
"""Module A — H5AD (AnnData) profiling pass.

Reads a single-cell `.h5ad` file (HDF5 on disk) with h5py and reports its REAL
structure: number of cells (obs) and genes (var), the X matrix encoding
(dense / CSR / CSC) and dtype, cell/gene index samples, obs/var column names, and
candidate grouping variables (categorical obs columns with 2–20 levels).

Per Module A's HALT-on-ambiguity rule: if no unambiguous grouping/condition column
is found, the response sets `needsClarification: true` with a precise question
rather than guessing an experimental design.

Nothing is fabricated — every value is read from the file. Requires h5py; returns
an honest 'unavailable' status if it is missing.

Reads JSON on stdin: { "path": "/abs/path/to/file.h5ad", "maxPreview": 8 }
Prints JSON on stdout.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _decode(v):
    if isinstance(v, bytes):
        return v.decode("utf-8", "replace")
    return v


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        _fail(f"Invalid JSON payload: {e}")

    path = payload.get("path")
    if not path:
        _fail("Provide a `path` to a .h5ad file.")

    try:
        import h5py
        import numpy as np
    except Exception as e:
        _fail(f"H5AD profiling requires h5py + numpy: {e}", status="unavailable")

    max_preview = int(payload.get("maxPreview", 8))

    try:
        f = h5py.File(path, "r")
    except Exception as e:
        _fail(f"Could not open H5AD file: {e}")

    try:
        # ---- X matrix shape + encoding ----
        n_obs = n_var = None
        x_encoding = "unknown"
        x_dtype = None
        if "X" in f:
            X = f["X"]
            if isinstance(X, h5py.Dataset):
                x_encoding = "dense"
                x_dtype = str(X.dtype)
                if X.ndim == 2:
                    n_obs, n_var = int(X.shape[0]), int(X.shape[1])
            elif isinstance(X, h5py.Group):
                enc = _decode(X.attrs.get("encoding-type", b""))
                x_encoding = enc or "sparse"
                shape = X.attrs.get("shape")
                if shape is not None and len(shape) == 2:
                    n_obs, n_var = int(shape[0]), int(shape[1])
                if "data" in X:
                    x_dtype = str(X["data"].dtype)

        def read_index(group_name):
            if group_name not in f:
                return []
            g = f[group_name]
            idx_name = _decode(g.attrs.get("_index", b"_index")) or "_index"
            if idx_name in g and isinstance(g[idx_name], h5py.Dataset):
                vals = g[idx_name][:max_preview]
                return [_decode(v) for v in vals.tolist()]
            return []

        def obs_columns(group_name):
            if group_name not in f:
                return []
            g = f[group_name]
            idx_name = _decode(g.attrs.get("_index", b"_index")) or "_index"
            cols = []
            for key in g.keys():
                if key == idx_name:
                    continue
                cols.append(key)
            return cols

        def grouping_candidates():
            """Categorical / low-cardinality obs columns usable as condition/group."""
            if "obs" not in f:
                return []
            g = f["obs"]
            idx_name = _decode(g.attrs.get("_index", b"_index")) or "_index"
            out = []
            for key in g.keys():
                if key == idx_name:
                    continue
                item = g[key]
                levels = None
                if isinstance(item, h5py.Group):
                    enc = _decode(item.attrs.get("encoding-type", b""))
                    if enc == "categorical" and "categories" in item:
                        cats = [_decode(c) for c in item["categories"][:].tolist()]
                        levels = cats
                elif isinstance(item, h5py.Dataset):
                    try:
                        uniq = np.unique(item[:])
                        if 2 <= uniq.size <= 20:
                            levels = [_decode(u) for u in uniq.tolist()]
                    except Exception:
                        levels = None
                if levels is not None and 2 <= len(levels) <= 20:
                    out.append({"column": key, "levels": levels[:20], "nLevels": len(levels)})
            return out

        obs_cols = obs_columns("obs")
        var_cols = obs_columns("var")
        candidates = grouping_candidates()

        extras = {k: (list(f[k].keys()) if isinstance(f.get(k), h5py.Group) else None)
                  for k in ("layers", "obsm", "varm", "uns") if k in f}

        needs_clarification = len(candidates) == 0
        result = {
            "status": "success",
            "engine": "H5AD profiler (h5py)",
            "detectedFormat": "h5ad",
            "nCells": n_obs,
            "nGenes": n_var,
            "xEncoding": x_encoding,
            "xDtype": x_dtype,
            "cellIdPreview": read_index("obs"),
            "geneIdPreview": read_index("var"),
            "obsColumns": obs_cols,
            "varColumns": var_cols,
            "groupingCandidates": candidates,
            "layersAndEmbeddings": extras,
            "needsClarification": needs_clarification,
        }
        if needs_clarification:
            result["clarificationQuestion"] = (
                "No unambiguous grouping/condition column was found in obs. Which obs "
                f"column defines the comparison groups? Available obs columns: {obs_cols or '(none)'}."
            )
        print(json.dumps(result))
    finally:
        f.close()


if __name__ == "__main__":
    main()
