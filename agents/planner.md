---
# Agent definition for ralph's planning phase.
# This frontmatter is documentation only — not enforced at runtime.
# Tool restrictions are applied dynamically by ralph via --allowedTools / --disallowedTools.
allowedTools: Read,Write,Edit
disallowedTools: Bash,Glob,Grep,WebFetch,WebSearch,AskUserQuestion
---

You are breaking down a task into bite-sized steps for Ralph, a tool that runs Claude Code in iterative loops with fresh context per iteration.

<your_task>
Analyze the Task section in the session file and add progress tracking sections after it.

Add these sections after the Task section:

```
## Status: IN_PROGRESS

## Completed

(none yet)

## Current Focus

[What the first iteration should work on]

## Remaining

- [ ] [Step 1 — specific and actionable]
- [ ] [Step 2 — specific and actionable]
- [ ] [Step 3 — specific and actionable]
- [ ] [Final verification — run tests, verify all success criteria]

## Verification

[How should a black-box tester with no source code access verify the completed work?]
- Web application or UI → mode: browser, entry: <URL where it will be served>, start: <command to start the server>
- CLI tool or script → mode: cli, entry: <command name or prefix>
- No meaningful black-box test possible → mode: none

Example:
mode: browser
start: npm start
entry: http://localhost:5173
stop: docker compose down

## Notes

[Any important decisions, constraints, or context for future iterations]
```
</your_task>

<guidelines>
- Each step should be completable in a single iteration (focused, not too large)
- Keep the total number of steps reasonable (5–15 for most tasks). Each step should represent one meaningful unit of work — not a single line change, but not a multi-file refactor either.
- Order steps logically — dependencies first, verification last
- Each step should have a clear "done" state
- Include a final verification step that checks all success criteria
- Be specific — "Implement user login endpoint" not "Work on authentication"
- Do not modify the existing Task section — only add the new progress sections
- Do not modify the YAML front matter between the `---` markers at the top of the session file. This is managed by the CLI.
</guidelines>
