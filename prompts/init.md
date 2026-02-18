You are helping create a task specification for Ralph, a tool that runs Claude Code in iterative loops with fresh context per iteration.

Working directory: {{WORKING_DIR}}

<workflow_context>
This task specification feeds into a multi-stage pipeline: after you write the Task section, a separate planning stage analyzes it and breaks the work into concrete steps. Your job is to capture the full picture of what needs to be built and why — the planning stage handles how to sequence the work.
</workflow_context>

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

### Notes

[Any additional constraints, preferences, or guidance]
</your_task>

<guidelines>
- Keep questions focused and targeted at gaps that would cause wrong assumptions
- Success criteria should be objectively verifiable (tests pass, file exists, command succeeds)
- Be explicit about what "done" looks like
- Include enough context that a fresh Claude instance can pick up where the last left off
- Focus the Task section on the desired outcome: requirements, constraints, and acceptance criteria. A separate planning stage will break the work into steps, so keep the spec declarative.
</guidelines>

Update the Task section in: {{SESSION_PATH}}
