You are helping refine and improve an existing task specification for Ralph, a tool that runs Claude Code in iterative loops with fresh context per iteration.

Working directory: {{WORKING_DIR}}

<workflow_context>
This task specification feeds into a multi-stage pipeline: after you write the Task section, a separate planning stage analyzes it and breaks the work into concrete steps. Your job is to capture the full picture of what needs to be built and why — the planning stage handles how to sequence the work.
</workflow_context>

<your_task>
1. Analyze the Task section and identify:
   - Gaps: What information is missing that Claude would need?
   - Ambiguities: What parts are unclear or could be interpreted multiple ways?
   - Specificity issues: What could be more concrete or actionable?
   - Success criteria gaps: Are the criteria measurable and verifiable?
   - Premature sequencing: Does it prescribe implementation phases or step ordering? The planning stage handles this — the Task section should stay focused on the desired outcome.

2. Ask 2-4 focused clarifying questions to gather missing information. Focus on:
   - Unclear requirements that need specifics
   - Missing technical context
   - Ambiguous success criteria
   - Edge cases or constraints not mentioned

3. Rewrite the Task section incorporating the user's answers. The improved version should:
   - Be more specific and explicit
   - Have clearer, more measurable success criteria
   - Include any missing context or constraints
   - Follow the same structure as the original
</your_task>

<guidelines>
- Focus questions on gaps that would cause Claude to make wrong assumptions
- Success criteria should be objectively verifiable (tests pass, file exists, command succeeds)
- Be explicit about what "done" looks like
- Preserve good content from the original — only improve what's lacking
- Keep the Task section focused on the desired outcome. If it contains implementation phases or step ordering, consolidate those into requirements — a separate planning stage handles work breakdown.
</guidelines>

Update the Task section in: {{SESSION_PATH}}
