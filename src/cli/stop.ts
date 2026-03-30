import chalk from 'chalk';
import {
  parseFrontMatter,
  readSession,
  sessionExists,
  updateFrontMatter,
  writeSession,
} from '../infra/session.js';

export async function runStop(sessionId: string): Promise<number> {
  if (!(await sessionExists(sessionId))) {
    console.error(chalk.red(`Error: Session '${sessionId}' not found.`));
    console.error(chalk.dim('Use `ralph list` to see available sessions.'));
    return 1;
  }

  const content = await readSession(sessionId);
  const fm = parseFrontMatter(content);

  if (!fm || fm.mode !== 'goal') {
    console.error(
      chalk.red(`Error: Session '${sessionId}' is not a goal session.`),
    );
    return 1;
  }

  if (fm.stage === 'done') {
    console.log(chalk.yellow(`Session '${sessionId}' is already done.`));
    return 0;
  }

  if (fm.stage === 'stopping') {
    console.log(chalk.yellow(`Session '${sessionId}' is already stopping.`));
    return 0;
  }

  const updated = updateFrontMatter(content, { stage: 'stopping' });
  await writeSession(sessionId, updated);

  console.log(
    chalk.green(`Stop signal sent to session ${chalk.bold(sessionId)}.`),
  );
  console.log(
    chalk.dim(
      'The session will wrap up after the current iteration and leave the project in a clean state.',
    ),
  );
  return 0;
}
