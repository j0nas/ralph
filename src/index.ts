#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { program } from 'commander';
import type { ReviewConfig, VerifyConfig } from './config.js';
import { runFlow, runNonInteractive } from './flow.js';
import { ensureClaudeInstalled, exists } from './fs.js';
import { runList } from './list.js';
import { runResume } from './resume.js';

const DEFAULT_VERIFY: VerifyConfig = { trigger: 'done', maxAttempts: 3 };
const DEFAULT_REVIEW: ReviewConfig = { trigger: 'done', maxAttempts: 2 };

program
  .name('ralph')
  .description('Claude Code in a loop with fresh context per iteration')
  .version('1.0.0');

// Default command (runs the full flow)
program
  .command('start', { isDefault: true })
  .description('Start a new ralph session (default)')
  .option('-m, --max-iterations <n>', 'Max iterations', '500')
  .option('--no-verify', 'Disable automatic verification and code review')
  .option('--no-review', 'Disable code review only')
  .action(async (opts) => {
    ensureClaudeInstalled();
    const verify = opts.verify === false ? undefined : DEFAULT_VERIFY;
    const review =
      opts.verify === false || opts.review === false
        ? undefined
        : DEFAULT_REVIEW;
    process.exit(
      await runFlow({
        maxIterations: parseInt(opts.maxIterations, 10),
        review,
        verify,
      }),
    );
  });

// Run command (non-interactive)
program
  .command('run <task>')
  .description('Run a task non-interactively (no init/refine phases)')
  .option('-m, --max-iterations <n>', 'Max iterations', '500')
  .option('--no-verify', 'Disable automatic verification and code review')
  .option('--no-review', 'Disable code review only')
  .action(async (task, opts) => {
    ensureClaudeInstalled();

    // Resolve task: if it's a path to an existing .md file, read it
    let taskContent = task;
    if (task.endsWith('.md') && (await exists(task))) {
      taskContent = await readFile(task, 'utf-8');
    }

    const verify = opts.verify === false ? undefined : DEFAULT_VERIFY;
    const review =
      opts.verify === false || opts.review === false
        ? undefined
        : DEFAULT_REVIEW;
    process.exit(
      await runNonInteractive({
        task: taskContent,
        maxIterations: parseInt(opts.maxIterations, 10),
        review,
        verify,
      }),
    );
  });

// Resume command
program
  .command('resume <id> [message]')
  .description('Resume a blocked or interrupted session')
  .option('-m, --max-iterations <n>', 'Max iterations', '500')
  .option('--no-verify', 'Disable automatic verification and code review')
  .option('--no-review', 'Disable code review only')
  .action(async (id, message, opts) => {
    ensureClaudeInstalled();
    const verify = opts.verify === false ? undefined : DEFAULT_VERIFY;
    const review =
      opts.verify === false || opts.review === false
        ? undefined
        : DEFAULT_REVIEW;
    process.exit(
      await runResume({
        sessionId: id,
        maxIterations: parseInt(opts.maxIterations, 10),
        message,
        review,
        verify,
      }),
    );
  });

// List command
program
  .command('list')
  .description('List all sessions')
  .action(async () => {
    await runList();
  });

program.parse();
