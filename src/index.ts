#!/usr/bin/env node

import { program } from 'commander';
import { runFlow } from './flow.js';
import { ensureClaudeInstalled } from './fs.js';

program
  .name('ralph')
  .description('Claude Code in a loop with fresh context per iteration')
  .version('1.0.0')
  .option('-m, --max-iterations <n>', 'Max iterations', '50')
  .action(async (opts) => {
    ensureClaudeInstalled();
    process.exit(
      await runFlow({
        maxIterations: parseInt(opts.maxIterations, 10),
      }),
    );
  });

program.parse();
