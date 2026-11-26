import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../src/runtime/config.js';
import { Container } from '../../src/runtime/container.js';
import { startDashboard } from '../../src/dashboard/server.js';
import { buildRegistry } from '../../src/tools/index.js';

describe('dashboard Responses gateway retirement', () => {
  it('rejects retired status and configuration endpoints while preserving history and MCP tunnel status', async () => {
    const root = mkdtempSync(join(tmpdir(), 'folderforge-responses-retirement-'));
    const historyDir = join(root, '.folderforge');
    const history = join(historyDir, 'responses-gateway.json');
    const before = Buffer.from('{"workflowId":"wf_historical","linkedAt":"2026-01-01T00:00:00.000Z"}\n');
    mkdirSync(historyDir, { recursive: true });
    writeFileSync(history, before, { mode: 0o600 });
    const config = defaultConfig(root);
    config.rateLimit.enabled = false;
    config.policy.defaultMode = 'dev';
    const container = new Container(config);
    const server = startDashboard(container, buildRegistry(container), {
      host: '127.0.0.1', port: 0, requireAuth: true, token: 'responses-retirement-fixture-token',
    });
    try {
      if (!server.listening) await once(server, 'listening');
      const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
      const headers = { authorization: 'Bearer responses-retirement-fixture-token', 'content-type': 'application/json' };
      const requests = [
        { path: '/responses/status', method: 'GET' },
        { path: '/responses/config', method: 'POST', body: JSON.stringify({ workflowId: null }) },
      ];
      for (const { path, ...init } of requests) {
        const unauthorized = await fetch(base + path, { ...init, headers: { 'content-type': 'application/json' } });
        expect(unauthorized.status, path).toBe(401);
        await unauthorized.text();
      }
      const retired = [];
      for (const { path, ...init } of requests) {
        const response = await fetch(base + path, { ...init, headers });
        retired.push({ path, status: response.status, body: await response.json() });
      }
      for (const path of ['/mission-control', '/openai-tunnel/status']) {
        const response = await fetch(base + path, { headers });
        expect(response.status, path).toBe(200);
        await response.json();
      }
      expect(readFileSync(history)).toEqual(before);
      expect(retired).toEqual(requests.map(({ path }) => ({
        path, status: 404, body: { error: 'not_found', path },
      })));
    } finally {
      try {
        if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });
});
