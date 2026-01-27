import { stdin, stdout } from 'node:process';
import * as readline from 'node:readline/promises';

export async function askForPrompt(): Promise<string> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  console.log();
  const answer = await rl.question('What would you like to build? ');
  rl.close();
  return answer.trim();
}

export async function askYesNo(
  question: string,
  defaultYes = false,
): Promise<boolean> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const hint = defaultYes ? '(Y/n)' : '(y/N)';
  const answer = await rl.question(`\n${question} ${hint} `);
  rl.close();
  if (!answer.trim()) return defaultYes;
  return answer.trim().toLowerCase().startsWith('y');
}
