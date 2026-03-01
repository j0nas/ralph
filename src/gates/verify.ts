import type { VerifyConfig } from '../config.js';
import { runClaudeVerifier, type ToolConfig } from '../infra/claude.js';
import {
  extractTaskSummary,
  extractVerificationSection,
  parseFrontMatter,
  readSession,
  updateFrontMatter,
  type VerificationSection,
  writeSession,
} from '../infra/session.js';
import {
  showVerification,
  verificationFailed,
  verificationPassed,
} from '../ui/ui.js';
import { loadAgentPrompt, parseVerdict } from './shared.js';

export interface VerificationContext {
  task: string;
  completed: string;
}

export interface VerificationResult {
  passed: boolean;
  feedback: string;
}

function buildDynamicPreamble(resolved: VerificationSection): string {
  const labels: Record<string, string> = {
    browser: `Entry point URL: ${resolved.entry}`,
    cli: `Allowed commands: ${resolved.entry}`,
  };
  return labels[resolved.mode];
}

export function extractVerificationContext(
  sessionContent: string,
): VerificationContext {
  const { task, completed } = extractTaskSummary(sessionContent);
  return { task, completed };
}

function buildUserPrompt(context: VerificationContext): string {
  return `The developer claims all success criteria are met. Verify the work.

<task>
${context.task}
</task>

<completed>
${context.completed || '(Nothing marked as completed yet)'}
</completed>

Test the implementation through the allowed interface. Confirm each success criterion is met.`;
}

export async function buildVerificationPrompt(
  context: VerificationContext,
  resolved: VerificationSection,
): Promise<{ systemPrompt: string; userPrompt: string }> {
  const agentPrompt = await loadAgentPrompt(`verifier-${resolved.mode}.md`);
  const preamble = buildDynamicPreamble(resolved);
  const systemPrompt = `${preamble}\n\n${agentPrompt}`;
  return {
    systemPrompt,
    userPrompt: buildUserPrompt(context),
  };
}

export function resolveToolConfig(resolved: VerificationSection): ToolConfig {
  switch (resolved.mode) {
    case 'browser':
      return {
        allowedTools: 'mcp__plugin_playwright_playwright__*',
        disallowedTools:
          'Read,Write,Edit,Glob,Grep,Bash,WebFetch,WebSearch,Task',
      };

    case 'cli': {
      // entry is comma-separated command prefixes like "ralph,npm"
      const prefixes = resolved.entry.split(',').map((p) => p.trim());
      const allowed = prefixes.map((p) => `Bash(${p}:*)`).join(',');
      return {
        allowedTools: allowed,
        disallowedTools: 'Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,Task',
      };
    }

    default:
      return {
        allowedTools: undefined,
        disallowedTools: 'Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,Task',
      };
  }
}

export async function runVerification(
  sessionId: string,
  config: VerifyConfig,
): Promise<VerificationResult> {
  // Resolve mode/entry from session file
  const sessionContent = await readSession(sessionId);
  const resolved = extractVerificationSection(sessionContent);

  if (!resolved) {
    // No verification section or mode: none — skip silently
    return { passed: true, feedback: '' };
  }

  // Read current attempt count from front matter
  const frontMatter = parseFrontMatter(sessionContent);
  const currentAttempts = frontMatter?.verificationAttempts ?? 0;
  const attempt = currentAttempts + 1;

  showVerification(attempt, config.maxAttempts, resolved.mode);

  // Update stage to verifying
  const updatedContent = updateFrontMatter(sessionContent, {
    stage: 'verifying',
    verificationAttempts: attempt,
  });
  await writeSession(sessionId, updatedContent);

  // Extract context (full, unsanitized — information barrier is in the agent prompt)
  const context = extractVerificationContext(sessionContent);

  // Build prompts
  const { systemPrompt, userPrompt } = await buildVerificationPrompt(
    context,
    resolved,
  );

  // Resolve tool restrictions
  const toolConfig = resolveToolConfig(resolved);

  // Run the verifier
  const output = await runClaudeVerifier(systemPrompt, userPrompt, toolConfig);

  // Parse verdict
  const passed = parseVerdict(output);

  if (passed) {
    verificationPassed();
  } else {
    verificationFailed(output);
  }

  // Restore stage to running
  // Only count failed attempts toward the budget — passing verifications
  // shouldn't consume retry slots
  const postContent = await readSession(sessionId);
  const restored = updateFrontMatter(postContent, {
    stage: 'running',
    ...(passed ? { verificationAttempts: currentAttempts } : {}),
  });
  await writeSession(sessionId, restored);

  return { passed, feedback: passed ? '' : output };
}
