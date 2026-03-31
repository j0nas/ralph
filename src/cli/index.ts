#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { type Command, Option, program } from 'commander';
import type { CallbackHooks, ReviewConfig, VerifyConfig } from '../config.js';
import { ensureClaudeInstalled, exists } from '../infra/fs.js';
import { runFlow, runNonInteractive } from '../pipeline/flow.js';
import { runGoalMode } from '../pipeline/goal.js';
import { runList } from './list.js';
import { runLog } from './log.js';
import { runResume } from './resume.js';
import { runStop } from './stop.js';

const DEFAULT_VERIFY: VerifyConfig = { trigger: 'done', maxAttempts: 5 };
const DEFAULT_REVIEW: ReviewConfig = { trigger: 'done', maxAttempts: 5 };

function getVersion(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return `1.0.0 (${sha})`;
  } catch {
    return '1.0.0';
  }
}

program
  .name('ralph')
  .description('Claude Code in a loop with fresh context per iteration')
  .version(getVersion());

function addHookOptions(cmd: Command): Command {
  return cmd
    .option('--on-done <command>', 'Shell command to run when task completes')
    .option(
      '--on-blocked <command>',
      'Shell command to run when task is blocked',
    )
    .option(
      '--on-progress <command>',
      'Shell command to run after each build iteration',
    );
}

function parseHooks(opts: {
  onDone?: string;
  onBlocked?: string;
  onProgress?: string;
}): CallbackHooks | undefined {
  const hooks: CallbackHooks = {};
  if (opts.onDone) hooks.onDone = opts.onDone;
  if (opts.onBlocked) hooks.onBlocked = opts.onBlocked;
  if (opts.onProgress) hooks.onProgress = opts.onProgress;
  return Object.keys(hooks).length > 0 ? hooks : undefined;
}

// Default command (runs the full flow)
addHookOptions(
  program
    .command('start', { isDefault: true })
    .description('Start a new ralph session (default)')
    .option('-m, --max-iterations <n>', 'Max iterations', '500')
    .option('--no-verify', 'Disable automatic verification and code review')
    .option('--no-review', 'Disable code review only'),
).action(async (opts) => {
  ensureClaudeInstalled();
  const verify = opts.verify === false ? undefined : DEFAULT_VERIFY;
  const review =
    opts.verify === false || opts.review === false ? undefined : DEFAULT_REVIEW;
  process.exit(
    await runFlow({
      maxIterations: parseInt(opts.maxIterations, 10),
      review,
      verify,
      hooks: parseHooks(opts),
    }),
  );
});

// Run command (non-interactive)
addHookOptions(
  program
    .command('run <task>')
    .description('Run a task non-interactively (no init/refine phases)')
    .option('-m, --max-iterations <n>', 'Max iterations', '500')
    .option('--no-verify', 'Disable automatic verification and code review')
    .option('--no-review', 'Disable code review only')
    .option('--detach', 'Run in the background (detached mode)')
    .addOption(new Option('--session-id <id>').hideHelp()),
).action(async (task, opts) => {
  ensureClaudeInstalled();

  // Resolve task: if it's a path to an existing .md file, read it
  let taskContent = task;
  if (task.endsWith('.md') && (await exists(task))) {
    taskContent = await readFile(task, 'utf-8');
  }

  const verify = opts.verify === false ? undefined : DEFAULT_VERIFY;
  const review =
    opts.verify === false || opts.review === false ? undefined : DEFAULT_REVIEW;
  process.exit(
    await runNonInteractive({
      task: taskContent,
      maxIterations: parseInt(opts.maxIterations, 10),
      review,
      verify,
      hooks: parseHooks(opts),
      detach: opts.detach,
      sessionId: opts.sessionId,
    }),
  );
});

// Resume command
addHookOptions(
  program
    .command('resume <id> [message]')
    .description('Resume a blocked or interrupted session')
    .option('-m, --max-iterations <n>', 'Max iterations', '500')
    .option('--no-verify', 'Disable automatic verification and code review')
    .option('--no-review', 'Disable code review only')
    .option('--detach', 'Run in the background (detached mode)'),
).action(async (id, message, opts) => {
  ensureClaudeInstalled();
  const verify = opts.verify === false ? undefined : DEFAULT_VERIFY;
  const review =
    opts.verify === false || opts.review === false ? undefined : DEFAULT_REVIEW;
  process.exit(
    await runResume({
      sessionId: id,
      maxIterations: parseInt(opts.maxIterations, 10),
      message,
      review,
      verify,
      hooks: parseHooks(opts),
      detach: opts.detach,
    }),
  );
});

// Goal command (autonomous, open-ended)
addHookOptions(
  program
    .command('goal <goal>')
    .description(
      'Run autonomously toward an open-ended goal (loops until stopped)',
    )
    .option('--detach', 'Run in the background (detached mode)')
    .addOption(new Option('--session-id <id>').hideHelp()),
).action(async (goal, opts) => {
  ensureClaudeInstalled();

  // Resolve goal: if it's a path to an existing .md file, read it
  let goalContent = goal;
  if (goal.endsWith('.md') && (await exists(goal))) {
    goalContent = await readFile(goal, 'utf-8');
  }

  process.exit(
    await runGoalMode({
      goal: goalContent,
      hooks: parseHooks(opts),
      detach: opts.detach,
      sessionId: opts.sessionId,
    }),
  );
});

// Stop command (graceful stop for goal sessions)
program
  .command('stop <id>')
  .description('Gracefully stop a running goal session')
  .action(async (id) => {
    process.exit(await runStop(id));
  });

// List command
program
  .command('list')
  .description('List all sessions')
  .action(async () => {
    await runList();
  });

// Log command
program
  .command('log <id>')
  .description('Open a session log in your editor')
  .action(async (id) => {
    await runLog(id);
  });

program.parse();
