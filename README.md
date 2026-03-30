# Ralph

A CLI for iterative AI development with Claude Code, based on the [Ralph Wiggum methodology](https://ghuntley.com/ralph/) by Geoffrey Huntley.

Fresh context every iteration. State lives in files, not memory.

## Installation

```bash
pnpm install
pnpm build
pnpm link
```

## Usage

```bash
ralph                         # Full interactive workflow (default)
ralph run <task>              # Non-interactive: skip init/refine, go straight to plan + execute
ralph run task.md             # Read task from a markdown file
ralph goal <goal>             # Autonomous mode: loop toward an open-ended goal until stopped
ralph stop <id>               # Gracefully stop a goal session (wrap up + summary)
ralph resume <id>             # Resume a blocked or interrupted session
ralph resume <id> "message"   # Resume with context for Claude
ralph list                    # List all sessions
ralph -m 10                   # With custom max iterations (default: 50)
```

### Interactive workflow

The default `ralph` command runs five phases:

1. You describe what you want built
2. Claude asks clarifying questions, creates a session file
3. You optionally refine the task spec (skip with Enter)
4. Claude breaks the task into iteration-sized steps
5. Fresh Claude instances work through steps until done, blocked, or max iterations hit

### Non-interactive mode

`ralph run` skips the interactive phases. Give it a task spec and it goes straight to planning + execution.

```bash
ralph run "Create a hello world index.html" -m 5
ralph run task.md -m 20
ralph run task.md --no-verify --no-review -m 10
```

### Goal mode

`ralph goal` loops indefinitely toward an open-ended goal. Each cycle plans the next batch of work based on the current codebase state, builds it, then re-plans.

```bash
ralph goal "create a fun multiplayer browser game"
ralph goal "create a fun multiplayer browser game" --detach
ralph stop <session-id>
ralph resume <session-id>
```

### Detached mode

Add `--detach` to run in the background:

```bash
ralph run task.md --detach -m 20
# Created session: abc123
# Detached -- running in the background.
# Log file: /tmp/ralph/session-abc123.log

ralph resume abc123 --detach
```

Monitor with `tail -f` on the log file. Combine with `--on-done` for notifications:

```bash
ralph run task.md --detach --on-done "say 'ralph is done'"
```

### Parallel work

Run `ralph` in multiple terminals or use `--detach`:

```bash
ralph run "Build auth" --detach --on-done "echo auth done >> /tmp/ralph.log"
ralph run "Add payments" --detach --on-done "echo payments done >> /tmp/ralph.log"
```

### Done gate

When the developer marks the task as done, Ralph runs two checks before accepting it:

1. Code review (white-box) -- type-checking, linting, tests, implementation completeness. Up to 5 attempts.
2. Verification (black-box) -- tests the work through Playwright or CLI commands, no source access. Up to 5 attempts.

Developer says DONE -> code review -> verification -> exit 0. If either stage fails, feedback goes back to the developer for another iteration.

Verification modes (set in the session file's `## Verification` section):

| Mode | Interface | Tools |
|------|-----------|-------|
| `browser` | Playwright | `mcp__plugin_playwright_playwright__*` |
| `cli` | Shell commands | `Bash(<prefix>:*)` |
| `none` | Skip verification | -- |

The `start` field tells Ralph how to start the server for browser verification.

Opt out:

```bash
ralph run task.md --no-verify     # Disable both code review and verification
ralph run task.md --no-review     # Disable code review only
```

### Callback hooks

```bash
ralph run task.md --on-done "notify done" --on-blocked "notify blocked"
ralph start --on-progress "curl -X POST https://webhook.example/status"
```

| Flag | Fires when |
|------|------------|
| `--on-done <cmd>` | Task completes |
| `--on-blocked <cmd>` | Task blocked, review/verification exhausted, or max iterations hit |
| `--on-progress <cmd>` | After each build iteration |

Hooks get these environment variables: `RALPH_SESSION_ID`, `RALPH_STATUS`, `RALPH_ITERATIONS`, `RALPH_TASK`. They have a 30-second timeout and won't crash the main process.

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Done |
| 1 | Blocked or error |
| 2 | Max iterations reached |
| 3 | Verification exhausted |
| 4 | Code review exhausted |
| 130 | Interrupted (Ctrl+C) |

## Tips

Be specific -- clear success criteria help Claude know when it's done. Use the refine loop until your task spec is solid. Start with low iterations (`-m 3`) before running longer loops. Commit between runs so you can track changes. Sessions are ephemeral and live in `$TMPDIR/ralph/`, so they clean up on reboot.
