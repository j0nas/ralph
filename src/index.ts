#!/usr/bin/env node

import { unlink } from 'node:fs/promises';
import chalk from 'chalk';
import { program } from 'commander';
import which from 'which';
import type { Config } from './config.js';
import { exists } from './fs.js';
import { runInit, runIterate } from './init.js';
import { run } from './loop.js';
import { runPlan } from './plan.js';

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
  .option('-m, --max-iterations <n>', 'Max iterations', '50')
  .action(async (opts) => {
    const config: Config = {
      promptFile: opts.prompt,
      progressFile: opts.progress,
      maxIterations: parseInt(opts.maxIterations, 10),
    };

    await checkPrereqs(config.promptFile);
    process.exit(await run(config));
  });

program
  .command('init')
  .description('Generate a PROMPT.md file through conversation with Claude')
  .argument('[prompt]', 'Initial description of your task')
  .option('-o, --output <file>', 'Output file path', 'PROMPT.md')
  .option('-f, --force', 'Overwrite existing file')
  .option(
    '-i, --iterate [count]',
    'Refine an existing PROMPT.md (optionally specify number of passes, default: 1)',
  )
  .action(
    async (
      prompt: string | undefined,
      opts: {
        output: string;
        force?: boolean;
        iterate?: boolean | string;
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
        // opts.iterate is true (flag only) or a string (with count)
        const count =
          typeof opts.iterate === 'string' ? parseInt(opts.iterate, 10) : 1;
        await runIterate({
          output: opts.output,
          force: opts.force,
          count,
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

program
  .command('clear')
  .description('Delete PROMPT.md and progress.md to reset Ralph loop state')
  .option('-p, --prompt <file>', 'Prompt file to delete', 'PROMPT.md')
  .option('-d, --progress <file>', 'Progress file to delete', 'progress.md')
  .action(async (_opts, cmd) => {
    const opts = cmd.optsWithGlobals() as { prompt: string; progress: string };
    const deleted: string[] = [];
    const missing: string[] = [];

    // Delete prompt file
    if (await exists(opts.prompt)) {
      await unlink(opts.prompt);
      deleted.push(opts.prompt);
    } else {
      missing.push(opts.prompt);
    }

    // Delete progress file
    if (await exists(opts.progress)) {
      await unlink(opts.progress);
      deleted.push(opts.progress);
    } else {
      missing.push(opts.progress);
    }

    // Print feedback
    if (deleted.length > 0) {
      console.log(chalk.green(`Deleted: ${deleted.join(', ')}`));
    }
    if (missing.length > 0) {
      console.log(chalk.dim(`Already missing: ${missing.join(', ')}`));
    }
    if (deleted.length === 0 && missing.length > 0) {
      console.log(chalk.yellow('Nothing to clear.'));
    }
  });

program.parse();
