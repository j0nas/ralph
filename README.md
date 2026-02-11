# Ralph

A CLI implementation of the Ralph Wiggum methodology for iterative AI development with Claude Code.

## The Problem: Context Degradation

Large Language Models advertise impressive context windows—200K+ tokens for Claude—but the reality is more nuanced.

Research shows LLMs pay disproportionate attention to the beginning and end of their context window. Information in the middle gets lost, leading to missed details and inconsistent reasoning. This "lost in the middle" effect means that as conversations grow, crucial context buried in earlier exchanges effectively disappears.

Each reasoning step in a long session builds on previous ones. Small errors compound. The model starts referencing its own potentially flawed earlier conclusions rather than ground truth. As context accumulates, the model increasingly "remembers" things that didn't happen or misattributes information. What started as a focused task becomes muddied by conversational artifacts.

And while 200K tokens is advertised, practical reasoning quality degrades well before that limit. The optimal zone for complex reasoning is often just 40-60% of the theoretical maximum.

The result: long Claude Code sessions that start brilliantly but gradually lose coherence as they try to hold too much in memory.

## The Ralph Wiggum Methodology

### Origin

Created by **Geoffrey Huntley** in 2025, the Ralph Wiggum technique is named after the perpetually confused Simpsons character. The methodology was born on a goat farm in rural Australia and later formalized. It represents a paradigm shift in how we work with AI coding assistants.

### Core Concept

At its heart, Ralph is elegantly simple:

```bash
while :; do cat PROMPT.md | claude ; done
```

That's it. A bash loop that spawns fresh Claude instances, each reading from a file that persists state. No clever memory management. No context optimization tricks. Just: fresh instance, read state, do work, write state, exit, repeat.

### Why Fresh Context Works

Each iteration starts with an empty context window. The entire window is available for the actual task—no space wasted on accumulated conversational history from previous iterations.

Every iteration begins from the same state: the prompt plus the session file. This predictability makes debugging and refinement possible. Instead of relying on in-memory state that degrades, all knowledge persists in the filesystem. The session file becomes the single source of truth.

Like distributed systems that achieve consistency through repeated reconciliation, Ralph achieves task completion through repeated iteration. Each pass refines the work, catches mistakes from previous passes, and converges toward the goal.

Traditional long sessions accumulate "garbage"—old reasoning chains, abandoned approaches, outdated understanding. Fresh instances have no garbage to collect.

### Key Principles

1. **Iteration > Perfection** — Don't aim for perfect on the first try. Let the loop refine.

2. **Deterministic Imperfection > Unpredictable Success** — A system that reliably makes correctable mistakes beats one that occasionally produces brilliance but can't be debugged.

3. **Failures Are Data** — When an iteration fails predictably, that's information. Use it to tune your prompts like tuning a guitar.

4. **Files Are Truth** — Work survives in the filesystem, not in memory. If it's not in a file, it doesn't exist.

5. **Steering > Prescribing** — Stay outside the loop. Define what success looks like; let the iterations figure out how.

### Real-World Results

The methodology has produced remarkable outcomes: $50K contracts completed for ~$300 in API costs, repositories shipped overnight, complex projects built autonomously over weeks of iteration.

## How Ralph Works

```
┌─────────────────────────────────────────────────────────────┐
│  ITERATION N                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Fresh Context Window (100% capacity)                │   │
│  │ • Load session file (specs + progress)              │   │
│  │ • Pick ONE task from Remaining                      │   │
│  │ • Execute task                                      │   │
│  │ • Update session file                               │   │
│  │ • Exit                                              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
              Session file persists to disk
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  ITERATION N+1                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Fresh Context Window (100% capacity again)          │   │
│  │ • No memory of previous iteration's reasoning       │   │
│  │ • Only knows state through session file             │   │
│  │ • Full cognitive capacity for next task             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

The magic is in what's NOT carried forward: reasoning chains, attempted approaches, accumulated confusion. Each iteration sees only the clean state and brings full capacity to the next task.

## This Implementation

### Beyond Raw Bash

While the raw bash loop works, this CLI adds structure that improves outcomes. It provides interactive initialization with clarifying questions (because garbage in equals garbage out), iterative refinement to solidify task specs before execution, and automatic planning to break work into discrete, iteration-sized tasks. The CLI also handles status detection for automatic termination and manages sessions through structured markdown files.

### The Five-Phase Workflow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  1. PROMPT                                                                   │
│     "What would you like to build?"                                          │
│                                                                              │
│  2. INIT (interactive)                                                       │
│     Claude asks clarifying questions                                         │
│     Creates session file with task spec                                      │
│     /exit or CTRL-C when done to proceed                                     │
│                                                                              │
│  3. REFINE (interactive, loop)                                               │
│     "Refine the task further? (y/N)"                                         │
│     If yes → Claude improves task spec → ask again                           │
│     If no (or Enter) → proceed                                               │
│     /exit or CTRL-C when done to proceed                                     │
│                                                                              │
│  4. PLAN (non-interactive)                                                   │
│     Claude breaks down into steps                                            │
│     Adds Status/Completed/Remaining sections                                 │
│                                                                              │
│  5. EXECUTE (non-interactive, loop)                                          │
│     Fresh Claude instances iterate                                           │
│     Until DONE/BLOCKED/max iterations                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

You start by describing what you want built, as detailed as you like. Claude then asks 2-4 clarifying questions to fill gaps in your description—this is crucial, because ambiguity here compounds into wasted iterations later.

Next comes an optional refinement loop where you can keep improving the task specification until it feels solid. Once you're satisfied, Claude breaks the task into discrete steps, each sized for a single iteration, creating the Remaining list that will guide execution.

Then the Ralph loop proper begins. Fresh instances work through tasks one at a time until done, blocked, or max iterations reached.

### Session File Structure

Sessions live in your system's temp directory (`$TMPDIR/ralph/`). Each is a markdown file:

```markdown
# Session: abc123
Created: 2025-01-27T10:30:00.000Z
Working Directory: /path/to/project

## Task
[Detailed task specification from init and refine phases]

## Status: IN_PROGRESS

## Completed
- [x] Items that have been done...

## Current Focus
What's being worked on right now...

## Remaining
- [ ] Items left to do...

## Notes
Observations, context, blockers...
```

The Task section stays immutable after planning—it's the north star for all iterations. Status enables automatic termination when the loop detects DONE or BLOCKED. Completed and Remaining track progress so each fresh instance knows what's been done and what's left. Current Focus tells the iteration what to work on right now. Notes captures observations that might help future iterations.

## Installation

```bash
# Install dependencies
npm install

# Build
npm run build

# Link globally
npm link
```

## Usage

```bash
ralph                         # Full interactive workflow (default)
ralph resume <id>             # Resume a blocked or interrupted session
ralph resume <id> "message"   # Resume with context for Claude
ralph list                    # List all sessions
ralph -m 10                   # With custom max iterations (default: 50)
```

One command runs the complete workflow. Use `ralph list` to see existing sessions and `ralph resume <id>` to continue where you left off.

### Parallel Work

Run `ralph` in multiple terminals for parallel workstreams. Each creates an independent session:

```bash
# Terminal 1
ralph     # "Build user authentication"

# Terminal 2
ralph     # "Add payment processing"
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Task completed (DONE status) |
| 1 | Task blocked or error |
| 2 | Max iterations reached |
| 3 | Verification exhausted (all attempts failed) |
| 4 | Code review exhausted (all attempts failed) |
| 130 | Interrupted (Ctrl+C) |

### Done Gate: Code Review + Verification

When the developer marks the task as DONE, Ralph runs a two-stage gate before accepting completion:

**Stage 1: Code Review (white-box)**
A reviewer agent with full source access runs type-checking, linting, tests, and checks implementation completeness against the task spec. This catches code-level issues cheaply before they waste a black-box verifier attempt. Up to 2 attempts.

**Stage 2: Verification (black-box)**
A verifier agent with no source access tests the work through the browser (Playwright) or CLI commands. This catches cases where the developer claims completion but the feature doesn't actually work. Up to 3 attempts.

The pipeline: Developer says DONE → Code Review → if PASS → Verification → if PASS → exit 0

If either stage fails, feedback is passed back to the developer for another iteration. If a stage exhausts its attempts, the session is marked blocked.

**Verification modes:**

During planning, Claude writes a `## Verification` section into the session file:

```markdown
## Verification
mode: browser
entry: http://localhost:5173
```

| Mode | Interface | Tools |
|------|-----------|-------|
| `browser` | Playwright (navigate, click, type) | `mcp__plugin_playwright_playwright__*` |
| `cli` | Shell commands (restricted to specified prefixes) | `Bash(<prefix>:*)` |
| `none` | Skip verification | — |

The developer agent maintains the `## Verification` section during execution — if the dev server port changes, the entry point gets updated automatically.

**Opting out:**

```bash
ralph start --no-verify     # Disable both code review and verification
ralph start --no-review     # Disable code review only (verification still runs)
ralph resume <id> --no-verify
ralph resume <id> --no-review
```

## Tips

Be specific—clear success criteria help Claude know when it's done. Use the refine loop and keep refining until your task spec is solid. Start with low iterations (`-m 3`) before running longer loops. Commit between runs to track changes. And remember that sessions are ephemeral; they live in the temp directory and clean up on reboot.

## For Contributors (Human and LLM)

### Core Alignment Principles

The methodology works BECAUSE it's simple. When contributing, resist the urge to add complexity.

One task per iteration is sacred—this is the entire point of Ralph. Session files are the single source of truth, so don't add alternative state mechanisms. Don't fight context rot; embrace it through fresh instances. And remember that the loop is the feature, not a workaround or limitation.

### Design Decisions

The TypeScript CLI wrapper adds user experience—interactive phases, status detection, structured output—while preserving the core loop mechanics. The raw bash loop works, but the wrapper makes it more approachable.

The interactive init phase exists because garbage in equals garbage out. Time spent clarifying upfront saves many wasted iterations later.

Sessions live in the temp directory because they're ephemeral by design. Git tracks the real work; sessions are working memory that should be discarded.

### What NOT to Do

Don't preserve state between iterations in memory—files only. Don't make iterations try to do multiple tasks; one task per iteration is the whole point. If your change makes the loop more complicated, reconsider. And don't optimize for fewer iterations—more iterations at lower cost beats fewer iterations that might fail.

## Credits

Based on the [Ralph Wiggum methodology](https://ghuntley.com/ralph/) by Geoffrey Huntley.
