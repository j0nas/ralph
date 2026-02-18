import {
  type ChildProcess,
  type SpawnOptions,
  spawn,
} from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock child_process.spawn
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

// Mock session module (used by runNonInteractive)
vi.mock('./session.js', () => ({
  createSession: vi.fn().mockResolvedValue('test-session-123'),
  getSessionPath: vi
    .fn()
    .mockReturnValue('/tmp/ralph/session-test-session-123.md'),
  sessionExists: vi.fn().mockResolvedValue(true),
  readSession: vi.fn().mockResolvedValue('---\nstage: running\n---\n# Session'),
  parseFrontMatter: vi.fn().mockReturnValue({ stage: 'running' }),
  getSessionWorkingDirectory: vi.fn().mockReturnValue(process.cwd()),
}));

// Mock plan and loop (used by runNonInteractive / runResume when not detaching)
vi.mock('./plan.js', () => ({ runPlan: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./loop.js', () => ({ run: vi.fn().mockResolvedValue(0) }));

import { runNonInteractive, spawnDetached } from './flow.js';
import { runResume } from './resume.js';
import { createSession } from './session.js';

const mockedCreateSession = vi.mocked(createSession);

const mockedSpawn = vi.mocked(spawn);

function stubSpawn() {
  const fakeChild = { unref: vi.fn() } as unknown as ChildProcess;
  mockedSpawn.mockReturnValue(fakeChild);
  return fakeChild;
}

describe('spawnDetached', () => {
  beforeEach(() => {
    mockedSpawn.mockReset();
  });

  it('spawns the process with detached:true, stdio:ignore, and RALPH_DETACHED env', () => {
    const fakeChild = stubSpawn();

    spawnDetached();

    expect(mockedSpawn).toHaveBeenCalledOnce();
    const [executable, _args, options] = mockedSpawn.mock.calls[0];

    expect(executable).toBe(process.execPath);
    expect(options).toMatchObject({
      detached: true,
      stdio: 'ignore',
    });
    expect((options as SpawnOptions).env).toHaveProperty('RALPH_DETACHED', '1');
    expect(fakeChild.unref).toHaveBeenCalledOnce();
  });

  it('strips --detach from the forwarded arguments', () => {
    stubSpawn();
    const originalArgv = process.argv;
    process.argv = ['node', 'ralph.js', 'run', 'hello', '--detach'];

    try {
      spawnDetached();

      const args = mockedSpawn.mock.calls[0][1] as string[];
      expect(args).not.toContain('--detach');
      expect(args).toContain('ralph.js');
      expect(args).toContain('run');
      expect(args).toContain('hello');
    } finally {
      process.argv = originalArgv;
    }
  });

  it('injects --session-id when a session ID is provided', () => {
    stubSpawn();
    const originalArgv = process.argv;
    process.argv = ['node', 'ralph.js', 'run', 'hello', '--detach'];

    try {
      spawnDetached('parent-session-abc');

      const args = mockedSpawn.mock.calls[0][1] as string[];
      expect(args).toContain('--session-id');
      expect(args).toContain('parent-session-abc');
      expect(args).not.toContain('--detach');
    } finally {
      process.argv = originalArgv;
    }
  });

  it('does not inject --session-id when no session ID is provided', () => {
    stubSpawn();
    const originalArgv = process.argv;
    process.argv = ['node', 'ralph.js', 'run', 'hello', '--detach'];

    try {
      spawnDetached();

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
