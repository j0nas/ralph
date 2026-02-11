import { randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exists } from './fs.js';

export type SessionStage =
  | 'initialized'
  | 'planned'
  | 'running'
  | 'reviewing'
  | 'verifying'
  | 'blocked'
  | 'done';

export interface SessionFrontMatter {
  stage: SessionStage;
  iterations: number;
  reviewAttempts?: number;
  verificationAttempts?: number;
}

export interface SessionInfo {
  id: string;
  created: string;
  workingDirectory: string;
  status: 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | 'NOT_PLANNED';
}

export function parseFrontMatter(content: string): SessionFrontMatter | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yaml = match[1];
  const stageMatch = yaml.match(/^stage:\s*(.+)$/m);
  const iterationsMatch = yaml.match(/^iterations:\s*(\d+)$/m);
  const reviewAttemptsMatch = yaml.match(/^reviewAttempts:\s*(\d+)$/m);
  const verifyAttemptsMatch = yaml.match(/^verificationAttempts:\s*(\d+)$/m);

  if (!stageMatch) return null;

  return {
    stage: stageMatch[1] as SessionStage,
    iterations: iterationsMatch ? parseInt(iterationsMatch[1], 10) : 0,
    reviewAttempts: reviewAttemptsMatch
      ? parseInt(reviewAttemptsMatch[1], 10)
      : undefined,
    verificationAttempts: verifyAttemptsMatch
      ? parseInt(verifyAttemptsMatch[1], 10)
      : undefined,
  };
}

function serializeFrontMatter(fm: {
  stage: string;
  iterations: number;
  reviewAttempts?: number;
  verificationAttempts?: number;
}): string {
  let yaml = `---\nstage: ${fm.stage}\niterations: ${fm.iterations}`;
  if (fm.reviewAttempts !== undefined) {
    yaml += `\nreviewAttempts: ${fm.reviewAttempts}`;
  }
  if (fm.verificationAttempts !== undefined) {
    yaml += `\nverificationAttempts: ${fm.verificationAttempts}`;
  }
  yaml += '\n---';
  return yaml;
}

export function updateFrontMatter(
  content: string,
  updates: Partial<SessionFrontMatter>,
): string {
  const existing = parseFrontMatter(content);

  if (!existing) {
    const fm = {
      stage: updates.stage ?? 'initialized',
      iterations: updates.iterations ?? 0,
      reviewAttempts: updates.reviewAttempts,
      verificationAttempts: updates.verificationAttempts,
    };
    return `${serializeFrontMatter(fm)}\n${content}`;
  }

  const fm = {
    stage: updates.stage ?? existing.stage,
    iterations: updates.iterations ?? existing.iterations,
    reviewAttempts: updates.reviewAttempts ?? existing.reviewAttempts,
    verificationAttempts:
      updates.verificationAttempts ?? existing.verificationAttempts,
  };

  return content.replace(/^---\n[\s\S]*?\n---/, serializeFrontMatter(fm));
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

  const content = `---
stage: initialized
iterations: 0
---
# Session: ${id}
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

export async function writeSession(id: string, content: string): Promise<void> {
  const path = getSessionPath(id);
  await writeFile(path, content, 'utf-8');
}

export async function sessionExists(id: string): Promise<boolean> {
  return exists(getSessionPath(id));
}

function parseSessionMetadata(content: string, id: string): SessionInfo {
  const createdMatch = content.match(/^Created:\s*(.+)$/m);
  const workDirMatch = content.match(/^Working Directory:\s*(.+)$/m);

  const frontMatter = parseFrontMatter(content);
  let status: SessionInfo['status'] = 'NOT_PLANNED';

  if (frontMatter) {
    switch (frontMatter.stage) {
      case 'done':
        status = 'DONE';
        break;
      case 'blocked':
        status = 'BLOCKED';
        break;
      case 'running':
      case 'reviewing':
      case 'verifying':
      case 'planned':
        status = 'IN_PROGRESS';
        break;
      default:
        status = 'NOT_PLANNED';
        break;
    }
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

export function extractTaskSummary(content: string): {
  task: string;
  completed: string;
} {
  // Extract ## Task section
  const taskMatch = content.match(
    /\n## Task\n([\s\S]*?)(?=\n## |\n---|\n# |$)/,
  );
  const task = taskMatch?.[1]?.trim() ?? '';

  // Extract ## Completed section
  const completedMatch = content.match(
    /\n## Completed\n([\s\S]*?)(?=\n## |\n---|\n# |$)/,
  );
  const completed = completedMatch?.[1]?.trim() ?? '';

  return { task, completed };
}

export interface VerificationSection {
  mode: 'browser' | 'cli';
  entry: string;
  start?: string;
  stop?: string;
}

export function extractVerificationSection(
  content: string,
): VerificationSection | null {
  const sectionMatch = content.match(
    /\n## Verification\n([\s\S]*?)(?=\n## |\n---|\n# |$)/,
  );
  if (!sectionMatch) return null;

  const section = sectionMatch[1];
  const modeMatch = section.match(/^mode:\s*(.+)$/m);
  const entryMatch = section.match(/^entry:\s*(.+)$/m);
  const startMatch = section.match(/^start:\s*(.+)$/m);
  const stopMatch = section.match(/^stop:\s*(.+)$/m);

  if (!modeMatch) return null;

  const mode = modeMatch[1].trim();
  if (mode !== 'browser' && mode !== 'cli') return null;

  const entry = entryMatch?.[1]?.trim();
  if (!entry) return null;

  return {
    mode,
    entry,
    start: startMatch?.[1]?.trim(),
    stop: stopMatch?.[1]?.trim(),
  };
}
