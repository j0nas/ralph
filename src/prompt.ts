import { readFile } from 'node:fs/promises';
import type { Config } from './config.js';
import { exists } from './fs.js';

export async function build(config: Config): Promise<string> {
  let prompt = await readFile(config.promptFile, 'utf-8');

  if (await exists(config.progressFile)) {
    const progress = await readFile(config.progressFile, 'utf-8');
    prompt += `\n\n---\n\n## Current Progress (from previous iterations)\n\n${progress}`;
  }

  prompt += `\n\n---\n\n## Important Instructions

After making progress, update \`${config.progressFile}\` with:
- What you accomplished this iteration
- What remains to be done
- Set \`## Status: DONE\` when fully complete
- Set \`## Status: BLOCKED\` if you need human help`;

  return prompt;
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
