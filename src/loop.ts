import { readFile } from 'node:fs/promises';
import boxen from 'boxen';
import chalk from 'chalk';
import { execa } from 'execa';
import { type Config, EXIT_CODES } from './config.js';
import { exists } from './fs.js';

function banner(): void {
  console.log(
    boxen(`${chalk.green('Ralph')} - Claude Code in a Loop`, {
      padding: { left: 1, right: 1, top: 0, bottom: 0 },
      borderColor: 'blue',
      borderStyle: 'double',
    }),
  );
}

function showConfig(cfg: Config): void {
  console.log(`\nPrompt file:     ${chalk.green(cfg.promptFile)}`);
  console.log(`Progress file:   ${chalk.green(cfg.progressFile)}`);
  console.log(`Max iterations:  ${chalk.green(cfg.maxIterations)}\n`);
}

function showIteration(current: number, max: number): void {
  const line = '━'.repeat(50);
  console.log(
    chalk.blue(`\n${line}\n  Iteration ${current}/${max}\n${line}\n`),
  );
}

function message(color: typeof chalk.green, text: string): void {
  const line = '═'.repeat(50);
  console.log(color(`\n${line}\n  ${text}\n${line}`));
}

const success = (text: string) => message(chalk.green, text);
const warning = (text: string) => message(chalk.yellow, text);
const error = (text: string) => message(chalk.red, text);

async function buildPrompt(config: Config): Promise<string> {
  const task = await readFile(config.promptFile, 'utf-8');
  const hasProgress = await exists(config.progressFile);
  const progress = hasProgress
    ? await readFile(config.progressFile, 'utf-8')
    : null;

  return `Working directory: ${process.cwd()}

<task>
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

async function checkStatus(
  config: Config,
): Promise<'done' | 'blocked' | 'continue'> {
  if (!(await exists(config.progressFile))) return 'continue';

  const content = await readFile(config.progressFile, 'utf-8');
  if (content.includes('## Status: DONE')) return 'done';
  if (content.includes('## Status: BLOCKED')) return 'blocked';
  return 'continue';
}

async function runClaude(prompt: string): Promise<void> {
  await execa('claude', ['--print'], {
    input: prompt,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
}

export async function run(config: Config): Promise<number> {
  banner();
  showConfig(config);

  const handleInterrupt = () => {
    console.log(chalk.yellow('\nInterrupted. Exiting...'));
    process.exit(EXIT_CODES.INTERRUPTED);
  };
  process.on('SIGINT', handleInterrupt);
  process.on('SIGTERM', handleInterrupt);

  try {
    for (let i = 1; i <= config.maxIterations; i++) {
      showIteration(i, config.maxIterations);
      await runClaude(await buildPrompt(config));

      const status = await checkStatus(config);
      if (status === 'done') {
        success(`Task completed after ${i} iteration(s)!`);
        return EXIT_CODES.SUCCESS;
      }
      if (status === 'blocked') {
        warning('Task blocked - human intervention needed');
        warning(`Check ${config.progressFile} for details`);
        return EXIT_CODES.BLOCKED;
      }
    }

    error(`Max iterations (${config.maxIterations}) reached`);
    error(`Check ${config.progressFile} for progress`);
    return EXIT_CODES.MAX_ITERATIONS;
  } finally {
    process.off('SIGINT', handleInterrupt);
    process.off('SIGTERM', handleInterrupt);
  }
}
