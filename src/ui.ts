import boxen from 'boxen';
import chalk from 'chalk';
import type { Config } from './config.js';

export function banner(): void {
  console.log(
    boxen(`${chalk.green('Ralph')} - Claude Code in a Loop`, {
      padding: { left: 1, right: 1, top: 0, bottom: 0 },
      borderColor: 'blue',
      borderStyle: 'double',
    }),
  );
}

export function config(cfg: Config): void {
  console.log(`\nPrompt file:     ${chalk.green(cfg.promptFile)}`);
  console.log(`Progress file:   ${chalk.green(cfg.progressFile)}`);
  console.log(`Max iterations:  ${chalk.green(cfg.maxIterations)}\n`);
}

export function iteration(current: number, max: number): void {
  const line = '━'.repeat(50);
  console.log(
    chalk.blue(`\n${line}\n  Iteration ${current}/${max}\n${line}\n`),
  );
}

function message(color: typeof chalk.green, text: string): void {
  const line = '═'.repeat(50);
  console.log(color(`\n${line}\n  ${text}\n${line}`));
}

export const success = (text: string) => message(chalk.green, text);
export const warning = (text: string) => message(chalk.yellow, text);
export const error = (text: string) => message(chalk.red, text);
