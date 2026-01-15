import { readFile, unlink } from 'node:fs/promises';
import chalk from 'chalk';
import { execa } from 'execa';
import which from 'which';
import { exists } from './fs.js';

export interface PlanOptions {
  prompt: string;
  output: string;
  force?: boolean;
}

function buildSystemPrompt(task: string, outputPath: string): string {
  return `You are breaking down a task into bite-sized steps for Ralph, a tool that runs Claude Code in iterative loops with fresh context per iteration.

Working directory: ${process.cwd()}

<task>
${task}
</task>

<your_task>
Analyze the task and generate a progress.md file with concrete, actionable steps.

# Progress Tracking

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
  // Check claude CLI exists
  if (!which.sync('claude', { nothrow: true })) {
    console.error(
      chalk.red("Error: 'claude' not found. Install Claude Code first."),
    );
    process.exit(1);
  }

  // Check prompt file exists
  if (!(await exists(options.prompt))) {
    console.error(chalk.red(`Error: '${options.prompt}' not found.`));
    process.exit(1);
  }

  // Check if output file exists (unless --force)
  if (!options.force && (await exists(options.output))) {
    console.error(
      chalk.red(
        `Error: '${options.output}' already exists. Use --force to overwrite.`,
      ),
    );
    process.exit(1);
  }

  // Delete output file if --force and file exists (so Claude starts fresh)
  if (options.force && (await exists(options.output))) {
    await unlink(options.output);
  }

  const task = await readFile(options.prompt, 'utf-8');
  const systemPrompt = buildSystemPrompt(task, options.output);

  console.log(
    chalk.cyan(`\nGenerating ${options.output} from ${options.prompt}...\n`),
  );

  // Run Claude in print mode - no user interaction needed
  await execa('claude', ['--print', '--system-prompt', systemPrompt], {
    input: 'Analyze the task and generate the progress.md file.',
    stdio: ['pipe', 'inherit', 'inherit'],
  });
}
