import chalk from 'chalk';
import { execa } from 'execa';
import { ensureClaudeInstalled } from './fs.js';
import { createSession, getSessionPath, sessionExists } from './session.js';

export interface InitOptions {
  session?: string;
}

export interface IterateOptions {
  sessionId: string;
  count?: number;
}

function buildSystemPrompt(sessionId: string): string {
  const sessionPath = getSessionPath(sessionId);
  return `You are helping create a task specification for Ralph, a tool that runs Claude Code in iterative loops with fresh context per iteration.

Working directory: ${process.cwd()}

<your_task>
1. Ask 2-4 clarifying questions using AskUserQuestion to understand:
   - Specific requirements and constraints
   - Success criteria (how will we know it's done?)
   - Any relevant technical context

2. After gathering information, update the session file with a complete task specification.

The Task section should follow this structure:

## Task

### Objective

[1-2 paragraphs explaining WHAT to accomplish and WHY it matters. Be specific and explicit - vague requests underperform. Include context that helps Claude understand the motivation.]

### Success Criteria

The task is complete when ALL of these are true:
- [ ] [Specific, measurable criterion with clear verification method]
- [ ] [Another criterion - tests pass, file exists, behavior works, etc.]
- [ ] [Final verification step]

### Context

[Technical context: frameworks, existing code patterns, constraints, dependencies. Include specific file paths if relevant.]

### Instructions

1. Read the session file to understand current state
2. Work incrementally - make meaningful progress each iteration
3. After making changes, update the session file with:
   - **Completed**: What you accomplished this iteration
   - **Remaining**: Concrete next steps
   - **Status**: IN_PROGRESS | DONE | BLOCKED
4. Run tests/verification after changes
5. Set status to DONE only when ALL success criteria are met

### Notes

[Any additional constraints, preferences, or guidance]
</your_task>

<guidelines>
- Keep questions focused - don't over-ask
- Success criteria should be objectively verifiable (tests pass, file exists, command succeeds)
- Be explicit about what "done" looks like
- Include enough context that a fresh Claude instance can pick up where the last left off
</guidelines>

Update the Task section in: ${sessionPath}`;
}

function buildIterateSystemPrompt(sessionId: string): string {
  const sessionPath = getSessionPath(sessionId);
  return `You are helping refine and improve an existing task specification for Ralph, a tool that runs Claude Code in iterative loops with fresh context per iteration.

Working directory: ${process.cwd()}

<your_task>
1. Analyze the Task section and identify:
   - Gaps: What information is missing that Claude would need?
   - Ambiguities: What parts are unclear or could be interpreted multiple ways?
   - Specificity issues: What could be more concrete or actionable?
   - Success criteria gaps: Are the criteria measurable and verifiable?

2. Ask 2-4 focused clarifying questions to gather missing information. Focus on:
   - Unclear requirements that need specifics
   - Missing technical context
   - Ambiguous success criteria
   - Edge cases or constraints not mentioned

3. Rewrite the Task section incorporating the user's answers. The improved version should:
   - Be more specific and explicit
   - Have clearer, more measurable success criteria
   - Include any missing context or constraints
   - Follow the same structure as the original
</your_task>

<guidelines>
- Don't ask about things already clearly specified
- Focus on gaps that would cause Claude to make wrong assumptions
- Success criteria should be objectively verifiable (tests pass, file exists, command succeeds)
- Be explicit about what "done" looks like
- Preserve any good content from the original - only improve what's lacking
</guidelines>

Update the Task section in: ${sessionPath}`;
}

export async function runInit(
  initialPrompt: string,
  options: InitOptions,
): Promise<string> {
  ensureClaudeInstalled();

  // Create the session with minimal content
  const sessionId = await createSession(initialPrompt, options.session);
  const sessionPath = getSessionPath(sessionId);

  console.log(chalk.cyan(`\nCreated session: ${chalk.bold(sessionId)}`));
  console.log(chalk.dim(`Session file: ${sessionPath}\n`));

  const systemPrompt = buildSystemPrompt(sessionId);

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

  return sessionId;
}

export async function runIterate(options: IterateOptions): Promise<void> {
  ensureClaudeInstalled();

  const count = options.count ?? 1;

  for (let i = 0; i < count; i++) {
    if (!(await sessionExists(options.sessionId))) {
      console.error(
        chalk.red(`Error: Session '${options.sessionId}' not found.`),
      );
      process.exit(1);
    }

    const sessionPath = getSessionPath(options.sessionId);
    const systemPrompt = buildIterateSystemPrompt(options.sessionId);

    if (count > 1) {
      console.log(
        chalk.cyan(
          `\nIteration ${i + 1}/${count}: Refining session ${options.sessionId}...`,
        ),
      );
    } else {
      console.log(chalk.cyan(`\nRefining session ${options.sessionId}...`));
    }
    console.log(
      chalk.dim('Type /exit when done to continue, or Ctrl+C to abort\n'),
    );

    // Spawn interactive claude session
    await execa(
      'claude',
      [
        '--system-prompt',
        systemPrompt,
        `Analyze @${sessionPath} and ask clarifying questions to help improve it.`,
      ],
      { stdio: 'inherit', reject: false },
    );
  }
}
