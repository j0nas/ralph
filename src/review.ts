import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runClaudeReviewer, type ToolConfig } from './claude.js';
import type { ReviewConfig } from './config.js';
import {
  extractTaskSummary,
  parseFrontMatter,
  readSession,
  updateFrontMatter,
  writeSession,
} from './session.js';
import { reviewFailed, reviewPassed, showReview } from './ui.js';

export interface ReviewResult {
  passed: boolean;
  feedback: string;
}

const __dirname = join(fileURLToPath(import.meta.url), '..');
let cachedAgentPrompt: string | undefined;

async function loadAgentPrompt(): Promise<string> {
  if (cachedAgentPrompt) return cachedAgentPrompt;

  const agentPath = join(__dirname, '..', 'agents', 'reviewer.md');
  const content = await readFile(agentPath, 'utf-8');

  // Strip YAML frontmatter
  const stripped = content.replace(/^---\n[\s\S]*?\n---\n*/, '').trim();
  cachedAgentPrompt = stripped;
  return stripped;
}

function resolveToolConfig(): ToolConfig {
  return {
    allowedTools: 'Read,Glob,Grep,Bash',
    disallowedTools: 'Write,Edit,WebFetch,WebSearch,Task',
  };
}

function buildUserPrompt(task: string, completed: string): string {
  return `ALL success criteria are claimed to be met. Review the code thoroughly.

## Task Description
${task}

## What Was Completed
${completed || '(Nothing marked as completed yet)'}

Now review the implementation. Run type-checking, linting, and tests. Verify completeness against the task spec. Check for obvious bugs.`;
}

function parseVerdict(output: string): boolean {
  const verdictMatch = output.match(/## VERDICT:\s*(PASS|FAIL)/gi);
  if (!verdictMatch) return false;
  const last = verdictMatch[verdictMatch.length - 1];
  return /PASS/i.test(last);
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
  const agentPrompt = await loadAgentPrompt();
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
  const postContent = await readSession(sessionId);
  const restored = updateFrontMatter(postContent, { stage: 'running' });
  await writeSession(sessionId, restored);

  return { passed, feedback: passed ? '' : output };
}
