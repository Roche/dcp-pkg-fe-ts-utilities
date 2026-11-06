import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { readFileSync } from 'node:fs';

import { checkDependencyPolicy } from '../checkDependencyPolicy';

jest.mock('node:fs', () => ({
  readFileSync: jest.fn()
}));

describe('checkDependencyPolicy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows prerelease packages outside protected branches without reading the lockfile', () => {
    const result = checkDependencyPolicy({ branch: 'develop' });

    expect(result).toEqual({ branch: 'develop', checked: false, violations: [] });
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it('reports prerelease scoped packages on protected branches, including nested packages', () => {
    jest.mocked(readFileSync).mockReturnValue(JSON.stringify({
      packages: {
        'node_modules/@open-dcp/services': { version: '1.2.0-alpha.54' },
        'node_modules/parent/node_modules/@open-dcp/utilities': { version: '2.0.0-beta.1' },
        'node_modules/@open-dcp/styles': { version: '1.0.0' }
      }
    }));

    const result = checkDependencyPolicy({ workspaceRoot: '/repo', branch: 'test' });

    expect(result).toEqual({
      branch: 'test',
      checked: true,
      violations: [
        { name: '@open-dcp/services', version: '1.2.0-alpha.54' },
        { name: '@open-dcp/utilities', version: '2.0.0-beta.1' }
      ]
    });
    expect(readFileSync).toHaveBeenCalledWith('/repo/package-lock.json', 'utf8');
  });

  it('passes when protected branches contain only stable scoped packages', () => {
    jest.mocked(readFileSync).mockReturnValue(JSON.stringify({
      packages: {
        'node_modules/@open-dcp/services': { version: '1.2.0' },
        'node_modules/vue': { version: '3.5.10' }
      }
    }));

    expect(checkDependencyPolicy({ branch: 'main' })).toEqual({
      branch: 'main',
      checked: true,
      violations: []
    });
  });
});