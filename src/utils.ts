import { constants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import chalk from 'chalk';

// Box drawing characters for banner
export const box = {
  topLeft: '╔',
  topRight: '╗',
  bottomLeft: '╚',
  bottomRight: '╝',
  horizontal: '═',
  vertical: '║',
  line: '━',
};

export function printBanner(): void {
  const width = 60;
  const horizontalLine = box.horizontal.repeat(width);

  console.log(chalk.blue(`${box.topLeft}${horizontalLine}${box.topRight}`));
  console.log(
    chalk.blue(box.vertical) +
      '  ' +
      chalk.green('Ralph') +
      ' - Claude Code in a Loop'.padEnd(width - 2) +
      chalk.blue(box.vertical),
  );
  console.log(
    chalk.blue(`${box.bottomLeft}${horizontalLine}${box.bottomRight}`),
  );
}

export function printConfig(config: {
  promptFile: string;
  progressFile: string;
  maxIterations: number;
}): void {
  console.log('');
  console.log(`Prompt file:     ${chalk.green(config.promptFile)}`);
  console.log(`Progress file:   ${chalk.green(config.progressFile)}`);
  console.log(
    `Max iterations:  ${chalk.green(config.maxIterations.toString())}`,
  );
  console.log('');
}

export function printIterationHeader(current: number, max: number): void {
  const line = box.line.repeat(60);
  console.log('');
  console.log(chalk.blue(line));
  console.log(chalk.blue(`  Iteration ${current}/${max}`));
  console.log(chalk.blue(line));
  console.log('');
}

export function printSuccess(message: string): void {
  const line = '═'.repeat(60);
  console.log('');
  console.log(chalk.green(line));
  console.log(chalk.green(`  ${message}`));
  console.log(chalk.green(line));
}

export function printWarning(message: string): void {
  const line = '═'.repeat(60);
  console.log('');
  console.log(chalk.yellow(line));
  console.log(chalk.yellow(`  ${message}`));
  console.log(chalk.yellow(line));
}

export function printError(message: string): void {
  const line = '═'.repeat(60);
  console.log('');
  console.log(chalk.red(line));
  console.log(chalk.red(`  ${message}`));
  console.log(chalk.red(line));
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readFileContent(filePath: string): Promise<string> {
  return readFile(filePath, 'utf-8');
}
