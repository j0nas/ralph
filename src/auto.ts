import { readFile } from 'node:fs/promises';
import boxen from 'boxen';
import chalk from 'chalk';
import { execa } from 'execa';
import type { AutoConfig } from './config.js';
import { EXIT_CODES } from './config.js';
import { exists } from './fs.js';

function banner(): void {
  console.log(
    boxen(`${chalk.green('Ralph Auto')} - Autonomous Mode`, {
      padding: { left: 1, right: 1, top: 0, bottom: 0 },
      borderColor: 'magenta',
      borderStyle: 'double',
    }),
  );
}

function showConfig(config: AutoConfig): void {
  console.log(`\nGoal:            ${chalk.green(config.goal)}`);
  console.log(`Tracking file:   ${chalk.green(config.trackingFile)}`);
  console.log(`Max iterations:  ${chalk.green(config.maxIterations)}\n`);
}

function showIteration(current: number, max: number, phase: string): void {
  const line = '━'.repeat(50);
  console.log(
    chalk.magenta(
      `\n${line}\n  Iteration ${current}/${max} - ${phase}\n${line}\n`,
    ),
  );
}

function message(color: typeof chalk.green, text: string): void {
  const line = '═'.repeat(50);
  console.log(color(`\n${line}\n  ${text}\n${line}`));
}

const success = (text: string) => message(chalk.green, text);
const warning = (text: string) => message(chalk.yellow, text);
const error = (text: string) => message(chalk.red, text);

function buildResearchPrompt(config: AutoConfig): string {
  return `Working directory: ${process.cwd()}

<goal>
${config.goal}
</goal>

<context>
You are an autonomous agent with full authority to achieve this goal. The user trusts you to make good decisions independently. Think deeply about what they actually want - not just the literal words, but the underlying intent and desired outcome.

This is the FIRST iteration. Your job is to deeply understand the problem space and create a thoughtful plan.
</context>

<philosophy>
You are not a passive executor - you are an intelligent agent. This means:

1. **Think about intent**: What does the user actually want? What would make them happiest? The stated goal is a starting point, not a complete specification.

2. **Research proactively**: Don't just skim - understand the codebase deeply. Look at how similar things are done. Read tests to understand expected behavior. Check documentation.

3. **Use all available tools**: You have powerful capabilities - use them:
   - **Web search**: Best practices, examples, unfamiliar concepts
   - **Context7 MCP**: Look up library/framework documentation directly - use this for accurate, up-to-date API references
   - **Playwright MCP**: If the goal involves UI/web, use this to verify behavior in a real browser

4. **Anticipate problems**: What could go wrong? What edge cases matter? What dependencies exist?

5. **Make good decisions**: You have judgment. Use it. If something seems wrong or suboptimal, think about better approaches.
</philosophy>

<instructions>
## Phase 1: Understand the Intent

Before diving into code, think carefully:
- What is the user trying to accomplish at a higher level?
- What would "success" look like from their perspective?
- Are there implicit requirements not stated in the goal?
- What quality bar should this meet?

## Phase 2: Deep Research

Explore thoroughly:
- **Codebase structure**: How is the project organized? What patterns are used?
- **Relevant code**: Find and READ the files that matter for this task
- **Existing patterns**: How are similar things done? Match the style.
- **Dependencies**: What tools/libraries are available? What constraints exist?
- **Tests**: How is the code tested? What coverage is expected?

Use your tools proactively:
- **Context7 MCP**: Use this to look up documentation for libraries, frameworks, and APIs. Get accurate, up-to-date references instead of guessing.
- **Web search**: Best practices, examples, Stack Overflow solutions, unfamiliar concepts
- **Playwright MCP**: If the task involves web UI, use this to understand current behavior before making changes

## Phase 3: Design the Approach

Think through your approach before committing to a plan:
- What's the simplest solution that fully solves the problem?
- Are there multiple approaches? Which is best and why?
- What order should tasks be done in?
- **How will you verify each task?** Plan verification upfront:
  - What tests exist? What new tests are needed?
  - For UI work, how will you use Playwright to verify?
  - What does "working correctly" look like for each task?

## Phase 4: Create Tracking File

Write \`${config.trackingFile}\` with this structure:

\`\`\`markdown
# Autonomous Task

## Goal

${config.goal}

## Status: IN_PROGRESS

## Understanding

[Your interpretation of what the user wants - the intent behind the goal, not just the literal request. What does success look like?]

## Research Findings

[Deep findings from your research - be specific and detailed]

- **Project context**: [technology, architecture, patterns]
- **Key files**: [specific files you'll modify or reference]
- **Patterns to follow**: [how similar things are done]
- **Dependencies**: [libraries, APIs, constraints]
- **Potential challenges**: [what could go wrong, edge cases]

## Approach

[Your reasoning about the best way to achieve the goal. Why this approach over alternatives?]

## Task Breakdown

- [x] Research and planning
- [ ] [Task 1 - include how you'll verify it works]
- [ ] [Task 2 - include how you'll verify it works]
- [ ] [Final verification - comprehensive testing of the complete solution]

## Current Focus

[First task to work on]

## Completed

- [Iteration 1]: Deep research and planning

## Follow-up Items

[Issues discovered during verification, unexpected behaviors, or deviations from expectations that need attention]

## Notes

[Important context, decisions made, things to remember]
\`\`\`

## Important

- Be thorough - future iterations only see the tracking file
- Capture your reasoning so future iterations understand WHY, not just WHAT
- Exit after creating the tracking file
</instructions>`;
}

async function buildExecutePrompt(config: AutoConfig): Promise<string> {
  const tracking = await readFile(config.trackingFile, 'utf-8');

  return `Working directory: ${process.cwd()}

<tracking_file>
${tracking}
</tracking_file>

<context>
You are an autonomous agent continuing work toward a goal. Review the tracking file to understand the full context - the goal, your research findings, your reasoning, and progress so far.

You have full authority to make decisions. The plan in the tracking file is a guide, not a rigid script. Adapt as needed.
</context>

<philosophy>
You are an intelligent agent, not a task executor. This means:

1. **Stay focused on the goal**: The task list serves the goal, not the other way around. If you realize a task is unnecessary, skip it. If you discover something new is needed, add it.

2. **Think before acting**: Each iteration, pause and consider - is this task still the right next step? Is there a better approach given what you've learned?

3. **Quality over speed**: Do the task well. Don't cut corners just to check a box. The user wants a good solution, not a fast one.

4. **Adapt the plan**: As you work, you'll learn things. Update the plan to reflect new understanding. Add tasks, remove tasks, reorder - whatever serves the goal.

5. **Verify everything**: A task is not complete until you've proven it works. This is non-negotiable:
   - Run the code and check the output
   - Run existing tests to ensure nothing broke
   - For UI changes, use Playwright to verify visually in a real browser
   - If verification reveals problems, add them as follow-up tasks

6. **Use all available tools**:
   - **Context7 MCP**: Look up library/API documentation - don't guess at function signatures or behavior
   - **Playwright MCP**: For web UI tasks, verify your changes work in a real browser - take screenshots, test interactions
   - **Web search**: Best practices, examples, troubleshooting - use external knowledge freely
</philosophy>

<instructions>
## This Iteration

1. **Orient**: Read the tracking file. Understand the goal, the approach, and where you are.

2. **Think**: Is the Current Focus still the right next step? Should you adjust the plan based on new information?

3. **Execute**: Do the work. Focus on quality. Test as you go. Use web search if you need information.

4. **Reflect**: Did this move you closer to the goal? What did you learn? What should change?

5. **Update \`${config.trackingFile}\`**:
   - Mark completed tasks (only after verification passes!)
   - Update Current Focus to the next priority
   - Add new tasks if discovered
   - Remove tasks if no longer needed
   - **Add any issues found during verification to Follow-up Items**
   - Add notes about decisions, learnings, or context
   - Update Status:
     - \`IN_PROGRESS\` - more work remains
     - \`DONE\` - goal fully achieved and verified (all follow-up items resolved)
     - \`BLOCKED\` - need human input (explain clearly in Notes)

## Guidance

- **One meaningful chunk per iteration**: This keeps context fresh. But "meaningful" is your judgment - if two small things are related, do them together.

- **Be thorough in updates**: The next iteration only sees the tracking file. Capture important context, reasoning, and decisions.

- **Trust your judgment**: You understand the codebase and the goal. Make good decisions. If something seems wrong, investigate. If there's a better way, take it.

## Verification (Critical)

**Every task must be verified before marking it complete.** This is how you ensure quality:

1. **Run the code**: Execute what you built. Does it work? Check the output carefully.

2. **Run existing tests**: Make sure you haven't broken anything. If tests fail, fix them before moving on.

3. **Test edge cases**: Think about what could go wrong. Empty inputs, large data, error conditions.

4. **For web UI - use Playwright**: Don't just assume UI changes work. Open the browser, take screenshots, test user interactions. Actually see it working.

5. **Document deviations**: If anything doesn't work as expected, or you discover unexpected behavior:
   - Add it to the **Follow-up Items** section in the tracking file
   - Decide if it's blocking (needs immediate fix) or can be addressed later
   - Don't sweep problems under the rug - surface them

**A task is only complete when verification passes.** If verification fails, the task remains incomplete - fix the issues or add follow-up tasks.
</instructions>`;
}

async function checkAutoStatus(
  config: AutoConfig,
): Promise<'done' | 'blocked' | 'continue'> {
  if (!(await exists(config.trackingFile))) return 'continue';

  const content = await readFile(config.trackingFile, 'utf-8');
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

  if (child.stdout) {
    const rl = await import('node:readline');
    const reader = rl.createInterface({ input: child.stdout });

    for await (const line of reader) {
      try {
        const event = JSON.parse(line);
        if (event.type === 'assistant' && event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === 'text' && block.text) {
              console.log(block.text);
            }
          }
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
  }

  await child;
  console.log();
}

export async function runAuto(config: AutoConfig): Promise<number> {
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
      const isFirstIteration = !(await exists(config.trackingFile));
      const phase = isFirstIteration ? 'Research & Plan' : 'Execute';

      showIteration(i, config.maxIterations, phase);

      const prompt = isFirstIteration
        ? buildResearchPrompt(config)
        : await buildExecutePrompt(config);

      await runClaude(prompt);

      const status = await checkAutoStatus(config);
      if (status === 'done') {
        success(`Goal achieved after ${i} iteration(s)!`);
        return EXIT_CODES.SUCCESS;
      }
      if (status === 'blocked') {
        warning('Task blocked - human intervention needed');
        warning(`Check ${config.trackingFile} for details`);
        return EXIT_CODES.BLOCKED;
      }
    }

    error(`Max iterations (${config.maxIterations}) reached`);
    error(`Check ${config.trackingFile} for progress`);
    return EXIT_CODES.MAX_ITERATIONS;
  } finally {
    process.off('SIGINT', handleInterrupt);
    process.off('SIGTERM', handleInterrupt);
  }
}
