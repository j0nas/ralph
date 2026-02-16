import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { execa } from 'execa';
import { ensureClaudeInstalled } from './fs.js';
import {
  getSessionPath,
  parseFrontMatter,
  readSession,
  sessionExists,
  updateFrontMatter,
  writeSession,
} from './session.js';

const __dirname = join(fileURLToPath(import.meta.url), '..');

export interface PlanOptions {
  sessionId: string;
}

async function loadPrompt(filename: string): Promise<string> {
  const promptPath = join(__dirname, '..', 'prompts', filename);
  return readFile(promptPath, 'utf-8');
}

async function buildSystemPrompt(sessionId: string): Promise<string> {
  const sessionPath = getSessionPath(sessionId);
  const basePrompt = await loadPrompt('plan.md');
  // Extract the prompt content from the markdown
  const match = basePrompt.match(/```\n([\s\S]*?)```/);
  if (!match) {
    throw new Error('Could not find prompt content in plan.md');
  }
  return match[1]
    .replace('${process.cwd()}', process.cwd())
    .replace('${sessionPath}', sessionPath);
}

export async function runPlan(options: PlanOptions): Promise<void> {
  ensureClaudeInstalled();

  if (!(await sessionExists(options.sessionId))) {
    console.error(
      chalk.red(`Error: Session '${options.sessionId}' not found.`),
    );
    console.error(chalk.yellow("Run 'ralph init' first to create a session."));
    process.exit(1);
  }

  // Check if session already has been planned (via front matter stage)
  const content = await readSession(options.sessionId);
  const frontMatter = parseFrontMatter(content);
  if (frontMatter && frontMatter.stage !== 'initialized') {
    console.error(chalk.red('Error: Session already has progress sections.'));
    console.error(chalk.yellow('The session has already been planned.'));
    process.exit(1);
  }

  const sessionPath = getSessionPath(options.sessionId);
  const systemPrompt = await buildSystemPrompt(options.sessionId);

  console.log(chalk.cyan(`\nPlanning session ${options.sessionId}...\n`));

  // Run Claude in print mode - no user interaction needed
  await execa('claude', ['--print', '--system-prompt', systemPrompt], {
    input: `Analyze @${sessionPath} and add progress tracking sections.`,
    stdio: ['pipe', 'inherit', 'inherit'],
  });

  // Update front matter to mark as planned
  const updatedContent = await readSession(options.sessionId);
  const newContent = updateFrontMatter(updatedContent, { stage: 'planned' });
  await writeSession(options.sessionId, newContent);
}
