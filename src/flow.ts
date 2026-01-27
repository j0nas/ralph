import chalk from 'chalk';
import { runInit, runIterate } from './init.js';
import { run } from './loop.js';
import { runPlan } from './plan.js';
import { askForPrompt, askYesNo } from './prompt.js';

export interface FlowOptions {
  maxIterations: number;
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
  return await run({ sessionId, maxIterations: options.maxIterations });
}
