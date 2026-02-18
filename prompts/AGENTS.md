# Ralph Agent Prompts

This directory contains the system prompts used by each stage of the Ralph workflow. These are loaded at runtime from markdown files, making them easy to review, iterate on, and version separately from the code.

## Agent Roles

### `init.md` — Task Specification Agent

Used by `ralph init`. Guides a Claude session to ask clarifying questions and write a complete task specification into the session file.

**Purpose:** Translate a vague goal into an explicit, verifiable task spec that downstream agents can act on.

**Template variables:**
- `{{WORKING_DIR}}` — the current working directory where Ralph is invoked
- `{{SESSION_PATH}}` — absolute path to the session file to be updated

---

### `iterate.md` — Task Refinement Agent

Used by `ralph iterate`. Guides a Claude session to improve an existing task specification by identifying gaps and ambiguities.

**Purpose:** Strengthen an existing spec before planning begins.

**Template variables:**
- `{{WORKING_DIR}}` — the current working directory
- `{{SESSION_PATH}}` — absolute path to the session file to be updated

---

### `plan.md` — Planning Agent

Used by `ralph plan`. Analyzes a task specification and adds structured progress tracking sections (Status, Completed, Remaining, Verification) to the session file.

**Purpose:** Break a task spec into a concrete, ordered list of steps that individual loop iterations can execute one at a time.

**Template variables:**
- `{{WORKING_DIR}}` — the current working directory
- `{{SESSION_PATH}}` — absolute path to the session file to be updated

---

### `loop.md` — Build/Execute Agent

Used by the `ralph run` loop for each iteration. Provides the full session context and instructions for completing one meaningful unit of work per iteration.

**Purpose:** Execute a single step of the plan, update the session file, and exit so the next iteration starts fresh.

**Template variables:**
- `{{WORKING_DIR}}` — the current working directory
- `{{SESSION_PATH}}` — absolute path to the session file
- `{{SESSION_CONTENT}}` — full contents of the session file (injected at runtime)
- `{{USER_MESSAGE_SECTION}}` — optional user message block when resuming with `-m` (empty string if not provided)

---

## Other Agent Prompts

The `agents/` directory at the project root contains prompts for the review and verification gates:

- `agents/reviewer.md` — Code review gate (read-only access, checks build/tests/spec coverage)
- `agents/verifier-browser.md` — Black-box browser verifier (Playwright)
- `agents/verifier-cli.md` — Black-box CLI verifier (restricted Bash)
- `agents/verifier-custom.md` — Custom verification mode

## Adding or Modifying Prompts

1. Edit the `.md` file in this directory
2. Template variables use `{{VARIABLE_NAME}}` syntax and are substituted at runtime by `src/prompts.ts`
3. No code changes are needed for content-only edits
4. Run `npm run build` after modifying `src/prompts.ts` to verify TypeScript compiles correctly
