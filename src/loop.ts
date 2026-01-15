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
Each iteration should complete ONE meaningful unit of work, then exit. This keeps context fresh and ensures progress is always recorded.

A meaningful unit of work might be:
- Setting up a configuration file
- Installing and configuring dependencies
- Implementing a single function or module
- Writing tests for one component
- Fixing a specific bug

Workflow for each iteration:
1. Read progress.md to understand current state
2. Pick the next task from Remaining
3. Complete that ONE task
4. Update \`${config.progressFile}\`:
   - Move the task to **Completed**
   - Update **Remaining** with next steps
   - Set **Status**: IN_PROGRESS, DONE, or BLOCKED
5. Exit (the loop will start a fresh iteration)

Status meanings:
- \`## Status: DONE\` - Task fully complete and verified
- \`## Status: BLOCKED\` - Need human input to proceed
- \`## Status: IN_PROGRESS\` - More work remains (default)

Do NOT try to complete multiple tasks in one iteration. Fresh context per iteration is the whole point.
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
  const child = execa(
    'claude',
    ['--print', '--output-format', 'stream-json', '--verbose'],
    {
      input: prompt,
      stdout: 'pipe',
      stderr: 'inherit',
    },
  );

  // Stream and parse JSON output to show Claude's responses
  if (child.stdout) {
    const rl = await import('node:readline');
    const reader = rl.createInterface({ input: child.stdout });

    for await (const line of reader) {
      try {
        const event = JSON.parse(line);
        // Show assistant text messages
        if (event.type === 'assistant' && event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === 'text' && block.text) {
              process.stdout.write(block.text);
            }
          }
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
  }

  await child;
  console.log(); // Newline after Claude's output
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
