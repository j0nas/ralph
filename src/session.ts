import { randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import chalk from 'chalk';
import { exists } from './fs.js';

export interface Session {
  id: string;
  workingDirectory: string;
  createdAt: Date;
}

export function getSessionDir(): string {
  return join(tmpdir(), 'ralph');
}

export function getSessionPath(id: string): string {
  return join(getSessionDir(), `session-${id}.md`);
}

export function generateSessionId(): string {
  return randomBytes(4).toString('hex');
}

export async function ensureSessionDir(): Promise<void> {
  const dir = getSessionDir();
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
}

export async function createSession(
  taskContent: string,
  customId?: string,
): Promise<string> {
  await ensureSessionDir();

  const id = customId || generateSessionId();
  const path = getSessionPath(id);

  if (await exists(path)) {
    throw new Error(`Session '${id}' already exists`);
  }

  const timestamp = new Date().toISOString();
  const cwd = process.cwd();

  const content = `# Session: ${id}
Created: ${timestamp}
Working Directory: ${cwd}

## Task
${taskContent}
`;

  await writeFile(path, content, 'utf-8');
  return id;
}

export async function readSession(id: string): Promise<string> {
  const path = getSessionPath(id);
  if (!(await exists(path))) {
    throw new Error(`Session '${id}' not found`);
  }
  return readFile(path, 'utf-8');
}

export async function sessionExists(id: string): Promise<boolean> {
  return exists(getSessionPath(id));
}

export async function listSessions(): Promise<Session[]> {
  const dir = getSessionDir();
  if (!(await exists(dir))) {
    return [];
  }

  const files = await readdir(dir);
  const sessions: Session[] = [];

  for (const file of files) {
    const match = file.match(/^session-(.+)\.md$/);
    if (match) {
      const id = match[1];
      try {
        const content = await readFile(join(dir, file), 'utf-8');
        const cwdMatch = content.match(/^Working Directory: (.+)$/m);
        const createdMatch = content.match(/^Created: (.+)$/m);

        sessions.push({
          id,
          workingDirectory: cwdMatch?.[1] || 'unknown',
          createdAt: createdMatch?.[1] ? new Date(createdMatch[1]) : new Date(),
        });
      } catch {
        // Skip files we can't read
      }
    }
  }

  return sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function deleteSession(id: string): Promise<void> {
  const path = getSessionPath(id);
  if (await exists(path)) {
    await rm(path);
  }
}

export async function deleteAllSessions(): Promise<number> {
  const sessions = await listSessions();
  for (const session of sessions) {
    await deleteSession(session.id);
  }
  return sessions.length;
}

export async function resolveSessionId(providedId?: string): Promise<string> {
  if (providedId) {
    if (!(await sessionExists(providedId))) {
      console.error(chalk.red(`Error: Session '${providedId}' not found.`));
      process.exit(1);
    }
    return providedId;
  }

  const sessions = await listSessions();

  if (sessions.length === 0) {
    console.error(chalk.red('Error: No active sessions.'));
    console.error(
      chalk.yellow('Run \'ralph init "your task"\' to create one.'),
    );
    process.exit(1);
  }

  if (sessions.length === 1) {
    return sessions[0].id;
  }

  console.error(
    chalk.red('Error: Multiple sessions found. Specify a session ID.'),
  );
  console.error(chalk.yellow('\nActive sessions:'));
  for (const session of sessions) {
    console.error(
      chalk.dim(
        `  ${session.id} - ${session.workingDirectory} (${session.createdAt.toLocaleString()})`,
      ),
    );
  }
  process.exit(1);
}

export async function appendToSession(
  id: string,
  content: string,
): Promise<void> {
  const path = getSessionPath(id);
  const existing = await readSession(id);
  await writeFile(path, existing + content, 'utf-8');
}
