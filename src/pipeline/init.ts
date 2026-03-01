import chalk from 'chalk';
import { loadAgentPrompt } from '../gates/shared.js';
import { runClaudeInteractive } from '../infra/claude.js';
import { ensureClaudeInstalled } from '../infra/fs.js';
import {
  createSession,
  generateSessionSlug,
  getSessionPath,
  sessionExists,
} from '../infra/session.js';

export interface InitOptions {
  session?: string;
}

export interface IterateOptions {
  sessionId: string;
  count?: number;
}

async function buildSystemPrompt(sessionId: string): Promise<string> {
  const sessionPath = getSessionPath(sessionId);
  const agentPrompt = await loadAgentPrompt('init.md');
  return `Working directory: ${process.cwd()}\n\n${agentPrompt}\n\nUpdate the Task section in: ${sessionPath}`;
}

async function buildIterateSystemPrompt(sessionId: string): Promise<string> {
  const sessionPath = getSessionPath(sessionId);
  const agentPrompt = await loadAgentPrompt('iterate.md');
  return `Working directory: ${process.cwd()}\n\n${agentPrompt}\n\nUpdate the Task section in: ${sessionPath}`;
}

export async function runInit(
  initialPrompt: string,
  options: InitOptions,
): Promise<string> {
  ensureClaudeInstalled();

  // Generate a human-friendly slug unless a custom session ID was provided
  const customId =
    options.session || (await generateSessionSlug(initialPrompt));
  const sessionId = await createSession(initialPrompt, customId);
  const sessionPath = getSessionPath(sessionId);

  console.log(chalk.cyan(`\nCreated session: ${chalk.bold(sessionId)}`));
  console.log(chalk.dim(`Session file: ${sessionPath}\n`));

  const systemPrompt = await buildSystemPrompt(sessionId);

  // Spawn interactive claude session with initial message
  await runClaudeInteractive(systemPrompt, [
    'Begin by asking clarifying questions about my goal.',
  ]);

  return sessionId;
}

export async function runIterate(options: IterateOptions): Promise<void> {
  ensureClaudeInstalled();

  const count = options.count ?? 1;

  for (let i = 0; i < count; i++) {
    if (!(await sessionExists(options.sessionId))) {
      console.error(
        chalk.red(`Error: Session '${options.sessionId}' not found.`),
      );
      process.exit(1);
    }

    const sessionPath = getSessionPath(options.sessionId);
    const systemPrompt = await buildIterateSystemPrompt(options.sessionId);

    if (count > 1) {
      console.log(
        chalk.cyan(
          `\nIteration ${i + 1}/${count}: Refining session ${options.sessionId}...`,
        ),
      );
    } else {
      console.log(chalk.cyan(`\nRefining session ${options.sessionId}...`));
    }
    console.log(
      chalk.dim('Type /exit when done to continue, or Ctrl+C to abort\n'),
    );

    // Spawn interactive claude session
    await runClaudeInteractive(
      systemPrompt,
      [
        `Analyze @${sessionPath} and ask clarifying questions to help improve it.`,
      ],
      { reject: false },
    );
  }
}
