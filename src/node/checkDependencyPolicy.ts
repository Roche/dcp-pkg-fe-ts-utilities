import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface DependencyPolicyViolation {
  name: string;
  version: string;
}

export interface CheckDependencyPolicyOptions {
  workspaceRoot?: string;
  lockfileName?: string;
  branch?: string;
  protectedBranches?: readonly string[];
  packageScope?: string;
}

export interface CheckDependencyPolicyResult {
  branch: string;
  checked: boolean;
  violations: DependencyPolicyViolation[];
}

const readJsonFile = (filePath: string): unknown => JSON.parse(readFileSync(filePath, 'utf8'));

const isPrerelease = (version: string): boolean => /^\d+\.\d+\.\d+-[^\s]+$/.test(version);

export const checkDependencyPolicy = (options: CheckDependencyPolicyOptions = {}): CheckDependencyPolicyResult => {
  const {
    workspaceRoot = process.cwd(),
    lockfileName = 'package-lock.json',
    branch = '',
    protectedBranches = ['test', 'main'],
    packageScope = '@open-dcp/'
  } = options;

  if (!protectedBranches.includes(branch)) {
    return { branch, checked: false, violations: [] };
  }

  const lockfile = readJsonFile(resolve(workspaceRoot, lockfileName));
  const packages = (lockfile as { packages?: Record<string, { version?: string } | undefined> }).packages ?? {};
  const violations: DependencyPolicyViolation[] = [];

  for (const [packagePath, packageInfo] of Object.entries(packages)) {
    const name = packagePath.split('node_modules/').pop() || '';

    if (!name.startsWith(packageScope) || !packageInfo?.version || !isPrerelease(packageInfo.version)) {
      continue;
    }

    violations.push({ name, version: packageInfo.version });
  }

  violations.sort((left, right) => left.name.localeCompare(right.name) || left.version.localeCompare(right.version));

  return { branch, checked: true, violations };
};