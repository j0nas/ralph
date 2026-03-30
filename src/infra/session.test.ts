import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import {
  appendChangelog,
  getChangelogPath,
  parseFrontMatter,
  readChangelog,
  updateFrontMatter,
} from './session.js';

// --- Front matter tests ---

describe('parseFrontMatter', () => {
  it('parses mode and cycle fields', () => {
    const content = `---
stage: running
iterations: 5
mode: goal
cycle: 3
---
# Session`;

    const fm = parseFrontMatter(content);
    expect(fm).not.toBeNull();
    expect(fm?.mode).toBe('goal');
    expect(fm?.cycle).toBe(3);
  });

  it('returns undefined for mode/cycle when absent', () => {
    const content = `---
stage: running
iterations: 2
---
# Session`;

    const fm = parseFrontMatter(content);
    expect(fm).not.toBeNull();
    expect(fm?.mode).toBeUndefined();
    expect(fm?.cycle).toBeUndefined();
  });

  it('parses stopping stage', () => {
    const content = `---
stage: stopping
iterations: 10
mode: goal
cycle: 4
---
# Session`;

    const fm = parseFrontMatter(content);
    expect(fm).not.toBeNull();
    expect(fm?.stage).toBe('stopping');
  });

  it('ignores non-goal mode values', () => {
    const content = `---
stage: running
iterations: 1
mode: something-else
---
# Session`;

    const fm = parseFrontMatter(content);
    expect(fm).not.toBeNull();
    expect(fm?.mode).toBeUndefined();
  });
});

describe('updateFrontMatter', () => {
  it('preserves mode and cycle when updating other fields', () => {
    const content = `---
stage: running
iterations: 5
mode: goal
cycle: 2
---
# Session`;

    const updated = updateFrontMatter(content, { stage: 'stopping' });
    const fm = parseFrontMatter(updated);
    expect(fm?.stage).toBe('stopping');
    expect(fm?.mode).toBe('goal');
    expect(fm?.cycle).toBe(2);
    expect(fm?.iterations).toBe(5);
  });

  it('sets mode and cycle on existing frontmatter', () => {
    const content = `---
stage: initialized
iterations: 0
---
# Session`;

    const updated = updateFrontMatter(content, { mode: 'goal', cycle: 1 });
    const fm = parseFrontMatter(updated);
    expect(fm?.mode).toBe('goal');
    expect(fm?.cycle).toBe(1);
  });

  it('increments cycle without affecting other fields', () => {
    const content = `---
stage: running
iterations: 15
mode: goal
cycle: 3
reviewAttempts: 1
---
# Session`;

    const updated = updateFrontMatter(content, { cycle: 4 });
    const fm = parseFrontMatter(updated);
    expect(fm?.cycle).toBe(4);
    expect(fm?.iterations).toBe(15);
    expect(fm?.reviewAttempts).toBe(1);
    expect(fm?.mode).toBe('goal');
  });
});

// --- Changelog tests ---

describe('changelog helpers', () => {
  const testId = 'test-changelog-unit';

  afterEach(async () => {
    await rm(getChangelogPath(testId), { force: true });
  });

  it('readChangelog returns empty string when file does not exist', async () => {
    const result = await readChangelog('nonexistent-session-id-xyz');
    expect(result).toBe('');
  });

  it('appendChangelog creates file and readChangelog reads it', async () => {
    const entry = '## Cycle 1\n- Built the thing\nStatus: done';
    await appendChangelog(testId, entry);

    const content = await readChangelog(testId);
    expect(content).toBe(entry);
  });

  it('appendChangelog appends with double newline separator', async () => {
    const entry1 = '## Cycle 1\n- Built the thing\nStatus: done';
    const entry2 = '## Cycle 2\n- Added more stuff\nStatus: done';

    await appendChangelog(testId, entry1);
    await appendChangelog(testId, entry2);

    const content = await readChangelog(testId);
    expect(content).toBe(`${entry1}\n\n${entry2}`);
  });
});
