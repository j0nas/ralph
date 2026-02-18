import {
  type ChildProcess,
  type SpawnOptions,
  spawn,
} from 'node:child_process';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock child_process.spawn
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

// Mock node:fs (openSync / closeSync / mkdirSync)
vi.mock('node:fs', () => ({
  openSync: vi.fn().mockReturnValue(42),
  closeSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

// Mock session module (used by runNonInteractive)
vi.mock('./session.js', () => ({
  createSession: vi.fn().mockResolvedValue('test-session-123'),
  getSessionPath: vi
    .fn()
    .mockReturnValue('/tmp/ralph/session-test-session-123.md'),
  getSessionLogPath: vi
    .fn()
    .mockImplementation((id: string) => `/tmp/ralph/session-${id}.log`),
  getSessionDir: vi.fn().mockReturnValue('/tmp/ralph'),
  sessionExists: vi.fn().mockResolvedValue(true),
  readSession: vi.fn().mockResolvedValue('---\nstage: running\n---\n# Session'),
  parseFrontMatter: vi.fn().mockReturnValue({ stage: 'running' }),
  getSessionWorkingDirectory: vi.fn().mockReturnValue(process.cwd()),
}));

// Mock plan and loop (used by runNonInteractive / runResume when not detaching)
vi.mock('./plan.js', () => ({ runPlan: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./loop.js', () => ({ run: vi.fn().mockResolvedValue(0) }));

import { isDetached } from './config.js';
import { runNonInteractive, spawnDetached } from './flow.js';
import { runResume } from './resume.js';
import { createSession } from './session.js';

const mockedCreateSession = vi.mocked(createSession);
const mockedOpenSync = vi.mocked(openSync);
const mockedCloseSync = vi.mocked(closeSync);
const mockedMkdirSync = vi.mocked(mkdirSync);

const mockedSpawn = vi.mocked(spawn);

function stubSpawn() {
  const fakeChild = { unref: vi.fn() } as unknown as ChildProcess;
  mockedSpawn.mockReturnValue(fakeChild);
  return fakeChild;
}

describe('isDetached', () => {
  const origEnv = process.env.RALPH_DETACHED;

  afterEach(() => {
    if (origEnv === undefined) {
      delete process.env.RALPH_DETACHED;
    } else {
      process.env.RALPH_DETACHED = origEnv;
    }
  });

  it('returns true when RALPH_DETACHED is "1"', () => {
    process.env.RALPH_DETACHED = '1';
    expect(isDetached()).toBe(true);
  });

  it('returns false when RALPH_DETACHED is unset', () => {
    delete process.env.RALPH_DETACHED;
    expect(isDetached()).toBe(false);
  });

  it('returns false for other values', () => {
    process.env.RALPH_DETACHED = 'yes';
    expect(isDetached()).toBe(false);
  });
});

describe('spawnDetached', () => {
  beforeEach(() => {
    mockedSpawn.mockReset();
    mockedOpenSync.mockReset().mockReturnValue(42);
    mockedCloseSync.mockReset();
    mockedMkdirSync.mockReset();
  });

  it('spawns with detached:true, stdio redirected to log fd, and RALPH_DETACHED env', () => {
    const fakeChild = stubSpawn();

    spawnDetached('abc123');

    expect(mockedSpawn).toHaveBeenCalledOnce();
    const [executable, _args, options] = mockedSpawn.mock.calls[0];

    expect(executable).toBe(process.execPath);
    expect(options).toMatchObject({
      detached: true,
      stdio: ['ignore', 42, 42],
    });
    expect((options as SpawnOptions).env).toHaveProperty('RALPH_DETACHED', '1');
    expect(fakeChild.unref).toHaveBeenCalledOnce();
  });

  it('opens the log file and closes the fd after spawn', () => {
    stubSpawn();

    spawnDetached('abc123');

    expect(mockedOpenSync).toHaveBeenCalledWith(
      '/tmp/ralph/session-abc123.log',
      'a',
    );
    expect(mockedCloseSync).toHaveBeenCalledWith(42);
  });

  it('ensures the session directory exists', () => {
    stubSpawn();

    spawnDetached('abc123');

    expect(mockedMkdirSync).toHaveBeenCalledWith('/tmp/ralph', {
      recursive: true,
    });
  });

  it('strips --detach from the forwarded arguments', () => {
    stubSpawn();
    const originalArgv = process.argv;
    process.argv = ['node', 'ralph.js', 'run', 'hello', '--detach'];

    try {
      spawnDetached('abc123');

      const args = mockedSpawn.mock.calls[0][1] as string[];
      expect(args).not.toContain('--detach');
      expect(args).toContain('ralph.js');
      expect(args).toContain('run');
      expect(args).toContain('hello');
    } finally {
      process.argv = originalArgv;
    }
  });

  it('injects --session-id when injectSessionId is true', () => {
    stubSpawn();
    const originalArgv = process.argv;
    process.argv = ['node', 'ralph.js', 'run', 'hello', '--detach'];

    try {
      spawnDetached('parent-session-abc', { injectSessionId: true });

      const args = mockedSpawn.mock.calls[0][1] as string[];
      expect(args).toContain('--session-id');
      expect(args).toContain('parent-session-abc');
      expect(args).not.toContain('--detach');
    } finally {
      process.argv = originalArgv;
    }
  });

  it('does not inject --session-id by default', () => {
    stubSpawn();
    const originalArgv = process.argv;
    process.argv = ['node', 'ralph.js', 'run', 'hello', '--detach'];

    try {
      spawnDetached('abc123');

      const args = mockedSpawn.mock.calls[0][1] as string[];
      expect(args).not.toContain('--session-id');
    } finally {
      process.argv = originalArgv;
    }
  });
});

describe('runNonInteractive with --detach', () => {
  beforeEach(() => {
    mockedSpawn.mockReset();
    mockedOpenSync.mockReset().mockReturnValue(42);
    mockedCloseSync.mockReset();
    mockedMkdirSync.mockReset();
    mockedCreateSession.mockClear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a session, calls spawnDetached, and returns 0', async () => {
    const fakeChild = stubSpawn();

    const exitCode = await runNonInteractive({
      task: 'do something',
      maxIterations: 10,
      detach: true,
    });

    expect(exitCode).toBe(0);
    expect(mockedSpawn).toHaveBeenCalledOnce();
    expect(fakeChild.unref).toHaveBeenCalledOnce();
  });

  it('forwards the session ID to the detached child via --session-id', async () => {
    stubSpawn();

    await runNonInteractive({
      task: 'do something',
      maxIterations: 10,
      detach: true,
    });

    const args = mockedSpawn.mock.calls[0][1] as string[];
    expect(args).toContain('--session-id');
    expect(args).toContain('test-session-123');
  });

  it('prints the log file path when detaching', async () => {
    stubSpawn();
    const logSpy = vi.spyOn(console, 'log');

    await runNonInteractive({
      task: 'do something',
      maxIterations: 10,
      detach: true,
    });

    const logMessages = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(logMessages).toContain('Log file:');
  });

  it('skips createSession when sessionId option is provided', async () => {
    const exitCode = await runNonInteractive({
      task: 'do something',
      maxIterations: 10,
      detach: false,
      sessionId: 'existing-session-456',
    });

    expect(exitCode).toBe(0);
    expect(mockedCreateSession).not.toHaveBeenCalled();
  });

  it('does not call spawnDetached when detach is false', async () => {
    const exitCode = await runNonInteractive({
      task: 'do something',
      maxIterations: 10,
      detach: false,
    });

    expect(exitCode).toBe(0);
    expect(mockedSpawn).not.toHaveBeenCalled();
  });
});

describe('runResume with --detach', () => {
  beforeEach(() => {
    mockedSpawn.mockReset();
    mockedOpenSync.mockReset().mockReturnValue(42);
    mockedCloseSync.mockReset();
    mockedMkdirSync.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls spawnDetached and returns 0 for a valid session', async () => {
    const fakeChild = stubSpawn();

    const exitCode = await runResume({
      sessionId: 'test-session-123',
      maxIterations: 10,
      detach: true,
    });

    expect(exitCode).toBe(0);
    expect(mockedSpawn).toHaveBeenCalledOnce();
    expect(fakeChild.unref).toHaveBeenCalledOnce();
  });

  it('prints the log file path when detaching', async () => {
    stubSpawn();
    const logSpy = vi.spyOn(console, 'log');

    await runResume({
      sessionId: 'test-session-123',
      maxIterations: 10,
      detach: true,
    });

    const logMessages = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(logMessages).toContain('Log file:');
  });

  it('does not call spawnDetached when detach is false', async () => {
    const exitCode = await runResume({
      sessionId: 'test-session-123',
      maxIterations: 10,
      detach: false,
    });

    expect(exitCode).toBe(0);
    expect(mockedSpawn).not.toHaveBeenCalled();
  });
});
