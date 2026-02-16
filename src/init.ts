import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { execa } from 'execa';
import { ensureClaudeInstalled } from './fs.js';
import { createSession, getSessionPath, sessionExists } from './session.js';

const __dirname = join(fileURLToPath(import.meta.url), '..');

export interface InitOptions {
  session?: string;
}

export interface IterateOptions {
  sessionId: string;
  count?: number;
}

async function loadPrompt(filename: string): Promise<string> {
  const promptPath = join(__dirname, '..', 'prompts', filename);
  return readFile(promptPath, 'utf-8');
}

async function buildSystemPrompt(sessionId: string): Promise<string> {
  const sessionPath = getSessionPath(sessionId);
  const basePrompt = await loadPrompt('init.md');
  // Extract the buildSystemPrompt section from the markdown
  const match = basePrompt.match(
    /## buildSystemPrompt[\s\S]*?```\n([\s\S]*?)```/,
  );
  if (!match) {
    throw new Error('Could not find buildSystemPrompt in init.md');
  }
  return match[1]
    .replace('${process.cwd()}', process.cwd())
    .replace('${sessionPath}', sessionPath);
}

async function buildIterateSystemPrompt(sessionId: string): Promise<string> {
  const sessionPath = getSessionPath(sessionId);
  const basePrompt = await loadPrompt('init.md');
  // Extract the buildIterateSystemPrompt section from the markdown
  const match = basePrompt.match(
    /## buildIterateSystemPrompt[\s\S]*?```\n([\s\S]*?)```/,
  );
  if (!match) {
    throw new Error('Could not find buildIterateSystemPrompt in init.md');
  }
  return match[1]
    .replace('${process.cwd()}', process.cwd())
    .replace('${sessionPath}', sessionPath);
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

  const systemPrompt = await buildSystemPrompt(sessionId);

  // Spawn interactive claude session with initial message
  await execa(
    'claude',
    [
      '--system-prompt',
      systemPrompt,
      'Begin by asking clarifying questions about my goal.',
    ],
    { stdio: 'inherit' },
  );

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
    await execa(
      'claude',
      [
        '--system-prompt',
        systemPrompt,
        `Analyze @${sessionPath} and ask clarifying questions to help improve it.`,
      ],
      { stdio: 'inherit', reject: false },
    );
  }
}
