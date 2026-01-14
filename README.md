# Ralph

**Claude Code in a loop with fresh context per iteration.**

Runs Claude Code repeatedly, spawning fresh instances to avoid context rot. Memory persists between iterations through a `progress.md` file.

## Why Fresh Instances?

As LLM context windows fill up, performance degrades ("context rot"). By starting fresh each iteration:
- Each Claude Code instance has a clean context window
- Progress persists through files, not memory
- Claude reads `progress.md` to understand state without re-exploring everything

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
# 1. Create your task prompt
cp PROMPT.md.example PROMPT.md
# Edit PROMPT.md with your task

# 2. Run the loop
ralph
# Or if not linked globally:
node dist/index.js
```

## Usage

```
ralph [OPTIONS]

Options:
  -V, --version             output the version number
  -p, --prompt <file>       Path to prompt file (default: "PROMPT.md")
  -d, --progress <file>     Progress file path (default: "progress.md")
  -m, --max-iterations <n>  Maximum iterations (default: "10")
  -c, --cooldown <secs>     Seconds between iterations (default: "5")
  -y, --yes                 Skip confirmation prompt
  -h, --help                display help for command
```

## How It Works

```
┌─────────────────────────────────────────────┐
│  1. Read PROMPT.md + progress.md            │
│  2. Spawn fresh Claude Code instance        │
│  3. Claude works on task, updates progress  │
│  4. Check for completion signal             │
│  5. If not done → loop back to step 1       │
│  6. If done or max iterations → exit        │
└─────────────────────────────────────────────┘
```

## Exit Signals

Claude should update `progress.md` with status:

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

## Tips

- **Be specific in PROMPT.md** - Clear success criteria help Claude know when it's done
- **Start with low iterations** - Test with `-m 3` before running longer loops
- **Monitor costs** - Each iteration uses API tokens
- **Use git** - Commit between runs to track changes

## Credits

Inspired by the [Ralph Wiggum methodology](https://ghuntley.com/ralph/) by Geoffrey Huntley.
