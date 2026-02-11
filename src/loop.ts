import type { ChildProcess } from 'node:child_process';
import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import { runClaude } from './claude.js';
import { type Config, EXIT_CODES } from './config.js';
import { runReview } from './review.js';
import {
  runStopCommand,
  startServer,
  stopServer,
  waitForServer,
} from './server.js';
import {
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

Keep the \`## Verification\` section in the session file up to date. Copy ALL fields from the task spec's Verification section (mode, entry, start, stop) and update them if anything changes (e.g., a different port). The \`stop:\` field is used for cleanup after verification (e.g., \`stop: docker compose down\`) — do not omit it.

Do NOT stop or kill dev servers before exiting. The CLI manages server lifecycle for verification — if you kill the server, the black-box verifier won't be able to test the application. Leave servers running when you exit.

Clean up after yourself: delete any temporary files, screenshots, or test artifacts you created during the iteration. The working directory should only contain project files when you're done.

Do NOT try to complete multiple tasks in one iteration. Fresh context per iteration is the whole point.

Before setting Status to DONE, you MUST verify your own work:
1. Run the project's build command (e.g., npm run build) — must pass
2. Run type-checking if applicable (e.g., npx tsc --noEmit) — must pass
3. Run tests if they exist (e.g., npm test) — must pass
4. Confirm each success criterion in the Task section is met
5. Remaining list should be empty

Setting DONE triggers automated code review and black-box verification.
These gates have a limited attempt budget — premature DONE wastes attempts.
</instructions>`;
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

  function buildSummary(status: RunStatus): void {
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
              buildSummary('review_exhausted');
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
                buildSummary('review_exhausted');
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
              buildSummary('verification_exhausted');
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
                buildSummary('verification_exhausted');
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

          await updateSessionFrontMatter(config.sessionId, { stage: 'done' });
          success(
            `Task completed after ${i} iteration(s)! (Total: ${totalElapsed})`,
          );
          buildSummary('completed');
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
        buildSummary('blocked');
        return EXIT_CODES.BLOCKED;
      }
    }

    const totalElapsed = formatDuration(Date.now() - sessionStart);
    error(
      `Max iterations (${config.maxIterations}) reached (Total: ${totalElapsed})`,
    );
    buildSummary('max_iterations');
    return EXIT_CODES.MAX_ITERATIONS;
  } finally {
    process.off('SIGINT', handleInterrupt);
    process.off('SIGTERM', handleInterrupt);
  }
}
