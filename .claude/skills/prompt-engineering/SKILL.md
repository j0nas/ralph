---
name: prompt-engineering
description: Anthropic prompt engineering best practices for writing and editing system prompts. Use when creating, modifying, or reviewing any prompt content including PROMPT.md, system prompts in src/, or progress.md format instructions. Also use when diagnosing why Claude misbehaves in the ralph loop.
---

# Prompt Engineering for Ralph

Ralph spawns fresh Claude Code instances in a loop. Each instance reads a single session
file (containing both the task spec and progress), does work, updates progress, and exits.
This means every prompt you write must stand completely on its own — Claude has zero memory
of previous iterations.

Before writing or modifying any prompt, read @anthropic-best-practices.md for the full
reference. Below are the rules to follow, specific to this project's context.

## Core Rules

### 1. Every prompt must be self-contained
Claude starts each iteration with an empty context window. Never write prompts that assume
Claude "already knows" something from a previous run. All necessary context — what the
project is, what has been done, what to do next — must either be in the prompt itself or
in files the prompt explicitly tells Claude to read.

### 2. Use XML tags to separate concerns
Structure prompts with descriptive XML tags. At minimum, separate:
- `<role>` — who Claude is and what it's doing
- `<context>` — project background, architecture, conventions
- `<instructions>` — the actual task steps, numbered sequentially
- `<completion_criteria>` — how Claude knows it's done

This prevents Claude from confusing task instructions with project context or constraints.

### 3. Be explicit and action-oriented
Claude 4.x follows instructions literally. Write prompts that say exactly what to do:
- "Implement the endpoint" not "Consider implementing the endpoint"
- "Write tests for the new function" not "Tests would be nice"
- "Update progress.md with status DONE" not "Update progress as appropriate"

### 4. Define exit conditions precisely
Ralph relies on Claude signaling completion via progress.md status values. Every prompt
must clearly define:
- What `IN_PROGRESS` means (keep working)
- What `DONE` means (task complete, loop can move on)
- What `BLOCKED` means (needs human intervention)

Use examples to show the exact format Claude should produce. Don't leave the status
format ambiguous.

### 5. Require code exploration before changes
Include a reminder to read before modifying:
```xml
<instructions>
Before modifying any file, read it first to understand existing patterns and conventions.
Do not guess about code you haven't inspected.
</instructions>
```

### 6. Keep prompts focused
Each ralph iteration should accomplish one focused unit of work. If a prompt tries to do
too many things, Claude's instruction-following degrades. A single prompt should ideally
contain no more than ~25 distinct instructions. Use separate files (referenced via @)
for specialized guidance.

### 7. Provide context and motivation
Don't just say "do X" — say why. Claude generalizes better when it understands the reason
behind a constraint:
```xml
<!-- Bad -->
<constraints>Do not modify package.json</constraints>

<!-- Good -->
<constraints>
Do not modify package.json. Dependency changes require manual review and could break
the CI pipeline if introduced during an automated loop.
</constraints>
```

### 8. Use examples for structured output
When Claude needs to produce a specific format (like progress.md updates), always include
a concrete example of the expected output. Examples are more reliable than prose
descriptions for enforcing format:
```xml
<output_format>
Update progress.md following this exact format:

## Task: [task name]
- Status: DONE
- Changes: [list files modified]
- Tests: [number] tests added/modified, all passing
- Notes: [any relevant observations for future iterations]
</output_format>
```

### 9. Match prompt style to desired behavior
The formatting you use in the prompt influences Claude's output style. If you want clean,
minimal code — write a clean, minimal prompt. If your prompt is full of markdown noise,
Claude's output will be too.

## Common Anti-Patterns in Ralph Prompts

Watch for and fix these when reviewing prompts:

| Anti-Pattern | Problem | Fix |
|---|---|---|
| "Do your best" | Vague success criteria | Define explicit completion criteria |
| "Don't use bad patterns" | Negative-only framing | Show the good pattern to follow |
| "Remember from last time" | Assumes cross-iteration memory | Put all state in files |
| "CRITICAL: YOU MUST..." | Overly aggressive emphasis | Use normal language; Claude 4.x is highly steerable |
| Giant monolithic prompt | Instruction overload degrades compliance | Split into focused sections with XML tags |
| No examples | Format ambiguity | Add 1-2 concrete examples of expected output |
| Contradictory instructions | "Be thorough" + "Be minimal" | Pick one and be explicit about scope |

## Checklist Before Committing a Prompt Change

- [ ] Prompt is self-contained (no assumed memory from previous iterations)
- [ ] XML tags separate role, context, instructions, constraints, and completion criteria
- [ ] Instructions use action-oriented language ("implement", "create", "update")
- [ ] Exit conditions (DONE/IN_PROGRESS/BLOCKED) are explicitly defined
- [ ] At least one example shows the expected output format
- [ ] Code exploration requirement is included
- [ ] No contradictory instructions
- [ ] Motivation/context provided for non-obvious constraints
- [ ] Total instruction count is reasonable (~25 or fewer distinct instructions)
