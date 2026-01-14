import chalk from 'chalk';
import { execa } from 'execa';
import { type Config, EXIT_CODES } from './config.js';
import { build, checkStatus } from './prompt.js';
import * as ui from './ui.js';

async function runClaude(prompt: string): Promise<void> {
  await execa('claude', ['--print'], {
    input: prompt,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
}

export async function run(config: Config): Promise<number> {
  ui.banner();
  ui.config(config);

  const handleInterrupt = () => {
    console.log(chalk.yellow('\nInterrupted. Exiting...'));
    process.exit(EXIT_CODES.INTERRUPTED);
  };
  process.on('SIGINT', handleInterrupt);
  process.on('SIGTERM', handleInterrupt);

  try {
    for (let i = 1; i <= config.maxIterations; i++) {
      ui.iteration(i, config.maxIterations);
      await runClaude(await build(config));

      const status = await checkStatus(config);
      if (status === 'done') {
        ui.success(`Task completed after ${i} iteration(s)!`);
        return EXIT_CODES.SUCCESS;
      }
      if (status === 'blocked') {
        ui.warning('Task blocked - human intervention needed');
        ui.warning(`Check ${config.progressFile} for details`);
        return EXIT_CODES.BLOCKED;
      }
    }

    ui.error(`Max iterations (${config.maxIterations}) reached`);
    ui.error(`Check ${config.progressFile} for progress`);
    return EXIT_CODES.MAX_ITERATIONS;
  } finally {
    process.off('SIGINT', handleInterrupt);
    process.off('SIGTERM', handleInterrupt);
  }
}
