import chalk from 'chalk';
import type { CallbackHooks, ReviewConfig, VerifyConfig } from '../config.js';
import { spawnDetached } from '../infra/detach.js';
import {
  getSessionLogPath,
  getSessionWorkingDirectory,
  parseFrontMatter,
  readSession,
  sessionExists,
} from '../infra/session.js';
import { run } from '../pipeline/loop.js';

export interface ResumeOptions {
  sessionId: string;
  maxIterations: number;
  message?: string;
  review?: ReviewConfig;
  verify?: VerifyConfig;
  hooks?: CallbackHooks;
  detach?: boolean;
}

export async function runResume(options: ResumeOptions): Promise<number> {
  const { sessionId, maxIterations, message, review, verify, hooks } = options;

  // Check if session exists
  if (!(await sessionExists(sessionId))) {
    console.error(chalk.red(`Error: Session '${sessionId}' not found.`));
    console.error(chalk.dim('Use `ralph list` to see available sessions.'));
    return 1;
  }

  // Read session content to check status
  const content = await readSession(sessionId);

  // Check if session has been planned
  const frontMatter = parseFrontMatter(content);

  if (!frontMatter || frontMatter.stage === 'initialized') {
    console.error(
      chalk.red(`Error: Session '${sessionId}' has not been planned yet.`),
    );
    console.error(
      chalk.dim('Sessions must go through the planning phase before resuming.'),
    );
    return 1;
  }

  // Warn if working directory differs
  const sessionDir = getSessionWorkingDirectory(content);
  const currentDir = process.cwd();
  if (sessionDir && sessionDir !== currentDir) {
    console.log(chalk.yellow('Warning: Working directory mismatch'));
    console.log(chalk.dim(`  Session created in: ${sessionDir}`));
    console.log(chalk.dim(`  Current directory:  ${currentDir}`));
    console.log('');
  }

  // If detach requested, re-spawn in background and exit
  if (options.detach) {
    // No injectSessionId needed — the session ID is already in argv as a
    // positional arg (`resume <id>`), so the child naturally reuses it.
    spawnDetached(sessionId);
    const logPath = getSessionLogPath(sessionId);
    console.log(
      chalk.green(
        `Detached session ${chalk.bold(sessionId)} — running in the background.`,
      ),
    );
    console.log(chalk.dim(`Log file: ${logPath}`));
    return 0;
  }

  return run({ sessionId, maxIterations, message, review, verify, hooks });
}
