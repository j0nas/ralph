import { execa } from 'execa';

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
              console.log(block.text);
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
