import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createInterface } from 'node:readline/promises';

import { enforceInstallPolicy } from '../enforceInstallPolicy';

jest.mock('node:readline/promises', () => ({
  createInterface: jest.fn()
}));

type MockWriteStream = {
  isTTY: boolean;
  write: jest.Mock;
};

type MockReadStream = {
  isTTY: boolean;
};

const createStreams = (isTTY: boolean): {
  stdin: NodeJS.ReadStream;
  stdout: NodeJS.WriteStream;
  stderr: NodeJS.WriteStream;
  stderrWrite: jest.Mock;
} => {
  const stderrWrite = jest.fn();

  const stdin = { isTTY } as MockReadStream;
  const stdout = { isTTY, write: jest.fn() } as MockWriteStream;
  const stderr = { isTTY, write: stderrWrite } as MockWriteStream;

  return {
    stdin: stdin as unknown as NodeJS.ReadStream,
    stdout: stdout as unknown as NodeJS.WriteStream,
    stderr: stderr as unknown as NodeJS.WriteStream,
    stderrWrite
  };
};

describe('enforceInstallPolicy', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  it('returns 0 when command is not guarded', async () => {
    const { stdin, stdout, stderr, stderrWrite } = createStreams(false);

    const exitCode = await enforceInstallPolicy({
      command: 'ci',
      stdin,
      stdout,
      stderr
    });

    expect(exitCode).toBe(0);
    expect(stderrWrite).not.toHaveBeenCalled();
    expect(jest.mocked(createInterface)).not.toHaveBeenCalled();
  });

  it('returns 0 without prompt when allow env var is set', async () => {
    process.env.ALLOW_NPM_INSTALL = '1';
    const { stdin, stdout, stderr, stderrWrite } = createStreams(false);

    const exitCode = await enforceInstallPolicy({
      command: 'install',
      stdin,
      stdout,
      stderr
    });

    expect(exitCode).toBe(0);
    expect(stderrWrite.mock.calls.join('\n')).toContain('ALLOW_NPM_INSTALL=1 detected.');
    expect(jest.mocked(createInterface)).not.toHaveBeenCalled();
  });

  it('returns 1 for non-interactive shells when policy is triggered', async () => {
    const { stdin, stdout, stderr, stderrWrite } = createStreams(false);

    const exitCode = await enforceInstallPolicy({
      command: 'install',
      stdin,
      stdout,
      stderr,
      noColor: true
    });

    expect(exitCode).toBe(1);
    const stderrOutput = stderrWrite.mock.calls.flat().join('\n');
    expect(stderrOutput).toContain('Non-interactive shell detected.');
    expect(stderrOutput).toContain('Installation stopped to protect reproducibility.');
    expect(stderrOutput).not.toMatch(/\u001b\[/);
  });

  it('returns 0 when user confirms prompt', async () => {
    const { stdin, stdout, stderr, stderrWrite } = createStreams(true);
    const rl = {
      question: jest.fn(async () => 'yes'),
      close: jest.fn()
    };

    jest.mocked(createInterface).mockReturnValue(rl as unknown as ReturnType<typeof createInterface>);

    const exitCode = await enforceInstallPolicy({
      command: 'install',
      stdin,
      stdout,
      stderr,
      noColor: true
    });

    expect(exitCode).toBe(0);
    expect(rl.question).toHaveBeenCalledWith('[dependency-policy] Continue with npm install? [y/N]: ');
    expect(stderrWrite.mock.calls.flat().join('\n')).toContain('Confirmation received.');
    expect(rl.close).toHaveBeenCalledTimes(1);
  });

  it('returns 1 when user declines prompt', async () => {
    const { stdin, stdout, stderr, stderrWrite } = createStreams(true);
    const rl = {
      question: jest.fn(async () => 'n'),
      close: jest.fn()
    };

    jest.mocked(createInterface).mockReturnValue(rl as unknown as ReturnType<typeof createInterface>);

    const exitCode = await enforceInstallPolicy({
      command: 'install',
      stdin,
      stdout,
      stderr,
      noColor: true
    });

    expect(exitCode).toBe(1);
    expect(stderrWrite.mock.calls.flat().join('\n')).toContain('Canceled by user.');
    expect(stderrWrite.mock.calls.flat().join('\n')).toContain('Use npm ci for regular installs.');
    expect(rl.close).toHaveBeenCalledTimes(1);
  });
});
