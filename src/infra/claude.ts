import { type Options as ExecaOptions, execa } from 'execa';

export interface ToolConfig {
  allowedTools?: string;
  disallowedTools?: string;
}

interface ClaudeOptions {
  allowedTools?: string;
  disallowedTools?: string;
  verbose?: boolean;
  inheritOutput?: boolean;
}

/**
 * Base arguments for non-interactive Claude CLI invocations.
 * Includes --dangerously-skip-permissions to enable tool access.
 */
const CLAUDE_BASE_ARGS = ['--print', '--dangerously-skip-permissions'];

/**
 * Centralized Claude CLI execution for NON-INTERACTIVE mode (--print).
 * Used by: plan.ts, loop.ts, reviewer, verifier, summarizer
 *
 * @param systemPrompt - The system prompt to use
 * @param input - Input to send via stdin
 * @param options - Additional options (tool config, verbose mode)
 * @returns Object with stdout and stderr
 */
export async function runClaudeNonInteractive(
  systemPrompt: string,
  input?: string,
  options: ClaudeOptions = {},
): Promise<{ stdout: string; stderr: string }> {
  const args = [...CLAUDE_BASE_ARGS, '--system-prompt', systemPrompt];

  if (options.verbose) {
    args.push('--output-format', 'stream-json', '--verbose');
  }

  if (options.allowedTools) {
    args.push('--allowedTools', options.allowedTools);
  }
  if (options.disallowedTools) {
    args.push('--disallowedTools', options.disallowedTools);
  }

  const result = await execa('claude', args, {
    input: input ?? '',
    stdout: options.inheritOutput ? 'inherit' : 'pipe',
    stderr: options.inheritOutput ? 'inherit' : 'pipe',
  });

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

/**
 * Centralized Claude CLI execution for INTERACTIVE mode.
 * Used by: init.ts, refine phases
 *
 * @param systemPrompt - The system prompt to use
 * @param args - Additional command-line arguments (e.g., initial message)
 * @param options - Execa options for stdio handling
 */
export async function runClaudeInteractive(
  systemPrompt: string,
  args: string[] = [],
  options: ExecaOptions = {},
): Promise<void> {
  await execa('claude', ['--system-prompt', systemPrompt, ...args], {
    stdio: 'inherit',
    ...options,
  });
}

/**
 * Run Claude in verbose streaming mode (for main execution loop).
 * Streams JSON output and prints assistant messages with timestamps.
 */
export async function runClaude(prompt: string): Promise<void> {
  const child = execa(
    'claude',
    [...CLAUDE_BASE_ARGS, '--output-format', 'stream-json', '--verbose'],
    {
      input: prompt,
      stdout: 'pipe',
      stderr: 'inherit',
    },
  );

  // Stream and parse JSON output to show Claude's responses
  if (child.stdout) {
    const rl = await import('node:readline');
    const reader = rl.createInterface({ input: child.stdout });

    for await (const line of reader) {
      try {
        const event = JSON.parse(line);
        // Show assistant text messages
        if (event.type === 'assistant' && event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === 'text' && block.text) {
              const timestamp = new Date().toLocaleTimeString('en-GB');
              console.log(`[${timestamp}] ${block.text}`);
            }
          }
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
  }

  await child;
  console.log(); // Newline after Claude's output
}

export async function runClaudeAgent(
  systemPrompt: string,
  userPrompt: string,
  toolConfig: ToolConfig,
  label: string,
): Promise<string> {
  const args = [
    ...CLAUDE_BASE_ARGS,
    '--output-format',
    'stream-json',
    '--verbose',
    '--system-prompt',
    systemPrompt,
  ];

  if (toolConfig.allowedTools) {
    args.push('--allowedTools', toolConfig.allowedTools);
  }
  if (toolConfig.disallowedTools) {
    args.push('--disallowedTools', toolConfig.disallowedTools);
  }

  const collected: string[] = [];

  const child = execa('claude', args, {
    input: userPrompt,
    stdout: 'pipe',
    stderr: 'inherit',
  });

  if (child.stdout) {
    const rl = await import('node:readline');
    const reader = rl.createInterface({ input: child.stdout });

    for await (const line of reader) {
      try {
        const event = JSON.parse(line);
        if (event.type === 'assistant' && event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === 'text' && block.text) {
              const timestamp = new Date().toLocaleTimeString('en-GB');
              console.log(`[${label} ${timestamp}] ${block.text}`);
              collected.push(block.text);
            }
          }
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
  }

  await child;
  return collected.join('\n');
}

export async function summarizeSession(
  sessionContent: string,
): Promise<string> {
  const systemPrompt = `You summarize automated coding sessions. Given a session file, produce a brief plain-text summary. Cover what the task was and what was accomplished (or what remains). Do not use markdown formatting or bullet points.`;

  try {
    const result = await runClaudeNonInteractive(
      systemPrompt,
      `Summarize this session:\n\n${sessionContent}`,
    );
    return result.stdout.trim();
  } catch {
    return '';
  }
}

export async function runClaudeVerifier(
  systemPrompt: string,
  userPrompt: string,
  toolConfig: ToolConfig,
): Promise<string> {
  return runClaudeAgent(systemPrompt, userPrompt, toolConfig, 'VERIFY');
}

export async function runClaudeReviewer(
  systemPrompt: string,
  userPrompt: string,
  toolConfig: ToolConfig,
): Promise<string> {
  return runClaudeAgent(systemPrompt, userPrompt, toolConfig, 'REVIEW');
}
