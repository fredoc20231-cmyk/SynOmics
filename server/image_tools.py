#!/usr/bin/env python3
"""Bio-image analysis (numpy + OpenCV) — single dispatch.

Reads a JSON payload on stdin and prints a JSON result on stdout. Zero
hallucination: every reported value is computed by real numpy / OpenCV code on
the provided pixels; nothing is fabricated. If an image cannot be produced,
an explicit error is returned instead of a placeholder number.

Input convention
----------------
- A single image is passed as ``image``: either a 2D list-of-lists of grayscale
  intensities, or a path string to an image file (read via cv2 as grayscale).
- An image sequence is passed as ``frames``: a 3D list ``[t][h][w]`` of grayscale
  intensities.
2D arrays are accepted directly; reading files is a convenience, not a
requirement.

Tasks
-----
1. pixel_distribution      — intensity statistics + histogram (numpy).
2. count_colonies          — Otsu threshold + connected-component blob counting.
3. optical_flow_deformation— dense Farneback optical flow between two frames.
4. ciliary_beat_frequency  — FFT dominant frequency of a frame-mean time series.

Design adapted from the Apache-2.0 Biomni project
(pharmacology.analyze_pixel_distribution, microbiology.count_bacterial_colonies,
biophysics.analyze_tissue_deformation_flow,
physiology.analyze_ciliary_beat_frequency); reimplemented cleanly.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _to_gray_array(obj, key):
    """Coerce a payload value into a 2D grayscale numpy array.

    Accepts a 2D list-of-lists directly, or a path string read via cv2 as
    grayscale. Returns the array; raises ValueError with a precise message on
    bad input (caller converts to an error result).
    """
    import numpy as np

    if obj is None:
        raise ValueError(f"Provide `{key}` (2D grayscale array or image path).")
    if isinstance(obj, str):
        import cv2

        img = cv2.imread(obj, cv2.IMREAD_GRAYSCALE)
        if img is None:
            raise ValueError(f"`{key}` path could not be read as an image: {obj!r}")
        return img
    try:
        arr = np.asarray(obj, dtype=float)
    except Exception as e:
        raise ValueError(f"`{key}` must be a numeric 2D array: {e}") from e
    if arr.ndim != 2:
        raise ValueError(f"`{key}` must be a 2D array (got {arr.ndim}D shape {arr.shape}).")
    if arr.size == 0:
        raise ValueError(f"`{key}` must be a non-empty 2D array.")
    return arr


def _as_uint8(arr):
    """Clip an intensity array into [0,255] uint8 for OpenCV routines."""
    import numpy as np

    return np.clip(np.asarray(arr, dtype=float), 0, 255).astype(np.uint8)


# --------------------------------------------------------------------------- #
# Task 1 — pixel intensity distribution (numpy only)                           #
# --------------------------------------------------------------------------- #
def task_pixel_distribution(p):
    import numpy as np

    try:
        img = _to_gray_array(p.get("image"), "image")
    except ValueError as e:
        _fail(str(e))

    flat = np.asarray(img, dtype=float).ravel()
    if not np.all(np.isfinite(flat)):
        _fail("`image` must contain only finite intensity values.")

    bins = p.get("bins", 256)
    try:
        bins = int(bins)
    except Exception:
        _fail("`bins` must be an integer.")
    if bins < 1:
        _fail("`bins` must be a positive integer.")

    counts, edges = np.histogram(flat, bins=bins, range=(0.0, 256.0))
    q25, q50, q75 = (float(x) for x in np.percentile(flat, [25, 50, 75]))

    mean = float(flat.mean())
    std = float(flat.std())
    vmin = float(flat.min())
    vmax = float(flat.max())
    median = float(np.median(flat))

    analysis = (
        f"Pixel intensity distribution over {flat.size} pixels "
        f"({img.shape[0]}x{img.shape[1]}): mean={mean:.6g}, std={std:.6g}, "
        f"min={vmin:.6g}, max={vmax:.6g}, median={median:.6g}; "
        f"IQR [{q25:.6g}, {q75:.6g}], {bins}-bin histogram over 0-255."
    )
    research_log = (
        "# Pixel intensity distribution\n\n"
        f"Computed summary statistics on **{flat.size}** grayscale pixels "
        f"(image shape {img.shape[0]}x{img.shape[1]}) with numpy.\n\n"
        "| Statistic | Value |\n| --- | --- |\n"
        f"| Mean | {mean:.6g} |\n"
        f"| Std (population) | {std:.6g} |\n"
        f"| Min | {vmin:.6g} |\n"
        f"| Max | {vmax:.6g} |\n"
        f"| Median | {median:.6g} |\n"
        f"| 25th pct | {q25:.6g} |\n"
        f"| 50th pct | {q50:.6g} |\n"
        f"| 75th pct | {q75:.6g} |\n\n"
        f"Histogram: {bins} bins over the intensity range [0, 255] "
        "(numpy.histogram). Std is the population standard deviation "
        "(numpy default, ddof=0)."
    )
    return {
        "status": "success",
        "analysis": analysis,
        "mean": round(mean, 10),
        "std": round(std, 10),
        "min": round(vmin, 10),
        "max": round(vmax, 10),
        "median": round(median, 10),
        "percentiles": {"25": round(q25, 10), "50": round(q50, 10), "75": round(q75, 10)},
        "histogram": [int(c) for c in counts.tolist()],
        "histogramBinEdges": [float(x) for x in edges.tolist()],
        "bins": bins,
        "pixelCount": int(flat.size),
        "shape": [int(img.shape[0]), int(img.shape[1])],
        "researchLog": research_log,
    }


# --------------------------------------------------------------------------- #
# Task 2 — colony / blob counting (Otsu + connected components)                #
# --------------------------------------------------------------------------- #
def task_count_colonies(p):
    import cv2
    import numpy as np

    try:
        img = _to_gray_array(p.get("image"), "image")
    except ValueError as e:
        _fail(str(e))
    if not np.all(np.isfinite(np.asarray(img, dtype=float))):
        _fail("`image` must contain only finite intensity values.")

    min_area = p.get("minArea", 5)
    try:
        min_area = float(min_area)
    except Exception:
        _fail("`minArea` must be a number.")
    if min_area < 0:
        _fail("`minArea` must be non-negative.")

    gray = _as_uint8(img)
    # Bright blobs on dark background is the native convention. For dark blobs on
    # a light background, `invert` flips intensities so the blobs become bright.
    if bool(p.get("invert", False)):
        gray = cv2.bitwise_not(gray)

    thr_val, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(binary, connectivity=8)

    colonies = []
    # Label 0 is the background component; skip it.
    for i in range(1, num_labels):
        area = int(stats[i, cv2.CC_STAT_AREA])
        if area < min_area:
            continue
        cx, cy = centroids[i]
        colonies.append(
            {
                "area": area,
                "centroidX": round(float(cx), 6),
                "centroidY": round(float(cy), 6),
                "bboxX": int(stats[i, cv2.CC_STAT_LEFT]),
                "bboxY": int(stats[i, cv2.CC_STAT_TOP]),
                "bboxWidth": int(stats[i, cv2.CC_STAT_WIDTH]),
                "bboxHeight": int(stats[i, cv2.CC_STAT_HEIGHT]),
            }
        )
    colonies.sort(key=lambda c: c["area"], reverse=True)

    areas = [c["area"] for c in colonies]
    total_area = int(sum(areas))
    mean_area = float(np.mean(areas)) if areas else 0.0

    analysis = (
        f"Detected {len(colonies)} colonies (Otsu threshold={thr_val:.6g}, "
        f"8-connectivity, minArea={min_area:g}) on a {img.shape[0]}x{img.shape[1]} "
        f"image. Total colony area {total_area} px, mean area {mean_area:.6g} px."
        + (" Intensities were inverted before thresholding." if p.get("invert") else "")
    )
    research_log = (
        "# Colony counting\n\n"
        f"Binarized a {img.shape[0]}x{img.shape[1]} grayscale image with Otsu's "
        f"method (cv2.THRESH_OTSU, threshold = **{thr_val:.6g}**), then labeled "
        "8-connected foreground components (cv2.connectedComponentsWithStats).\n\n"
        f"- `invert`: {bool(p.get('invert', False))} (dark-on-light input flips to bright-on-dark)\n"
        f"- `minArea`: {min_area:g} px (components below this are discarded)\n"
        f"- **Colonies detected: {len(colonies)}**\n"
        f"- Total colony area: {total_area} px; mean area: {mean_area:.6g} px\n\n"
        "Each colony reports pixel area, centroid (x, y), and bounding box from "
        "the connected-component statistics. No blob is fabricated; the count is "
        "the number of real components surviving the area filter."
    )
    return {
        "status": "success",
        "analysis": analysis,
        "colonyCount": len(colonies),
        "colonies": colonies,
        "otsuThreshold": round(float(thr_val), 6),
        "minArea": min_area,
        "inverted": bool(p.get("invert", False)),
        "totalArea": total_area,
        "meanArea": round(mean_area, 6),
        "shape": [int(img.shape[0]), int(img.shape[1])],
        "researchLog": research_log,
    }


# --------------------------------------------------------------------------- #
# Task 3 — dense optical-flow tissue deformation (Farneback)                   #
# --------------------------------------------------------------------------- #
def task_optical_flow_deformation(p):
    import cv2
    import numpy as np

    try:
        f1 = _to_gray_array(p.get("frame1"), "frame1")
        f2 = _to_gray_array(p.get("frame2"), "frame2")
    except ValueError as e:
        _fail(str(e))
    if f1.shape != f2.shape:
        _fail(f"`frame1` {f1.shape} and `frame2` {f2.shape} must have the same shape.")
    for name, arr in (("frame1", f1), ("frame2", f2)):
        if not np.all(np.isfinite(np.asarray(arr, dtype=float))):
            _fail(f"`{name}` must contain only finite intensity values.")

    prev = _as_uint8(f1)
    nxt = _as_uint8(f2)

    flow = cv2.calcOpticalFlowFarneback(
        prev,
        nxt,
        None,
        pyr_scale=0.5,
        levels=3,
        winsize=15,
        iterations=5,
        poly_n=5,
        poly_sigma=1.2,
        flags=0,
    )
    fx = flow[..., 0]
    fy = flow[..., 1]
    magnitude = np.sqrt(fx * fx + fy * fy)

    mean_fx = float(fx.mean())
    mean_fy = float(fy.mean())
    mean_mag = float(magnitude.mean())
    max_mag = float(magnitude.max())

    # Deformation descriptors from the flow field.
    dfx_dx = np.gradient(fx, axis=1)
    dfx_dy = np.gradient(fx, axis=0)
    dfy_dx = np.gradient(fy, axis=1)
    dfy_dy = np.gradient(fy, axis=0)
    divergence = dfx_dx + dfy_dy  # net expansion/contraction
    curl = dfy_dx - dfx_dy        # net rotation
    mean_div = float(divergence.mean())
    mean_curl = float(curl.mean())

    analysis = (
        f"Dense Farneback optical flow over {f1.shape[0]}x{f1.shape[1]} px: "
        f"meanFlowX={mean_fx:.6g}, meanFlowY={mean_fy:.6g}, "
        f"meanMagnitude={mean_mag:.6g} px (max {max_mag:.6g}). "
        f"Mean divergence={mean_div:.6g}, mean curl={mean_curl:.6g}."
    )
    research_log = (
        "# Optical-flow deformation\n\n"
        f"Estimated dense motion between two {f1.shape[0]}x{f1.shape[1]} grayscale "
        "frames with cv2.calcOpticalFlowFarneback "
        "(pyr_scale=0.5, levels=3, winsize=15, iterations=5, poly_n=5, poly_sigma=1.2).\n\n"
        "| Quantity | Value (px) |\n| --- | --- |\n"
        f"| Mean flow X | {mean_fx:.6g} |\n"
        f"| Mean flow Y | {mean_fy:.6g} |\n"
        f"| Mean magnitude | {mean_mag:.6g} |\n"
        f"| Max magnitude | {max_mag:.6g} |\n"
        f"| Mean divergence | {mean_div:.6g} |\n"
        f"| Mean curl | {mean_curl:.6g} |\n\n"
        "Flow X/Y are the per-pixel displacement components (frame1 to frame2), "
        "averaged over the field. Divergence = d(fx)/dx + d(fy)/dy (expansion), "
        "curl = d(fy)/dx - d(fx)/dy (rotation), from numpy gradients of the flow."
    )
    return {
        "status": "success",
        "analysis": analysis,
        "meanFlowX": round(mean_fx, 6),
        "meanFlowY": round(mean_fy, 6),
        "meanMagnitude": round(mean_mag, 6),
        "maxMagnitude": round(max_mag, 6),
        "meanDivergence": round(mean_div, 6),
        "meanCurl": round(mean_curl, 6),
        "shape": [int(f1.shape[0]), int(f1.shape[1])],
        "researchLog": research_log,
    }


# --------------------------------------------------------------------------- #
# Task 4 — ciliary beat frequency (FFT of frame-mean time series)             #
# --------------------------------------------------------------------------- #
def task_ciliary_beat_frequency(p):
    import numpy as np

    frames = p.get("frames")
    if frames is None:
        _fail("Provide `frames` (3D array [t][h][w]).")
    try:
        stack = np.asarray(frames, dtype=float)
    except Exception as e:
        _fail(f"`frames` must be a numeric 3D array: {e}")
    if stack.ndim != 3:
        _fail(f"`frames` must be a 3D array [t][h][w] (got {stack.ndim}D shape {stack.shape}).")
    n_frames = stack.shape[0]
    if n_frames < 4:
        _fail(f"`frames` must contain at least 4 time points (got {n_frames}).")
    if not np.all(np.isfinite(stack)):
        _fail("`frames` must contain only finite intensity values.")

    rate = p.get("samplingRateHz")
    if rate is None:
        _fail("Provide `samplingRateHz` (frames per second).")
    try:
        rate = float(rate)
    except Exception:
        _fail("`samplingRateHz` must be a number.")
    if not (rate > 0):
        _fail("`samplingRateHz` must be a positive number.")

    # Spatial-mean intensity per frame -> 1D time series.
    signal = stack.mean(axis=(1, 2))
    detrended = signal - signal.mean()

    spectrum = np.fft.rfft(detrended)
    freqs = np.fft.rfftfreq(n_frames, d=1.0 / rate)
    power = np.abs(spectrum) ** 2

    # Ignore the DC bin (index 0); it carries the residual mean, not a rhythm.
    if power.size > 1:
        search = power.copy()
        search[0] = 0.0
        peak_idx = int(np.argmax(search))
    else:
        peak_idx = 0
    beat_freq = float(freqs[peak_idx])
    peak_power = float(power[peak_idx])

    analysis = (
        f"Ciliary beat frequency from {n_frames} frames at {rate:g} Hz: "
        f"dominant frequency {beat_freq:.6g} Hz "
        f"(FFT power peak {peak_power:.6g}). Frequency resolution "
        f"{rate / n_frames:.6g} Hz."
    )
    research_log = (
        "# Ciliary beat frequency\n\n"
        f"Reduced a stack of **{n_frames}** frames to a 1D time series by taking "
        "the spatial mean intensity per frame, removed the DC component, and took "
        "a real FFT (numpy.fft.rfft).\n\n"
        f"- Sampling rate: {rate:g} Hz\n"
        f"- Frequency resolution: {rate / n_frames:.6g} Hz "
        f"({rate:g} Hz / {n_frames} frames)\n"
        f"- **Dominant (beat) frequency: {beat_freq:.6g} Hz**\n"
        f"- Power-spectrum peak: {peak_power:.6g}\n\n"
        "The beat frequency is the FFT bin with maximum power (excluding DC). "
        "Discrete bin spacing limits resolution to samplingRate / nFrames."
    )
    return {
        "status": "success",
        "analysis": analysis,
        "beatFrequencyHz": round(beat_freq, 6),
        "powerSpectrumPeak": round(peak_power, 6),
        "peakBinIndex": peak_idx,
        "frequencyResolutionHz": round(rate / n_frames, 6),
        "nFrames": int(n_frames),
        "samplingRateHz": rate,
        "researchLog": research_log,
    }


TASKS = {
    "pixel_distribution": task_pixel_distribution,
    "count_colonies": task_count_colonies,
    "optical_flow_deformation": task_optical_flow_deformation,
    "ciliary_beat_frequency": task_ciliary_beat_frequency,
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
        import numpy  # noqa: F401
    except Exception as e:
        _fail(f"image_tools requires numpy: {e}", status="unavailable")
    try:
        import cv2  # noqa: F401
    except Exception as e:
        _fail(f"image_tools requires OpenCV (cv2): {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
