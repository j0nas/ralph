import chalk from 'chalk';
import { execa } from 'execa';
import which from 'which';
import { exists } from './fs.js';

export interface InitOptions {
  output: string;
  force?: boolean;
}

function buildSystemPrompt(initialPrompt: string, outputPath: string): string {
  return `You are helping create a PROMPT.md file for Ralph, a tool that runs Claude Code in iterative loops with fresh context per iteration.

<user_goal>
${initialPrompt}
</user_goal>

<your_task>
1. Ask 2-4 clarifying questions using AskUserQuestion to understand:
   - Specific requirements and constraints
   - Success criteria (how will we know it's done?)
   - Any relevant technical context

2. Generate a PROMPT.md file following this structure:

# Task: [Descriptive Title]

## Objective

[1-2 paragraphs explaining WHAT to accomplish and WHY it matters. Be specific and explicit - vague requests underperform. Include context that helps Claude understand the motivation.]

## Success Criteria

The task is complete when ALL of these are true:
- [ ] [Specific, measurable criterion with clear verification method]
- [ ] [Another criterion - tests pass, file exists, behavior works, etc.]
- [ ] [Final verification step]

## Context

[Technical context: frameworks, existing code patterns, constraints, dependencies. Include specific file paths if relevant.]

## Instructions

1. Read \`progress.md\` to understand current state (if it exists)
2. Work incrementally - make meaningful progress each iteration
3. After making changes, update \`progress.md\` with:
   - **Completed**: What you accomplished this iteration
   - **Remaining**: Concrete next steps
   - **Status**: IN_PROGRESS | DONE | BLOCKED
4. Run tests/verification after changes
5. Set status to DONE only when ALL success criteria are met

## Notes

[Any additional constraints, preferences, or guidance]
</your_task>

<guidelines>
- Keep questions focused - don't over-ask
- Success criteria should be objectively verifiable (tests pass, file exists, command succeeds)
- Be explicit about what "done" looks like
- Include enough context that a fresh Claude instance can pick up where the last left off
</guidelines>

Write the file to: ${outputPath}`;
}

export async function runInit(
  initialPrompt: string,
  options: InitOptions,
): Promise<void> {
  // Check claude CLI exists
  if (!which.sync('claude', { nothrow: true })) {
    console.error(
      chalk.red("Error: 'claude' not found. Install Claude Code first."),
    );
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

  const systemPrompt = buildSystemPrompt(initialPrompt, options.output);

  console.log(chalk.cyan(`\nGenerating ${options.output}...\n`));

  // Spawn interactive claude session with initial message
  await execa(
    'claude',
    [
      '--system-prompt',
      systemPrompt,
      'Begin by asking clarifying questions about my goal.',
    ],
    { stdio: 'inherit' },
  );
}
