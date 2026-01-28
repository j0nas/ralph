#!/usr/bin/env node

import { program } from 'commander';
import { runFlow } from './flow.js';
import { ensureClaudeInstalled } from './fs.js';
import { runList } from './list.js';
import { runResume } from './resume.js';

program
  .name('ralph')
  .description('Claude Code in a loop with fresh context per iteration')
  .version('1.0.0');

// Default command (runs the full flow)
program
  .command('start', { isDefault: true })
  .description('Start a new ralph session (default)')
  .option('-m, --max-iterations <n>', 'Max iterations', '50')
  .action(async (opts) => {
    ensureClaudeInstalled();
    process.exit(
      await runFlow({
        maxIterations: parseInt(opts.maxIterations, 10),
      }),
    );
  });

// Resume command
program
  .command('resume <id> [message]')
  .description('Resume a blocked or interrupted session')
  .option('-m, --max-iterations <n>', 'Max iterations', '50')
  .action(async (id, message, opts) => {
    ensureClaudeInstalled();
    process.exit(
      await runResume({
        sessionId: id,
        maxIterations: parseInt(opts.maxIterations, 10),
        message,
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
