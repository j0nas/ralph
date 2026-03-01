import chalk from 'chalk';
import type { CallbackHooks, ReviewConfig, VerifyConfig } from '../config.js';
import { spawnDetached } from '../infra/detach.js';
import {
  createSession,
  generateSessionSlug,
  getSessionLogPath,
  getSessionPath,
} from '../infra/session.js';
import { askForPrompt, askYesNo } from '../ui/prompt.js';
import { runInit, runIterate } from './init.js';
import { run } from './loop.js';
import { runPlan } from './plan.js';

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

export async function runNonInteractive(options: RunOptions): Promise<number> {
  // 1. Reuse an existing session (detached child) or create a new one
  let sessionId: string;
  if (options.sessionId) {
    sessionId = options.sessionId;
  } else {
    const slug = await generateSessionSlug(options.task);
    sessionId = await createSession(options.task, slug);
  }
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
