import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { generateDependencyChangeSummary } from '../dependencyChangeSummary';

jest.mock('node:child_process', () => ({
  execSync: jest.fn()
}));

jest.mock('node:fs', () => ({
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn()
}));

describe('generateDependencyChangeSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-10T12:34:56.789Z'));
  });

  it('generates a markdown report with added, removed, and updated dependencies', () => {
    const currentLock = {
      packages: {
        'node_modules/alpha': { version: '2.0.0' },
        'node_modules/delta': { version: '1.0.0' },
        'node_modules/parent/node_modules/charlie': { version: '3.1.0' },
        '': { name: 'workspace-root' }
      }
    };

    const previousLock = {
      packages: {
        'node_modules/alpha': { version: '1.0.0' },
        'node_modules/bravo': { version: '4.0.0' },
        'node_modules/parent/node_modules/charlie': { version: '3.1.0' }
      }
    };

    const readFileSyncMock = jest.mocked(readFileSync);
    const execSyncMock = jest.mocked(execSync);
    const mkdirSyncMock = jest.mocked(mkdirSync);
    const writeFileSyncMock = jest.mocked(writeFileSync);

    readFileSyncMock.mockReturnValue(JSON.stringify(currentLock));
    execSyncMock.mockImplementation(() => JSON.stringify(previousLock) as never);

    const result = generateDependencyChangeSummary({
      workspaceRoot: '/repo',
      baselineRef: 'origin/main'
    });

    expect(readFileSyncMock).toHaveBeenCalledWith('/repo/package-lock.json', 'utf8');
    expect(execSyncMock).toHaveBeenCalledWith('git show origin/main:package-lock.json', {
      cwd: '/repo',
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });

    expect(mkdirSyncMock).toHaveBeenCalledWith('/repo/reports', { recursive: true });

    expect(result.reportPath).toBe('/repo/reports/dependency-change-summary-20260810-123456.md');
    expect(result.updated).toEqual([
      {
        key: 'node_modules/alpha',
        name: 'alpha',
        version: '2.0.0',
        direct: true,
        previousVersion: '1.0.0'
      }
    ]);
    expect(result.added).toEqual([
      {
        key: 'node_modules/delta',
        name: 'delta',
        version: '1.0.0',
        direct: true
      }
    ]);
    expect(result.removed).toEqual([
      {
        key: 'node_modules/bravo',
        name: 'bravo',
        version: '4.0.0',
        direct: true
      }
    ]);

    const [reportPath, reportBody] = writeFileSyncMock.mock.calls[0] as [string, string, string];
    expect(reportPath).toBe('/repo/reports/dependency-change-summary-20260810-123456.md');
    expect(reportBody).toContain('# Dependency Change Summary');
    expect(reportBody).toContain('- Baseline: origin/main:package-lock.json');
    expect(reportBody).toContain('- Updated packages: 1');
    expect(reportBody).toContain('- Added packages: 1');
    expect(reportBody).toContain('- Removed packages: 1');
    expect(reportBody).toContain('- alpha: 1.0.0 -> 2.0.0 (direct)');
    expect(reportBody).toContain('- delta: 1.0.0 (direct)');
    expect(reportBody).toContain('- bravo: 4.0.0 (direct)');
  });

  it('throws a clear error when git baseline cannot be read', () => {
    const readFileSyncMock = jest.mocked(readFileSync);
    const execSyncMock = jest.mocked(execSync);

    readFileSyncMock.mockReturnValue(JSON.stringify({ packages: {} }));
    execSyncMock.mockImplementation(() => {
      throw new Error('git show failed');
    });

    expect(() =>
      generateDependencyChangeSummary({
        workspaceRoot: '/repo',
        baselineRef: 'missing-ref'
      })
    ).toThrow('[dependency-summary] Could not read missing-ref:package-lock.json. Ensure the ref and lockfile are available.');
  });
});
