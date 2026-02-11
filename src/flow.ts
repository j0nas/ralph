import chalk from 'chalk';
import type { ReviewConfig, VerifyConfig } from './config.js';
import { runInit, runIterate } from './init.js';
import { run } from './loop.js';
import { runPlan } from './plan.js';
import { askForPrompt, askYesNo } from './prompt.js';
import { createSession, getSessionPath } from './session.js';

export interface FlowOptions {
  maxIterations: number;
  review?: ReviewConfig;
  verify?: VerifyConfig;
}

export interface RunOptions {
  task: string;
  maxIterations: number;
  review?: ReviewConfig;
  verify?: VerifyConfig;
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
  });
}

export async function runNonInteractive(options: RunOptions): Promise<number> {
  // 1. Create session directly with the provided task
  const sessionId = await createSession(options.task);
  const sessionPath = getSessionPath(sessionId);

  console.log(chalk.cyan(`\nCreated session: ${chalk.bold(sessionId)}`));
  console.log(chalk.dim(`Session file: ${sessionPath}\n`));

  // 2. Plan phase - break down into steps
  await runPlan({ sessionId });

  // 3. Execute loop - work through tasks
  return await run({
    sessionId,
    maxIterations: options.maxIterations,
    review: options.review,
    verify: options.verify,
  });
}
