import { readFile } from 'node:fs/promises';
import type { Config } from './config.js';
import { exists } from './fs.js';

export async function build(config: Config): Promise<string> {
  const task = await readFile(config.promptFile, 'utf-8');
  const hasProgress = await exists(config.progressFile);
  const progress = hasProgress
    ? await readFile(config.progressFile, 'utf-8')
    : null;

  return `<task>
${task}
</task>

<context>
You are working on a multi-iteration task. Each iteration starts with a fresh context window to avoid context degradation. Your work persists through the filesystem, particularly \`${config.progressFile}\`.

${
  progress
    ? `This is a continuation. Review your previous progress below and continue from where you left off.

<previous_progress>
${progress}
</previous_progress>`
    : 'This is the first iteration. Start by understanding the task and making initial progress.'
}
</context>

<instructions>
Work autonomously and make meaningful progress each iteration. Before finishing:

1. Update \`${config.progressFile}\` with your progress using this structure:
   - **Completed**: What you accomplished this iteration
   - **Remaining**: Concrete next steps for future iterations
   - **Status**: One of IN_PROGRESS, DONE, or BLOCKED

2. Set the status header to signal completion:
   - \`## Status: DONE\` when the task is fully complete and verified
   - \`## Status: BLOCKED\` when you need human input to proceed
   - \`## Status: IN_PROGRESS\` otherwise (default)

Updating progress is critical because future iterations rely on this file to understand state. Be specific about what was done and what remains.
</instructions>`;
}

export async function checkStatus(
  config: Config,
): Promise<'done' | 'blocked' | 'continue'> {
  if (!(await exists(config.progressFile))) return 'continue';

  const content = await readFile(config.progressFile, 'utf-8');
  if (content.includes('## Status: DONE')) return 'done';
  if (content.includes('## Status: BLOCKED')) return 'blocked';
  return 'continue';
}
