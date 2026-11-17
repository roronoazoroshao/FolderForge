import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultConfig } from '../../src/runtime/config.js';
import { PathPolicy } from '../../src/policy/path-policy.js';

const fixtures: string[] = [];

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'ff-ua002-protect-state-'));
  fixtures.push(root);
  const state = join(root, '.folderforge');
  mkdirSync(state);
  const policy = new PathPolicy([root], defaultConfig(root).workspace.deniedGlobs);
  return { root, state, policy };
}

afterEach(() => {
  for (const dir of fixtures.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('UA-002 persisted owner-authority filesystem tool denial', () => {
  it('denies registry and grant state, temp files and writer locks by default', () => {
    const { root, policy } = setup();
    const protectedPaths = [
      '.folderforge/workspaces.json',
      '.folderforge/workspaces.json.123.tmp',
      '.folderforge/workspaces.json.lock',
      '.folderforge/workspaces.json.lock/forged',
      '.folderforge/capsules.json',
      '.folderforge/capsules.json.123.tmp',
      '.folderforge/capsules.json.lock',
      '.folderforge/capsules.json.lock/forged',
    ];
    for (const path of protectedPaths) {
      expect(() => policy.resolveSafe(path, root), path).toThrow(/denied/i);
    }
  });

  it('denies symlink aliases to owner state, not only the lexical filename', () => {
    const { root, state, policy } = setup();
    const alias = join(root, 'state-alias');
    symlinkSync(state, alias, process.platform === 'win32' ? 'junction' : 'dir');
    for (const path of ['state-alias/workspaces.json', 'state-alias/capsules.json']) {
      expect(() => policy.resolveSafe(path, root), path).toThrow(/denied/i);
    }
  });
});
