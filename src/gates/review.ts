import type { ReviewConfig } from '../config.js';
import { runClaudeReviewer, type ToolConfig } from '../infra/claude.js';
import {
  extractTaskSummary,
  parseFrontMatter,
  readSession,
  updateFrontMatter,
  writeSession,
} from '../infra/session.js';
import { reviewFailed, reviewPassed, showReview } from '../ui/ui.js';
import { loadAgentPrompt, parseVerdict } from './shared.js';

export interface ReviewResult {
  passed: boolean;
  feedback: string;
}

function resolveToolConfig(): ToolConfig {
  return {
    allowedTools: 'Read,Glob,Grep,Bash',
    disallowedTools: 'Write,Edit,WebFetch,WebSearch,Task',
  };
}

function buildUserPrompt(task: string, completed: string): string {
  return `The developer claims all success criteria are met. Review the code.

<task>
${task}
</task>

<completed>
${completed || '(Nothing marked as completed yet)'}
</completed>

Run the toolchain (type-checking, linting, tests, build). Check completeness against the task spec. Assess how the implementation fits into the existing codebase.`;
}

export async function runReview(
  sessionId: string,
  config: ReviewConfig,
): Promise<ReviewResult> {
  const sessionContent = await readSession(sessionId);

  // Read current attempt count from front matter
  const frontMatter = parseFrontMatter(sessionContent);
  const currentAttempts = frontMatter?.reviewAttempts ?? 0;
  const attempt = currentAttempts + 1;

  showReview(attempt, config.maxAttempts);

  // Update stage to reviewing
  const updatedContent = updateFrontMatter(sessionContent, {
    stage: 'reviewing',
    reviewAttempts: attempt,
  });
  await writeSession(sessionId, updatedContent);

  // Extract task context
  const { task, completed } = extractTaskSummary(sessionContent);

  // Build prompts
  const agentPrompt = await loadAgentPrompt('reviewer.md');
  const systemPrompt = `Working directory: ${process.cwd()}\n\n${agentPrompt}`;
  const userPrompt = buildUserPrompt(task, completed);

  // Resolve tool restrictions
  const toolConfig = resolveToolConfig();

  // Run the reviewer
  const output = await runClaudeReviewer(systemPrompt, userPrompt, toolConfig);

  // Parse verdict
  const passed = parseVerdict(output);

  if (passed) {
    reviewPassed();
  } else {
    reviewFailed(output);
  }

  // Restore stage to running
  // Only count failed attempts toward the budget — passing reviews shouldn't
  // consume retry slots (e.g. when verification fails after review passes)
  const postContent = await readSession(sessionId);
  const restored = updateFrontMatter(postContent, {
    stage: 'running',
    ...(passed ? { reviewAttempts: currentAttempts } : {}),
  });
  await writeSession(sessionId, restored);

  return { passed, feedback: passed ? '' : output };
}
