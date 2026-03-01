import { execa } from 'execa';
import type { CallbackHooks } from '../config.js';

export interface HookEnv {
  RALPH_SESSION_ID: string;
  RALPH_STATUS: string;
  RALPH_ITERATIONS: string;
  RALPH_TASK: string;
}

/**
 * Execute a callback hook shell command with context environment variables.
 * Never throws — a failing hook must not crash the main process.
 */
export async function executeHook(
  command: string,
  env: HookEnv,
): Promise<void> {
  try {
    await execa(command, {
      shell: true,
      env: { ...env },
      stdio: 'inherit',
      timeout: 30_000,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ralph] hook failed: ${msg}`);
  }
}

/**
 * Run a named hook if it is configured.
 */
export async function runHook(
  hooks: CallbackHooks | undefined,
  name: keyof CallbackHooks,
  env: HookEnv,
): Promise<void> {
  const command = hooks?.[name];
  if (command) {
    await executeHook(command, env);
  }
}
