- [ ] Support for more autonomous modes and fewer questions in --iterate that can be answered by tools:
  > "Only ask the user questions that you can't answer yourself. Prefer to use your available tools to find the answer. Proactively use your available MCP servers, codebase search, web search, etc. to find the answer. Think hard about what the user wants and what would make them happiest. What is the user trying to accomplish at a higher level? What would "success" look like from their perspective? The stated goal is a starting point, not a complete specification. The user trusts you to make good decisions independently. They likely don't know the best way to achieve their goal and don't have all the answers. You are a SMART AND CAPABLE agent able to work AUTONOMOUSLY, not a mere task executor."
- [ ] Input field so it's possible to steer the model in real time?
- [ ] Include verification prompts as part of each iteration. Use available tools to verify that the model is on the right track. Trust hierarchy: prioritize "objective, external verification": Playwright > Linters > Integration tests against real APIs (remember cleanup!) > Unit tests
- Encourage parallelism/subagent use where possible to speed up the process
- [ ] Mode to create "Project Goals" file that models can use to guide their behavior, re: "Decision-Making Principles" 

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