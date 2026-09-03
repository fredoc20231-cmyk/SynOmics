#!/usr/bin/env python3
"""Module C sandbox isolation tests — real OS resource limits are enforced.

Verifies: normal code runs and returns real stdout; server secrets are NOT visible
to sandboxed code (env stripped); a memory-allocation bomb is killed; a CPU/infinite
loop is killed; limits metadata is reported honestly (incl. networkIsolation:false).

Run: `python tests/sandbox_smoke.py`
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "sandbox_runner.py")

passed = 0
def check(name, cond, ctx=None):
    global passed
    if not cond:
        print(f"FAIL: {name}\n  {ctx}")
        sys.exit(1)
    passed += 1
    print(f"ok: {name}")


def run(payload, extra_env=None):
    env = dict(os.environ)
    if extra_env:
        env.update(extra_env)
    p = subprocess.run([sys.executable, SCRIPT], input=json.dumps(payload).encode(),
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
    return json.loads(p.stdout.decode())


# 1. Normal code executes and returns real stdout.
r = run({"code": "print(6*7)"})
check("normal code succeeds", r.get("status") == "success" and r["success"] is True, r)
check("real stdout captured", r["stdout"].strip() == "42", r["stdout"])
check("limits reported", r["limits"]["memoryMB"] > 0 and r["limits"]["envStripped"] is True, r["limits"])
check("network isolation reported honestly (false)", r["limits"]["networkIsolation"] is False, r["limits"])

# 2. Server secrets are NOT visible to sandboxed code.
r2 = run({"code": "import os; print('LEAK' if 'SECRET_TOKEN_XYZ' in os.environ else 'CLEAN')"},
         extra_env={"SECRET_TOKEN_XYZ": "supersecret"})
check("secrets stripped from sandbox env", r2["stdout"].strip() == "CLEAN", r2["stdout"])

# 3. Memory bomb is killed (RLIMIT_AS) — not success.
r3 = run({"code": "x = bytearray(4_000_000_000)", "memoryMB": 256, "timeoutSec": 15})
check("memory bomb does not succeed", r3["success"] is False, r3)

# 4. CPU / infinite loop is killed (RLIMIT_CPU or wall-clock).
r4 = run({"code": "\nwhile True:\n    pass\n", "timeoutSec": 4, "cpuSec": 2})
check("infinite loop does not succeed", r4["success"] is False, r4)
check("infinite loop was killed (signal or timeout)", (r4.get("timedOut") is True) or (r4.get("killedSignal") is not None), r4)

# 5. Honest error on missing code.
r5 = run({})
check("missing code -> honest error", r5.get("status") == "error", r5)

print(f"\nALL {passed} SANDBOX ISOLATION TESTS PASSED")
