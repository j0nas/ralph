#!/usr/bin/env node

import chalk from 'chalk';
import { program } from 'commander';
import type { Config } from './config.js';
import { ensureClaudeInstalled } from './fs.js';
import { runInit, runIterate } from './init.js';
import { run } from './loop.js';
import { runPlan } from './plan.js';
import {
  deleteAllSessions,
  getSessionPath,
  listSessions,
  readSession,
  resolveSessionId,
} from './session.js';

program
  .name('ralph')
  .description('Claude Code in a loop with fresh context per iteration')
  .version('1.0.0')
  .argument(
    '[session-id]',
    'Session ID to run (auto-detects if only one session)',
  )
  .option('-m, --max-iterations <n>', 'Max iterations', '50')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (sessionIdArg: string | undefined, opts) => {
    ensureClaudeInstalled();

    const sessionId = await resolveSessionId(sessionIdArg);

    // Check if session has been planned
    const content = await readSession(sessionId);
    if (!content.includes('## Status:')) {
      console.error(chalk.red('Error: Session has not been planned yet.'));
      console.error(chalk.yellow(`Run 'ralph plan ${sessionId}' first.`));
      process.exit(1);
    }

    const config: Config = {
      sessionId,
      maxIterations: parseInt(opts.maxIterations, 10),
    };

    process.exit(await run(config));
  });

program
  .command('init')
  .description('Create a new session through conversation with Claude')
  .argument('<prompt>', 'Description of your task')
  .option(
    '-s, --session <name>',
    'Custom session name (otherwise auto-generated)',
  )
  .option(
    '-i, --iterate [count]',
    'Refine an existing session (optionally specify number of passes, default: 1)',
  )
  .action(
    async (
      prompt: string,
      opts: {
        session?: string;
        iterate?: boolean | string;
      },
    ) => {
      if (opts.iterate) {
        // Iterate mode - refine an existing session
        const sessionId = await resolveSessionId(opts.session);
        const count =
          typeof opts.iterate === 'string' ? parseInt(opts.iterate, 10) : 1;
        await runIterate({ sessionId, count });
      } else {
        // Standard init flow
        const sessionId = await runInit(prompt, { session: opts.session });
        console.log(chalk.green(`\nSession created: ${sessionId}`));
        console.log(chalk.dim(`Next: ralph plan ${sessionId}`));
      }
    },
  );

program
  .command('plan')
  .description('Break down a session task into actionable steps')
  .argument(
    '[session-id]',
    'Session ID to plan (auto-detects if only one session)',
  )
  .action(async (sessionIdArg: string | undefined) => {
    const sessionId = await resolveSessionId(sessionIdArg);
    await runPlan({ sessionId });
    console.log(chalk.green(`\nSession planned: ${sessionId}`));
    console.log(chalk.dim(`Next: ralph ${sessionId}`));
  });

program
  .command('sessions')
  .description('List or manage active sessions')
  .option('--clean', 'Delete all sessions')
  .action(async (opts: { clean?: boolean }) => {
    if (opts.clean) {
      const count = await deleteAllSessions();
      if (count > 0) {
        console.log(chalk.green(`Deleted ${count} session(s).`));
      } else {
        console.log(chalk.dim('No sessions to delete.'));
      }
      return;
    }

    const sessions = await listSessions();

    if (sessions.length === 0) {
      console.log(chalk.dim('No active sessions.'));
      console.log(
        chalk.yellow('Run \'ralph init "your task"\' to create one.'),
      );
      return;
    }

    console.log(chalk.cyan(`\nActive sessions (${sessions.length}):\n`));
    for (const session of sessions) {
      const path = getSessionPath(session.id);
      console.log(`  ${chalk.green(session.id)}`);
      console.log(`    Directory: ${session.workingDirectory}`);
      console.log(`    Created:   ${session.createdAt.toLocaleString()}`);
      console.log(`    File:      ${chalk.dim(path)}`);
      console.log();
    }
  });

program.parse();
