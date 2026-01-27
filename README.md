# Ralph

**Claude Code in a loop with fresh context per iteration.**

Runs Claude Code repeatedly, spawning fresh instances to avoid context rot. Memory persists between iterations through session files stored in your system's temp directory.

## Why Fresh Instances?

As LLM context windows fill up, performance degrades ("context rot"). By starting fresh each iteration:
- Each Claude Code instance has a clean context window
- Progress persists through files, not memory
- Claude reads the session file to understand state without re-exploring everything

## Installation

```bash
# Install dependencies
npm install

# Build
npm run build

# Link globally (optional)
npm link
```

## Quick Start

```bash
# 1. Create a new session (Claude will ask clarifying questions)
ralph init "Build a REST API for user management"

# 2. Break down into tasks
ralph plan

# 3. Run the loop
ralph
```

## Usage

```
ralph [session-id]          Run the loop (auto-detects if only one session)
ralph init <prompt>         Create a new session through conversation
ralph plan [session-id]     Break down session into actionable steps
ralph sessions              List active sessions
ralph sessions --clean      Delete all sessions

Init options:
  -s, --session <name>      Custom session name (otherwise auto-generated)
  -i, --iterate [count]     Refine an existing session (default: 1 pass)

Loop options:
  -m, --max-iterations <n>  Maximum iterations (default: "50")
```

## How It Works

```
┌─────────────────────────────────────────────┐
│  1. Read session file from temp directory   │
│  2. Spawn fresh Claude Code instance        │
│  3. Claude works on task, updates session   │
│  4. Check for completion signal             │
│  5. If not done → loop back to step 1       │
│  6. If done or max iterations → exit        │
└─────────────────────────────────────────────┘
```

## Session Files

Sessions are stored in your system's temp directory (`$TMPDIR/ralph/`). Each session is a single markdown file containing both the task specification and progress tracking:

```markdown
# Session: abc123
Created: 2025-01-27T10:30:00.000Z
Working Directory: /path/to/project

## Task
[Task specification...]

## Status: IN_PROGRESS

## Completed
- [x] Items done...

## Current Focus
Current work description...

## Remaining
- [ ] Items left...

## Notes
Observations, context...
```

## Exit Signals

Claude should update the session file with status:

- `## Status: IN_PROGRESS` - Keep iterating
- `## Status: DONE` - Task complete, exit successfully
- `## Status: BLOCKED` - Needs human help, exit with error

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Task completed (DONE status found) |
| 1 | Task blocked or error |
| 2 | Max iterations reached |
| 130 | Interrupted (Ctrl+C) |

## Parallel Sessions

Each session has a unique ID, allowing multiple sessions to run simultaneously:

```bash
# Create multiple sessions
ralph init "Build user authentication" -s auth
ralph init "Add payment processing" -s payments

# Run them in parallel
ralph auth &
ralph payments &
```

## Refining Your Task

Use `--iterate` to improve an existing session through multiple refinement passes:

```bash
# Single refinement pass
ralph init --iterate -s my-session

# Multiple refinement passes
ralph init --iterate 3 -s my-session
```

Each pass spawns an interactive Claude session that analyzes gaps, ambiguities, and specificity issues in your task, then asks clarifying questions to improve it.

**Important**: To end each Claude session and continue to the next iteration, type `/exit` in Claude. Pressing Ctrl+C will terminate the entire process.

## Tips

- **Be specific in your task** - Clear success criteria help Claude know when it's done
- **Start with low iterations** - Test with `-m 3` before running longer loops
- **Use git** - Commit between runs to track changes
- **Sessions are ephemeral** - They live in temp directory and clean up on reboot

## Credits

Inspired by the [Ralph Wiggum methodology](https://ghuntley.com/ralph/) by Geoffrey Huntley.
