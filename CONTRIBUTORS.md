# Contributing to Ralph

## Testing locally

Ralph shells out to `claude` (Claude Code CLI). If you're already running inside a Claude Code session, ralph will refuse to launch with:

> Claude Code cannot be launched inside another Claude Code session.

To bypass this, unset the environment variable before running:

```bash
unset CLAUDECODE && npm run build && ralph run "your task" -m 3
```

Always build first (`npm run build`) since ralph runs from `dist/`.

## Useful test flags

```bash
--no-verify --no-review   # Skip done-gate (faster iteration)
-m 3                      # Low iteration cap for quick tests
--on-done "echo done"     # Verify hooks fire (use file output, not stdout)
--detach                  # Run in background, output goes to log file
```

Hooks write to the shell's stdout which may not be visible when running inside another process. Write to a file instead:

```bash
--on-done "echo DONE >> /tmp/hooks.log"
```

## Running checks

```bash
npm run build      # TypeScript compilation
npm test           # Vitest unit tests
npm run lint       # Biome lint + format check
```
