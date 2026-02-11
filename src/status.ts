import { parseFrontMatter, readSession, sessionExists } from './session.js';

export type Status = 'done' | 'blocked' | 'continue';

export async function checkStatus(sessionId: string): Promise<Status> {
  if (!(await sessionExists(sessionId))) return 'continue';

  const content = await readSession(sessionId);

  // Check front matter stage (set by CLI for blocked/done transitions)
  const frontMatter = parseFrontMatter(content);
  if (frontMatter?.stage === 'done') return 'done';
  if (frontMatter?.stage === 'blocked') return 'blocked';

  // Check markdown body ## Status: line (set by developer agent)
  const statusMatch = content.match(/^## Status:\s*(.+)$/m);
  if (statusMatch) {
    const bodyStatus = statusMatch[1].trim().toUpperCase();
    if (bodyStatus === 'DONE') return 'done';
    if (bodyStatus === 'BLOCKED') return 'blocked';
  }

  return 'continue';
}
