import chalk from 'chalk';
import { run } from './loop.js';
import {
  getSessionWorkingDirectory,
  readSession,
  sessionExists,
} from './session.js';
import { checkStatus } from './status.js';

export interface ResumeOptions {
  sessionId: string;
  maxIterations: number;
}

export async function runResume(options: ResumeOptions): Promise<number> {
  const { sessionId, maxIterations } = options;

  // Check if session exists
  if (!(await sessionExists(sessionId))) {
    console.error(chalk.red(`Error: Session '${sessionId}' not found.`));
    console.error(chalk.dim('Use `ralph list` to see available sessions.'));
    return 1;
  }

  // Read session content to check status
  const content = await readSession(sessionId);

  // Check if session has a status marker (meaning it's been planned)
  const hasStatus =
    content.includes('## Status: DONE') ||
    content.includes('## Status: BLOCKED') ||
    content.includes('## Status: IN_PROGRESS');

  if (!hasStatus) {
    console.error(
      chalk.red(`Error: Session '${sessionId}' has not been planned yet.`),
    );
    console.error(
      chalk.dim('Sessions must go through the planning phase before resuming.'),
    );
    return 1;
  }

  // Check current status
  const status = await checkStatus(sessionId);

  if (status === 'done') {
    console.log(chalk.green(`Session '${sessionId}' is already completed.`));
    return 0;
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

  // Resume the execution loop
  return run({ sessionId, maxIterations });
}
