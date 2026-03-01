import { spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { getSessionDir, getSessionLogPath } from './session.js';

/**
 * Re-spawn the current process in the background without `--detach`.
 * The child inherits the environment plus `RALPH_DETACHED=1`.
 * Stdout and stderr are redirected to the session log file.
 */
export function spawnDetached(
  sessionId: string,
  opts?: { injectSessionId?: boolean },
): void {
  const args = process.argv.slice(1).filter((a) => a !== '--detach');
  if (opts?.injectSessionId) {
    args.push('--session-id', sessionId);
  }

  const logPath = getSessionLogPath(sessionId);
  mkdirSync(getSessionDir(), { recursive: true });
  const logFd = openSync(logPath, 'a');
  try {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      stdio: ['ignore', logFd, logFd],
      detached: true,
      env: { ...process.env, RALPH_DETACHED: '1' },
    });
    child.unref();
  } finally {
    closeSync(logFd);
  }
}
