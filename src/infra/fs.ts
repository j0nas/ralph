import { access, unlink } from 'node:fs/promises';
import chalk from 'chalk';
import which from 'which';

export const exists = (path: string): Promise<boolean> =>
  access(path)
    .then(() => true)
    .catch(() => false);

export function ensureClaudeInstalled(): void {
  if (!which.sync('claude', { nothrow: true })) {
    console.error(
      chalk.red("Error: 'claude' not found. Install Claude Code first."),
    );
    process.exit(1);
  }
}

export async function ensureFileExists(
  path: string,
  hint?: string,
): Promise<void> {
  if (!(await exists(path))) {
    console.error(chalk.red(`Error: '${path}' not found.`));
    if (hint) {
      console.error(chalk.yellow(hint));
    }
    process.exit(1);
  }
}

export async function ensureFileNotExists(
  path: string,
  force?: boolean,
): Promise<void> {
  if (await exists(path)) {
    if (!force) {
      console.error(chalk.red(`Error: '${path}' already exists.`));
      console.error(chalk.yellow('Use --force to overwrite.'));
      process.exit(1);
    }
    await unlink(path);
    console.log(chalk.dim(`Removed existing ${path}`));
  }
}
