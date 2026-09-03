#!/usr/bin/env python3
"""Tests for network-biology tools (networkx). Run: python tests/netbio_smoke.py"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "netbio.py")

try:
    import networkx  # noqa: F401
except Exception as e:
    print(f"SKIP: networkx not available ({e}).")
    sys.exit(0)

passed = 0
def check(name, cond, ctx=None):
    global passed
    if not cond:
        print(f"FAIL: {name}\n  {ctx}")
        sys.exit(1)
    passed += 1
    print(f"ok: {name}")

def run(p):
    r = subprocess.run([sys.executable, SCRIPT], input=json.dumps(p).encode(),
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return json.loads(r.stdout.decode())

star = [["A", "B"], ["A", "C"], ["A", "D"], ["A", "E"]]
check("centrality identifies hub A", run({"task": "centrality", "edges": star})["topHubByPageRank"] == "A")

two_tri = [["A", "B"], ["B", "C"], ["A", "C"], ["D", "E"], ["E", "F"], ["D", "F"], ["C", "D"]]
cm = run({"task": "community", "edges": two_tri})
check("community finds 2 modules with positive Q", cm["nCommunities"] == 2 and cm["modularity"] > 0, cm)

sp = run({"task": "shortest_path", "edges": [["A", "B", 1], ["B", "C", 1], ["A", "C", 5]], "source": "A", "target": "C", "weighted": True})
check("weighted shortest path routes A-B-C", sp["path"] == ["A", "B", "C"] and sp["length"] == 2.0, sp)

gs = run({"task": "graph_stats", "edges": two_tri})
check("graph stats correct", gs["nNodes"] == 6 and gs["nEdges"] == 7 and gs["nConnectedComponents"] == 1, gs)

rw = run({"task": "rwr", "edges": two_tri, "seeds": ["A"]})
check("rwr ranks seed A first", rw["ranking"][0]["node"] == "A", rw["ranking"][:3])

check("unknown task -> honest error", run({"task": "nope", "edges": star}).get("status") == "error")
check("missing edges -> honest error", run({"task": "centrality"}).get("status") == "error")

print(f"\nALL {passed} NETBIO TESTS PASSED")
