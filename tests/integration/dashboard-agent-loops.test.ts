import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { defaultConfig } from '../../src/runtime/config.js';
import { Container } from '../../src/runtime/container.js';
import { startDashboard } from '../../src/dashboard/server.js';
import { buildRegistry } from '../../src/tools/index.js';
import { afterEach, describe, expect, it } from 'vitest';

interface Harness {
  root: string;
  container: Container;
  runId: string;
  runsDir: string;
  record: string;
  before: Buffer;
  filenames: string[];
  server: Server;
  baseUrl: string;
}

async function startHarness(): Promise<Harness> {
  const root = mkdtempSync(join(tmpdir(), 'folderforge-dashboard-agent-loops-'));
  const runId = 'loop_0123456789abcdef';
  const runsDir = join(root, '.folderforge', 'agent-loops', 'runs');
  mkdirSync(runsDir, { recursive: true });
  const record = join(runsDir, `${runId}.json`);
  // Independent on-disk legacy fixture: no retired code is needed to seed history.
  const unsigned = {
    schemaVersion: 1, id: runId, revision: 2, title: 'Historical loop',
    goal: 'Retirement fixture', acceptanceCriteria: ['Preserve history'],
    projectRoot: root, ownerId: 'agent:historical-fixture',
    experts: [{ id: 'architect', role: 'architecture', weight: 1 }, { id: 'qa', role: 'verification', weight: 1 }],
    councilMinVotes: 2, councilThreshold: 0.7, maxIterations: 20, iteration: 1,
    phase: 'discovery', state: 'running', createdAt: 1, updatedAt: 2, startedAt: 2,
    proposals: [], votes: [], events: [
      { seq: 1, type: 'created', phase: 'discovery', iteration: 1, message: 'Agent loop created.', recordedAt: 1 },
      { seq: 2, type: 'started', phase: 'discovery', iteration: 1, message: 'Agent loop started.', recordedAt: 2 },
    ],
  };
  const before = Buffer.from(JSON.stringify({ ...unsigned, integritySha256: createHash('sha256').update(JSON.stringify(unsigned)).digest('hex') }, null, 2) + '\n');
  writeFileSync(record, before, { mode: 0o600 });
  const filenames = readdirSync(runsDir).sort();
  const config = defaultConfig(root);
  config.rateLimit.enabled = false;
  config.policy.defaultMode = 'dev';
  const container = new Container(config);
  const server = startDashboard(container, buildRegistry(container), { host: '127.0.0.1', port: 0, requireAuth: true, token: 'retirement-fixture-token' });
  if (!server.listening) await once(server, 'listening');
  const address = server.address() as AddressInfo;
  return { root, container, server, runId, runsDir, record, before, filenames, baseUrl: `http://127.0.0.1:${address.port}` };
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
    const { runId, runsDir, record, before, filenames } = harness;
    expect('agentLoops' in harness.container).toBe(false);
    expect('agentLoopRunner' in harness.container).toBe(false);
    const headers = { authorization: 'Bearer retirement-fixture-token', 'content-type': 'application/json' };
    const base = harness.baseUrl;
    const idPath = `/agent-loops/${runId}`;
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
