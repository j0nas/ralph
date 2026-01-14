import { execa } from 'execa';
import { setTimeout } from 'timers/promises';
import chalk from 'chalk';
import {
  fileExists,
  readFileContent,
  printBanner,
  printConfig,
  printIterationHeader,
  printSuccess,
  printWarning,
  printError,
} from './utils.js';

export interface RalphConfig {
  promptFile: string;
  progressFile: string;
  maxIterations: number;
  cooldown: number;
  skipConfirm: boolean;
}

export const EXIT_CODES = {
  SUCCESS: 0,
  BLOCKED: 1,
  MAX_ITERATIONS: 2,
  INTERRUPTED: 130,
} as const;

async function buildPrompt(config: RalphConfig): Promise<string> {
  let prompt = await readFileContent(config.promptFile);

  // Append progress if it exists
  if (await fileExists(config.progressFile)) {
    const progress = await readFileContent(config.progressFile);
    prompt += '\n\n---\n\n## Current Progress (from previous iterations)\n\n';
    prompt += progress;
  }

  // Add instructions about updating progress
  prompt += '\n\n---\n\n## Important Instructions\n\n';
  prompt += `After making progress, update the \`${config.progressFile}\` file with:`;
  prompt += '\n- What you accomplished this iteration';
  prompt += '\n- What remains to be done';
  prompt += '\n- Set `## Status: DONE` when the task is fully complete';
  prompt += '\n- Set `## Status: BLOCKED` if you need human help';

  return prompt;
}

async function checkStatus(config: RalphConfig): Promise<'done' | 'blocked' | 'continue'> {
  if (!(await fileExists(config.progressFile))) {
    return 'continue';
  }

  const content = await readFileContent(config.progressFile);

  if (content.includes('## Status: DONE')) {
    return 'done';
  }

  if (content.includes('## Status: BLOCKED')) {
    return 'blocked';
  }

  return 'continue';
}

async function runClaudeInstance(prompt: string): Promise<void> {
  const result = await execa('claude', ['--print'], {
    input: prompt,
    stdio: ['pipe', 'inherit', 'inherit'],
  });

  if (result.exitCode !== 0) {
    throw new Error(`Claude exited with code ${result.exitCode}`);
  }
}

export async function runLoop(config: RalphConfig): Promise<number> {
  printBanner();
  printConfig(config);

  // Set up interrupt handler
  let interrupted = false;
  const handleInterrupt = (): void => {
    console.log(chalk.yellow('\nInterrupted. Exiting...'));
    interrupted = true;
    process.exit(EXIT_CODES.INTERRUPTED);
  };

  process.on('SIGINT', handleInterrupt);
  process.on('SIGTERM', handleInterrupt);

  try {
    for (let iteration = 1; iteration <= config.maxIterations; iteration++) {
      if (interrupted) {
        return EXIT_CODES.INTERRUPTED;
      }

      printIterationHeader(iteration, config.maxIterations);

      // Build and send prompt to fresh Claude instance
      const prompt = await buildPrompt(config);
      await runClaudeInstance(prompt);

      // Check for completion
      const status = await checkStatus(config);

      if (status === 'done') {
        printSuccess(`Task completed successfully after ${iteration} iteration(s)!`);
        return EXIT_CODES.SUCCESS;
      }

      if (status === 'blocked') {
        printWarning('Task blocked - human intervention needed');
        printWarning(`Check ${config.progressFile} for details`);
        return EXIT_CODES.BLOCKED;
      }

      // Cooldown before next iteration (skip on last iteration)
      if (iteration < config.maxIterations) {
        console.log('');
        console.log(chalk.yellow(`Cooling down for ${config.cooldown}s before next iteration...`));
        await setTimeout(config.cooldown * 1000);
      }
    }

    // Max iterations reached
    printError(`Max iterations (${config.maxIterations}) reached without completion`);
    printError(`Check ${config.progressFile} to see current progress`);
    return EXIT_CODES.MAX_ITERATIONS;
  } finally {
    process.off('SIGINT', handleInterrupt);
    process.off('SIGTERM', handleInterrupt);
  }
}
