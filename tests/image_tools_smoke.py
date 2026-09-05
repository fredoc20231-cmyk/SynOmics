#!/usr/bin/env python3
"""Ground-truth smoke tests for server/image_tools.py.

Every expectation is derived from SYNTHETIC images this test constructs with
numpy/cv2, so the asserted ground truth is known exactly (no hardcoded guesses,
nothing fabricated). Skips cleanly if numpy or cv2 is missing.
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "image_tools.py")

try:
    import numpy as np
except Exception as e:  # pragma: no cover
    print(f"SKIP: numpy not available ({e}).")
    sys.exit(0)
try:
    import cv2
except Exception as e:  # pragma: no cover
    print(f"SKIP: cv2 (OpenCV) not available ({e}).")
    sys.exit(0)

passed = 0


def check(name, cond, ctx=None):
    global passed
    if not cond:
        print(f"FAIL: {name}\n  {ctx}")
        sys.exit(1)
    passed += 1
    print(f"ok: {name}")


def run(payload):
    r = subprocess.run(
        [sys.executable, SCRIPT],
        input=json.dumps(payload).encode(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if r.returncode != 0:
        print(f"FAIL: process exited {r.returncode}\n  stderr={r.stderr.decode()}")
        sys.exit(1)
    return json.loads(r.stdout.decode())


# --------------------------------------------------------------------------- #
# Task 1 — pixel_distribution                                                  #
# --------------------------------------------------------------------------- #
# Constant 128 image: mean/median == 128, std == 0 exactly.
const = np.full((100, 100), 128.0)
res = run({"task": "pixel_distribution", "image": const.tolist()})
check("pixel_distribution status", res.get("status") == "success", res)
check("pixel_distribution const mean==128", res["mean"] == 128.0, res["mean"])
check("pixel_distribution const std==0", res["std"] == 0.0, res["std"])
check("pixel_distribution const median==128", res["median"] == 128.0, res["median"])
check("pixel_distribution const min==max==128", res["min"] == 128.0 and res["max"] == 128.0, res)
check("pixel_distribution histogram is 256 bins", len(res["histogram"]) == 256, len(res["histogram"]))
check("pixel_distribution histogram sums to pixel count", sum(res["histogram"]) == 100 * 100, res["pixelCount"])
check("pixel_distribution percentiles present", set(res["percentiles"]) == {"25", "50", "75"}, res["percentiles"])

# Half 0 / half 255: mean is exactly 127.5.
half = np.vstack([np.zeros((50, 100)), np.full((50, 100), 255.0)])
res = run({"task": "pixel_distribution", "image": half.tolist()})
check("pixel_distribution half mean==127.5", res["mean"] == 127.5, res["mean"])
check("pixel_distribution half min==0", res["min"] == 0.0, res["min"])
check("pixel_distribution half max==255", res["max"] == 255.0, res["max"])

# Custom bin count is honored.
res = run({"task": "pixel_distribution", "image": half.tolist(), "bins": 4})
check("pixel_distribution custom bins", len(res["histogram"]) == 4, res["histogram"])


# --------------------------------------------------------------------------- #
# Task 2 — count_colonies                                                      #
# --------------------------------------------------------------------------- #
# Black 200x200 background with N=5 well-separated white filled circles (r=10).
N = 5
colony_img = np.zeros((200, 200), dtype=np.uint8)
centers = [(40, 40), (160, 40), (100, 100), (40, 160), (160, 160)]
for (cx, cy) in centers:
    cv2.circle(colony_img, (cx, cy), 10, 255, -1)
res = run({"task": "count_colonies", "image": colony_img.tolist()})
check("count_colonies status", res.get("status") == "success", res)
check("count_colonies count==5", res["colonyCount"] == N, res["colonyCount"])
check("count_colonies per-colony fields", all({"area", "centroidX", "centroidY"} <= set(c) for c in res["colonies"]), res["colonies"])
# Each drawn circle (r=10) has area ~pi*100 ~314 px, well above the default minArea.
check("count_colonies areas plausible", all(c["area"] > 200 for c in res["colonies"]), [c["area"] for c in res["colonies"]])

# Dark-on-light variant with invert flag: 5 black circles on white -> still 5.
inv_img = np.full((200, 200), 255, dtype=np.uint8)
for (cx, cy) in centers:
    cv2.circle(inv_img, (cx, cy), 10, 0, -1)
res = run({"task": "count_colonies", "image": inv_img.tolist(), "invert": True})
check("count_colonies invert count==5", res["colonyCount"] == N, res["colonyCount"])


# --------------------------------------------------------------------------- #
# Task 3 — optical_flow_deformation                                           #
# --------------------------------------------------------------------------- #
# Richly textured frame; frame2 = frame1 shifted right by dx=3 (np.roll).
rng = np.random.default_rng(0)
DX = 3
frame1 = np.zeros((120, 120), dtype=float)
for _ in range(60):
    cx, cy = int(rng.integers(10, 110)), int(rng.integers(10, 110))
    val = float(rng.integers(80, 255))
    cv2.circle(frame1, (cx, cy), int(rng.integers(3, 9)), val, -1)
frame1 = cv2.GaussianBlur(frame1, (5, 5), 0)
frame2 = np.roll(frame1, DX, axis=1)
res = run({"task": "optical_flow_deformation", "frame1": frame1.tolist(), "frame2": frame2.tolist()})
check("optical_flow status", res.get("status") == "success", res)
mfx, mfy = res["meanFlowX"], res["meanFlowY"]
# Content shifted right => meanFlowX ~ +3 (positive sign), meanFlowY ~ 0.
check("optical_flow meanFlowX sign positive", mfx > 0, mfx)
check("optical_flow meanFlowX ~ 3.0 (within 1.0)", abs(mfx - DX) < 1.0, mfx)
check("optical_flow meanFlowY ~ 0 (within 1.0)", abs(mfy) < 1.0, mfy)
check("optical_flow meanMagnitude present", res["meanMagnitude"] > 0, res["meanMagnitude"])
print(f"  [info] optical-flow achieved meanFlowX = {mfx} (target dx={DX})")


# --------------------------------------------------------------------------- #
# Task 4 — ciliary_beat_frequency                                            #
# --------------------------------------------------------------------------- #
# 64 constant frames whose intensity oscillates at f=5 Hz, sampled at 50 Hz.
F_TRUE = 5.0
RATE = 50.0
T = 64
times = np.arange(T) / RATE
frames = [(128.0 + 100.0 * np.sin(2.0 * np.pi * F_TRUE * ti)) * np.ones((8, 8)) for ti in times]
res = run({"task": "ciliary_beat_frequency", "frames": [f.tolist() for f in frames], "samplingRateHz": RATE})
check("ciliary_beat status", res.get("status") == "success", res)
bf = res["beatFrequencyHz"]
check("ciliary_beat frequency ~ 5.0 (within 0.5)", abs(bf - F_TRUE) < 0.5, bf)
check("ciliary_beat power peak > 0", res["powerSpectrumPeak"] > 0, res["powerSpectrumPeak"])
print(f"  [info] ciliary beat achieved frequency = {bf} Hz (target {F_TRUE} Hz)")


# --------------------------------------------------------------------------- #
# Error handling — must return status "error"                                  #
# --------------------------------------------------------------------------- #
check("missing image -> error", run({"task": "pixel_distribution"}).get("status") == "error", None)
check("wrong dims (1D) -> error", run({"task": "pixel_distribution", "image": [1, 2, 3]}).get("status") == "error", None)
check("colonies missing image -> error", run({"task": "count_colonies"}).get("status") == "error", None)
check("optical_flow shape mismatch -> error",
      run({"task": "optical_flow_deformation",
           "frame1": np.zeros((10, 10)).tolist(),
           "frame2": np.zeros((10, 12)).tolist()}).get("status") == "error", None)
check("ciliary_beat wrong dims (2D) -> error",
      run({"task": "ciliary_beat_frequency", "frames": np.zeros((8, 8)).tolist(),
           "samplingRateHz": 50}).get("status") == "error", None)
check("ciliary_beat missing rate -> error",
      run({"task": "ciliary_beat_frequency", "frames": np.zeros((8, 4, 4)).tolist()}).get("status") == "error", None)
check("unknown task -> error", run({"task": "does_not_exist"}).get("status") == "error", None)

print(f"ALL {passed} IMAGE-TOOLS TESTS PASSED")
