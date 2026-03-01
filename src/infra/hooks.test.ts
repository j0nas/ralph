import { describe, expect, it, vi } from 'vitest';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

import { execa } from 'execa';
import type { CallbackHooks } from '../config.js';
import { executeHook, runHook } from './hooks.js';

const mockedExeca = vi.mocked(execa);

const env = {
  RALPH_SESSION_ID: 'test-session',
  RALPH_STATUS: 'progress',
  RALPH_ITERATIONS: '3',
  RALPH_TASK: 'Build the thing',
};

describe('executeHook', () => {
  it('calls execa with shell and env vars', async () => {
    mockedExeca.mockResolvedValueOnce(undefined as never);

    await executeHook('echo hello', env);

    expect(mockedExeca).toHaveBeenCalledWith('echo hello', {
      shell: true,
      env: { ...env },
      stdio: 'inherit',
      timeout: 30_000,
    });
  });

  it('does not throw when the command fails', async () => {
    mockedExeca.mockRejectedValueOnce(new Error('command not found'));

    await expect(executeHook('bad-cmd', env)).resolves.toBeUndefined();
  });

  it('logs the error message on failure', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedExeca.mockRejectedValueOnce(new Error('boom'));

    await executeHook('bad-cmd', env);

    expect(spy).toHaveBeenCalledWith('[ralph] hook failed: boom');
    spy.mockRestore();
  });
});

describe('runHook', () => {
  it('calls executeHook when the hook is configured', async () => {
    mockedExeca.mockResolvedValueOnce(undefined as never);
    const hooks: CallbackHooks = { onDone: 'notify done' };

    await runHook(hooks, 'onDone', env);

    expect(mockedExeca).toHaveBeenCalledWith('notify done', expect.any(Object));
  });

  it('does nothing when the hook is not configured', async () => {
    mockedExeca.mockClear();
    const hooks: CallbackHooks = { onDone: 'notify done' };

    await runHook(hooks, 'onBlocked', env);

    expect(mockedExeca).not.toHaveBeenCalled();
  });

  it('does nothing when hooks is undefined', async () => {
    mockedExeca.mockClear();

    await runHook(undefined, 'onDone', env);

    expect(mockedExeca).not.toHaveBeenCalled();
  });
});
