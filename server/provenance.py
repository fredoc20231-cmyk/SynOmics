#!/usr/bin/env python3
"""Cryptographic provenance manifest — APEX Part 5.

Builds a `provenance.manifest.json` containing SHA-256 hashes of every input,
script, and output of an analysis, plus a single manifest hash over the whole
record. Reports embed this manifest hash in their footer, so a result can be
tied back to the exact bytes that produced it. Pure stdlib — no dependencies.

Reads JSON on stdin, prints JSON. Optionally writes the manifest to `outPath`.

Payload: { "sessionId": str?, "inputs": {name: value}, "scripts": [path],
           "outputs": {name: value}, "outPath": str? }
"""
import datetime
import hashlib
import json
import os
import sys


def _sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def _sha256_json(value) -> tuple:
    try:
        s = json.dumps(value, sort_keys=True, default=str)
    except Exception:
        s = str(value)
    data = s.encode("utf-8")
    return _sha256_bytes(data), len(data)


def _entries(mapping):
    out = []
    for name, value in (mapping or {}).items():
        h, n = _sha256_json(value)
        out.append({"name": name, "sha256": h, "bytes": n})
    return sorted(out, key=lambda e: e["name"])


def _script_entries(paths):
    out = []
    for p in paths or []:
        if os.path.isfile(p):
            with open(p, "rb") as fh:
                b = fh.read()
            out.append({"path": p, "sha256": _sha256_bytes(b), "bytes": len(b)})
        else:
            out.append({"path": p, "sha256": None, "error": "file not found"})
    return sorted(out, key=lambda e: e["path"])


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        print(json.dumps({"status": "error", "error": f"Invalid JSON: {e}"}))
        sys.exit(0)

    manifest = {
        "manifestVersion": 1,
        "generated": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "sessionId": payload.get("sessionId"),
        "tool": "SynOmics Advanced Bioinformatics Platform",
        "inputs": _entries(payload.get("inputs")),
        "scripts": _script_entries(payload.get("scripts")),
        "outputs": _entries(payload.get("outputs")),
    }
    # The manifest hash is SHA-256 over the canonical manifest (excluding itself).
    canonical = json.dumps(manifest, sort_keys=True).encode("utf-8")
    manifest_hash = _sha256_bytes(canonical)
    manifest["manifestHash"] = manifest_hash

    out_path = payload.get("outPath")
    written = None
    if out_path:
        try:
            with open(out_path, "w") as fh:
                json.dump(manifest, fh, indent=2)
            written = out_path
        except Exception as e:
            manifest["writeError"] = str(e)

    print(json.dumps({"status": "success", "manifestHash": manifest_hash, "manifest": manifest, "written": written}))


if __name__ == "__main__":
    main()
