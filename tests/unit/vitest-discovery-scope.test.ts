import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

test('Vitest discovers the checkout tests, not nested Git worktrees', () => {
  const worktreesDir = join(root, '.worktrees');
  const createdWorktreesDir = !existsSync(worktreesDir);
  mkdirSync(worktreesDir, { recursive: true });
  const fixtureDir = mkdtempSync(join(worktreesDir, 'vitest-scope-fixture-'));
  const foreignTestDir = join(fixtureDir, 'tests', 'unit');
  mkdirSync(foreignTestDir, { recursive: true });
  writeFileSync(
    join(foreignTestDir, 'foreign-sentinel.test.ts'),
    "import { test } from 'vitest'; test('foreign sentinel', () => {});\n",
  );

  try {
    const files = execFileSync(
      process.execPath,
      [join(root, 'node_modules', 'vitest', 'vitest.mjs'), 'list', '--filesOnly'],
      {
        cwd: root,
        encoding: 'utf8',
        timeout: 90_000,
        maxBuffer: 32 * 1024 * 1024,
      },
    );
    expect(files).toContain('tests/unit/vitest-discovery-scope.test.ts');
    expect(files).not.toContain('foreign-sentinel.test.ts');
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
    if (createdWorktreesDir) rmdirSync(worktreesDir);
  }
}, 110_000);
