#!/usr/bin/env python3
"""Cell motility quantification & clustering (numpy + scikit-learn) — single dispatch.

Reads a JSON payload on stdin and prints a JSON result on stdout. Operates on
already-tracked cell trajectories (no video / segmentation required): each
trajectory is a list of [x, y] positions sampled over time.

Tasks:
  * cell_motility_metrics    — per-track motility descriptors + population means.
  * cluster_motility_patterns — unsupervised grouping of tracks by motility phenotype.

Zero-hallucination: every reported number is computed by real numpy / scikit-learn
code on the provided coordinates; nothing is fabricated. Design adapted from the
Apache-2.0 Biomni project (cell_biology.quantify_and_cluster_cell_motility),
reimplemented cleanly on tracked trajectories.
"""
import json
import os
import sys

# Allow sibling imports if ever needed (mirrors the other engine modules).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _parse_tracks(tracks):
    """Validate `tracks` and return a list of (N_i, 2) float numpy arrays.

    Each track must be a list of at least 2 positions, and each position must be
    a pair of finite numbers [x, y]. Any violation HALTS via _fail (never guesses).
    """
    import numpy as np

    if not isinstance(tracks, list) or len(tracks) == 0:
        _fail("Provide `tracks`: a non-empty list of trajectories (each a list of [x,y] positions).")

    parsed = []
    for ti, track in enumerate(tracks):
        if not isinstance(track, list) or len(track) < 2:
            _fail(f"Track {ti} must be a list of >=2 positions.")
        for pi, pos in enumerate(track):
            if not isinstance(pos, (list, tuple)) or len(pos) != 2:
                _fail(f"Track {ti} position {pi} must be a 2-element [x,y] pair.")
        try:
            arr = np.asarray(track, dtype=float)
        except Exception as e:  # noqa: BLE001
            _fail(f"Track {ti} coordinates must be numeric: {e}")
        if arr.shape[1] != 2:
            _fail(f"Track {ti} must have exactly 2 coordinates per position.")
        if not np.all(np.isfinite(arr)):
            _fail(f"Track {ti} coordinates must all be finite.")
        parsed.append(arr)
    return parsed


def _track_metrics(arr, dt, pixel_size):
    """Compute motility descriptors for one (N,2) trajectory array (in pixels).

    Coordinates are scaled by `pixel_size` (physical units per pixel); time is in
    `dt` per step. Returns a plain-dict of Python floats/ints.
    """
    import numpy as np

    pts = arr * float(pixel_size)
    n = int(pts.shape[0])

    diffs = np.diff(pts, axis=0)
    step_dists = np.sqrt(np.sum(diffs ** 2, axis=1))
    total_path = float(np.sum(step_dists))

    net_disp = float(np.sqrt(np.sum((pts[-1] - pts[0]) ** 2)))
    mean_speed = total_path / ((n - 1) * float(dt))
    directionality = net_disp / total_path if total_path > 0 else 0.0
    # Mean squared displacement at lag 1 = mean over consecutive pairs of |Δr|^2.
    msd_lag1 = float(np.mean(step_dists ** 2))

    return {
        "nPositions": n,
        "totalPathLength": round(total_path, 10),
        "netDisplacement": round(net_disp, 10),
        "meanSpeed": round(mean_speed, 10),
        "directionalityRatio": round(directionality, 10),
        "msdLag1": round(msd_lag1, 10),
    }


def task_cell_motility_metrics(p):
    import numpy as np

    tracks = p.get("tracks")
    parsed = _parse_tracks(tracks)

    dt = p.get("dt", 1)
    pixel_size = p.get("pixelSize", 1)
    try:
        dt = float(dt)
        pixel_size = float(pixel_size)
    except Exception as e:  # noqa: BLE001
        _fail(f"`dt` and `pixelSize` must be numeric: {e}")
    if not (dt > 0):
        _fail("`dt` must be a positive number.")
    if not (pixel_size > 0):
        _fail("`pixelSize` must be a positive number.")

    per_track = [_track_metrics(arr, dt, pixel_size) for arr in parsed]

    keys = ["totalPathLength", "netDisplacement", "meanSpeed", "directionalityRatio", "msdLag1"]
    population_means = {
        k: round(float(np.mean([m[k] for m in per_track])), 10) for k in keys
    }

    n_tracks = len(per_track)
    analysis = (
        f"Quantified motility for {n_tracks} track(s) (dt={dt:g}, pixelSize={pixel_size:g}). "
        f"Population mean speed={population_means['meanSpeed']:.6g}, mean directionality "
        f"ratio={population_means['directionalityRatio']:.6g}, mean net displacement="
        f"{population_means['netDisplacement']:.6g}."
    )

    research_log = (
        f"# Cell motility metrics\n\n"
        f"Computed per-track descriptors on **{n_tracks}** tracked trajectory/trajectories "
        f"(dt = {dt:g} per frame, pixelSize = {pixel_size:g} unit/pixel).\n\n"
        f"Per track:\n"
        f"- **totalPathLength** = sum of consecutive step distances.\n"
        f"- **netDisplacement** = straight-line distance from first to last position.\n"
        f"- **meanSpeed** = totalPathLength / ((N-1) * dt).\n"
        f"- **directionalityRatio** = netDisplacement / totalPathLength "
        f"(~1 = straight/persistent, ~0 = random/confined).\n"
        f"- **msdLag1** = mean squared displacement at lag 1 = mean(|Δr|^2) over steps.\n\n"
        f"| Metric | Population mean |\n| --- | --- |\n"
        f"| meanSpeed | {population_means['meanSpeed']:.6g} |\n"
        f"| directionalityRatio | {population_means['directionalityRatio']:.6g} |\n"
        f"| netDisplacement | {population_means['netDisplacement']:.6g} |\n"
        f"| totalPathLength | {population_means['totalPathLength']:.6g} |\n"
        f"| msdLag1 | {population_means['msdLag1']:.6g} |\n"
    )

    return {
        "status": "success",
        "analysis": analysis,
        "nTracks": n_tracks,
        "dt": dt,
        "pixelSize": pixel_size,
        "perTrack": per_track,
        "populationMeans": population_means,
        "researchLog": research_log,
    }


def task_cluster_motility_patterns(p):
    import numpy as np
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler

    tracks = p.get("tracks")
    parsed = _parse_tracks(tracks)

    n_clusters = p.get("nClusters", 2)
    try:
        n_clusters = int(n_clusters)
    except Exception as e:  # noqa: BLE001
        _fail(f"`nClusters` must be an integer: {e}")
    if n_clusters < 2:
        _fail("`nClusters` must be an integer >= 2.")
    if n_clusters > len(parsed):
        _fail(f"`nClusters` ({n_clusters}) cannot exceed the number of tracks ({len(parsed)}).")

    dt = p.get("dt", 1)
    pixel_size = p.get("pixelSize", 1)
    try:
        dt = float(dt)
        pixel_size = float(pixel_size)
    except Exception as e:  # noqa: BLE001
        _fail(f"`dt` and `pixelSize` must be numeric: {e}")
    if not (dt > 0 and pixel_size > 0):
        _fail("`dt` and `pixelSize` must be positive numbers.")

    # Feature vector per track: [meanSpeed, directionalityRatio, netDisplacement].
    feats = []
    for arr in parsed:
        m = _track_metrics(arr, dt, pixel_size)
        feats.append([m["meanSpeed"], m["directionalityRatio"], m["netDisplacement"]])
    features = np.asarray(feats, dtype=float)

    scaler = StandardScaler()
    scaled = scaler.fit_transform(features)

    km = KMeans(n_clusters=n_clusters, random_state=0, n_init=10)
    labels = km.fit_predict(scaled)
    labels_list = [int(x) for x in labels]

    feature_names = ["meanSpeed", "directionalityRatio", "netDisplacement"]
    cluster_sizes = {}
    cluster_means = {}
    for c in range(n_clusters):
        mask = labels == c
        size = int(np.sum(mask))
        cluster_sizes[str(c)] = size
        if size > 0:
            means = features[mask].mean(axis=0)
            cluster_means[str(c)] = {
                feature_names[j]: round(float(means[j]), 10) for j in range(len(feature_names))
            }
        else:
            cluster_means[str(c)] = {name: None for name in feature_names}

    analysis = (
        f"Clustered {len(parsed)} tracks into {n_clusters} motility phenotype(s) via "
        f"StandardScaler + KMeans (random_state=0) on features "
        f"[meanSpeed, directionalityRatio, netDisplacement]. "
        f"Cluster sizes: {', '.join(f'{c}:{cluster_sizes[c]}' for c in cluster_sizes)}."
    )

    log_rows = "".join(
        f"| {c} | {cluster_sizes[c]} | "
        f"{cluster_means[c]['meanSpeed']} | "
        f"{cluster_means[c]['directionalityRatio']} | "
        f"{cluster_means[c]['netDisplacement']} |\n"
        for c in cluster_sizes
    )
    research_log = (
        f"# Cell motility pattern clustering\n\n"
        f"Grouped **{len(parsed)}** tracks into **{n_clusters}** phenotype(s).\n\n"
        f"Each track was reduced to the feature vector "
        f"`[meanSpeed, directionalityRatio, netDisplacement]`, standardized with "
        f"scikit-learn `StandardScaler` (zero mean, unit variance), then partitioned "
        f"with `KMeans(n_clusters={n_clusters}, random_state=0, n_init=10)`.\n\n"
        f"| Cluster | Size | mean meanSpeed | mean directionalityRatio | mean netDisplacement |\n"
        f"| --- | --- | --- | --- | --- |\n{log_rows}"
    )

    return {
        "status": "success",
        "analysis": analysis,
        "nTracks": len(parsed),
        "nClusters": n_clusters,
        "featureNames": feature_names,
        "clusterLabels": labels_list,
        "clusterSizes": cluster_sizes,
        "clusterMeans": cluster_means,
        "researchLog": research_log,
    }


TASKS = {
    "cell_motility_metrics": task_cell_motility_metrics,
    "cluster_motility_patterns": task_cluster_motility_patterns,
}


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:  # noqa: BLE001
        _fail(f"Invalid JSON payload: {e}")
    task = payload.get("task")
    if task not in TASKS:
        _fail(f"Unknown task {task!r}. Available: {', '.join(TASKS)}.")
    try:
        import numpy  # noqa: F401
    except Exception as e:  # noqa: BLE001
        _fail(f"cell_motility_tools requires numpy: {e}", status="unavailable")
    try:
        import sklearn  # noqa: F401
    except Exception as e:  # noqa: BLE001
        _fail(f"cell_motility_tools requires scikit-learn: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
