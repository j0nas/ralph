import { spawn } from 'node:child_process';
import chalk from 'chalk';
import type { CallbackHooks, ReviewConfig, VerifyConfig } from './config.js';
import { runInit, runIterate } from './init.js';
import { run } from './loop.js';
import { runPlan } from './plan.js';
import { askForPrompt, askYesNo } from './prompt.js';
import { createSession, getSessionPath } from './session.js';

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
 *
 * When `sessionId` is provided, `--session-id <id>` is injected into the
 * forwarded argv so the child reuses the parent's session instead of
 * creating a new one.
 */
export function spawnDetached(sessionId?: string): void {
  const args = process.argv.slice(1).filter((a) => a !== '--detach');
  if (sessionId) {
    args.push('--session-id', sessionId);
  }
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    stdio: 'ignore',
    detached: true,
    env: { ...process.env, RALPH_DETACHED: '1' },
  });
  child.unref();
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
    spawnDetached(sessionId);
    console.log(chalk.green('Detached — running in the background.'));
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
