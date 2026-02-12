# Agent Prompts

Practical reference for editing Ralph's agent prompts. Based on Anthropic's prompting guidelines for Claude 4.

## Agent Architecture

### Agent prompts (loaded from disk)

| Agent file | Purpose | Tools | Called from |
|---|---|---|---|
| `agents/reviewer.md` | White-box code review (build, spec, integration) | Read, Glob, Grep, Bash | `src/review.ts` → `runClaudeReviewer()` |
| `agents/verifier-browser.md` | Black-box browser testing via Playwright | `mcp__plugin_playwright_playwright__*` | `src/verify.ts` → `runClaudeVerifier()` |
| `agents/verifier-cli.md` | Black-box CLI testing via allowed commands | `Bash(<prefix>:*)` | `src/verify.ts` → `runClaudeVerifier()` |
| `agents/verifier-custom.md` | Custom verification (user-defined tools) | Varies | `src/verify.ts` → `runClaudeVerifier()` |

All agents are loaded at runtime from disk (`agents/*.md`). YAML frontmatter is stripped before injection. Tool restrictions are enforced by `--allowedTools` / `--disallowedTools` flags in `src/claude.ts`, not by the prompt itself.

### Inline prompts (built in TypeScript)

| Builder function | Purpose | File |
|---|---|---|
| `buildSystemPrompt()` | Task spec creation (interactive init) | `src/init.ts` |
| `buildIterateSystemPrompt()` | Task spec refinement (interactive refine) | `src/init.ts` |
| `buildSystemPrompt()` | Task breakdown into steps (planning) | `src/plan.ts` |
| `buildPrompt()` | Developer loop iteration | `src/loop.ts` |
| `buildUserPrompt()` | Review user prompt (task + completed) | `src/review.ts` |
| `buildUserPrompt()` | Verify user prompt (task + completed) | `src/verify.ts` |

### Prompt assembly

The calling code in `src/claude.ts` passes two prompts to `claude --print`:

- **System prompt** (`--system-prompt`): dynamic preamble (working directory, entry point) + agent markdown
- **User prompt** (stdin): task description + completed items, wrapped in XML tags

See `src/review.ts:buildUserPrompt()` and `src/verify.ts:buildUserPrompt()` for the user prompt templates.

## General Principles

1. **Be explicit, not prohibitive.** Tell the agent what to do, not just what to avoid. A list of 20 "do nots" is harder to follow than 3 clear steps.

2. **Provide motivation.** Explain *why* a rule exists. Claude 4 follows instructions better when it understands the reasoning. Example: "Only review code the developer changed — pre-existing issues waste verifier attempts" is better than "Do not review pre-existing code."

3. **Keep it direct.** Avoid hedging language ("you might want to consider..."). State expectations plainly.

4. **Use structured sections.** Headers, numbered steps, and tables are easier for the model to follow than long prose paragraphs. Each section should have a single concern.

5. **Separate reasoning from output.** When the agent needs to produce a structured verdict, tell it to reason first, then emit the verdict separately. This prevents the model from committing to a verdict too early and then rationalizing it.

## XML Tag Conventions

Ralph uses XML tags to delimit variable content injected into prompts. This makes boundaries unambiguous for the model.

| Tag | Used in | Content |
|---|---|---|
| `<task>` | Review/verify user prompt | The task description from the session file |
| `<completed>` | Review/verify user prompt | Completed items from the session file |
| `<session>` | Developer system prompt | Full session file content |
| `<context>` | Developer system prompt | Contextual information block |
| `<instructions>` | Developer system prompt | Behavioral instructions |
| `<user-message>` | Developer system prompt | The user's original message |
| `<your_task>` | Init/plan system prompt | What the agent should do |
| `<guidelines>` | Init/plan system prompt | Constraints and tips |

When adding new variable content to a prompt, wrap it in a descriptive XML tag rather than using markdown headers or inline delimiters.

## Claude 4 Tips

These are specific to Claude 4 (Opus/Sonnet) behavior:

- **Don't over-prompt tool usage.** Claude 4 is good at deciding when and how to use tools. Listing every possible tool invocation as an explicit step makes the prompt longer without improving results. State the *goal* and let the model figure out the tool calls.

- **Avoid encouraging overthinking.** Phrases like "think carefully" or "consider all possibilities" can cause Claude 4 to spiral into excessive analysis. Be concrete about what to check.

- **Long context handling.** When the user prompt contains large amounts of context (full task specs, completion lists), use XML tags to delimit sections. The model attends to tagged boundaries more reliably than markdown headers buried in long text.

- **Verdicts.** Have the agent write its analysis first, then emit the verdict at the end. This "reasoning then answer" pattern produces more accurate judgments than asking for the verdict upfront.

- **Avoid emphatic language.** ALL CAPS (`MUST`, `IMPORTANT`), bold emphasis on behavioral words (`**SKEPTICAL**`), and aggressive framing ("adversarial") cause overtriggering on Claude 4. The model follows normal-cased instructions just as well. Write "Do not modify the front matter" instead of "IMPORTANT: Do NOT modify the front matter."

- **Frame agents as thorough, not antagonistic.** "You are a thorough QA agent" produces better-calibrated testing than "You are an adversarial QA agent." Aggressive framing makes the model test irrelevant edge cases. State what thoroughness means for the specific task.

- **Remove legacy anti-laziness prompts.** Older Claude models needed nudges like "be thorough" or "don't skip steps." On Claude 4 these cause excessive exploration and overthinking. If the model has clear steps, it follows them without encouragement.

## Editing Checklist

When modifying an agent prompt:

1. Read the calling code (`src/review.ts` or `src/verify.ts`) to understand what gets injected and how the output is parsed
2. Check that the verdict format matches the regex in `parseVerdict()` — it expects `## VERDICT: PASS` or `## VERDICT: FAIL`
3. Keep the prompt under ~2000 words — longer prompts dilute the important instructions
4. Test with `ralph run` on a simple task to confirm the agent produces output in the expected format
5. Verify the agent's tool restrictions match what the prompt describes (frontmatter is documentation only)
6. Don't add instructions that duplicate what the tools already enforce (e.g., "don't write files" when Write is already disallowed)
7. After editing, run `npm run build` to confirm nothing broke in the TypeScript layer
