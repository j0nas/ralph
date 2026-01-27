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

## Usage

```bash
ralph                 # Full interactive workflow
ralph -m 10           # With custom max iterations (default: 50)
```

That's it. One command runs the complete workflow:

1. **Prompt** - Asks what you want to build
2. **Init** - Claude asks 2-4 clarifying questions
3. **Refine** - Option to refine task spec (loop until satisfied)
4. **Plan** - Breaks down into actionable steps
5. **Execute** - Works through tasks in fresh context iterations

## Workflow

```
┌──────────────────────────────────────────────────────────────┐
│  1. PROMPT                                                    │
│     "What would you like to build?"                          │
│                                                               │
│  2. INIT (interactive)                                        │
│     Claude asks clarifying questions                          │
│     Creates session file with task spec                       │
│                                                               │
│  3. REFINE (interactive, loop)                                │
│     "Refine the task further? (y/N)"                         │
│     If yes → Claude improves task spec → ask again            │
│     If no (or Enter) → proceed                                │
│                                                               │
│  4. PLAN (non-interactive)                                    │
│     Claude breaks down into steps                             │
│     Adds Status/Completed/Remaining sections                  │
│                                                               │
│  5. EXECUTE (non-interactive, loop)                           │
│     Fresh Claude instances iterate                            │
│     Until DONE/BLOCKED/max iterations                         │
└──────────────────────────────────────────────────────────────┘
```

## Parallel Work

For parallel work, simply run `ralph` in multiple terminals. Each run creates its own independent session.

```bash
# Terminal 1
ralph     # "Build user authentication"

# Terminal 2
ralph     # "Add payment processing"
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

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Task completed (DONE status) |
| 1 | Task blocked or error |
| 2 | Max iterations reached |
| 130 | Interrupted (Ctrl+C) |

## Tips

- **Be specific** - Clear success criteria help Claude know when it's done
- **Use the refine loop** - Keep refining until your task spec is solid
- **Start with low iterations** - Test with `-m 3` before running longer loops
- **Use git** - Commit between runs to track changes
- **Sessions are ephemeral** - They live in temp directory and clean up on reboot

## Credits

Inspired by the [Ralph Wiggum methodology](https://ghuntley.com/ralph/) by Geoffrey Huntley.
