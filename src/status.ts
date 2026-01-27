import { readSession, sessionExists } from './session.js';

export type Status = 'done' | 'blocked' | 'continue';

export async function checkStatus(sessionId: string): Promise<Status> {
  if (!(await sessionExists(sessionId))) return 'continue';

  const content = await readSession(sessionId);
  if (content.includes('## Status: DONE')) return 'done';
  if (content.includes('## Status: BLOCKED')) return 'blocked';
  return 'continue';
}
