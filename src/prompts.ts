import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = join(fileURLToPath(import.meta.url), '..');

/**
 * Load a prompt template from the prompts/ directory and substitute variables.
 * Variables use {{VARIABLE_NAME}} syntax.
 */
export function loadPrompt(
  name: string,
  variables: Record<string, string> = {},
): string {
  const promptPath = join(__dirname, '..', 'prompts', `${name}.md`);
  let content = readFileSync(promptPath, 'utf-8');

  for (const [key, value] of Object.entries(variables)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }

  return content;
}
