import chalk from 'chalk';
import { listSessions, type SessionInfo } from './session.js';

function formatStatus(status: SessionInfo['status']): string {
  switch (status) {
    case 'DONE':
      return chalk.green('DONE');
    case 'BLOCKED':
      return chalk.yellow('BLOCKED');
    case 'IN_PROGRESS':
      return chalk.blue('IN_PROGRESS');
    case 'NOT_PLANNED':
      return chalk.dim('NOT_PLANNED');
  }
}

function formatDate(isoDate: string): string {
  if (isoDate === 'unknown') return isoDate;
  try {
    const date = new Date(isoDate);
    return date.toLocaleString();
  } catch {
    return isoDate;
  }
}

function truncatePath(path: string, maxLen: number): string {
  if (path.length <= maxLen) return path;
  return `...${path.slice(-(maxLen - 3))}`;
}

export async function runList(): Promise<void> {
  const sessions = await listSessions();

  if (sessions.length === 0) {
    console.log(chalk.dim('No sessions found.'));
    return;
  }

  console.log(chalk.bold('\nSessions:\n'));

  // Column widths
  const idWidth = 10;
  const statusWidth = 14;
  const dateWidth = 22;

  // Header
  const header =
    chalk.dim('ID'.padEnd(idWidth)) +
    chalk.dim('Status'.padEnd(statusWidth)) +
    chalk.dim('Created'.padEnd(dateWidth)) +
    chalk.dim('Working Directory');
  console.log(header);
  console.log(chalk.dim('─'.repeat(80)));

  for (const session of sessions) {
    const id = session.id.padEnd(idWidth);
    const status = formatStatus(session.status).padEnd(statusWidth + 10); // Extra for ANSI codes
    const date = formatDate(session.created).padEnd(dateWidth);
    const dir = truncatePath(session.workingDirectory, 30);

    console.log(`${id}${status}${date}${chalk.dim(dir)}`);
  }

  console.log(
    chalk.dim(
      `\n${sessions.length} session(s) found. Resume with: ralph resume <id>`,
    ),
  );
}
