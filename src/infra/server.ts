import type { ChildProcess } from 'node:child_process';
import { execSync, spawn } from 'node:child_process';

const SHELL_OPERATORS = /&&|\|\||[|;>]/;

/**
 * Start a server process in the background.
 * Detects shell operators and uses shell mode when needed.
 * Returns the child process handle for later cleanup.
 */
export function startServer(command: string, cwd: string): ChildProcess {
  let child: ChildProcess;

  if (SHELL_OPERATORS.test(command)) {
    child = spawn(command, {
      cwd,
      stdio: 'ignore',
      detached: true,
      shell: true,
    });
  } else {
    const [cmd, ...args] = command.split(/\s+/);
    child = spawn(cmd, args, {
      cwd,
      stdio: 'ignore',
      detached: true,
    });
  }

  child.unref();
  return child;
}

/**
 * Run a cleanup/stop command synchronously (e.g., `docker compose down`).
 */
export function runStopCommand(command: string, cwd: string): void {
  try {
    execSync(command, { cwd, stdio: 'ignore', timeout: 30_000 });
  } catch {
    // Non-fatal — cleanup is best-effort
  }
}

/**
 * Wait for a URL to respond with a 2xx/3xx status.
 * Returns true if the server is up, false if it timed out.
 */
export async function waitForServer(
  url: string,
  timeoutMs = 15000,
): Promise<boolean> {
  const start = Date.now();
  const interval = 500;

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(2000),
        redirect: 'manual',
      });
      if (response.status < 500) return true;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
}

/**
 * Stop a server process and all its children (process group).
 */
export function stopServer(child: ChildProcess): void {
  try {
    // Kill the process group (negative PID)
    if (child.pid) {
      process.kill(-child.pid, 'SIGTERM');
    }
  } catch {
    // Process may have already exited
  }
}
