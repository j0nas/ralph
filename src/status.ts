import { parseFrontMatter, readSession, sessionExists } from './session.js';

export type Status = 'done' | 'blocked' | 'continue';

export async function checkStatus(sessionId: string): Promise<Status> {
  if (!(await sessionExists(sessionId))) return 'continue';

  const content = await readSession(sessionId);

  const frontMatter = parseFrontMatter(content);
  if (frontMatter?.stage === 'done') return 'done';
  if (frontMatter?.stage === 'blocked') return 'blocked';
  return 'continue';
}
