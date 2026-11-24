import { test } from 'vitest';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

function verify(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'ff-source-build-'));
  try {
    for (const [name, content] of Object.entries(files)) {
      const path = join(root, name);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
    }
    mkdirSync(join(root, 'scripts'));
    const script = join(root, 'scripts', 'verify-source-build.mjs');
    copyFileSync(resolve('scripts/verify-source-build.mjs'), script);
    return spawnSync(process.execPath, [script], { encoding: 'utf8', cwd: tmpdir() });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const complete = {
  'dist/main.js': 'console.log("CLI");',
  'packages/mission-control/dist/index.html': '<html>SPA</html>',
  'dist/dashboard/app/index.html': '<html>SPA</html>',
};

test('source build accepts a nonempty CLI and matching SPA assets', () => {
  const result = verify(complete);
  assert.equal(result.status, 0, result.stderr);
});

test('source build rejects a missing packaged SPA even when CLI exists', () => {
  const result = verify({
    'dist/main.js': complete['dist/main.js'],
    'packages/mission-control/dist/index.html': complete['packages/mission-control/dist/index.html'],
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Mission Control packaged UI/);
});

test('source build rejects an absent SPA build even if packaged assets exist', () => {
  const result = verify({
    'dist/main.js': complete['dist/main.js'],
    'dist/dashboard/app/index.html': complete['dist/dashboard/app/index.html'],
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Mission Control build/);
});

test('source build rejects empty packaged SPA and missing CLI', () => {
  const empty = verify({ ...complete, 'dist/dashboard/app/index.html': '' });
  assert.equal(empty.status, 1);
  const missing = verify({ ...complete, 'dist/main.js': '' });
  assert.equal(missing.status, 1);
});

test('source build rejects a stale packaged SPA', () => {
  const result = verify({ ...complete, 'dist/dashboard/app/index.html': '<html>old</html>' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /match/);
});
