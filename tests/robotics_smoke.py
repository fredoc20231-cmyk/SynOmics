#!/usr/bin/env python3
"""Tests for the Opentrons protocol generator + physical validator. Stdlib only.
Run: `python tests/robotics_smoke.py`
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "robotics.py")

passed = 0
def check(name, cond):
    global passed
    if not cond:
        print(f"FAIL: {name}")
        sys.exit(1)
    passed += 1
    print(f"ok: {name}")

def run(payload):
    p = subprocess.run([sys.executable, SCRIPT], input=json.dumps(payload).encode(),
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return json.loads(p.stdout.decode())

# Valid plan with an oversize transfer that must be split.
r = run({"pipette": {"model": "p300_single_gen2", "maxVolume": 300, "minVolume": 20},
         "labware": [{"name": "nest_96_wellplate_200ul_flat", "slot": 1},
                     {"name": "opentrons_96_tiprack_300ul", "slot": 2}],
         "transfers": [{"source": "A1", "dest": "B1", "volume": 150},
                       {"source": "A2", "dest": "B2", "volume": 500}]})
check("valid plan accepted", r["valid"] is True)
check("oversize 500uL split into 2 aliquots", any(rc["splitInto"] == 2 for rc in r["recalculations"]))
check("no planned step exceeds pipette max", all(s["volume"] <= 300 for s in r["plannedSteps"]))
check("protocol emitted with runtime assert guard", "assert" in r["protocolPython"] and "pipette.transfer" in r["protocolPython"])

# Slot collision -> invalid, no protocol.
r2 = run({"pipette": {"maxVolume": 300}, "labware": [{"name": "a", "slot": 1}, {"name": "b", "slot": 1}],
          "transfers": [{"source": "A1", "dest": "B1", "volume": 50}]})
check("slot collision rejected", r2["valid"] is False and "protocolPython" not in r2)

# Too many slots -> invalid.
r3 = run({"pipette": {"maxVolume": 300}, "deckSlots": 2,
          "labware": [{"name": "a", "slot": 1}, {"name": "b", "slot": 2}, {"name": "c", "slot": 3}],
          "transfers": [{"source": "A1", "dest": "B1", "volume": 50}]})
check("over-capacity deck rejected", r3["valid"] is False)

# Below-minimum volume -> violation.
r4 = run({"pipette": {"maxVolume": 300, "minVolume": 20},
          "transfers": [{"source": "A1", "dest": "B1", "volume": 5}]})
check("below-min volume rejected", r4["valid"] is False)

print(f"\nALL {passed} ROBOTICS TESTS PASSED")
