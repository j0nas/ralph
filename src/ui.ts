import boxen from 'boxen';
import chalk, { type ChalkInstance } from 'chalk';

export function banner(
  title: string,
  subtitle: string,
  borderColor: 'blue' | 'magenta',
): void {
  console.log(
    boxen(`${chalk.green(title)} - ${subtitle}`, {
      padding: { left: 1, right: 1, top: 0, bottom: 0 },
      borderColor,
      borderStyle: 'double',
    }),
  );
}

export function message(color: ChalkInstance, text: string): void {
  const line = '═'.repeat(50);
  console.log(color(`\n${line}\n  ${text}\n${line}`));
}

export const success = (text: string): void => message(chalk.green, text);
export const warning = (text: string): void => message(chalk.yellow, text);
export const error = (text: string): void => message(chalk.red, text);

export function showIteration(
  current: number,
  max: number,
  phase?: string,
  color: ChalkInstance = chalk.blue,
): void {
  const line = '━'.repeat(50);
  const label = phase
    ? `Iteration ${current}/${max} - ${phase}`
    : `Iteration ${current}/${max}`;
  console.log(color(`\n${line}\n  ${label}\n${line}\n`));
}
