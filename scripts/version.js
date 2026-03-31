import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

let sha = 'unknown';
try {
  sha = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
} catch {
  // Not a git repo
}

writeFileSync(
  'src/generated/version.ts',
  `export const VERSION = '1.0.0';\nexport const GIT_SHA = '${sha}';\n`,
);
