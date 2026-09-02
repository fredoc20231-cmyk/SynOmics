import { spawn } from 'child_process';
import path from 'path';

/**
 * Shared client for the real Python compute engine. Spawns
 * `python3 server/synomics_engine.py <cmd>` and pipes a JSON payload on stdin,
 * resolving with the parsed JSON result. This is the single execution path used
 * by both the HTTP routes and the agent executor, so every "tool call" runs the
 * same real computation.
 */
export function runEngine(cmd: string, payload: any, timeoutMs = 60000): Promise<any> {
  return new Promise((resolve, reject) => {
    const enginePath = path.join(process.cwd(), 'server', 'synomics_engine.py');
    const py = spawn('python3', [enginePath, cmd], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONPATH: process.cwd() },
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      py.kill();
      reject(new Error(`Engine command '${cmd}' timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    py.stdout.on('data', (d) => { stdout += d.toString(); });
    py.stderr.on('data', (d) => { stderr += d.toString(); });
    py.on('error', (err) => { clearTimeout(timer); reject(err); });
    py.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0 && !stdout.trim()) {
        return reject(new Error(stderr || `Engine command '${cmd}' exited with code ${code}`));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve({ rawOutput: stdout, error: stderr });
      }
    });

    py.stdin.write(JSON.stringify(payload || {}));
    py.stdin.end();
  });
}
