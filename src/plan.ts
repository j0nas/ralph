import chalk from 'chalk';
import { runClaudeNonInteractive } from './claude.js';
import { ensureClaudeInstalled } from './fs.js';
import { loadPrompt } from './prompts.js';
import {
  getSessionPath,
  parseFrontMatter,
  readSession,
  sessionExists,
  updateFrontMatter,
  writeSession,
} from './session.js';

export interface PlanOptions {
  sessionId: string;
}

function buildSystemPrompt(sessionId: string): string {
  return loadPrompt('plan', {
    WORKING_DIR: process.cwd(),
    SESSION_PATH: getSessionPath(sessionId),
  });
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
  const systemPrompt = buildSystemPrompt(options.sessionId);

  console.log(chalk.cyan(`\nPlanning session ${options.sessionId}...\n`));

  // Run Claude in print mode using centralized function
  await runClaudeNonInteractive(
    systemPrompt,
    `Analyze @${sessionPath} and add progress tracking sections.`,
    { inheritOutput: true },
  );

  // Update front matter to mark as planned
  const updatedContent = await readSession(options.sessionId);
  const newContent = updateFrontMatter(updatedContent, { stage: 'planned' });
  await writeSession(options.sessionId, newContent);
}
