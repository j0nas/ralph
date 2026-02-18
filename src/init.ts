import chalk from 'chalk';
import { runClaudeInteractive } from './claude.js';
import { ensureClaudeInstalled } from './fs.js';
import { loadPrompt } from './prompts.js';
import { createSession, getSessionPath, sessionExists } from './session.js';

export interface InitOptions {
  session?: string;
}

export interface IterateOptions {
  sessionId: string;
  count?: number;
}

function buildSystemPrompt(sessionId: string): string {
  return loadPrompt('init', {
    WORKING_DIR: process.cwd(),
    SESSION_PATH: getSessionPath(sessionId),
  });
}

function buildIterateSystemPrompt(sessionId: string): string {
  return loadPrompt('iterate', {
    WORKING_DIR: process.cwd(),
    SESSION_PATH: getSessionPath(sessionId),
  });
}

export async function runInit(
  initialPrompt: string,
  options: InitOptions,
): Promise<string> {
  ensureClaudeInstalled();

  // Create the session with minimal content
  const sessionId = await createSession(initialPrompt, options.session);
  const sessionPath = getSessionPath(sessionId);

  console.log(chalk.cyan(`\nCreated session: ${chalk.bold(sessionId)}`));
  console.log(chalk.dim(`Session file: ${sessionPath}\n`));

  const systemPrompt = buildSystemPrompt(sessionId);

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
    const systemPrompt = buildIterateSystemPrompt(options.sessionId);

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
