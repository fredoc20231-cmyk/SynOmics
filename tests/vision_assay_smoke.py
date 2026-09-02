#!/usr/bin/env python3
"""Test OpenCV assay quantification + Bayesian update. Requires opencv + scipy.
Run: python tests/vision_assay_smoke.py"""
import base64
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "vision_assay.py")
try:
    import cv2  # noqa: F401
    import numpy as np
except Exception as e:
    print(f"SKIP: opencv/scipy not available ({e}).")
    sys.exit(0)

passed = 0
def check(name, cond):
    global passed
    if not cond:
        print(f"FAIL: {name}"); sys.exit(1)
    passed += 1
    print(f"ok: {name}")

def run(payload):
    p = subprocess.run([sys.executable, SCRIPT], input=json.dumps(payload).encode(),
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return json.loads(p.stdout.decode())

# Synthetic assay image (test fixture only): 3 spots of known intensity.
img = np.zeros((120, 300), np.uint8)
cv2.circle(img, (50, 60), 18, 80, -1)
cv2.circle(img, (150, 60), 18, 160, -1)
cv2.circle(img, (250, 60), 18, 240, -1)
_ok, png = cv2.imencode(".png", img)
b64 = base64.b64encode(png.tobytes()).decode()

r = run({"task": "quantify_image", "imageBase64": b64, "minArea": 50, "threshold": 40})
check("detects all 3 spots", r["regionCount"] == 3)
ints = [reg["meanIntensity"] for reg in r["regions"]]
check("measured intensities match drawn spots", abs(ints[0] - 80) < 5 and abs(ints[2] - 240) < 5 and ints[0] < ints[1] < ints[2])

# Beta-Binomial update: uniform prior + 8/10 positive -> mean (1+8)/(2+10)=0.75.
b = run({"task": "bayesian_update", "model": "beta_binomial", "prior": {"alpha": 1, "beta": 1}, "data": {"successes": 8, "trials": 10}})
check("beta-binomial posterior mean correct", abs(b["posteriorMean"] - 0.75) < 1e-6)
check("credible interval within [0,1]", 0 <= b["credibleInterval95"][0] < b["credibleInterval95"][1] <= 1)

# Normal update pulls toward the data.
nrm = run({"task": "bayesian_update", "model": "normal", "prior": {"mean": 0, "var": 10}, "data": {"values": [5.0, 5.2, 4.8, 5.1], "obsVar": 0.1}})
check("normal posterior near data mean", 4.5 < nrm["posterior"]["mean"] < 5.5)

check("honest error on bad task", run({"task": "nope"}).get("status") == "error")
print(f"\nALL {passed} VISION+BAYES TESTS PASSED")
