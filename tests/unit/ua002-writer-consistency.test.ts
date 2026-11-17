import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WorkspaceIdentityRegistry } from '../../src/workspace/workspace-identity.js';
import { WorkspaceCapsuleManager } from '../../src/capsule/workspace-capsule-manager.js';

const roots: string[] = [];
const registryModule = pathToFileURL(join(process.cwd(), 'src/workspace/workspace-identity.ts')).href;
const capsuleModule = pathToFileURL(join(process.cwd(), 'src/capsule/workspace-capsule-manager.ts')).href;

function fixture() {
  const home = mkdtempSync(join(tmpdir(), 'ff-ua002-writer-'));
  roots.push(home);
  const a = join(home, 'a');
  const b = join(home, 'b');
  mkdirSync(a);
  mkdirSync(b);
  return { home, a, b };
}

function manager(home: string) {
  return new WorkspaceCapsuleManager([home], 'all', 60_000, 600_000, home);
}

function child(source: string) {
  return spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', source], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 20_000,
  });
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('UA-002 cross-process writer consistency', () => {
  it('a second process cannot register a root while an exclusive registry writer lock is held', () => {
    const { home, a, b } = fixture();
    new WorkspaceIdentityRegistry(home, [home]).register(a);
    const path = join(home, '.folderforge', 'workspaces.json');
    const before = readFileSync(path);
    const lockPath = path + '.lock';
    mkdirSync(lockPath, { mode: 0o700 });
    try {
      const script = `import { WorkspaceIdentityRegistry } from ${JSON.stringify(registryModule)};
        try { new WorkspaceIdentityRegistry(${JSON.stringify(home)}, [${JSON.stringify(home)}]).register(${JSON.stringify(b)}); process.exit(7); }
        catch (error) { if (!String(error).includes('WORKSPACE_REGISTRY_WRITER_BUSY')) process.exit(8); }`;
      const result = child(script);
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(path)).toEqual(before);
    } finally {
      rmdirSync(lockPath);
    }
  });

  it('a stale manager cannot overwrite a grant revoked in a separate process', () => {
    const { home, a } = fixture();
    const stale = manager(home);
    const original = stale.create({
      workspaceRoot: a, principalId: 'principal:a', sessionId: 'session:a',
      profile: 'develop', grantedScopes: ['tools:read'],
    });
    const script = `import { WorkspaceCapsuleManager } from ${JSON.stringify(capsuleModule)};
      new WorkspaceCapsuleManager([${JSON.stringify(home)}], 'all', 60000, 600000, ${JSON.stringify(home)}).revoke(${JSON.stringify(original.id)}, 'owner');`;
    const result = child(script);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    stale.create({
      workspaceRoot: a, principalId: 'principal:b', sessionId: 'session:b',
      profile: 'observe', grantedScopes: ['tools:read'],
    });
    const persisted = manager(home).get(original.id);
    expect(persisted?.revokedBy).toBe('owner');
    expect(persisted?.grantRevision).toBe(2);
    expect(manager(home).list()).toHaveLength(2);
    expect(() => stale.reserve(original.id, false)).toThrow(/revoked/i);
  });

  it('grant writers fail closed under a held cross-process writer lock without modifying bytes', () => {
    const { home, a } = fixture();
    const capsules = manager(home);
    capsules.create({
      workspaceRoot: a, principalId: 'principal:a',
      profile: 'observe', grantedScopes: ['tools:read'],
    });
    const path = join(home, '.folderforge', 'capsules.json');
    const before = readFileSync(path);
    const lockPath = path + '.lock';
    mkdirSync(lockPath, { mode: 0o700 });
    try {
      expect(() => manager(home).create({
        workspaceRoot: a, principalId: 'principal:b',
        profile: 'observe', grantedScopes: ['tools:read'],
      })).toThrow(/CAPSULE_WRITER_BUSY/);
      expect(readFileSync(path)).toEqual(before);
    } finally {
      rmdirSync(lockPath);
    }
  });
});
