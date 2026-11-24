import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { defaultConfig } from '../../src/runtime/config.js';
import { Container } from '../../src/runtime/container.js';
import { startDashboard } from '../../src/dashboard/server.js';
import { buildRegistry } from '../../src/tools/index.js';
import { afterEach, describe, expect, it } from 'vitest';

interface Harness {
  root: string;
  server: Server;
  baseUrl: string;
}

async function startHarness(): Promise<Harness> {
  const root = mkdtempSync(join(tmpdir(), 'folderforge-dashboard-agent-loops-'));
  const config = defaultConfig(root);
  config.rateLimit.enabled = false;
  config.policy.defaultMode = 'dev';
  const container = new Container(config);
  const server = startDashboard(container, buildRegistry(container), { host: '127.0.0.1', port: 0 });
  if (!server.listening) await once(server, 'listening');
  const address = server.address() as AddressInfo;
  return { root, server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

describe('dashboard agent-loop bindings', () => {
  const harnesses: Harness[] = [];

  afterEach(async () => {
    for (const harness of harnesses.splice(0)) {
      await closeServer(harness.server);
      rmSync(harness.root, { recursive: true, force: true });
    }
  });

  it('preserves client/session/task bindings across dashboard requests', async () => {
    const harness = await startHarness();
    harnesses.push(harness);
    const headers = {
      'content-type': 'application/json',
      'x-client-id': 'codex-client-a',
      'x-session-id': 'codex-session-a',
      'x-task-id': 'codex-task-a',
    };
    const createdResponse = await fetch(`${harness.baseUrl}/agent-loops`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'Bound dashboard loop',
        goal: 'Keep remote Codex work correlated.',
        acceptanceCriteria: ['Context remains bound'],
      }),
    });
    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()) as { loop: Record<string, unknown> };
    expect(created.loop).toMatchObject({
      clientId: 'codex-client-a',
      sessionId: 'codex-session-a',
      taskId: 'codex-task-a',
    });
    const id = String(created.loop.id);

    const missingTask = await fetch(`${harness.baseUrl}/agent-loops/${id}`);
    expect(missingTask.status).toBe(200);
    expect(((await missingTask.json()) as { loop: { id: string } }).loop.id).toBe(id);

    const mismatchedTask = await fetch(`${harness.baseUrl}/agent-loops/${id}`, {
      headers: { 'x-client-id': 'codex-client-a', 'x-session-id': 'codex-session-a', 'x-task-id': 'codex-task-b' },
    });
    expect(mismatchedTask.status).toBe(200);
    expect(((await mismatchedTask.json()) as { loop: { id: string } }).loop.id).toBe(id);

    const sameContext = await fetch(`${harness.baseUrl}/agent-loops/${id}`, { headers });
    expect(sameContext.status).toBe(200);
  });

  it('uses the bound context for durable idempotent run claims', async () => {
    const harness = await startHarness();
    harnesses.push(harness);
    const headers = {
      'content-type': 'application/json',
      'x-client-id': 'codex-client-b',
      'x-session-id': 'codex-session-b',
      'x-task-id': 'codex-task-b',
    };
    const createdResponse = await fetch(`${harness.baseUrl}/agent-loops`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Idempotent dashboard loop', goal: 'Claim once.', acceptanceCriteria: ['One claim'] }),
    });
    const created = (await createdResponse.json()) as { loop: { id: string } };

    const first = await fetch(`${harness.baseUrl}/agent-loops/${created.loop.id}/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ idempotencyKey: 'codex-request-1' }),
    });
    expect(first.status).toBe(202);

    const conflicting = await fetch(`${harness.baseUrl}/agent-loops/${created.loop.id}/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ idempotencyKey: 'codex-request-2' }),
    });
    expect(conflicting.status).toBe(409);
  });
  it('denies a council decision through HTTP despite caller-asserted votes', async () => {
    const harness = await startHarness();
    harnesses.push(harness);
    const post = (path: string, body: object = {}) => fetch(harness.baseUrl + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const created = await post('/agent-loops', { title: 'Review gate', goal: 'Deny self approval', acceptanceCriteria: ['No authorization'] });
    expect(created.status).toBe(201);
    const { loop } = await created.json() as { loop: { id: string; experts: Array<{ id: string }> } };
    const path = '/agent-loops/' + loop.id;
    expect((await post(path + '/start')).status).toBe(200);
    const proposed = await post(path + '/proposals', { expertId: loop.experts[0]!.id, summary: 'Advisory only' });
    expect(proposed.status).toBe(200);
    const proposalId = (await proposed.json() as { loop: { currentIterationProposals: Array<{ id: string }> } }).loop.currentIterationProposals[0]!.id;
    for (const expert of loop.experts) {
      expect((await post(path + '/votes', { expertId: expert.id, proposalId, score: 1, approve: true })).status).toBe(200);
    }
    const denied = await post(path + '/decide');
    expect(denied.status).toBe(409);
    expect(await denied.text()).toContain('BLOCKED_REVIEW');
    const current = await fetch(harness.baseUrl + path);
    expect((await current.json() as { loop: unknown }).loop).toMatchObject({ phase: 'council', reviewAuthority: 'NOT_QUORATE', goalGate: { satisfied: false } });
  });
});
