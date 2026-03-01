import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Resolve the absolute path to the agents/ directory (project root). */
const __dirname = join(fileURLToPath(import.meta.url), '..');
export const agentsDir = join(__dirname, '..', '..', 'agents');

const promptCache = new Map<string, string>();

/**
 * Load an agent prompt from agents/*.md, stripping YAML frontmatter.
 * Results are cached in memory.
 */
export async function loadAgentPrompt(filename: string): Promise<string> {
  const cached = promptCache.get(filename);
  if (cached) return cached;

  const content = await readFile(join(agentsDir, filename), 'utf-8');
  const stripped = content.replace(/^---\n[\s\S]*?\n---\n*/, '').trim();
  promptCache.set(filename, stripped);
  return stripped;
}

/**
 * Parse the last VERDICT line from reviewer/verifier output.
 */
export function parseVerdict(output: string): boolean {
  const verdictMatch = output.match(/## VERDICT:\s*(PASS|FAIL)/gi);
  if (!verdictMatch) return false;
  const last = verdictMatch[verdictMatch.length - 1];
  return /PASS/i.test(last);
}
