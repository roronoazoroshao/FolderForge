import { afterEach, describe, expect, it } from 'vitest';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { defaultConfig } from '../../src/runtime/config.js';
import { Container } from '../../src/runtime/container.js';
import { startDashboard } from '../../src/dashboard/server.js';
import { buildRegistry } from '../../src/tools/index.js';
import { WorkspaceIdentityRegistry } from '../../src/workspace/workspace-identity.js';

const OWNER_TOKEN = 'ua002-test-owner-credential';
const fixtures: Array<{ root: string; container: Container; server: Server }> = [];

async function harness(authenticated: boolean) {
  const root = mkdtempSync(join(tmpdir(), 'ff-ua002-owner-'));
  const config = defaultConfig(root);
  config.rateLimit.enabled = false;
  config.policy.defaultMode = 'dev';
  const container = new Container(config);
  const server = startDashboard(container, buildRegistry(container), {
    host: '127.0.0.1', port: 0,
    ...(authenticated ? { requireAuth: true, token: OWNER_TOKEN } : {}),
  });
  if (!server.listening) await once(server, 'listening');
  fixtures.push({ root, container, server });
  const address = server.address() as AddressInfo;
  return { root, container, base: `http://127.0.0.1:${address.port}` };
}

function post(url: string, body: unknown, bearer?: string) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      'x-principal-id': 'local:dashboard-admin',
      'x-session-id': 'forged-agent-session',
    },
    body: JSON.stringify(body),
  });
}

afterEach(async () => {
  for (const { root, container, server } of fixtures.splice(0)) {
    for (const process of container.processes.list()) {
      if (process.status === 'running') container.processes.kill(process.sessionId);
    }
    if (server.listening) await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
    rmSync(root, { recursive: true, force: true });
  }
});

describe('UA-002 owner-issued workspace identity and grant boundary', () => {
  it('denies agent-originated loopback enrollment, reattachment and grant writes without changing persisted bytes', async () => {
    const { root, container, base } = await harness(false);
    const a = join(root, 'a');
    const b = join(root, 'b');
    mkdirSync(a);
    mkdirSync(b);
    const identity = new WorkspaceIdentityRegistry(root, [root]);
    const workspace = identity.register(a);
    const capsule = container.capsules.create({
      workspaceRoot: a, principalId: 'principal:a',
      sessionId: 'session:a', profile: 'develop', grantedScopes: ['tools:read'],
    });
    const registryPath = join(root, '.folderforge', 'workspaces.json');
    const grantsPath = join(root, '.folderforge', 'capsules.json');
    const registryBytes = readFileSync(registryPath);
    const grantBytes = readFileSync(grantsPath);
    const attempts: Array<[string, unknown]> = [
      ['/workspaces/register', { path: b, workspaceId: workspace.workspaceId, principalId: 'owner' }],
      [`/workspaces/${workspace.workspaceId}/reattach`, { path: b, principalId: 'owner' }],
      ['/workspaces/activate', { path: b }],
      ['/capsules', { workspaceRoot: a, principalId: 'principal:attacker', profile: 'autopilot', grantedScopes: ['tools:write'] }],
      [`/capsules/${capsule.id}/revoke`, {}],
      [`/mission-control/capsules/${capsule.id}/revoke`, {}],
    ];
    for (const [path, body] of attempts) {
      const response = await post(base + path, body);
      expect(response.status, path).toBe(403);
      expect(readFileSync(registryPath), path).toEqual(registryBytes);
      expect(readFileSync(grantsPath), path).toEqual(grantBytes);
    }
  });

  it('accepts only an authenticated owner bearer for enrollment, reattachment and grant creation', async () => {
    const { root, base } = await harness(true);
    const initial = join(root, 'initial');
    const moved = join(root, 'moved');
    mkdirSync(initial);
    const wrong = await post(base + '/workspaces/register', { path: initial }, 'invalid-token');
    expect(wrong.status).toBe(401);
    const queryOnly = await post(base + `/workspaces/register?token=${OWNER_TOKEN}`, { path: initial });
    expect(queryOnly.status).toBe(403);
    const created = await post(base + '/workspaces/register', { path: initial }, OWNER_TOKEN);
    expect(created.status).toBe(201);
    const workspace = await created.json() as { workspaceId: string; root: string };
    expect(workspace.workspaceId).toMatch(/^ws_[a-f0-9]{32}$/);
    renameSync(initial, moved);
    const attached = await post(base + `/workspaces/${workspace.workspaceId}/reattach`, { path: moved }, OWNER_TOKEN);
    expect(attached.status).toBe(200);
    expect(await attached.json()).toMatchObject({ workspaceId: workspace.workspaceId });
    const grant = await post(base + '/capsules', {
      workspaceRoot: moved, principalId: 'principal:agent-a',
      sessionId: 'session:agent-a', profile: 'develop', grantedScopes: ['tool:file_read'],
    }, OWNER_TOKEN);
    expect(grant.status).toBe(201);
  });
});
