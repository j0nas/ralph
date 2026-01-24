import chalk from 'chalk';
import { execa } from 'execa';
import {
  ensureClaudeInstalled,
  ensureFileExists,
  ensureFileNotExists,
} from './fs.js';

export interface PlanOptions {
  prompt: string;
  output: string;
  force?: boolean;
}

function buildSystemPrompt(outputPath: string): string {
  return `You are breaking down a task into bite-sized steps for Ralph, a tool that runs Claude Code in iterative loops with fresh context per iteration.

Working directory: ${process.cwd()}

<your_task>
Analyze the task and generate a progress.md file with concrete, actionable steps.

# Progress Tracking

> **📋 Full Task Specification:** See @PROMPT.md for complete requirements and success criteria.

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
</guidelines>

Write the file to: ${outputPath}`;
}

export async function runPlan(options: PlanOptions): Promise<void> {
  ensureClaudeInstalled();
  await ensureFileExists(
    options.prompt,
    `Run 'ralph init' first to create it.`,
  );
  await ensureFileNotExists(options.output, options.force);

  const systemPrompt = buildSystemPrompt(options.output);

  console.log(
    chalk.cyan(`\nGenerating ${options.output} from ${options.prompt}...\n`),
  );

  // Run Claude in print mode - no user interaction needed
  await execa('claude', ['--print', '--system-prompt', systemPrompt], {
    input: `Analyze @${options.prompt} and generate the progress.md file.`,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
}
