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
# 1. Generate your task prompt (Claude will ask clarifying questions)
ralph init "Build a REST API for user management"

# 2. Break down into tasks (Claude analyzes PROMPT.md)
ralph plan

# 3. Run the loop
ralph
```

## Usage

```
ralph init <prompt>     Generate PROMPT.md through conversation with Claude
ralph plan              Break down PROMPT.md into tasks in progress.md
ralph [options]         Run the loop

Init options:
  -o, --output <file>       Output file path (default: "PROMPT.md")
  -f, --force               Overwrite existing file
  -i, --iterate             Refine an existing PROMPT.md by asking clarifying questions
  -n, --count <number>      Number of refinement passes (default: 1, use with --iterate)

Plan options:
  -p, --prompt <file>       Prompt file to read (default: "PROMPT.md")
  -o, --output <file>       Output file path (default: "progress.md")
  --force                   Overwrite existing file

Loop options:
  -p, --prompt <file>       Path to prompt file (default: "PROMPT.md")
  -d, --progress <file>     Progress file path (default: "progress.md")
  -m, --max-iterations <n>  Maximum iterations (default: "50")
  -y, --yes                 Skip confirmation prompt
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

## Refining Your Prompt

Use `--iterate` to improve an existing PROMPT.md through multiple refinement passes:

```bash
# Single refinement pass
ralph init --iterate

# Multiple refinement passes
ralph init --iterate -n 3
```

Each pass spawns an interactive Claude session that analyzes gaps, ambiguities, and specificity issues in your prompt, then asks clarifying questions to improve it.

**Important**: To end each Claude session and continue to the next iteration, type `/exit` in Claude. Pressing Ctrl+C will terminate the entire process.

## Tips

- **Be specific in PROMPT.md** - Clear success criteria help Claude know when it's done
- **Start with low iterations** - Test with `-m 3` before running longer loops
- **Monitor costs** - Each iteration uses API tokens
- **Use git** - Commit between runs to track changes

## Credits

Inspired by the [Ralph Wiggum methodology](https://ghuntley.com/ralph/) by Geoffrey Huntley.
