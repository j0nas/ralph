#!/usr/bin/env node

import { createInterface } from 'node:readline';
import chalk from 'chalk';
import { program } from 'commander';
import which from 'which';
import type { Config } from './config.js';
import { exists } from './fs.js';
import { runInit, runIterate } from './init.js';
import { run } from './loop.js';
import { runPlan } from './plan.js';

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

program
  .command('init')
  .description('Generate a PROMPT.md file through conversation with Claude')
  .argument('[prompt]', 'Initial description of your task')
  .option('-o, --output <file>', 'Output file path', 'PROMPT.md')
  .option('-f, --force', 'Overwrite existing file')
  .option(
    '-i, --iterate',
    'Refine an existing PROMPT.md by analyzing gaps and asking clarifying questions',
  )
  .option(
    '-n, --count <number>',
    'Number of iteration passes to run (use with --iterate)',
    '1',
  )
  .action(
    async (
      prompt: string | undefined,
      opts: {
        output: string;
        force?: boolean;
        iterate?: boolean;
        count: string;
      },
    ) => {
      if (opts.iterate) {
        // If no PROMPT.md exists, run standard init first
        if (!(await exists(opts.output))) {
          if (!prompt) {
            console.error(
              chalk.red(
                `Error: No ${opts.output} found. Provide a task description to create one first.`,
              ),
            );
            console.error(
              chalk.yellow(
                `Usage: ralph init --iterate "your task description"`,
              ),
            );
            process.exit(1);
          }
          console.log(
            chalk.cyan(`No ${opts.output} found. Creating one first...\n`),
          );
          await runInit(prompt, { output: opts.output, force: opts.force });
        }
        // Now run the iterate refinement
        await runIterate({
          output: opts.output,
          force: opts.force,
          count: parseInt(opts.count, 10),
        });
      } else {
        // Standard init flow - prompt is required
        if (!prompt) {
          console.error(chalk.red('Error: Please provide a task description.'));
          console.error(
            chalk.yellow('Usage: ralph init "your task description"'),
          );
          process.exit(1);
        }
        await runInit(prompt, opts);
      }
    },
  );

program
  .command('plan')
  .description('Break down PROMPT.md into tasks in progress.md')
  .option('-p, --prompt <file>', 'Prompt file to read', 'PROMPT.md')
  .option('-o, --output <file>', 'Output file path', 'progress.md')
  .option('-f, --force', 'Overwrite existing file')
  .action(async (opts: { prompt: string; output: string; force?: boolean }) => {
    await runPlan(opts);
  });

program.parse();
