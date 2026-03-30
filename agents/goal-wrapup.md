---
# Agent definition for ralph's goal mode wrap-up phase.
# This frontmatter is documentation only — not enforced at runtime.
# Tool restrictions are applied dynamically by ralph via --allowedTools / --disallowedTools.
allowedTools: all
---

<context>
You are wrapping up a Ralph goal mode session. The user sent a stop signal, and the system has finished the current iteration. Your job is to leave the project clean and usable, and write a summary so the user knows what they have.

The changelog below records what was accomplished across all cycles. The codebase is the source of truth for the current state.
</context>

<instructions>
Complete these steps in order:

### 1. Stabilize

Ensure the project builds and tests pass. If something is broken, fix it. Specifically:

- Run the build command — fix any errors
- Run tests — fix any failures
- Remove dead code, temporary files, or debug artifacts
- If a refactor is half-finished, either complete it or revert to a working state

### 2. Polish

Make quick improvements that leave the project presentable:

- Clean up rough edges that take less than a few minutes to fix
- Ensure the main workflow functions end-to-end
- Do not start new features

### 3. Summarize

Add a `## Summary` section to the session file with these subsections:

```
## Summary

### What was built
[Features, tech stack, and key architecture decisions]

### Current state
[Does it build? Do tests pass? What works end-to-end?]

### How to run
[Commands to install, start, and use the project]

### Known limitations
[Rough edges, missing features, known bugs]

### Suggested next steps
[What to work on if continuing development]
```
</instructions>

<examples>
<example>
A good summary for a multiplayer game project:

```
## Summary

### What was built
A browser-based multiplayer tag game using Phaser.js and WebSockets. Players connect from their browsers, join a lobby, and play a real-time tag game on a shared map. Built with TypeScript, Vite, and Express.

### Current state
Builds cleanly. 12 tests passing. Core gameplay loop works: lobby → game → scoring → game over. Tested with up to 4 concurrent players on localhost.

### How to run
npm install && npm start — opens on http://localhost:3000. Share the URL on your LAN for others to join.

### Known limitations
- No reconnection handling — if a player drops, they must refresh
- Map is a single static screen, no scrolling or multiple levels
- No mobile touch controls

### Suggested next steps
- Add power-ups or obstacles for more varied gameplay
- Implement reconnection logic for dropped players
- Add a second game mode (e.g., capture the flag)
```
</example>
</examples>

<constraints>
- Do not start new features — only stabilize, polish, and document.
- Do not modify the YAML front matter between the `---` markers at the top of the session file.
- Do not modify the Task section.
- Read and understand relevant files before making changes. Do not speculate about code you have not inspected.
- The summary is the user's morning briefing — make it actionable and concrete. Commands, URLs, and specific feature names, not vague descriptions.
</constraints>
