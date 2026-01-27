import chalk from 'chalk';
import { execa } from 'execa';
import { ensureClaudeInstalled } from './fs.js';
import { getSessionPath, readSession, sessionExists } from './session.js';

export interface PlanOptions {
  sessionId: string;
}

function buildSystemPrompt(sessionId: string): string {
  const sessionPath = getSessionPath(sessionId);
  return `You are breaking down a task into bite-sized steps for Ralph, a tool that runs Claude Code in iterative loops with fresh context per iteration.

Working directory: ${process.cwd()}

<your_task>
Analyze the Task section and add progress tracking sections to the session file.

Add these sections after the Task section:

## Status: IN_PROGRESS

## Completed

(none yet)

## Current Focus

[What the first iteration should work on]

## Remaining

- [ ] [Step 1 - specific and actionable]
- [ ] [Step 2 - specific and actionable]
- [ ] [Step 3 - specific and actionable]
- [ ] [Final verification - run tests, verify all success criteria]

## Notes

[Any important decisions, constraints, or context for future iterations]
</your_task>

<guidelines>
- Each step should be completable in a single iteration (focused, not too large)
- Order steps logically - dependencies first, verification last
- Each step should have a clear "done" state
- Include a final verification step that checks all success criteria
- Be specific - "Implement user login endpoint" not "Work on authentication"
- Do NOT modify the existing Task section - only add the new progress sections
</guidelines>

Update the file: ${sessionPath}`;
}

export async function runPlan(options: PlanOptions): Promise<void> {
  ensureClaudeInstalled();

  if (!(await sessionExists(options.sessionId))) {
    console.error(
      chalk.red(`Error: Session '${options.sessionId}' not found.`),
    );
    console.error(chalk.yellow("Run 'ralph init' first to create a session."));
    process.exit(1);
  }

  // Check if session already has progress sections
  const content = await readSession(options.sessionId);
  if (content.includes('## Status:')) {
    console.error(chalk.red('Error: Session already has progress sections.'));
    console.error(chalk.yellow('The session has already been planned.'));
    process.exit(1);
  }

  const sessionPath = getSessionPath(options.sessionId);
  const systemPrompt = buildSystemPrompt(options.sessionId);

  console.log(chalk.cyan(`\nPlanning session ${options.sessionId}...\n`));

  // Run Claude in print mode - no user interaction needed
  await execa('claude', ['--print', '--system-prompt', systemPrompt], {
    input: `Analyze @${sessionPath} and add progress tracking sections.`,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
}
