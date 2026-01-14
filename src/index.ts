#!/usr/bin/env node

import { createInterface } from 'node:readline';
import chalk from 'chalk';
import { program } from 'commander';
import which from 'which';
import type { Config } from './config.js';
import { exists } from './fs.js';
import { run } from './loop.js';

const confirm = (msg: string): Promise<boolean> =>
  new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(`${msg} [y/N] `, (a) => {
      rl.close();
      resolve(a.toLowerCase() === 'y');
    });
  });

async function checkPrereqs(promptFile: string): Promise<void> {
  if (!which.sync('claude', { nothrow: true })) {
    console.error(
      chalk.red("Error: 'claude' not found. Install Claude Code first."),
    );
    process.exit(1);
  }
  if (!(await exists(promptFile))) {
    console.error(chalk.red(`Error: '${promptFile}' not found.`));
    process.exit(1);
  }
}

program
  .name('ralph')
  .description('Claude Code in a loop with fresh context per iteration')
  .version('1.0.0')
  .option('-p, --prompt <file>', 'Prompt file', 'PROMPT.md')
  .option('-d, --progress <file>', 'Progress file', 'progress.md')
  .option('-m, --max-iterations <n>', 'Max iterations', '10')
  .option('-y, --yes', 'Skip confirmation', false)
  .action(async (opts) => {
    const config: Config = {
      promptFile: opts.prompt,
      progressFile: opts.progress,
      maxIterations: parseInt(opts.maxIterations, 10),
      skipConfirm: opts.yes,
    };

    await checkPrereqs(config.promptFile);
    if (!config.skipConfirm && !(await confirm('Start the loop?'))) {
      console.log('Aborted.');
      process.exit(0);
    }

    process.exit(await run(config));
  });

program.parse();
