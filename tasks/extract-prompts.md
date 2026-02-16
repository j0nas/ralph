# Task: Extract Hardcoded Prompts to /prompts/ Directory

## Objective

Move all hardcoded system prompts from Ralph's source files into separate .md files in a /prompts/ directory. The prompts must adhere to Anthropic's best practices as defined in the prompt-engineering skill.

## Why

- Makes prompts easier to iterate on without touching code
- Enables prompt versioning and A/B testing
- Follows TODO.md goal: Extract all prompts to /prompts/ directory with an AGENTS.md covering prompting best practices
- Improves maintainability and allows non-developers to tweak prompts

## Files to Extract Prompts From

1. **src/init.ts** - Contains:
   - `buildSystemPrompt()` - System prompt for initial task specification creation
   - `buildIterateSystemPrompt()` - System prompt for refining task specifications

2. **src/loop.ts** - Contains:
   - `buildPrompt()` - Large main instruction prompt for each iteration loop

3. **src/plan.ts** - Contains:
   - Planning stage system prompt for breaking tasks into steps

4. **src/review.ts** - Contains:
   - Code review system prompt (white-box review)

5. **src/verify.ts** - Contains:
   - Verification system prompt (black-box testing)

## Required Output Structure

```
/prompts/
├── init/
│   ├── system.md          # Initial task specification prompt
│   └── iterate.md         # Refinement iteration prompt
├── loop/
│   └── main.md            # Main iteration loop prompt
├── plan/
│   └── system.md          # Task planning prompt
├── review/
│   └── system.md          # Code review prompt
├── verify/
│   └── system.md          # Browser/CLI verification prompt
└── AGENTS.md              # Anthropic prompting best practices guide
```

## AGENTS.md Requirements

Create AGENTS.md at `/prompts/AGENTS.md` that documents:
1. Anthropic prompting best practices (reference .claude/skills/prompt-engineering/anthropic-best-practices.md)
2. Ralph-specific prompt patterns
3. Guidelines for maintaining prompts
4. Examples of well-structured prompts from this project

## Success Criteria

- [ ] All system prompts extracted from src/ files to /prompts/**/*.md
- [ ] Each prompt file is a valid markdown file with clear structure
- [ ] Source files import and use prompts from /prompts/ instead of hardcoded strings
- [ ] AGENTS.md created with comprehensive prompting best practices
- [ ] Each extracted prompt has been reviewed against Anthropic best practices checklist:
  - [ ] Prompt is self-contained (no assumed memory)
  - [ ] XML tags separate role, context, instructions, completion criteria
  - [ ] Instructions use action-oriented language
  - [ ] Exit conditions (DONE/IN_PROGRESS/BLOCKED) explicitly defined
  - [ ] Examples show expected output format
  - [ ] Code exploration requirement included
  - [ ] No contradictory instructions
- [ ] Code compiles successfully (`npm run build`)
- [ ] Ralph still functions correctly (can create session, run iteration)

## Context

The prompt-engineering skill at `.claude/skills/prompt-engineering/` contains:
- SKILL.md - Core rules and anti-patterns for Ralph-specific prompts
- anthropic-best-practices.md - Full Anthropic prompting reference

Use these to verify all extracted prompts follow best practices before marking DONE.

## Notes

- Keep prompts functionally identical when extracting (don't change behavior yet, just location)
- Use ES modules (import/readFile) to load prompts at runtime
- Consider caching prompts in memory after first load for performance
- Ensure proper error handling if prompt files are missing