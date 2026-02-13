# Anthropic Prompt Engineering Best Practices

Reference for writing system prompts consumed by Claude models, particularly in autonomous
agent loops where each instance gets a fresh context window. Sourced from Anthropic's official
documentation at https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/.

---

## 1. Be Clear, Direct, and Detailed

Claude treats prompts like instructions to a new employee with no prior context. Vague
prompts produce vague results.

**Do:**
- State what the task results will be used for
- Specify the audience for the output
- Define what successful completion looks like
- Use sequential numbered steps for multi-part instructions

**Don't:**
- Rely on Claude inferring intent from ambiguous phrasing
- Leave success criteria implicit
- Assume Claude "knows what you mean"

**Example — vague vs. explicit:**
```
# Bad
"Work on the next task and update progress."

# Good
"Read progress.md to identify the next IN_PROGRESS task. Implement it fully, including
tests. Update progress.md: mark the task DONE and set the next task to IN_PROGRESS.
If all tasks are complete, set Status to DONE."
```

## 2. Use XML Tags for Structure

XML tags help Claude parse multi-part prompts accurately. They prevent Claude from confusing
instructions with context, examples, or data.

**Key guidelines:**
- Use descriptive tag names that match their content: `<instructions>`, `<context>`,
  `<constraints>`, `<output_format>`
- Be consistent — use the same tag names throughout and refer to them by name
- Nest tags for hierarchy: `<task><requirements>...</requirements></task>`
- Combine with other techniques: `<examples>`, `<thinking>`, `<answer>`

**Example:**
```xml
<task_context>
You are implementing features for a REST API. The codebase uses Express.js with TypeScript.
</task_context>

<instructions>
1. Read progress.md to find the current task
2. Implement the task following the patterns in src/
3. Write tests in test/
4. Update progress.md with results
</instructions>

<constraints>
- Do not modify files unrelated to the current task
- All tests must pass before marking a task as DONE
- Follow existing code style and patterns
</constraints>
```

## 3. Use Examples (Multishot Prompting)

Few-shot examples dramatically improve output consistency and quality, especially for
structured outputs or adherence to specific formats.

**Guidelines:**
- Include 2-3 diverse examples covering normal and edge cases
- Show both input and expected output
- Make examples representative of real scenarios
- For structured output, examples are more reliable than format descriptions alone

**Example:**
```xml
<examples>
<example>
Input: "Add user authentication with JWT"
Progress update:
## Task 3: User Authentication
- Status: DONE
- Implementation: Added JWT middleware in src/auth.ts, login endpoint in src/routes/auth.ts
- Tests: 4 tests added in test/auth.test.ts (all passing)
- Notes: Used existing bcrypt dependency for password hashing
</example>
</examples>
```

## 4. Let Claude Think (Chain of Thought)

Encouraging step-by-step reasoning improves accuracy on complex tasks. This is especially
important for tasks requiring analysis before action.

**Approaches:**
- Ask Claude to reason through the problem before acting: "Before implementing, analyze
  the current codebase patterns and explain your approach"
- Use `<thinking>` and `<answer>` tags to separate reasoning from output
- For autonomous agents: have Claude write its analysis to a scratchpad before executing

**When to use:**
- Multi-step tasks with dependencies
- Tasks requiring understanding of existing code before modification
- Debugging or root cause analysis
- Choosing between multiple valid approaches

## 5. Give Claude a Role (System Prompts)

System prompts set Claude's perspective, expertise, and behavioral boundaries. They are
especially powerful for establishing consistent behavior across iterations.

**Effective system prompts:**
- Define expertise and perspective: "You are an autonomous coding agent..."
- Set behavioral constraints: what to do and what to avoid
- Establish the operating context: tools available, file structure, workflow

**For agent loops specifically:**
- Describe the loop mechanism so Claude understands it will be restarted
- Explain what persists between iterations (files, git) and what doesn't (memory)
- Be explicit about how to signal completion or blockers

## 6. Claude 4.x-Specific Best Practices

### Explicit instruction following
Claude 4.x models follow instructions more precisely than earlier models. They respond
to what you literally say. If you want "above and beyond" behavior, request it explicitly.

### Be explicit about tool usage
Claude 4.x may suggest changes rather than implementing them if your prompt says "suggest".
Use action-oriented language: "implement", "create", "modify" rather than "suggest",
"consider", "could you".

### Avoid overengineering prompts
Claude Opus 4.5/4.6 is highly steerable. Where older models needed "CRITICAL: YOU MUST...",
newer models respond well to normal language: "Use this tool when...".

### Context awareness
Claude 4.5+ tracks its remaining context window. For agent loops, add:
```
Your context window will be automatically compacted as it approaches its limit.
Do not stop tasks early due to token budget concerns. Always be as persistent
and autonomous as possible.
```

### Reduce overengineering tendency
Claude 4.x can over-build. Add constraints:
```xml
<constraints>
Only make changes that are directly requested or clearly necessary. Keep solutions
simple and focused:
- Don't add features beyond what the task requires
- Don't refactor surrounding code during a bug fix
- Don't add error handling for scenarios that can't happen
- Don't create abstractions for one-time operations
</constraints>
```

### Encourage code exploration before action
Claude 4.x can propose solutions without reading code first. Counter this with:
```
ALWAYS read and understand relevant files before proposing code edits.
Do not speculate about code you have not inspected.
```

### Minimize hallucinations
```xml
<investigate_before_answering>
Never speculate about code you have not opened. Read relevant files BEFORE answering
questions about the codebase. Never make claims about code before investigating.
</investigate_before_answering>
```

### Parallel tool calling
Claude 4.x excels at parallel execution. You can encourage this:
```
If you intend to call multiple tools with no dependencies between them, make all
independent calls in parallel.
```

### Format control
- Tell Claude what to do, not what not to do
  - Instead of: "Do not use markdown"
  - Use: "Respond in flowing prose paragraphs"
- Match your prompt style to desired output style
- Use XML tags as format indicators

## 7. Long Context and Multi-Window Tips

**For long documents:**
- Place longform data (20K+ tokens) near the top of the prompt, above instructions
- Structure documents with XML tags: `<document>`, `<document_content>`, `<source>`

**For multi-window workflows (relevant to agent loops):**
- Use the first context window for setup (write tests, create scripts)
- Have Claude write tests in structured formats (e.g., JSON) before implementing
- Create setup scripts for gracefully starting servers, running tests
- Use git for state tracking between context windows
- Emphasize incremental progress — complete one thing fully before moving on

## 8. Prompt Templates and Variables

When prompts are reused across iterations (as in agent loops), use template variables
for dynamic content:

```
Read the task specification in <task_spec>{{TASK_CONTENT}}</task_spec>.
Review current progress in <progress>{{PROGRESS_CONTENT}}</progress>.
```

Wrapping variables in XML tags prevents Claude from confusing injected content with
instructions.

## 9. Chain Complex Prompts

For complex tasks, break them into subtasks with separate prompts rather than one massive
prompt. This is the core philosophy behind the ralph loop — each iteration handles a
focused slice of work with fresh context.

**Benefits:**
- Each prompt can be optimized for its specific subtask
- Reduces error cascading from one step to the next
- Easier to debug when things go wrong

## 10. Anti-Patterns to Avoid

These are common mistakes that degrade prompt quality:

1. **Contradictory instructions**: Saying "be concise" but also "explain thoroughly"
2. **Ambiguous scope**: Not defining what "done" means
3. **Negative-only framing**: Listing what NOT to do without saying what TO do
4. **Missing context**: Not explaining WHY a constraint exists (Claude generalizes better
   with motivation)
5. **Instruction overload**: Cramming too many rules reduces compliance across the board.
   Keep to ~25 high-quality instructions; use separate files for specialized guidance
6. **Stale examples**: Examples that show outdated patterns Claude will reproduce
7. **Assuming memory**: In agent loops, every instance starts fresh. Never assume Claude
   remembers previous iterations — all state must be in files
