import type { ChildProcess } from 'node:child_process';
import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import { runClaude, summarizeSession } from './claude.js';
import { type CallbackHooks, type Config, EXIT_CODES } from './config.js';
import { runHook } from './hooks.js';
import { loadPrompt } from './prompts.js';
import { runReview } from './review.js';
import {
  runStopCommand,
  startServer,
  stopServer,
  waitForServer,
} from './server.js';
import {
  extractTaskSummary,
  extractVerificationSection,
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
  printRunSummary,
  type RunStatus,
  showIteration,
  success,
  warning,
} from './ui.js';
import { runVerification } from './verify.js';

/**
 * Clean up artifacts left by the verification step (screenshots, .playwright-mcp).
 * The browser verifier only has Playwright tools and can't delete files itself.
 */
async function cleanVerificationArtifacts(cwd: string): Promise<void> {
  try {
    const entries = await readdir(cwd);
    const removals: Promise<void>[] = [];

    for (const entry of entries) {
      const full = join(cwd, entry);
      // Screenshots from Playwright's take_screenshot
      if (/\.(png|jpeg)$/i.test(entry)) {
        const info = await stat(full);
        // Only delete files, not directories
        if (info.isFile()) {
          removals.push(rm(full));
        }
      }
      // Playwright MCP working directory
      if (entry === '.playwright-mcp') {
        removals.push(rm(full, { recursive: true }));
      }
    }

    if (removals.length > 0) {
      await Promise.all(removals);
      console.log(
        chalk.dim(`Cleaned ${removals.length} verification artifact(s)`),
      );
    }
  } catch {
    // Non-fatal — don't fail the run over cleanup
  }
}

/**
 * After all gates pass, run a Claude instance to update any project documentation
 * rendered inaccurate by the session's work.
 */
async function updateDocs(sessionId: string): Promise<void> {
  const sessionContent = await readSession(sessionId);
  const { task, completed } = extractTaskSummary(sessionContent);

  if (!task && !completed) return;

  console.log(chalk.dim('Checking if project documentation needs updating...'));

  const prompt = loadPrompt('update-docs', {
    WORKING_DIR: process.cwd(),
    TASK: task,
    COMPLETED: completed,
  });

  await runClaude(prompt);
}

function banner(): void {
  baseBanner('Ralph', 'Claude Code in a Loop', 'blue');
}

function showConfig(cfg: Config): void {
  const sessionPath = getSessionPath(cfg.sessionId);
  console.log(`\nSession:         ${chalk.green(cfg.sessionId)}`);
  console.log(`Session file:    ${chalk.dim(sessionPath)}`);
  console.log(`Max iterations:  ${chalk.green(cfg.maxIterations)}`);
  if (cfg.review) {
    console.log(`Code review:     ${chalk.magenta('enabled')}`);
  }
  if (cfg.verify) {
    console.log(`Verification:    ${chalk.magenta('enabled')}`);
  }
  console.log();
}

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

  return loadPrompt('loop', {
    WORKING_DIR: process.cwd(),
    SESSION_CONTENT: sessionContent,
    SESSION_PATH: sessionPath,
    USER_MESSAGE_SECTION: userMessageSection,
  });
}

/**
 * Fire a named callback hook if configured. Reads the session to build
 * context env vars, so callers don't need to worry about that.
 * Short-circuits when no hook is configured (avoids the session read).
 */
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

export async function run(config: Config): Promise<number> {
  banner();
  showConfig(config);

  const sessionStart = Date.now();
  const sessionPath = getSessionPath(config.sessionId);
  const resumeCmd = `ralph resume ${config.sessionId}`;

  // Stats for the run summary
  const stats = {
    buildIterations: 0,
    doneGateTriggers: 0,
    reviewRuns: 0,
    reviewPasses: 0,
    verifyRuns: 0,
    verifyPasses: 0,
  };

  async function buildSummary(status: RunStatus): Promise<void> {
    const sessionContent = await readSession(config.sessionId);
    const sessionSummary =
      stats.buildIterations > 0 ? await summarizeSession(sessionContent) : '';

    printRunSummary({
      status,
      buildIterations: stats.buildIterations,
      doneGateTriggers: stats.doneGateTriggers,
      totalIterations: stats.buildIterations + stats.doneGateTriggers,
      duration: formatDuration(Date.now() - sessionStart),
      reviewRuns: stats.reviewRuns,
      reviewPasses: stats.reviewPasses,
      verifyRuns: stats.verifyRuns,
      verifyPasses: stats.verifyPasses,
      sessionPath,
      resumeCommand: status === 'completed' ? undefined : resumeCmd,
      sessionSummary: sessionSummary || undefined,
    });
  }

  const handleInterrupt = () => {
    const elapsed = formatDuration(Date.now() - sessionStart);
    console.log(chalk.yellow(`\nInterrupted. Exiting... (Total: ${elapsed})`));
    process.exit(EXIT_CODES.INTERRUPTED);
  };
  process.on('SIGINT', handleInterrupt);
  process.on('SIGTERM', handleInterrupt);

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
        stats.doneGateTriggers++;

        // Done-gate: code review (white-box) then verification (black-box)
        // If the project has a start command, manage the server lifecycle
        const doneContent = await readSession(config.sessionId);
        const verifySection = extractVerificationSection(doneContent);
        let serverProc: ChildProcess | undefined;

        if (verifySection?.start) {
          console.log(chalk.dim(`Starting server: ${verifySection.start}`));
          serverProc = startServer(verifySection.start, process.cwd());
          const ready = await waitForServer(verifySection.entry);
          if (!ready) {
            console.log(
              chalk.yellow(
                'Server did not respond in time — proceeding anyway',
              ),
            );
          }
        }

        try {
          // Stage 1: Code review
          if (config.review) {
            const fm = parseFrontMatter(await readSession(config.sessionId));
            const reviewAttempts = fm?.reviewAttempts ?? 0;

            if (reviewAttempts >= config.review.maxAttempts) {
              await updateSessionFrontMatter(config.sessionId, {
                stage: 'blocked',
              });
              error(
                `Code review exhausted after ${reviewAttempts} attempt(s) (Total: ${totalElapsed})`,
              );
              await buildSummary('review_exhausted');
              await fireHook(
                config.hooks,
                'onBlocked',
                config.sessionId,
                'review_exhausted',
                i,
              );
              return EXIT_CODES.REVIEW_EXHAUSTED;
            }

            stats.reviewRuns++;
            const reviewResult = await runReview(
              config.sessionId,
              config.review,
            );
            if (!reviewResult.passed) {
              const postFm = parseFrontMatter(
                await readSession(config.sessionId),
              );
              if ((postFm?.reviewAttempts ?? 0) >= config.review.maxAttempts) {
                await updateSessionFrontMatter(config.sessionId, {
                  stage: 'blocked',
                });
                error(
                  `Code review exhausted after ${postFm?.reviewAttempts} attempt(s) (Total: ${totalElapsed})`,
                );
                await buildSummary('review_exhausted');
                await fireHook(
                  config.hooks,
                  'onBlocked',
                  config.sessionId,
                  'review_exhausted',
                  i,
                );
                return EXIT_CODES.REVIEW_EXHAUSTED;
              }

              // Write feedback and continue — builder will see it next iteration
              const feedbackContent = await readSession(config.sessionId);
              const withFeedback = `${feedbackContent}\n\n## Review Feedback (Done Gate)\n${reviewResult.feedback}\n`;
              await writeSession(config.sessionId, withFeedback);

              await updateSessionFrontMatter(config.sessionId, {
                stage: 'running',
              });
              warning('Code review failed — continuing with feedback');
              continue;
            }
            stats.reviewPasses++;
          }

          // Stage 2: Black-box verification
          if (config.verify) {
            const fm = parseFrontMatter(await readSession(config.sessionId));
            const attempts = fm?.verificationAttempts ?? 0;

            if (attempts >= config.verify.maxAttempts) {
              await updateSessionFrontMatter(config.sessionId, {
                stage: 'blocked',
              });
              error(
                `Verification exhausted after ${attempts} attempt(s) (Total: ${totalElapsed})`,
              );
              await buildSummary('verification_exhausted');
              await fireHook(
                config.hooks,
                'onBlocked',
                config.sessionId,
                'verification_exhausted',
                i,
              );
              return EXIT_CODES.VERIFICATION_EXHAUSTED;
            }

            stats.verifyRuns++;
            const result = await runVerification(
              config.sessionId,
              config.verify,
            );
            if (!result.passed) {
              // Check if we've now exhausted attempts
              const postFm = parseFrontMatter(
                await readSession(config.sessionId),
              );
              if (
                (postFm?.verificationAttempts ?? 0) >= config.verify.maxAttempts
              ) {
                await updateSessionFrontMatter(config.sessionId, {
                  stage: 'blocked',
                });
                error(
                  `Verification exhausted after ${postFm?.verificationAttempts} attempt(s) (Total: ${totalElapsed})`,
                );
                await buildSummary('verification_exhausted');
                await fireHook(
                  config.hooks,
                  'onBlocked',
                  config.sessionId,
                  'verification_exhausted',
                  i,
                );
                return EXIT_CODES.VERIFICATION_EXHAUSTED;
              }

              // Write feedback and continue — builder will see it next iteration
              const feedbackContent = await readSession(config.sessionId);
              const withFeedback = `${feedbackContent}\n\n## Verification Feedback (Done Gate)\n${result.feedback}\n`;
              await writeSession(config.sessionId, withFeedback);

              // Revert status so loop continues
              await updateSessionFrontMatter(config.sessionId, {
                stage: 'running',
              });
              warning('Verification failed — continuing with feedback');
              continue;
            }
            stats.verifyPasses++;
          }

          // Update project docs if the session's work made them inaccurate
          await updateDocs(config.sessionId);

          await updateSessionFrontMatter(config.sessionId, { stage: 'done' });
          success(
            `Task completed after ${i} iteration(s)! (Total: ${totalElapsed})`,
          );
          await buildSummary('completed');
          await fireHook(config.hooks, 'onDone', config.sessionId, 'done', i);
          return EXIT_CODES.SUCCESS;
        } finally {
          if (serverProc) {
            stopServer(serverProc);
            console.log(chalk.dim('Server stopped'));
          }
          if (verifySection?.stop) {
            console.log(
              chalk.dim(`Running stop command: ${verifySection.stop}`),
            );
            runStopCommand(verifySection.stop, process.cwd());
          }
          await cleanVerificationArtifacts(process.cwd());
        }
      } else {
        stats.buildIterations++;
      }
      if (status === 'blocked') {
        await updateSessionFrontMatter(config.sessionId, { stage: 'blocked' });
        warning(
          `Task blocked - human intervention needed (Total: ${totalElapsed})`,
        );
        await buildSummary('blocked');
        await fireHook(
          config.hooks,
          'onBlocked',
          config.sessionId,
          'blocked',
          i,
        );
        return EXIT_CODES.BLOCKED;
      }

      // on-progress: fires after each build iteration (not done-gate attempts)
      await fireHook(
        config.hooks,
        'onProgress',
        config.sessionId,
        'progress',
        newIterations,
      );
    }

    const totalElapsed = formatDuration(Date.now() - sessionStart);
    error(
      `Max iterations (${config.maxIterations}) reached (Total: ${totalElapsed})`,
    );
    await buildSummary('max_iterations');
    await fireHook(
      config.hooks,
      'onBlocked',
      config.sessionId,
      'max_iterations',
      config.maxIterations,
    );
    return EXIT_CODES.MAX_ITERATIONS;
  } finally {
    process.off('SIGINT', handleInterrupt);
    process.off('SIGTERM', handleInterrupt);
  }
}
