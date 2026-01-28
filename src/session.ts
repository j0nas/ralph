import { randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exists } from './fs.js';

export interface SessionInfo {
  id: string;
  created: string;
  workingDirectory: string;
  status: 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | 'NOT_PLANNED';
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

function parseSessionMetadata(content: string, id: string): SessionInfo {
  const createdMatch = content.match(/^Created:\s*(.+)$/m);
  const workDirMatch = content.match(/^Working Directory:\s*(.+)$/m);

  let status: SessionInfo['status'] = 'NOT_PLANNED';
  if (content.includes('## Status: DONE')) {
    status = 'DONE';
  } else if (content.includes('## Status: BLOCKED')) {
    status = 'BLOCKED';
  } else if (content.includes('## Status: IN_PROGRESS')) {
    status = 'IN_PROGRESS';
  }

  return {
    id,
    created: createdMatch?.[1] ?? 'unknown',
    workingDirectory: workDirMatch?.[1] ?? 'unknown',
    status,
  };
}

export async function listSessions(): Promise<SessionInfo[]> {
  const dir = getSessionDir();

  if (!(await exists(dir))) {
    return [];
  }

  const files = await readdir(dir);
  const sessionFiles = files.filter(
    (f) => f.startsWith('session-') && f.endsWith('.md'),
  );

  const sessions: SessionInfo[] = [];

  for (const file of sessionFiles) {
    const id = file.replace('session-', '').replace('.md', '');
    const content = await readFile(join(dir, file), 'utf-8');
    sessions.push(parseSessionMetadata(content, id));
  }

  // Sort by creation date (newest first)
  sessions.sort((a, b) => {
    const dateA = new Date(a.created).getTime() || 0;
    const dateB = new Date(b.created).getTime() || 0;
    return dateB - dateA;
  });

  return sessions;
}

export function getSessionWorkingDirectory(content: string): string | null {
  const match = content.match(/^Working Directory:\s*(.+)$/m);
  return match?.[1] ?? null;
}
