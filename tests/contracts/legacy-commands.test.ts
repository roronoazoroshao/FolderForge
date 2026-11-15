import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '../..');
const fixturePath = resolve(repoRoot, 'tests/fixtures/ua-001-cli-baseline.json');

type CliBaseline = {
  packageName: string;
  version: string;
  helpMarkers: string[];
  rejectCases: Array<{ args: string[]; error: string }>;
};

function baseline(): CliBaseline {
  return JSON.parse(readFileSync(fixturePath, 'utf8')) as CliBaseline;
}

// Exercise source directly: dist/main.js can be absent in a clean CI checkout.
function cli(args: string[]) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/main.ts', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 20_000,
  });
  expect(result.error).toBeUndefined();
  return {
    status: result.status,
    output: String(result.stdout ?? '') + String(result.stderr ?? ''),
  };
}

describe('UA-001 source CLI compatibility baseline (no daemon startup)', () => {
  it('pins the package command and observed version', () => {
    const contract = baseline();
    const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8')) as {
      name: string; version: string; bin: Record<string, string>;
    };
    expect(pkg.name).toBe(contract.packageName);
    expect(pkg.bin.folderforge).toBe('dist/main.js');
    expect(pkg.version).toBe(contract.version);
    expect(cli(['--version'])).toEqual({
      status: 0,
      output: `folderforge ${contract.version}\n`,
    });
  });

  it('preserves published CLI help and auth/transport flags', () => {
    const result = cli(['--help']);
    expect(result.status).toBe(0);
    for (const marker of baseline().helpMarkers) {
      expect(result.output).toContain(marker);
    }
  });

  it('fails closed on unknown commands and unsafe/missing security flags', () => {
    for (const probe of baseline().rejectCases) {
      const result = cli(probe.args);
      expect(result.status, probe.args.join(' ')).toBe(1);
      expect(result.output, probe.args.join(' ')).toContain(probe.error);
    }
  }, 60_000); // Multiple tsx CLI launches are slower on Windows CI.
});
