import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { defaultConfig } from '../../src/runtime/config.js';
import { Container } from '../../src/runtime/container.js';
import { startDashboard } from '../../src/dashboard/server.js';
import { buildRegistry } from '../../src/tools/index.js';
import { afterEach, describe, expect, it } from 'vitest';

interface Harness {
  root: string;
  container: Container;
  server: Server;
  baseUrl: string;
}

async function startHarness(): Promise<Harness> {
  const root = mkdtempSync(join(tmpdir(), 'folderforge-dashboard-agent-loops-'));
  const config = defaultConfig(root);
  config.rateLimit.enabled = false;
  config.policy.defaultMode = 'dev';
  const container = new Container(config);
  const server = startDashboard(container, buildRegistry(container), { host: '127.0.0.1', port: 0, requireAuth: true, token: 'retirement-fixture-token' });
  if (!server.listening) await once(server, 'listening');
  const address = server.address() as AddressInfo;
  return { root, container, server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

describe('dashboard Agent Loop retirement', () => {
  const harnesses: Harness[] = [];

  afterEach(async () => {
    for (const harness of harnesses.splice(0)) {
      await closeServer(harness.server);
      rmSync(harness.root, { recursive: true, force: true });
    }
  });

  it('removes all legacy Agent Loop HTTP routes without changing historical records', async () => {
    const harness = await startHarness();
    harnesses.push(harness);
    const principal = { id: 'agent:historical-fixture', role: 'agent' as const, authMode: 'stdio' as const };
    const run = harness.container.agentLoops.create({
      title: 'Historical loop', goal: 'Retirement fixture', acceptanceCriteria: ['Preserve history'],
    }, principal);
    const runsDir = join(harness.root, '.folderforge', 'agent-loops', 'runs');
    const record = join(runsDir, `${run.id}.json`);
    const before = readFileSync(record);
    const filenames = readdirSync(runsDir).sort();
    const headers = { authorization: 'Bearer retirement-fixture-token', 'content-type': 'application/json' };
    const base = harness.baseUrl;
    const idPath = `/agent-loops/${run.id}`;
    const unauthorized = await fetch(`${base}/agent-loops`);
    expect(unauthorized.status).toBe(401);
    await unauthorized.text();

    for (const path of ['/agent-loops', idPath, `${idPath}/report`, `${idPath}/events`]) {
      const response = await fetch(base + path, { headers });
      expect(response.status, path).toBe(404);
      expect(await response.json()).toMatchObject({ error: 'not_found', path });
    }

    for (const path of ['/agent-loops', ...['run', 'start', 'resume', 'pause', 'cancel', 'proposals', 'votes', 'decide', 'implementation', 'verification'].map(action => `${idPath}/${action}`)]) {
      const response = await fetch(base + path, {
        method: 'POST', headers,
        body: JSON.stringify({ title: 'Retired', goal: 'Retired', acceptanceCriteria: ['Retired'] }),
      });
      expect(response.status, path).toBe(404);
      expect(await response.json()).toMatchObject({ error: 'not_found', path });
    }

    expect(readdirSync(runsDir).sort()).toEqual(filenames);
    expect(readFileSync(record)).toEqual(before);
    const control = await fetch(`${base}/mission-control`, { headers });
    expect(control.status).toBe(200);
    await control.json();
  });
});
