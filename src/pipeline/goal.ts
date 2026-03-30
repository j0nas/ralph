import chalk from 'chalk';
import { type CallbackHooks, EXIT_CODES } from '../config.js';
import { loadAgentPrompt } from '../gates/shared.js';
import { runClaude, runClaudeAgent, type ToolConfig } from '../infra/claude.js';
import { spawnDetached } from '../infra/detach.js';
import { runHook } from '../infra/hooks.js';
import {
  appendChangelog,
  createSession,
  extractTaskSummary,
  generateSessionSlug,
  getSessionLogPath,
  getSessionPath,
  parseFrontMatter,
  readChangelog,
  readSession,
  updateFrontMatter,
  writeSession,
} from '../infra/session.js';
import { checkStatus } from '../status.js';
import { banner as baseBanner, showIteration } from '../ui/ui.js';

const MAX_ITERATIONS_PER_CYCLE = 500;

export interface GoalOptions {
  goal: string;
  hooks?: CallbackHooks;
  detach?: boolean;
  /** Pre-created session ID (used by detached child or resume). */
  sessionId?: string;
}

interface BuildResult {
  iterations: number;
  status: 'done' | 'blocked' | 'stopping';
  blockReason?: string;
}

// --- Helpers ---

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
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

async function fireHook(
  hooks: CallbackHooks | undefined,
  name: keyof CallbackHooks,
  sessionId: string,
  status: string,
  iterations: number,
): Promise<void> {
  const command = hooks?.[name];
  if (!command) return;
  const content = await readSession(sessionId);
  const { task } = extractTaskSummary(content);
  await runHook(hooks, name, {
    RALPH_SESSION_ID: sessionId,
    RALPH_STATUS: status,
    RALPH_ITERATIONS: String(iterations),
    RALPH_TASK: task.slice(0, 4096),
  });
}

// --- Goal planner ---

async function runGoalPlan(sessionId: string, cycle: number): Promise<void> {
  const agentPrompt = await loadAgentPrompt('goal-planner.md');
  const sessionPath = getSessionPath(sessionId);
  const content = await readSession(sessionId);
  const { task: goal } = extractTaskSummary(content);
  const changelog = await readChangelog(sessionId);

  const systemPrompt = `Working directory: ${process.cwd()}\n\n${agentPrompt}\n\nUpdate the file: ${sessionPath}`;

  let userPrompt = `<goal>\n${goal}\n</goal>\n\n`;

  if (changelog) {
    userPrompt += `<changelog>\n${changelog}\n</changelog>\n\n`;
  }

  if (cycle === 1) {
    userPrompt += `This is the first cycle — the project may be empty or minimal. Focus on foundational choices: technology stack, project structure, and getting a working skeleton before adding features.\n\n`;
  }

  userPrompt += `Plan the next batch of work and update the session file at: ${sessionPath}`;

  const toolConfig: ToolConfig = {
    allowedTools: 'Read,Write,Edit,Glob,Grep,Bash',
    disallowedTools: 'WebFetch,WebSearch',
  };

  await runClaudeAgent(systemPrompt, userPrompt, toolConfig, 'PLAN');

  // Ensure stage is running after planning — but don't overwrite a stop signal
  const postPlanFm = parseFrontMatter(await readSession(sessionId));
  if (postPlanFm?.stage !== 'stopping') {
    await updateSessionFrontMatter(sessionId, { stage: 'running' });
  }
}

// --- Goal builder (single cycle) ---

async function buildGoalBuilderPrompt(sessionId: string): Promise<string> {
  const sessionContent = await readSession(sessionId);
  const sessionPath = getSessionPath(sessionId);
  const agentPrompt = await loadAgentPrompt('builder.md');
  return `Working directory: ${process.cwd()}\n\nSession file: ${sessionPath}\n\n<session>\n${sessionContent}\n</session>\n\n${agentPrompt}`;
}

async function runGoalBuild(sessionId: string): Promise<BuildResult> {
  for (let i = 1; i <= MAX_ITERATIONS_PER_CYCLE; i++) {
    // Check for stop signal before each iteration
    const fm = parseFrontMatter(await readSession(sessionId));
    if (fm?.stage === 'stopping') {
      return { iterations: i - 1, status: 'stopping' };
    }

    showIteration({
      current: i,
      max: MAX_ITERATIONS_PER_CYCLE,
      sessionId,
      sessionPath: getSessionPath(sessionId),
    });

    const iterationStart = Date.now();
    await runClaude(await buildGoalBuilderPrompt(sessionId));
    const iterationDuration = formatDuration(Date.now() - iterationStart);
    console.log(chalk.dim(`Iteration completed in ${iterationDuration}`));

    // Increment iteration count in front matter
    const currentContent = await readSession(sessionId);
    const currentFm = parseFrontMatter(currentContent);
    await updateSessionFrontMatter(sessionId, {
      iterations: (currentFm?.iterations ?? 0) + 1,
    });

    const status = await checkStatus(sessionId);

    if (status === 'done') {
      return { iterations: i, status: 'done' };
    }

    if (status === 'blocked') {
      const blockContent = await readSession(sessionId);
      const notesMatch = blockContent.match(/## Notes\n([\s\S]*?)(?=\n## |$)/);
      return {
        iterations: i,
        status: 'blocked',
        blockReason: notesMatch?.[1]?.trim(),
      };
    }
  }

  // Per-cycle iteration limit reached — treat as done for re-planning
  return { iterations: MAX_ITERATIONS_PER_CYCLE, status: 'done' };
}

// --- Changelog ---

async function appendCycleToChangelog(
  sessionId: string,
  cycle: number,
  result: BuildResult,
): Promise<void> {
  const content = await readSession(sessionId);
  const { completed } = extractTaskSummary(content);

  const statusLine =
    result.status === 'blocked'
      ? `Status: blocked — ${result.blockReason ?? 'unknown reason'}`
      : `Status: done`;

  const completedLines = completed || '(no completed items recorded)';

  const entry = `## Cycle ${cycle}\n${completedLines}\n${statusLine}`;
  await appendChangelog(sessionId, entry);
}

// --- Wrap-up ---

async function runWrapupCycle(sessionId: string): Promise<void> {
  const agentPrompt = await loadAgentPrompt('goal-wrapup.md');
  const sessionPath = getSessionPath(sessionId);
  const content = await readSession(sessionId);
  const { task: goal } = extractTaskSummary(content);
  const changelog = await readChangelog(sessionId);

  const systemPrompt = `Working directory: ${process.cwd()}\n\n${agentPrompt}`;

  let userPrompt = `<goal>\n${goal}\n</goal>\n\n`;

  if (changelog) {
    userPrompt += `<changelog>\n${changelog}\n</changelog>\n\n`;
  }

  userPrompt += `Stabilize the project and write the summary to the session file at: ${sessionPath}`;

  // Wrap-up has full tool access like the builder
  await runClaudeAgent(systemPrompt, userPrompt, {}, 'WRAPUP');
}

function printGoalSummary(
  sessionId: string,
  cycles: number,
  totalIterations: number,
  durationMs: number,
): void {
  const sessionPath = getSessionPath(sessionId);
  const line = '═'.repeat(50);
  console.log(chalk.green(`\n${line}`));
  console.log(chalk.green('  Goal session complete'));
  console.log(chalk.green(line));
  console.log();
  console.log(`  ${chalk.bold('Cycles:')}      ${cycles}`);
  console.log(`  ${chalk.bold('Iterations:')}  ${totalIterations}`);
  console.log(`  ${chalk.bold('Duration:')}    ${formatDuration(durationMs)}`);
  console.log(`  ${chalk.bold('Session:')}     ${chalk.dim(sessionPath)}`);
  console.log();
  console.log(
    chalk.dim(
      `  Run ${chalk.white(`ralph log ${sessionId}`)} to see the full summary.`,
    ),
  );
  console.log();
}

// --- Main entry point ---

export async function runGoalMode(options: GoalOptions): Promise<number> {
  // 1. Create or reuse session
  let sessionId: string;
  if (options.sessionId) {
    sessionId = options.sessionId;
  } else {
    const slug = await generateSessionSlug(options.goal);
    sessionId = await createSession(options.goal, slug);
  }

  const sessionPath = getSessionPath(sessionId);

  if (!options.sessionId) {
    console.log(chalk.cyan(`\nCreated session: ${chalk.bold(sessionId)}`));
    console.log(chalk.dim(`Session file: ${sessionPath}\n`));
  }

  // 2. If detach requested, re-spawn in background and exit
  if (options.detach) {
    spawnDetached(sessionId, { injectSessionId: true });
    const logPath = getSessionLogPath(sessionId);
    console.log(chalk.green('Detached — running in the background.'));
    console.log(chalk.dim(`Log file: ${logPath}`));
    console.log(chalk.dim(`Stop with: ralph stop ${sessionId}`));
    return 0;
  }

  // 3. Banner
  baseBanner('Ralph Goal', 'Autonomous Development', 'blue');
  console.log(`\n  Session:  ${chalk.green(sessionId)}`);
  console.log(`  File:     ${chalk.dim(sessionPath)}`);
  console.log(
    `  Goal:     ${chalk.cyan(options.goal.length > 80 ? `${options.goal.slice(0, 77)}...` : options.goal)}`,
  );
  console.log(chalk.dim(`\n  Stop gracefully: ralph stop ${sessionId}\n`));

  const sessionStart = Date.now();
  let cycle = 1;
  let totalIterations = 0;

  // Resume: pick up cycle counter from frontmatter before overwriting it
  if (options.sessionId) {
    const fm = parseFrontMatter(await readSession(sessionId));
    cycle = fm?.cycle ?? 1;
  }

  // Set mode and stage (after reading cycle for resume)
  await updateSessionFrontMatter(sessionId, {
    mode: 'goal',
    stage: 'running',
    cycle,
  });

  const handleInterrupt = () => {
    const elapsed = formatDuration(Date.now() - sessionStart);
    console.log(chalk.yellow(`\nInterrupted after ${elapsed}. Exiting...`));
    process.exit(EXIT_CODES.INTERRUPTED);
  };
  process.on('SIGINT', handleInterrupt);
  process.on('SIGTERM', handleInterrupt);

  try {
    while (true) {
      // Check for stop signal
      const fm = parseFrontMatter(await readSession(sessionId));
      if (fm?.stage === 'stopping') {
        console.log(
          chalk.yellow('\nStop signal received. Running wrap-up cycle...'),
        );
        await runWrapupCycle(sessionId);
        await updateSessionFrontMatter(sessionId, { stage: 'done' });
        printGoalSummary(
          sessionId,
          cycle - 1,
          totalIterations,
          Date.now() - sessionStart,
        );
        await fireHook(
          options.hooks,
          'onDone',
          sessionId,
          'done',
          totalIterations,
        );
        return EXIT_CODES.SUCCESS;
      }

      // --- Plan phase ---
      const planLine = '═'.repeat(50);
      console.log(
        chalk.magenta(
          `\n${planLine}\n  Cycle ${cycle} — Planning\n${planLine}`,
        ),
      );
      await runGoalPlan(sessionId, cycle);

      // --- Build phase ---
      const buildLine = '━'.repeat(50);
      console.log(
        chalk.blue(`\n${buildLine}\n  Cycle ${cycle} — Building\n${buildLine}`),
      );
      const result = await runGoalBuild(sessionId);
      totalIterations += result.iterations;

      // Append cycle to changelog
      await appendCycleToChangelog(sessionId, cycle, result);

      // Update cycle counter in frontmatter
      cycle++;
      await updateSessionFrontMatter(sessionId, { cycle });

      // If builder detected stop signal mid-cycle
      if (result.status === 'stopping') {
        console.log(
          chalk.yellow('\nStop signal received. Running wrap-up cycle...'),
        );
        await runWrapupCycle(sessionId);
        await updateSessionFrontMatter(sessionId, { stage: 'done' });
        printGoalSummary(
          sessionId,
          cycle - 1,
          totalIterations,
          Date.now() - sessionStart,
        );
        await fireHook(
          options.hooks,
          'onDone',
          sessionId,
          'done',
          totalIterations,
        );
        return EXIT_CODES.SUCCESS;
      }

      // Reset session for next cycle — the builder may have set Status: DONE
      // or BLOCKED in the body, but the goal-planner will overwrite the
      // progress sections anyway. Ensure the frontmatter stage is running,
      // but don't overwrite a stop signal that arrived during the build.
      const postBuildFm = parseFrontMatter(await readSession(sessionId));
      if (postBuildFm?.stage === 'stopping') {
        console.log(
          chalk.yellow('\nStop signal received. Running wrap-up cycle...'),
        );
        await runWrapupCycle(sessionId);
        await updateSessionFrontMatter(sessionId, { stage: 'done' });
        printGoalSummary(
          sessionId,
          cycle - 1,
          totalIterations,
          Date.now() - sessionStart,
        );
        await fireHook(
          options.hooks,
          'onDone',
          sessionId,
          'done',
          totalIterations,
        );
        return EXIT_CODES.SUCCESS;
      }
      await updateSessionFrontMatter(sessionId, { stage: 'running' });

      if (result.status === 'blocked') {
        console.log(
          chalk.yellow(
            `\nCycle ${cycle - 1} blocked: ${result.blockReason ?? 'unknown reason'}`,
          ),
        );
        console.log(chalk.dim('Re-planning around the obstacle...'));
      } else {
        console.log(
          chalk.green(`\nCycle ${cycle - 1} complete. Re-planning...`),
        );
      }

      // Fire progress hook between cycles
      await fireHook(
        options.hooks,
        'onProgress',
        sessionId,
        'progress',
        totalIterations,
      );
    }
  } finally {
    process.off('SIGINT', handleInterrupt);
    process.off('SIGTERM', handleInterrupt);
  }
}
