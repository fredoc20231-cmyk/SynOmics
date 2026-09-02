#!/usr/bin/env python3
"""Physical assay vision + Bayesian update — Final Frontier 1.

Two deterministic, code-grounded capabilities:

  task 'quantify_image': extract quantitative metrics from a physical assay image
  using classical OpenCV computer vision (grayscale -> Otsu threshold -> contours
  -> per-region area / centroid / mean intensity). Results are measured, never
  "eyeballed" by an LLM.

  task 'bayesian_update': fold measured assay results into a conjugate Bayesian
  posterior (Beta-Binomial for proportions, Normal-Normal for continuous
  measurements) — the updater that shifts the adversarial swarm's posterior
  probabilities with physical evidence.

Reads JSON on stdin, prints JSON. Honest 'unavailable' if a required library is
missing.
"""
import base64
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def quantify_image(payload):
    try:
        import cv2
        import numpy as np
    except Exception as e:
        _fail(f"Image quantification requires opencv-python + numpy: {e}", status="unavailable")

    b64 = payload.get("imageBase64")
    if not b64:
        _fail("Provide `imageBase64` (PNG/JPEG bytes, base64).")
    try:
        buf = np.frombuffer(base64.b64decode(b64), dtype=np.uint8)
        img = cv2.imdecode(buf, cv2.IMREAD_GRAYSCALE)
    except Exception as e:
        _fail(f"Could not decode image: {e}")
    if img is None:
        _fail("Image decode returned empty.")

    min_area = float(payload.get("minArea", 20))
    # Deterministic segmentation: fixed background threshold if supplied (useful
    # when spot intensities span a wide range), otherwise Otsu's method.
    fixed = payload.get("threshold")
    if fixed is not None:
        _thr, binary = cv2.threshold(img, float(fixed), 255, cv2.THRESH_BINARY)
    else:
        _thr, binary = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    regions = []
    for c in contours:
        area = float(cv2.contourArea(c))
        if area < min_area:
            continue
        mask = np.zeros(img.shape, dtype=np.uint8)
        cv2.drawContours(mask, [c], -1, 255, -1)
        mean_intensity = float(cv2.mean(img, mask=mask)[0])
        M = cv2.moments(c)
        cx = float(M["m10"] / M["m00"]) if M["m00"] else 0.0
        cy = float(M["m01"] / M["m00"]) if M["m00"] else 0.0
        regions.append({"area": round(area, 2), "centroid": [round(cx, 1), round(cy, 1)],
                        "meanIntensity": round(mean_intensity, 2)})
    regions.sort(key=lambda r: r["meanIntensity"])

    print(json.dumps({
        "status": "success",
        "method": "OpenCV Otsu threshold + contour intensity measurement (deterministic, no LLM vision)",
        "imageShape": [int(img.shape[0]), int(img.shape[1])],
        "otsuThreshold": float(_thr),
        "regionCount": len(regions),
        "regions": regions,
    }))


def bayesian_update(payload):
    try:
        import numpy as np
        from scipy import stats as sp
    except Exception as e:
        _fail(f"Bayesian update requires numpy + scipy: {e}", status="unavailable")

    model = payload.get("model", "beta_binomial")
    if model == "beta_binomial":
        prior = payload.get("prior") or {"alpha": 1.0, "beta": 1.0}
        data = payload.get("data") or {}
        a0, b0 = float(prior.get("alpha", 1.0)), float(prior.get("beta", 1.0))
        s = float(data.get("successes", 0)); n = float(data.get("trials", 0))
        if n < s or n < 0:
            _fail("data.trials must be >= data.successes >= 0.")
        a1, b1 = a0 + s, b0 + (n - s)
        mean = a1 / (a1 + b1)
        ci = [float(sp.beta.ppf(0.025, a1, b1)), float(sp.beta.ppf(0.975, a1, b1))]
        print(json.dumps({
            "status": "success", "model": "beta_binomial",
            "prior": {"alpha": a0, "beta": b0}, "observed": {"successes": s, "trials": n},
            "posterior": {"alpha": a1, "beta": b1},
            "posteriorMean": round(mean, 6),
            "credibleInterval95": [round(ci[0], 6), round(ci[1], 6)],
            "note": "Posterior proportion after folding in the observed assay outcomes.",
        }))
    elif model == "normal":
        prior = payload.get("prior") or {"mean": 0.0, "var": 1.0}
        data = payload.get("data") or {}
        mu0, var0 = float(prior.get("mean", 0.0)), float(prior.get("var", 1.0))
        vals = np.asarray(data.get("values", []), dtype=float)
        if vals.size == 0:
            _fail("Provide data.values for the normal model.")
        obs_var = float(data.get("obsVar", float(np.var(vals, ddof=1)) if vals.size > 1 else 1.0))
        n = vals.size
        # Conjugate normal-normal posterior (known observation variance).
        post_var = 1.0 / (1.0 / var0 + n / obs_var)
        post_mean = post_var * (mu0 / var0 + vals.sum() / obs_var)
        sd = post_var ** 0.5
        print(json.dumps({
            "status": "success", "model": "normal",
            "prior": {"mean": mu0, "var": var0}, "observed": {"n": int(n), "sampleMean": round(float(vals.mean()), 6), "obsVar": obs_var},
            "posterior": {"mean": round(post_mean, 6), "var": round(post_var, 6)},
            "credibleInterval95": [round(post_mean - 1.959964 * sd, 6), round(post_mean + 1.959964 * sd, 6)],
            "note": "Posterior mean shrinks from the prior toward the data as evidence accrues.",
        }))
    else:
        _fail(f"Unknown model '{model}'. Use 'beta_binomial' or 'normal'.")


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        _fail(f"Invalid JSON: {e}")
    task = payload.get("task")
    if task == "quantify_image":
        quantify_image(payload)
    elif task == "bayesian_update":
        bayesian_update(payload)
    else:
        _fail("Unknown task. Use 'quantify_image' or 'bayesian_update'.")


if __name__ == "__main__":
    main()
