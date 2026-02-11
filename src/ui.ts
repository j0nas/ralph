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

export interface IterationOptions {
  current: number;
  max: number;
  sessionId?: string;
  sessionPath?: string;
  phase?: string;
  color?: ChalkInstance;
}

export function showIteration(opts: IterationOptions): void {
  const {
    current,
    max,
    sessionId,
    sessionPath,
    phase,
    color = chalk.blue,
  } = opts;
  const line = '━'.repeat(50);
  const label = phase
    ? `Iteration ${current}/${max} - ${phase}`
    : `Iteration ${current}/${max}`;

  let output = `\n${line}\n  ${label}\n`;
  if (sessionId) {
    output += `  ${chalk.dim(`Session: ${sessionId}`)}\n`;
  }
  if (sessionPath) {
    output += `  ${chalk.dim(`File: ${sessionPath}`)}\n`;
  }
  output += `${line}\n`;

  console.log(color(output));
}

export function showVerification(
  attempt: number,
  maxAttempts: number,
  mode: string,
): void {
  banner(
    'Verification',
    `Attempt ${attempt}/${maxAttempts} (${mode} mode)`,
    'magenta',
  );
}

export function verificationPassed(): void {
  message(chalk.green, 'Verification PASSED');
}

export function verificationFailed(feedback: string): void {
  message(chalk.red, 'Verification FAILED');
  // Show a brief summary of issues if present
  const issuesMatch = feedback.match(/### Issues Found\n([\s\S]*?)(?:\n##|$)/);
  if (issuesMatch) {
    console.log(chalk.red(issuesMatch[1].trim()));
  }
}

export function showReview(attempt: number, maxAttempts: number): void {
  banner('Code Review', `Attempt ${attempt}/${maxAttempts}`, 'magenta');
}

export function reviewPassed(): void {
  message(chalk.green, 'Code Review PASSED');
}

export function reviewFailed(feedback: string): void {
  message(chalk.red, 'Code Review FAILED');
  const issuesMatch = feedback.match(/### Issues Found\n([\s\S]*?)(?:\n##|$)/);
  if (issuesMatch) {
    console.log(chalk.red(issuesMatch[1].trim()));
  }
}
