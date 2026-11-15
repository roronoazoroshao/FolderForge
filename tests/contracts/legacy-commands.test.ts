import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repository = resolve(import.meta.dirname, '../..');

function cli(...args: string[]) {
  return spawnSync(process.execPath, ['--import', 'tsx', 'src/main.ts', ...args], {
    cwd: repository,
    encoding: 'utf8',
    timeout: 15_000,
    env: { ...process.env, FOLDERFORGE_CONFIG: '' },
  });
}

describe('FF-001 legacy command contracts', () => {
  it('keeps the stdio, HTTP, policy and client-onboarding entrypoints discoverable', () => {
    const result = cli('--help');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('connect <client>');
    expect(result.stdout).toContain('--stdio');
    expect(result.stdout).toContain('--http');
    expect(result.stdout).toContain('--policy <mode>');
    expect(result.stdout).toContain('--project <dir>');
  });

  it('rejects unknown commands instead of accidentally starting a server', () => {
    const result = cli('no-such-command');
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toContain('Unknown command');
  });
});
