import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorkspaceCapsuleManager } from '../../src/capsule/workspace-capsule-manager.js';
import { projectPrincipalId } from '../../src/core/principal.js';
import { WorkspaceIdentityRegistry } from '../../src/workspace/workspace-identity.js';
import { authorizeWorkspaceOperation } from '../../src/workspace/authorized-context.js';

const temporaryRoots: string[] = [];

function setup() {
  const home = mkdtempSync(join(tmpdir(), 'ff-ua002-'));
  temporaryRoots.push(home);
  const a = join(home, 'a');
  const b = join(home, 'b');
  mkdirSync(a);
  mkdirSync(b);
  const registry = new WorkspaceIdentityRegistry(home, [home]);
  const workspace = registry.register(a);
  const capsules = new WorkspaceCapsuleManager([home], 'all', 60_000, 600_000, home);
  const capsule = capsules.create({
    workspaceRoot: a,
    principalId: 'principal:a',
    sessionId: 'session:a',
    profile: 'develop',
    grantedScopes: ['tool:file_read'],
  });
  const principal = {
    id: 'principal:a' as const,
    role: 'agent' as const,
    authMode: 'token' as const,
    sessionId: 'session:a',
    projectId: projectPrincipalId(a),
  };
  const request = {
    registry, capsules, principal,
    workspaceId: workspace.workspaceId,
    grantId: capsule.id,
    grantRevision: 1,
    operationId: 'op:1',
    call: { name: 'file_read', group: 'filesystem', risk: 'LOW' as const, mutates: false, args: { path: 'safe.txt' } },
  };
  return { home, a, b, registry, workspace, capsules, capsule, principal, request };
}

afterEach(() => {
  vi.useRealTimers();
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('UA-AC02 authoritative workspace and owner grant', () => {
  it('issues stable opaque workspace IDs across registry reload and symlink aliases', () => {
    const { home, a, registry, workspace } = setup();
    const alias = join(home, 'alias');
    symlinkSync(a, alias, process.platform === 'win32' ? 'junction' : 'dir');
    expect(registry.register(alias).workspaceId).toBe(workspace.workspaceId);
    expect(new WorkspaceIdentityRegistry(home, [home]).resolve(workspace.workspaceId).root).toBe(realpathSync.native(a));
    expect(workspace.workspaceId).toMatch(/^ws_[a-f0-9]{32}$/);
    expect(workspace.workspaceId).not.toContain(a);
  });

  it('rejects client-forged workspace IDs, roots, grant IDs, and revisions', () => {
    const { b, registry, request } = setup();
    const other = registry.register(b);
    expect(() => authorizeWorkspaceOperation({ ...request, workspaceId: other.workspaceId })).toThrow();
    expect(() => authorizeWorkspaceOperation({ ...request, workspaceId: 'ws_' + '0'.repeat(32) })).toThrow();
    expect(() => authorizeWorkspaceOperation({ ...request, claimedRoot: b })).toThrow();
    expect(() => authorizeWorkspaceOperation({ ...request, grantId: 'caps_' + '0'.repeat(20) })).toThrow();
    expect(() => authorizeWorkspaceOperation({ ...request, grantRevision: 2 })).toThrow();
  });

  it('derives a deep-frozen context exclusively from stored workspace and capsule binding', () => {
    const { a, workspace, capsule, request } = setup();
    const context = authorizeWorkspaceOperation(request);
    expect(context).toMatchObject({
      workspaceId: workspace.workspaceId, canonicalRoot: realpathSync.native(a),
      grantId: capsule.id, grantRevision: 1,
      principalId: 'principal:a', sessionId: 'session:a',
      operationId: 'op:1', capsuleId: capsule.id,
    });
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.effectiveLimits)).toBe(true);
    expect(() => Object.assign(context, { canonicalRoot: '/tmp/escape' })).toThrow();
  });

  it('denies an impersonated principal, wrong session, or missing authenticated session', () => {
    const { request } = setup();
    expect(() => authorizeWorkspaceOperation({
      ...request, principal: { ...request.principal, id: 'principal:b' },
    })).toThrow();
    expect(() => authorizeWorkspaceOperation({
      ...request, principal: { ...request.principal, sessionId: 'session:b' },
    })).toThrow();
    expect(() => authorizeWorkspaceOperation({
      ...request, principal: { ...request.principal, sessionId: undefined },
    })).toThrow();
  });

  it('does not follow mutable global workspace selection during overlapping operations', async () => {
    const { a, b, registry, capsules, request } = setup();
    const bIdentity = registry.register(b);
    const bGrant = capsules.create({
      workspaceRoot: b, principalId: 'principal:b', sessionId: 'session:b',
      profile: 'develop', grantedScopes: ['tool:file_read'],
    });
    const other = {
      ...request,
      principal: {
        id: 'principal:b', role: 'agent' as const, authMode: 'token' as const,
        sessionId: 'session:b', projectId: projectPrincipalId(b),
      },
      workspaceId: bIdentity.workspaceId, grantId: bGrant.id,
    };
    const [ca, cb] = await Promise.all([
      Promise.resolve().then(() => authorizeWorkspaceOperation(request)),
      Promise.resolve().then(() => authorizeWorkspaceOperation(other)),
    ]);
    expect(ca.canonicalRoot).toBe(realpathSync.native(a));
    expect(cb.canonicalRoot).toBe(realpathSync.native(b));
    expect(ca.principalId).not.toBe(cb.principalId);
  });

  it('denies ungranted operations and unscoped legacy capsules', () => {
    const { a, capsules, registry, request } = setup();
    expect(() => authorizeWorkspaceOperation({
      ...request, call: { ...request.call, name: 'file_write', mutates: true },
    })).toThrow();
    const legacy = capsules.create({ workspaceRoot: a, principalId: 'principal:a', sessionId: 'session:a', profile: 'develop' });
    expect(() => authorizeWorkspaceOperation({ ...request, grantId: legacy.id })).toThrow();
    expect(registry.resolve(request.workspaceId).root).toBe(realpathSync.native(a));
  });

  it('denies expiration and revocation, including a revocation from another manager instance', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-17T00:00:00.000Z'));
    const { home, request, capsule } = setup();
    expect(authorizeWorkspaceOperation(request).grantId).toBe(capsule.id);
    const otherProcess = new WorkspaceCapsuleManager([home], 'all', 60_000, 600_000, home);
    otherProcess.revoke(capsule.id, 'owner');
    expect(() => authorizeWorkspaceOperation(request)).toThrow(/revok|revision|grant/i);
    vi.advanceTimersByTime(60_001);
    expect(() => authorizeWorkspaceOperation(request)).toThrow(/expir|revok|grant/i);
  });

  it('denies expired grants without revocation', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-17T00:00:00.000Z'));
    const { request } = setup();
    vi.advanceTimersByTime(60_001);
    expect(() => authorizeWorkspaceOperation(request)).toThrow(/expir|grant/i);
  });

  it('denies symlink retargeting and renamed roots until a trusted reattach preserves filesystem identity', () => {
    const { home, a, b, registry, workspace, request } = setup();
    const moved = join(home, 'moved');
    renameSync(a, moved);
    symlinkSync(b, a, process.platform === 'win32' ? 'junction' : 'dir');
    expect(() => registry.resolve(workspace.workspaceId)).toThrow();
    expect(() => authorizeWorkspaceOperation(request)).toThrow();
    expect(() => registry.reattach(workspace.workspaceId, b)).toThrow();
    expect(registry.reattach(workspace.workspaceId, moved).workspaceId).toBe(workspace.workspaceId);
    expect(registry.resolve(workspace.workspaceId).root).toBe(realpathSync.native(moved));
  });

  it('rejects a replaced directory at the old path (inode rebind)', () => {
    const { a, home, registry, workspace } = setup();
    renameSync(a, join(home, 'original'));
    mkdirSync(a);
    expect(() => registry.resolve(workspace.workspaceId)).toThrow();
    expect(() => registry.register(a).workspaceId).not.toBe(workspace.workspaceId);
  });

  it('fails closed on corrupted or missing registry and corrupted capsule records', () => {
    const { home, registry, request } = setup();
    const path = join(home, '.folderforge', 'workspaces.json');
    const original = readFileSync(path, 'utf8');
    writeFileSync(path, original.replace('ws_', 'XX_'));
    expect(() => registry.resolve(request.workspaceId)).toThrow();
    writeFileSync(path, original);
    const capsulePath = join(home, '.folderforge', 'capsules.json');
    const raw = readFileSync(capsulePath, 'utf8');
    writeFileSync(capsulePath, raw.replace('principal:a', 'principal:x'));
    expect(() => authorizeWorkspaceOperation(request)).toThrow();
  });
});
