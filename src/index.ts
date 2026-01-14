#!/usr/bin/env node

import { createInterface } from 'node:readline';
import chalk from 'chalk';
import { program } from 'commander';
import { type RalphConfig, runLoop } from './ralph.js';
import { fileExists } from './utils.js';

async function promptConfirm(message: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

async function checkPrereqs(promptFile: string): Promise<void> {
  // Check if claude command exists
  const { execaSync } = await import('execa');
  try {
    execaSync('which', ['claude']);
  } catch {
    console.error(
      chalk.red(
        "Error: 'claude' command not found. Install Claude Code first.",
      ),
    );
    process.exit(1);
  }

  // Check if prompt file exists
  if (!(await fileExists(promptFile))) {
    console.error(chalk.red(`Error: Prompt file '${promptFile}' not found.`));
    console.error('Create a PROMPT.md file with your task definition.');
    process.exit(1);
  }
}

program
  .name('ralph')
  .description('Run Claude Code in a loop with fresh context per iteration')
  .version('1.0.0')
  .option('-p, --prompt <file>', 'Path to prompt file', 'PROMPT.md')
  .option('-d, --progress <file>', 'Progress file path', 'progress.md')
  .option('-m, --max-iterations <n>', 'Maximum iterations', '10')
  .option('-y, --yes', 'Skip confirmation prompt', false)
  .action(async (options) => {
    const config: RalphConfig = {
      promptFile: options.prompt,
      progressFile: options.progress,
      maxIterations: parseInt(options.maxIterations, 10),
      skipConfirm: options.yes,
    };

    await checkPrereqs(config.promptFile);

    // Confirmation prompt
    if (!config.skipConfirm) {
      const confirmed = await promptConfirm('Start the loop?');
      if (!confirmed) {
        console.log('Aborted.');
        process.exit(0);
      }
    }

    const exitCode = await runLoop(config);
    process.exit(exitCode);
  });

program.parse();
