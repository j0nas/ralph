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
A good summary for a web application:

```
## Summary

### What was built
A recipe sharing platform built with Next.js, TypeScript, and SQLite (via Drizzle ORM). Users can browse recipes, search by ingredient or tag, create accounts, and save favorites to a personal cookbook. Server-rendered pages for fast loads.

### Current state
Builds cleanly. 24 tests passing. Full flow works: browse → search → view recipe → sign up → save to cookbook. Seeded with 20 sample recipes.

### How to run
npm install && npm run dev — opens on http://localhost:3000. Database auto-migrates on first run.

### Known limitations
- No image upload — recipes use placeholder images
- No social features (comments, ratings, sharing)
- Search is basic substring matching, no fuzzy/typo tolerance

### Suggested next steps
- Add image upload with S3 or local storage
- Add recipe ratings and comments
- Improve search with full-text indexing
```
</example>
<example>
A good summary for a CLI tool:

```
## Summary

### What was built
A line-level diff tool in TypeScript using the Myers algorithm (same as git diff). Supports file-to-file and directory comparison with colored output, unified diff format, and whitespace-ignoring options.

### Current state
Builds cleanly. 31 tests passing (18 unit, 13 integration). Handles edge cases: empty files, binary detection, identical inputs, large files.

### How to run
npm install && npm run build && npm link — then use `difftool file1 file2` from anywhere. Use `--unified` for patch-compatible output, `--ignore-whitespace` to skip whitespace-only changes.

### Known limitations
- No word-level or character-level diff (line-level only)
- Directory mode doesn't recurse into subdirectories
- No side-by-side output format

### Suggested next steps
- Add recursive directory comparison
- Add word-level diff highlighting within changed lines
- Add `--side-by-side` output mode
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
