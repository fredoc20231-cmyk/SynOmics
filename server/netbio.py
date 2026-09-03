#!/usr/bin/env python3
"""Network biology (networkx) — one dispatch, several real graph analyses.

Tasks (payload.task):
  centrality       : degree/betweenness/closeness/eigenvector/pagerank per node.
  community        : greedy-modularity community detection (+ modularity score).
  shortest_path    : shortest path (optionally weighted) between two nodes.
  graph_stats      : nodes/edges/density/clustering/components/diameter.
  rwr              : random walk with restart (personalized PageRank) from seeds.

Input graph: `edges` = [[u, v] or [u, v, weight], ...], optional `directed`.
Every value is computed by networkx. Reads JSON on stdin; honest 'unavailable' if
networkx is missing.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _build(p):
    import networkx as nx
    edges = p.get("edges")
    if not isinstance(edges, list) or not edges:
        _fail("Provide `edges`: a list of [u, v] or [u, v, weight].")
    G = nx.DiGraph() if p.get("directed") else nx.Graph()
    for e in edges:
        if len(e) >= 3:
            G.add_edge(str(e[0]), str(e[1]), weight=float(e[2]))
        else:
            G.add_edge(str(e[0]), str(e[1]), weight=1.0)
    return G


def task_centrality(p):
    import networkx as nx
    G = _build(p)
    out = {"degree": nx.degree_centrality(G),
           "betweenness": nx.betweenness_centrality(G, weight="weight"),
           "closeness": nx.closeness_centrality(G),
           "pagerank": nx.pagerank(G, weight="weight")}
    try:
        out["eigenvector"] = nx.eigenvector_centrality_numpy(G, weight="weight")
    except Exception:
        out["eigenvector"] = {n: None for n in G.nodes()}
    rounded = {k: {n: round(float(v), 6) for n, v in d.items()} for k, d in out.items()}
    top_hub = max(rounded["pagerank"], key=rounded["pagerank"].get)
    return {"status": "success", "analysis": "node centrality", "nNodes": G.number_of_nodes(),
            "nEdges": G.number_of_edges(), "centrality": rounded, "topHubByPageRank": top_hub}


def task_community(p):
    from networkx.algorithms.community import greedy_modularity_communities, modularity
    G = _build(p)
    UG = G.to_undirected() if G.is_directed() else G
    comms = list(greedy_modularity_communities(UG, weight="weight"))
    q = float(modularity(UG, comms, weight="weight")) if comms else 0.0
    communities = [sorted(c) for c in comms]
    return {"status": "success", "analysis": "greedy-modularity community detection",
            "nCommunities": len(communities), "modularity": round(q, 6), "communities": communities}


def task_shortest_path(p):
    import networkx as nx
    G = _build(p)
    src, dst = p.get("source"), p.get("target")
    if src is None or dst is None:
        _fail("shortest_path needs `source` and `target`.")
    src, dst = str(src), str(dst)
    if src not in G or dst not in G:
        _fail("source/target not in graph.")
    try:
        weighted = bool(p.get("weighted", True))
        path = nx.shortest_path(G, src, dst, weight="weight" if weighted else None)
        length = nx.shortest_path_length(G, src, dst, weight="weight" if weighted else None)
    except nx.NetworkXNoPath:
        return {"status": "success", "analysis": "shortest path", "pathExists": False,
                "source": src, "target": dst}
    return {"status": "success", "analysis": "shortest path", "pathExists": True,
            "source": src, "target": dst, "path": path, "length": float(length), "hops": len(path) - 1}


def task_graph_stats(p):
    import networkx as nx
    G = _build(p)
    UG = G.to_undirected() if G.is_directed() else G
    comps = list(nx.connected_components(UG))
    largest = max(comps, key=len) if comps else set()
    diameter = None
    if len(largest) > 1:
        try:
            diameter = int(nx.diameter(UG.subgraph(largest)))
        except Exception:
            diameter = None
    return {"status": "success", "analysis": "graph statistics",
            "nNodes": G.number_of_nodes(), "nEdges": G.number_of_edges(),
            "directed": G.is_directed(), "density": round(float(nx.density(G)), 6),
            "avgClustering": round(float(nx.average_clustering(UG)), 6),
            "nConnectedComponents": len(comps), "largestComponentSize": len(largest),
            "diameterOfLargestComponent": diameter}


def task_rwr(p):
    import networkx as nx
    G = _build(p)
    seeds = p.get("seeds")
    if not isinstance(seeds, list) or not seeds:
        _fail("rwr needs `seeds`: a list of node ids.")
    seeds = [str(s) for s in seeds if str(s) in G]
    if not seeds:
        _fail("None of the seeds are in the graph.")
    restart = float(p.get("restart", 0.15))
    personalization = {n: (1.0 if n in seeds else 0.0) for n in G.nodes()}
    pr = nx.pagerank(G, alpha=1 - restart, personalization=personalization, weight="weight")
    ranked = sorted(((n, round(float(v), 6)) for n, v in pr.items()), key=lambda kv: -kv[1])
    return {"status": "success", "analysis": "random walk with restart (personalized PageRank)",
            "seeds": seeds, "restartProbability": restart,
            "ranking": [{"node": n, "score": v} for n, v in ranked]}


TASKS = {"centrality": task_centrality, "community": task_community, "shortest_path": task_shortest_path,
         "graph_stats": task_graph_stats, "rwr": task_rwr}


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
        import networkx  # noqa: F401
    except Exception as e:
        _fail(f"netbio requires networkx: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
