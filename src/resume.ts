import chalk from 'chalk';
import { run } from './loop.js';
import {
  getSessionWorkingDirectory,
  parseFrontMatter,
  readSession,
  sessionExists,
} from './session.js';

export interface ResumeOptions {
  sessionId: string;
  maxIterations: number;
  message?: string;
}

export async function runResume(options: ResumeOptions): Promise<number> {
  const { sessionId, maxIterations, message } = options;

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

  // Resume the execution loop
  return run({ sessionId, maxIterations, message });
}
