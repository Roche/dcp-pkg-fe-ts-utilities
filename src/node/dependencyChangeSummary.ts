import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface DependencyChangeSummaryOptions {
  workspaceRoot?: string;
  lockfileName?: string;
  baselineRef?: string;
  reportsDirName?: string;
  reportFilePrefix?: string;
}

export interface DependencyChangeSummaryRow {
  key: string;
  name: string;
  version: string;
  direct: boolean;
  previousVersion?: string;
}

export interface DependencyChangeSummaryResult {
  reportPath: string;
  updated: DependencyChangeSummaryRow[];
  added: DependencyChangeSummaryRow[];
  removed: DependencyChangeSummaryRow[];
}

const readJsonFile = (filePath: string): unknown => JSON.parse(readFileSync(filePath, 'utf8'));

const countNodeModulesSegments = (key: string): number => (key.match(/node_modules\//g) || []).length;

const normalizeLockPackages = (lock: unknown): Map<string, { name: string; version: string; direct: boolean }> => {
  const result = new Map<string, { name: string; version: string; direct: boolean }>();

  if (typeof lock !== 'object' || lock === null) {
    return result;
  }

  const lockObject = lock as { packages?: Record<string, { name?: string; version?: string } | undefined> };
  const packages = lockObject.packages;

  if (!packages || typeof packages !== 'object') {
    return result;
  }

  for (const [key, value] of Object.entries(packages)) {
    if (!key.includes('node_modules/')) {
      continue;
    }

    const packageMeta = value || {};
    const name = packageMeta.name || key.replace(/^.*node_modules\//, '');
    const version = packageMeta.version || 'unknown';
    const direct = countNodeModulesSegments(key) === 1;

    result.set(key, { name, version, direct });
  }

  return result;
};

const compareLocks = (previousLock: unknown, currentLock: unknown): {
  updated: DependencyChangeSummaryRow[];
  added: DependencyChangeSummaryRow[];
  removed: DependencyChangeSummaryRow[];
} => {
  const previous = normalizeLockPackages(previousLock);
  const current = normalizeLockPackages(currentLock);

  const added: DependencyChangeSummaryRow[] = [];
  const removed: DependencyChangeSummaryRow[] = [];
  const updated: DependencyChangeSummaryRow[] = [];

  for (const [key, curr] of current.entries()) {
    const prev = previous.get(key);

    if (!prev) {
      added.push({ ...curr, key });
      continue;
    }

    if (prev.version !== curr.version) {
      updated.push({ ...curr, key, previousVersion: prev.version });
    }
  }

  for (const [key, prev] of previous.entries()) {
    if (!current.has(key)) {
      removed.push({ ...prev, key });
    }
  }

  const sorter = (a: DependencyChangeSummaryRow, b: DependencyChangeSummaryRow): number => a.name.localeCompare(b.name);
  added.sort(sorter);
  removed.sort(sorter);
  updated.sort(sorter);

  return { updated, added, removed };
};

const sectionLines = (title: string, rows: DependencyChangeSummaryRow[]): string[] => {
  const lines = [`## ${title}`, ''];

  if (rows.length === 0) {
    lines.push('- none', '');
    return lines;
  }

  for (const row of rows) {
    if (row.previousVersion) {
      lines.push(`- ${row.name}: ${row.previousVersion} -> ${row.version} (${row.direct ? 'direct' : 'transitive'})`);
    } else {
      lines.push(`- ${row.name}: ${row.version} (${row.direct ? 'direct' : 'transitive'})`);
    }
  }

  lines.push('');
  return lines;
};

export const generateDependencyChangeSummary = (options: DependencyChangeSummaryOptions = {}): DependencyChangeSummaryResult => {
  const {
    workspaceRoot = process.cwd(),
    lockfileName = 'package-lock.json',
    baselineRef = 'HEAD',
    reportsDirName = 'reports',
    reportFilePrefix = 'dependency-change-summary'
  } = options;

  const lockPath = resolve(workspaceRoot, lockfileName);
  const baselinePath = `${baselineRef}:${lockfileName}`;

  const currentLock = readJsonFile(lockPath);

  let previousLock: unknown;
  try {
    const raw = execSync(`git show ${baselinePath}`, {
      cwd: workspaceRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    previousLock = JSON.parse(raw);
  } catch {
    throw new Error(`[dependency-summary] Could not read ${baselinePath}. Ensure the ref and lockfile are available.`);
  }

  const { updated, added, removed } = compareLocks(previousLock, currentLock);

  const now = new Date();
  const isoTime = now.toISOString();
  const stamp = isoTime.replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');

  const reportLines = [
    '# Dependency Change Summary',
    '',
    `- Generated at: ${isoTime}`,
    `- Baseline: ${baselinePath}`,
    `- Current: working tree ${lockfileName}`,
    `- Updated packages: ${updated.length}`,
    `- Added packages: ${added.length}`,
    `- Removed packages: ${removed.length}`,
    '',
    ...sectionLines('Updated', updated),
    ...sectionLines('Added', added),
    ...sectionLines('Removed', removed)
  ];

  const reportsDir = resolve(workspaceRoot, reportsDirName);
  mkdirSync(reportsDir, { recursive: true });

  const reportPath = resolve(reportsDir, `${reportFilePrefix}-${stamp}.md`);
  writeFileSync(reportPath, `${reportLines.join('\n')}\n`, 'utf8');

  return {
    reportPath,
    updated,
    added,
    removed
  };
};