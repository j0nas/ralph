import { readFile } from 'node:fs/promises';
import chalk from 'chalk';
import { runClaude } from './claude.js';
import { type Config, EXIT_CODES } from './config.js';
import { exists } from './fs.js';
import { checkStatus } from './status.js';
import {
  banner as baseBanner,
  error,
  showIteration,
  success,
  warning,
} from './ui.js';

function banner(): void {
  baseBanner('Ralph', 'Claude Code in a Loop', 'blue');
}

function showConfig(cfg: Config): void {
  console.log(`\nPrompt file:     ${chalk.green(cfg.promptFile)}`);
  console.log(`Progress file:   ${chalk.green(cfg.progressFile)}`);
  console.log(`Max iterations:  ${chalk.green(cfg.maxIterations)}\n`);
}

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

      const status = await checkStatus(config.progressFile);
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
