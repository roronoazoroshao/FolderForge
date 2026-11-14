import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveWorkspaceIdentity } from '../../src/workspace/workspace-identity.js';
import { createWorkspaceContext } from '../../src/workspace/workspace-context.js';

const temporaryRoots: string[] = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'ff-v2-identity-'));
  temporaryRoots.push(root);
  const a = join(root, 'project-a');
  const b = join(root, 'project-b');
  mkdirSync(a);
  mkdirSync(b);
  return { root, a, b };
}
afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('FF-004 workspace identity and immutable call context', () => {
  it('gives symlink aliases one identity while separating distinct directories', () => {
    const { root, a, b } = fixture();
    const alias = join(root, 'alias');
    symlinkSync(a, alias, 'dir');
    expect(resolveWorkspaceIdentity(alias)).toEqual(resolveWorkspaceIdentity(a));
    expect(resolveWorkspaceIdentity(a).workspaceId).not.toBe(resolveWorkspaceIdentity(b).workspaceId);
  });

  it('rejects file paths and absent workspace directories', () => {
    const { root } = fixture();
    const file = join(root, 'file.txt');
    writeFileSync(file, 'not a directory');
    expect(() => resolveWorkspaceIdentity(file)).toThrow();
    expect(() => resolveWorkspaceIdentity(join(root, 'missing'))).toThrow();
  });

  it('binds a frozen context to the right principal, session and grant revision', () => {
    const { a } = fixture();
    const workspace = resolveWorkspaceIdentity(a);
    const context = createWorkspaceContext({
      workspace, sessionWorkspaceId: workspace.workspaceId,
      principalId: 'agent-1', sessionId: 'session-1',
      operationId: 'operation-1', grantRevision: 3,
    });
    expect(context).toMatchObject({
      workspaceId: workspace.workspaceId, root: workspace.root,
      principalId: 'agent-1', sessionId: 'session-1',
      operationId: 'operation-1', grantRevision: 3,
    });
    expect(Object.isFrozen(context)).toBe(true);
    expect(() => Object.assign(context, { root: '/tmp/elsewhere' })).toThrow();
  });

  it('denies session ID reuse on a different workspace identity', () => {
    const { a, b } = fixture();
    const another = resolveWorkspaceIdentity(b);
    expect(() => createWorkspaceContext({
      workspace: resolveWorkspaceIdentity(a), sessionWorkspaceId: another.workspaceId,
      principalId: 'agent-1', sessionId: 'session-1',
      operationId: 'operation-1', grantRevision: 3,
    })).toThrow(/workspace/i);
  });

  it.each([
    { principalId: '', sessionId: 's', operationId: 'o', grantRevision: 0 },
    { principalId: 'p', sessionId: ' ', operationId: 'o', grantRevision: 0 },
    { principalId: 'p', sessionId: 's', operationId: '', grantRevision: 0 },
    { principalId: 'p', sessionId: 's', operationId: 'o', grantRevision: -1 },
  ])('refuses incomplete authority context: %j', (invalid) => {
    const { a } = fixture();
    const workspace = resolveWorkspaceIdentity(a);
    expect(() => createWorkspaceContext({
      workspace, sessionWorkspaceId: workspace.workspaceId, ...invalid,
    })).toThrow();
  });
});
