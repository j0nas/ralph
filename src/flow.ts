import { spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import chalk from 'chalk';
import type { CallbackHooks, ReviewConfig, VerifyConfig } from './config.js';
import { runInit, runIterate } from './init.js';
import { run } from './loop.js';
import { runPlan } from './plan.js';
import { askForPrompt, askYesNo } from './prompt.js';
import {
  createSession,
  getSessionDir,
  getSessionLogPath,
  getSessionPath,
} from './session.js';

export interface FlowOptions {
  maxIterations: number;
  review?: ReviewConfig;
  verify?: VerifyConfig;
  hooks?: CallbackHooks;
}

export interface RunOptions {
  task: string;
  maxIterations: number;
  review?: ReviewConfig;
  verify?: VerifyConfig;
  hooks?: CallbackHooks;
  detach?: boolean;
  /** Pre-created session ID (used by the detached child to reuse the parent's session). */
  sessionId?: string;
}

export async function runFlow(options: FlowOptions): Promise<number> {
  // 1. Get initial prompt
  const prompt = await askForPrompt();

  if (!prompt) {
    console.error(chalk.red('\nError: No prompt provided.'));
    return 1;
  }

  // 2. Init phase - Claude asks clarifying questions
  const sessionId = await runInit(prompt, {});

  // 3. Refine loop - until user is satisfied
  while (await askYesNo('Refine the task further?', false)) {
    await runIterate({ sessionId, count: 1 });
  }

  // 4. Plan phase - break down into steps
  await runPlan({ sessionId });

  // 5. Execute loop - work through tasks
  return await run({
    sessionId,
    maxIterations: options.maxIterations,
    review: options.review,
    verify: options.verify,
    hooks: options.hooks,
  });
}

/**
 * Re-spawn the current process in the background without `--detach`.
 * The child inherits the environment plus `RALPH_DETACHED=1`.
 * Stdout and stderr are redirected to the session log file.
 *
 * @param sessionId - Session ID used to derive the log file path.
 * @param opts.injectSessionId - When true, `--session-id <id>` is appended to
 *   the forwarded argv so the child reuses the parent's session.
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

export async function runNonInteractive(options: RunOptions): Promise<number> {
  // 1. Reuse an existing session (detached child) or create a new one
  const sessionId = options.sessionId || (await createSession(options.task));
  const sessionPath = getSessionPath(sessionId);

  if (!options.sessionId) {
    console.log(chalk.cyan(`\nCreated session: ${chalk.bold(sessionId)}`));
    console.log(chalk.dim(`Session file: ${sessionPath}\n`));
  }

  // 2. If detach requested, re-spawn in background and exit
  if (options.detach) {
    spawnDetached(sessionId, { injectSessionId: true });
    const logPath = getSessionLogPath(sessionId);
    console.log(chalk.green('Detached — running in the background.'));
    console.log(chalk.dim(`Log file: ${logPath}`));
    return 0;
  }

  // 3. Plan phase - break down into steps
  await runPlan({ sessionId });

  // 4. Execute loop - work through tasks
  return await run({
    sessionId,
    maxIterations: options.maxIterations,
    review: options.review,
    verify: options.verify,
    hooks: options.hooks,
  });
}
