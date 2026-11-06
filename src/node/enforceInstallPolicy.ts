import { createInterface } from 'node:readline/promises';
import { stdin as processStdin, stdout as processStdout, stderr as processStderr } from 'node:process';

export interface EnforceInstallPolicyOptions {
  command?: string;
  defaultCommand?: string;
  guardedCommand?: string;
  guardedCommandLabel?: string;
  allowEnvVar?: string;
  allowEnvValue?: string;
  guardAuditFixOnly?: boolean;
  npmConfigArgvRaw?: string;
  lifecycleEvent?: string;
  lifecycleScript?: string;
  npmConfigFix?: string;
  stdin?: NodeJS.ReadStream;
  stdout?: NodeJS.WriteStream;
  stderr?: NodeJS.WriteStream;
  noColor?: boolean;
}

interface Palette {
  reset: string;
  cyan: string;
  yellow: string;
  green: string;
  red: string;
  bold: string;
}

const createPalette = (useColor: boolean): Palette => ({
  reset: useColor ? '\u001b[0m' : '',
  cyan: useColor ? '\u001b[36m' : '',
  yellow: useColor ? '\u001b[33m' : '',
  green: useColor ? '\u001b[32m' : '',
  red: useColor ? '\u001b[31m' : '',
  bold: useColor ? '\u001b[1m' : ''
});

const isConfirmed = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return normalized === 'y' || normalized === 'yes';
};

const isAuditFixCommand = (options: {
  command: string;
  npmConfigArgvRaw?: string;
  lifecycleEvent?: string;
  lifecycleScript?: string;
  npmConfigFix?: string;
}): boolean => {
  const { command, npmConfigArgvRaw, lifecycleEvent, lifecycleScript, npmConfigFix } = options;

  if (command !== 'audit') {
    return false;
  }

  if (npmConfigFix === '1' || npmConfigFix === 'true') {
    return true;
  }

  if (npmConfigArgvRaw) {
    try {
      const parsed = JSON.parse(npmConfigArgvRaw) as { original?: string[] };
      if (Array.isArray(parsed.original) && parsed.original.includes('fix')) {
        return true;
      }
    } catch {
      // Ignore invalid npm_config_argv payload and continue with other heuristics.
    }
  }

  if (lifecycleEvent === 'preaudit' && typeof lifecycleScript === 'string' && lifecycleScript.includes('audit fix')) {
    return true;
  }

  return false;
};

export const enforceInstallPolicy = async (options: EnforceInstallPolicyOptions = {}): Promise<number> => {
  const {
    command = process.env.npm_command,
    defaultCommand = 'ci',
    guardedCommand = 'install',
    guardedCommandLabel,
    allowEnvVar = 'ALLOW_NPM_INSTALL',
    allowEnvValue = '1',
    guardAuditFixOnly = false,
    npmConfigArgvRaw = process.env.npm_config_argv,
    lifecycleEvent = process.env.npm_lifecycle_event,
    lifecycleScript = process.env.npm_lifecycle_script,
    npmConfigFix = process.env.npm_config_fix,
    stdin = processStdin,
    stdout = processStdout,
    stderr = processStderr,
    noColor = Boolean(process.env.NO_COLOR)
  } = options;

  if (command !== guardedCommand) {
    return 0;
  }

  if (guardAuditFixOnly && !isAuditFixCommand({
    command,
    npmConfigArgvRaw,
    lifecycleEvent,
    lifecycleScript,
    npmConfigFix
  })) {
    return 0;
  }

  const useColor = Boolean(stdout.isTTY) && !noColor;
  const color = createPalette(useColor);
  const label = `${color.bold}${color.cyan}[dependency-policy]${color.reset}`;
  const defaultCommandLabel = `${color.bold}npm ${defaultCommand}${color.reset}`;
  const guardedLabelValue = guardedCommandLabel || guardedCommand;
  const guardedCommandLabelStyled = `${color.bold}npm ${guardedLabelValue}${color.reset}`;
  const allowEnvLabel = `${color.bold}${allowEnvVar}=${allowEnvValue}${color.reset}`;

  stderr.write(`\n${label} Default command: ${defaultCommandLabel} for reproducible installs from package-lock.json.\n`);
  stderr.write(`${label} Use ${guardedCommandLabelStyled} only when you intentionally change dependencies.\n\n`);

  if (process.env[allowEnvVar] === allowEnvValue) {
    stderr.write(`${label} ${color.green}${allowEnvVar}=${allowEnvValue} detected.${color.reset} Continuing without prompt.\n\n`);
    return 0;
  }

  if (!stdin.isTTY || !stdout.isTTY) {
    stderr.write(`${label} ${color.yellow}Non-interactive shell detected.${color.reset}\n`);
    stderr.write(`${label} Installation stopped to protect reproducibility.\n`);
    stderr.write(`${label} Use ${defaultCommandLabel}, or set ${allowEnvLabel} if this update is intentional.\n\n`);
    return 1;
  }

  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const answer = await rl.question(`${label} Continue with npm ${guardedLabelValue}? [y/N]: `);

    if (isConfirmed(answer)) {
      stderr.write(`\n${label} ${color.green}Confirmation received.${color.reset} Continuing npm ${guardedLabelValue}.\n\n`);
      return 0;
    }

    stderr.write(`\n${label} ${color.red}Canceled by user.${color.reset} No dependencies were changed.\n`);
    stderr.write(`${label} Use ${defaultCommandLabel} for regular installs.\n\n`);
    return 1;
  } finally {
    rl.close();
  }
};