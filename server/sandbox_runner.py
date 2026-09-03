#!/usr/bin/env python3
"""Module C — deterministic sandbox runner with REAL OS resource limits.

Executes user/agent-authored Python under enforced limits so a runaway or hostile
script cannot exhaust the host:

  * RLIMIT_CPU   — hard CPU-seconds cap (kills busy loops).
  * RLIMIT_AS    — address-space (memory) cap (kills allocation bombs).
  * RLIMIT_FSIZE — max bytes any single write may produce.
  * RLIMIT_CORE  — 0 (no core dumps).
  * wall-clock timeout — kills the whole process group if it overruns.
  * stripped environment — the child sees only PATH + a couple of safe vars, so
    server secrets (e.g. GEMINI_API_KEY) are NOT visible to sandboxed code.
  * isolated cwd — a fresh temp directory, cleaned up afterwards.

HONEST SCOPE: this enforces CPU/memory/file/process-time and env/cwd isolation via
POSIX rlimits — real, effective protections available without root. It does NOT add
kernel network namespacing or seccomp syscall filtering (those need root/unshare,
unavailable here); outbound network from sandboxed code is still governed by the
environment's egress policy, not blocked at this layer. Stated plainly, not faked.

Reads JSON on stdin, prints JSON on stdout.
Payload: { "code": "...", "timeoutSec": 30, "cpuSec": 15,
           "memoryMB": 512, "fileSizeMB": 64 }
"""
import json
import os
import resource
import shutil
import subprocess
import sys
import tempfile


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        _fail(f"Invalid JSON payload: {e}")

    code = payload.get("code") or payload.get("script")
    if not code or not isinstance(code, str):
        _fail("Provide a `code` string to execute.")

    timeout_sec = int(payload.get("timeoutSec", 30))
    cpu_sec = int(payload.get("cpuSec", max(1, min(timeout_sec, 15))))
    memory_mb = int(payload.get("memoryMB", 512))
    file_mb = int(payload.get("fileSizeMB", 64))

    workdir = tempfile.mkdtemp(prefix="synomics_sbx_")
    script_path = os.path.join(workdir, "user_code.py")
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(code)

    def apply_limits():
        # Runs in the child after fork, before exec.
        os.setsid()  # own process group so we can kill the whole tree on timeout
        mem_bytes = memory_mb * 1024 * 1024
        fsize_bytes = file_mb * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_CPU, (cpu_sec, cpu_sec + 1))
        resource.setrlimit(resource.RLIMIT_AS, (mem_bytes, mem_bytes))
        resource.setrlimit(resource.RLIMIT_FSIZE, (fsize_bytes, fsize_bytes))
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))

    # Minimal environment — server secrets are NOT propagated to sandboxed code.
    safe_env = {
        "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
        "LANG": os.environ.get("LANG", "C.UTF-8"),
        "HOME": workdir,
        "PYTHONDONTWRITEBYTECODE": "1",
    }

    timed_out = False
    killed_signal = None
    try:
        proc = subprocess.Popen(
            [sys.executable, "-I", script_path],  # -I: isolated mode (ignore env/user site)
            cwd=workdir, env=safe_env,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            preexec_fn=apply_limits,
        )
        try:
            out, err = proc.communicate(timeout=timeout_sec)
            exit_code = proc.returncode
        except subprocess.TimeoutExpired:
            timed_out = True
            try:
                os.killpg(os.getpgid(proc.pid), 9)
            except Exception:
                proc.kill()
            out, err = proc.communicate()
            exit_code = -9
        if exit_code is not None and exit_code < 0:
            killed_signal = -exit_code
        stdout = out.decode("utf-8", "replace")
        stderr = err.decode("utf-8", "replace")
    except Exception as e:
        _fail(f"Sandbox execution failed: {e}")
    finally:
        shutil.rmtree(workdir, ignore_errors=True)

    if timed_out:
        stderr += f"\n[sandbox] killed: wall-clock timeout after {timeout_sec}s"
    elif killed_signal == 9:
        stderr += "\n[sandbox] killed by SIGKILL (likely CPU or memory limit exceeded)"

    print(json.dumps({
        "status": "success",
        "success": exit_code == 0,
        "stdout": stdout,
        "stderr": stderr,
        "exitCode": exit_code,
        "timedOut": timed_out,
        "killedSignal": killed_signal,
        "limits": {
            "timeoutSec": timeout_sec, "cpuSec": cpu_sec,
            "memoryMB": memory_mb, "fileSizeMB": file_mb,
            "envStripped": True, "isolatedCwd": True,
            "networkIsolation": False,  # honest: not enforced at this layer
        },
    }))


if __name__ == "__main__":
    main()
