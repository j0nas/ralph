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

export type RunStatus =
  | 'completed'
  | 'blocked'
  | 'max_iterations'
  | 'review_exhausted'
  | 'verification_exhausted';

export interface RunSummaryData {
  status: RunStatus;
  buildIterations: number;
  doneGateTriggers: number;
  totalIterations: number;
  duration: string;
  reviewRuns: number;
  reviewPasses: number;
  verifyRuns: number;
  verifyPasses: number;
  sessionPath: string;
  resumeCommand?: string;
  sessionSummary?: string;
}

const STATUS_DISPLAY: Record<
  RunStatus,
  { label: string; color: ChalkInstance; border: 'green' | 'yellow' | 'red' }
> = {
  completed: { label: '\u2714 Completed', color: chalk.green, border: 'green' },
  blocked: { label: '\u26A0 Blocked', color: chalk.yellow, border: 'yellow' },
  max_iterations: {
    label: '\u2716 Max iterations reached',
    color: chalk.red,
    border: 'red',
  },
  review_exhausted: {
    label: '\u2716 Review exhausted',
    color: chalk.red,
    border: 'red',
  },
  verification_exhausted: {
    label: '\u2716 Verification exhausted',
    color: chalk.red,
    border: 'red',
  },
};

export function printRunSummary(data: RunSummaryData): void {
  const { label, color, border } = STATUS_DISPLAY[data.status];

  const iterDetail =
    data.doneGateTriggers > 0
      ? `${data.buildIterations} build, ${data.doneGateTriggers} done-gate`
      : `${data.buildIterations} build`;

  const lines: string[] = [
    `${chalk.bold('Status:')}        ${color(label)}`,
    `${chalk.bold('Iterations:')}    ${data.totalIterations} (${iterDetail})`,
    `${chalk.bold('Duration:')}      ${data.duration}`,
  ];

  if (data.reviewRuns > 0) {
    const reviewStatus =
      data.reviewPasses > 0
        ? chalk.green(
            `PASS (${data.reviewRuns} attempt${data.reviewRuns > 1 ? 's' : ''})`,
          )
        : chalk.red(
            `FAIL (${data.reviewRuns} attempt${data.reviewRuns > 1 ? 's' : ''})`,
          );
    lines.push(`${chalk.bold('Review:')}        ${reviewStatus}`);
  }

  if (data.verifyRuns > 0) {
    const verifyStatus =
      data.verifyPasses > 0
        ? chalk.green(
            `PASS (${data.verifyRuns} attempt${data.verifyRuns > 1 ? 's' : ''})`,
          )
        : chalk.red(
            `FAIL (${data.verifyRuns} attempt${data.verifyRuns > 1 ? 's' : ''})`,
          );
    lines.push(`${chalk.bold('Verification:')}  ${verifyStatus}`);
  }

  lines.push(`${chalk.bold('Session:')}       ${chalk.dim(data.sessionPath)}`);

  if (data.resumeCommand) {
    lines.push(
      `${chalk.bold('Resume:')}        ${chalk.dim(data.resumeCommand)}`,
    );
  }

  console.log(
    boxen(lines.join('\n'), {
      title: 'Run Summary',
      padding: { left: 1, right: 1, top: 0, bottom: 0 },
      borderColor: border,
      borderStyle: 'round',
    }),
  );

  // Print AI-generated session summary
  if (data.sessionSummary) {
    console.log(
      boxen(data.sessionSummary, {
        title: 'Session Summary',
        padding: { left: 1, right: 1, top: 0, bottom: 0 },
        borderColor: border,
        borderStyle: 'round',
      }),
    );
  }
}
