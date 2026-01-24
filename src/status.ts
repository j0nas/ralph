import { readFile } from 'node:fs/promises';
import { exists } from './fs.js';

export type Status = 'done' | 'blocked' | 'continue';

export async function checkStatus(filePath: string): Promise<Status> {
  if (!(await exists(filePath))) return 'continue';

  const content = await readFile(filePath, 'utf-8');
  if (content.includes('## Status: DONE')) return 'done';
  if (content.includes('## Status: BLOCKED')) return 'blocked';
  return 'continue';
}
