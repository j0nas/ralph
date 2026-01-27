import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exists } from './fs.js';

export function getSessionDir(): string {
  return join(tmpdir(), 'ralph');
}

export function getSessionPath(id: string): string {
  return join(getSessionDir(), `session-${id}.md`);
}

export function generateSessionId(): string {
  return randomBytes(4).toString('hex');
}

async function ensureSessionDir(): Promise<void> {
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
