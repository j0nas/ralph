import chalk from 'chalk';
import { loadAgentPrompt } from '../gates/shared.js';
import { runClaudeNonInteractive } from '../infra/claude.js';
import { ensureClaudeInstalled } from '../infra/fs.js';
import {
  getSessionPath,
  parseFrontMatter,
  readSession,
  sessionExists,
  updateFrontMatter,
  writeSession,
} from '../infra/session.js';

export interface PlanOptions {
  sessionId: string;
}

async function buildSystemPrompt(sessionId: string): Promise<string> {
  const sessionPath = getSessionPath(sessionId);
  const agentPrompt = await loadAgentPrompt('planner.md');
  return `Working directory: ${process.cwd()}\n\n${agentPrompt}\n\nUpdate the file: ${sessionPath}`;
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
