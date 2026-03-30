- [ ] Input field so it's possible to steer the model in real time?
- [ ] Include verification prompts as part of each iteration. Use available tools to verify that the model is on the right track. Trust hierarchy: prioritize "objective, external verification": Playwright > Linters > Integration tests against real APIs (remember cleanup!) > Unit tests
- Encourage parallelism/subagent use where possible to speed up the process
- [ ] Mode to create "Project Goals" file that models can use to guide their behavior, re: "Decision-Making Principles" 
- [ ] Extract all prompts to /prompts/ directory with an AGENTS.md covering prompting best practices from Anthropic docs

Prompt excerpt that worked well in another project: 

## Decision-Making Principles

When you encounter ambiguous situations or implementation choices not explicitly covered in this prompt:

< assuming a PROJECT_GOALS.md file exists? >
1. **Consult PROJECT_GOALS.md** - Read and internalize the project's core principles:
   - Zero-config by default, configurable when needed
   - Transparency over magic
   - Speed matters
   - Developer experience is the product

< encouraging autonomous behavior >
2. **Do web research** - Use WebSearch and WebFetch to find current best practices:
   - Search for how other platforms handle similar problems (Railway, Render, Vercel)
   - Look up Neon-specific recommendations and common pitfalls
   - Find current documentation if Context7 results seem outdated

< aligning with specific project's goals >
3. **Optimize for the target user** - Side project developers who want things to "just work":
   - Prefer sensible defaults over configuration options
   - Prefer resilient/retry behavior over failing fast
   - Prefer clear error messages that suggest fixes