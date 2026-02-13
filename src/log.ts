import { spawn } from 'node:child_process';
import { platform } from 'node:os';
import { getSessionPath, sessionExists } from './session.js';

function defaultEditor(): string {
  if (platform() === 'darwin') return 'open -t';
  if (platform() === 'win32') return 'notepad';
  return 'xdg-open';
}

export async function runLog(id: string): Promise<void> {
  if (!(await sessionExists(id))) {
    console.error(`Session '${id}' not found.`);
    process.exit(1);
  }

  const path = getSessionPath(id);
  const editor = process.env.EDITOR || defaultEditor();
  const [cmd, ...args] = editor.split(/\s+/);

  const child = spawn(cmd, [...args, path], { stdio: 'inherit' });

  child.on('error', (err) => {
    console.error(`Failed to open editor: ${err.message}`);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}
