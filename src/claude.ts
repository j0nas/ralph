import { execa } from 'execa';

export interface ToolConfig {
  allowedTools?: string;
  disallowedTools?: string;
}

export async function runClaude(prompt: string): Promise<void> {
  const child = execa(
    'claude',
    ['--print', '--output-format', 'stream-json', '--verbose'],
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

async function runClaudeAgent(
  systemPrompt: string,
  userPrompt: string,
  toolConfig: ToolConfig,
  label: string,
): Promise<string> {
  const args = [
    '--print',
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

  const child = execa('claude', args, {
    input: userPrompt,
    stdout: 'pipe',
    stderr: 'inherit',
  });

  const collected: string[] = [];

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
  console.log();
  return collected.join('\n');
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
