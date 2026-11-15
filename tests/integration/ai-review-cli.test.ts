import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const cwd = resolve(import.meta.dirname, '../..');
const realHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
function execute(args: string[]) {
  return spawnSync(process.execPath, ['--import', 'tsx', 'src/ai-board/cli.ts', ...args], {
    cwd, encoding: 'utf8', timeout: 12_000,
    env: { ...process.env, OPENAI_API_KEY: '', FOLDERFORGE_AI_BOARD_MODEL: '' },
  });
}

describe('standalone AI board CLI', () => {
  it('records a NOT_QUORATE proof without calling a model when execution is not enabled', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'ai-board-cli-'));
    try {
      const target = join(tmp, 'goal-review.json');
      const result = execute(['--stage', 'GOAL', '--source-sha', realHead,
        '--artifact', 'docs/strategy/FOLDERFORGE_NORTH_STAR_2027_2030.md', '--out', target]);
      expect(result.status).toBe(2);
      expect(existsSync(target)).toBe(true);
      const report = JSON.parse(readFileSync(target, 'utf8'));
      expect(report.state).toBe('NOT_QUORATE');
      expect(report.receipts).toHaveLength(0);
      expect(result.stdout).toContain('NOT_QUORATE');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('fails if live execution is requested without model or API credentials', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'ai-board-cli-execute-'));
    try {
      const result = execute(['--stage', 'GOAL', '--source-sha', realHead,
        '--artifact', 'docs/strategy/README.md', '--out', join(tmp, 'review.json'), '--execute']);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/model|key/i);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('refuses to send private files outside the reviewed repo', () => {
    const result = execute(['--stage', 'GOAL', '--source-sha', realHead,
      '--artifact', '/etc/hosts']);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/outside/i);
  });
});
