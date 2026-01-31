import chalk from 'chalk';
import { runClaude } from './claude.js';
import { type Config, EXIT_CODES } from './config.js';
import {
  getSessionPath,
  parseFrontMatter,
  readSession,
  updateFrontMatter,
  writeSession,
} from './session.js';
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
  const sessionPath = getSessionPath(cfg.sessionId);
  console.log(`\nSession:         ${chalk.green(cfg.sessionId)}`);
  console.log(`Session file:    ${chalk.dim(sessionPath)}`);
  console.log(`Max iterations:  ${chalk.green(cfg.maxIterations)}\n`);
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${seconds}s`;
}

async function updateSessionFrontMatter(
  sessionId: string,
  updates: Parameters<typeof updateFrontMatter>[1],
): Promise<void> {
  const content = await readSession(sessionId);
  const newContent = updateFrontMatter(content, updates);
  await writeSession(sessionId, newContent);
}

async function buildPrompt(config: Config): Promise<string> {
  const sessionContent = await readSession(config.sessionId);
  const sessionPath = getSessionPath(config.sessionId);

  const userMessageSection = config.message
    ? `

<user-message>
The user has provided the following message when resuming this session:

${config.message}

Take this into account as you proceed with the next iteration.
</user-message>`
    : '';

  return `Working directory: ${process.cwd()}

<session>
${sessionContent}
</session>

<context>
You are working on a multi-iteration task. Each iteration starts with a fresh context window to avoid context degradation. Your work persists through the filesystem, particularly the session file at \`${sessionPath}\`.

Review the session file above - it contains both the task specification and your progress so far.
</context>${userMessageSection}

<instructions>
Each iteration should complete ONE meaningful unit of work, then exit. This keeps context fresh and ensures progress is always recorded.

A meaningful unit of work might be:
- Setting up a configuration file
- Installing and configuring dependencies
- Implementing a single function or module
- Writing tests for one component
- Fixing a specific bug

Workflow for each iteration:
1. Read the session file to understand current state
2. Pick the next task from Remaining
3. Complete that ONE task
4. Update \`${sessionPath}\`:
   - Move the task to **Completed**
   - Update **Remaining** with next steps
   - Set **Status**: IN_PROGRESS, DONE, or BLOCKED
5. Exit (the loop will start a fresh iteration)

Status meanings:
- \`## Status: DONE\` - Task fully complete and verified
- \`## Status: BLOCKED\` - Need human input to proceed
- \`## Status: IN_PROGRESS\` - More work remains (default)

IMPORTANT: Do NOT modify the YAML front matter between the \`---\` markers at the top of the session file. This is managed by the CLI.

Do NOT try to complete multiple tasks in one iteration. Fresh context per iteration is the whole point.
</instructions>`;
}

export async function run(config: Config): Promise<number> {
  banner();
  showConfig(config);

  const sessionStart = Date.now();

  const handleInterrupt = () => {
    const elapsed = formatDuration(Date.now() - sessionStart);
    console.log(chalk.yellow(`\nInterrupted. Exiting... (Total: ${elapsed})`));
    process.exit(EXIT_CODES.INTERRUPTED);
  };
  process.on('SIGINT', handleInterrupt);
  process.on('SIGTERM', handleInterrupt);

  const sessionPath = getSessionPath(config.sessionId);

  // Set stage to running at loop start
  await updateSessionFrontMatter(config.sessionId, { stage: 'running' });

  try {
    for (let i = 1; i <= config.maxIterations; i++) {
      showIteration({
        current: i,
        max: config.maxIterations,
        sessionId: config.sessionId,
        sessionPath,
      });
      const iterationStart = Date.now();
      await runClaude(await buildPrompt(config));
      const iterationDuration = formatDuration(Date.now() - iterationStart);
      console.log(chalk.dim(`Iteration completed in ${iterationDuration}`));

      // Increment iteration count in front matter
      const currentContent = await readSession(config.sessionId);
      const currentFrontMatter = parseFrontMatter(currentContent);
      const newIterations = (currentFrontMatter?.iterations ?? 0) + 1;
      await updateSessionFrontMatter(config.sessionId, {
        iterations: newIterations,
      });

      const status = await checkStatus(config.sessionId);
      const totalElapsed = formatDuration(Date.now() - sessionStart);
      if (status === 'done') {
        await updateSessionFrontMatter(config.sessionId, { stage: 'done' });
        success(
          `Task completed after ${i} iteration(s)! (Total: ${totalElapsed})`,
        );
        return EXIT_CODES.SUCCESS;
      }
      if (status === 'blocked') {
        await updateSessionFrontMatter(config.sessionId, { stage: 'blocked' });
        warning(
          `Task blocked - human intervention needed (Total: ${totalElapsed})`,
        );
        console.log(chalk.dim(`Resume with: ralph resume ${config.sessionId}`));
        return EXIT_CODES.BLOCKED;
      }
    }

    const totalElapsed = formatDuration(Date.now() - sessionStart);
    error(
      `Max iterations (${config.maxIterations}) reached (Total: ${totalElapsed})`,
    );
    console.log(chalk.dim(`Resume with: ralph resume ${config.sessionId}`));
    return EXIT_CODES.MAX_ITERATIONS;
  } finally {
    process.off('SIGINT', handleInterrupt);
    process.off('SIGTERM', handleInterrupt);
  }
}
