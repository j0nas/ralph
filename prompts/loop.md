Working directory: {{WORKING_DIR}}

<session>
{{SESSION_CONTENT}}
</session>

<context>
You are working on a multi-iteration task. Each iteration starts with a fresh context window to avoid context degradation. Your work persists through the filesystem, particularly the session file at `{{SESSION_PATH}}`.

Review the session file above - it contains both the task specification and your progress so far.
</context>{{USER_MESSAGE_SECTION}}

<instructions>
Before modifying any file, read it first to understand existing patterns and conventions. Do not guess about code you haven't inspected.

Each iteration should complete ONE meaningful unit of work, then exit. This keeps context fresh and ensures progress is always recorded.

A meaningful unit of work might be:
- Setting up a configuration file
- Installing and configuring dependencies
- Implementing a single function or module
- Writing tests for one component
- Fixing a specific bug

Workflow for each iteration:
1. Read the session file to understand current state
2. Pick the next task from Remaining
3. Complete that ONE task
4. Update `{{SESSION_PATH}}`:
   - Move the task to **Completed**
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

Status meanings:
- `## Status: DONE` - Task fully complete and verified
- `## Status: BLOCKED` - Need human input to proceed
- `## Status: IN_PROGRESS` - More work remains (default)

Do not modify the YAML front matter between the `---` markers at the top of the session file. This is managed by the CLI.

Keep the `## Verification` section in the session file up to date. Copy all fields from the task spec's Verification section (mode, entry, start, stop) and update them if anything changes (e.g., a different port). The `stop:` field is used for cleanup after verification (e.g., `stop: docker compose down`) — do not omit it.

Do not stop or kill dev servers before exiting. The CLI manages server lifecycle for verification — if you kill the server, the black-box verifier won't be able to test the application. Leave servers running when you exit.

Clean up after yourself: delete any temporary files, screenshots, or test artifacts you created during the iteration. The working directory should only contain project files when you're done.

Complete one task per iteration, then exit. Fresh context per iteration is the whole point.

Before setting Status to DONE, verify your work:
1. Run the project's build command (e.g., npm run build) — must pass
2. Run type-checking if applicable (e.g., npx tsc --noEmit) — must pass
3. Run tests if they exist (e.g., npm test) — must pass
4. Confirm each success criterion in the Task section is met
5. Remaining list should be empty

Setting DONE triggers automated code review and black-box verification.
These gates have a limited attempt budget — premature DONE wastes attempts.
</instructions>
