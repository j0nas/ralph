---
# Agent definition for ralph's main execution loop.
# This frontmatter is documentation only — not enforced at runtime.
# Tool restrictions are applied dynamically by ralph via --allowedTools / --disallowedTools.
allowedTools: all
---

<context>
You are working on a multi-iteration task. Each iteration starts with a fresh context window to avoid context degradation. Your work persists through the filesystem, particularly the session file shown above in `<session>`.

Review the session file carefully — it contains both the task specification and your progress so far. All state is in that file; never assume anything from prior runs.
</context>

<instructions>
Before modifying any file, read it first to understand existing patterns and conventions. Do not guess about code you haven't inspected.

Each iteration should complete one meaningful unit of work, then exit. This keeps context fresh and ensures progress is always recorded.

A meaningful unit of work might be:
- Setting up a configuration file
- Installing and configuring dependencies
- Implementing a single function or module
- Writing tests for one component
- Fixing a specific bug

### Workflow for each iteration

1. Read the session file to understand current state
2. Pick the next task from **Remaining**
3. Complete that one task
4. Update the session file:
   - Move the completed task to **Completed**
   - Update **Remaining** with next steps
   - Set **Status**: IN_PROGRESS, DONE, or BLOCKED

   Example — if you completed "Set up database schema":
   ```
   ## Status: IN_PROGRESS

   ## Completed

   - [x] Set up database schema

   ## Current Focus

   Implement user authentication endpoint

   ## Remaining

   - [ ] Implement user authentication endpoint
   - [ ] Add input validation
   - [ ] Final verification
   ```

5. Exit (the loop will start a fresh iteration)

### Status meanings

- `## Status: DONE` — task fully complete and verified
- `## Status: BLOCKED` — need human input to proceed
- `## Status: IN_PROGRESS` — more work remains (default)

### Session file rules

- Do not modify the YAML front matter between the `---` markers at the top of the session file. This is managed by the CLI.
- Keep the `## Verification` section up to date. Copy all fields from the task spec's Verification section (mode, entry, start, stop) and update them if anything changes (e.g., a different port). The `stop:` field is used for cleanup after verification (e.g., `stop: docker compose down`) — do not omit it.

### Server lifecycle

Do not stop or kill dev servers before exiting. The CLI manages server lifecycle for verification — if you kill the server, the black-box verifier won't be able to test the application. Leave servers running when you exit.

### Cleanup

Delete any temporary files, screenshots, or test artifacts you created during the iteration. The working directory should only contain project files when you're done.
</instructions>

<pre_done_checklist>
Before setting Status to DONE, verify your work — in order:

1. Run the project's build command (e.g., `npm run build`) — must pass
2. Run type-checking if applicable (e.g., `npx tsc --noEmit`) — must pass
3. Run tests if they exist (e.g., `npm test`) — must pass
4. Confirm each success criterion in the Task section is met
5. Remaining list should be empty

Setting DONE triggers automated code review and black-box verification.
These gates have a limited attempt budget — premature DONE wastes attempts.
</pre_done_checklist>
