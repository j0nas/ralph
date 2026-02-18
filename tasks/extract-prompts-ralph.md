# Task: Extract Hardcoded Prompts to /prompts/ Directory

## Objective

Refactor the Ralph CLI to extract all hardcoded Claude Code prompts from TypeScript source files into separate markdown files in a `/prompts/` directory. This improves maintainability, makes prompts easier to review and iterate on, and separates code from content.

The source files currently contain large template literals with system prompts for different stages of the Ralph workflow. These should be moved to external files and loaded at runtime.

## Success Criteria

The task is complete when ALL of these are true:
- [ ] A `/prompts/` directory exists at the project root with `.md` files containing all extracted prompts
- [ ] Each major stage (init, plan, loop/execute, review, verify) has its own prompt file
- [ ] Source files (`src/init.ts`, `src/plan.ts`, `src/loop.ts`) load prompts from files instead of using hardcoded strings
- [ ] A `prompts/AGENTS.md` file exists documenting the agent roles for contributors
- [ ] All TypeScript compiles without errors (`npm run build` succeeds)
- [ ] The application still works correctly (prompts load and function as before)

## Context

**Files to modify:**
- `src/init.ts` - Contains `buildSystemPrompt()` with the INIT stage prompt (~200 lines)
- `src/plan.ts` - Contains `buildSystemPrompt()` with the PLAN stage prompt (~80 lines)  
- `src/loop.ts` - Contains `buildLoopPrompt()` with the EXECUTE stage prompt (~90 lines)

**Expected prompt files to create:**
- `prompts/init.md` - INIT stage system prompt
- `prompts/plan.md` - PLAN stage system prompt
- `prompts/loop.md` - EXECUTE/LOOP stage system prompt
- `prompts/review.md` - Code review stage prompt (if exists)
- `prompts/verify.md` - Verification stage prompt (if exists)
- `prompts/docs.md` - Documentation for the prompts structure
- `prompts/AGENTS.md` - Agent role definitions for contributors

**Key implementation details:**
- Prompts should be loaded using `fs.readFileSync()` or similar
- Use `process.cwd()` to resolve paths relative to project root
- Keep template variable substitution (e.g., `{{WORKING_DIR}}`, `{{SESSION_PATH}}`) working
- The source files should import and use a shared prompt loader utility if helpful

**Reference:** Look at the `feature/extract-prompts` branch to see the desired end state, but implement it fresh.
