import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { Container } from '../../src/runtime/container.js';
import { defaultConfig } from '../../src/runtime/config.js';
import { startDashboard } from '../../src/dashboard/server.js';
import { buildRegistry } from '../../src/tools/index.js';

describe('Dashboard read-only configuration inventory', () => {
  const items: Array<{ root: string; close: () => Promise<void> }> = [];
  afterEach(async () => {
    for (const item of items.splice(0)) { await item.close(); rmSync(item.root, { recursive: true, force: true }); }
  });

  it('requires authentication and never returns secret or filesystem configuration', async () => {
    const root = mkdtempSync(join(tmpdir(), 'folderforge-config-api-'));
    const config = defaultConfig(root);
    config.workspace.allowedDirectories = [root, '/sensitive/DONT_EXPOSE_WORKSPACE'];
    config.server.name = 'DONT_EXPOSE_SERVER';
    const container = new Container(config);
    const server = startDashboard(container, buildRegistry(container), {
      host: '127.0.0.1', port: 0, token: 'test-only-secret-token', requireAuth: true,
    });
    items.push({root,close:() => new Promise<void>((resolve,reject)=>server.close(err=>err?reject(err):resolve()))});
    if (!server.listening) await once(server, 'listening');
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/operator/config`;
    expect((await fetch(url)).status).toBe(401);
    const response = await fetch(url, { headers: { authorization: 'Bearer test-only-secret-token' } });
    expect(response.status).toBe(200);
    const result = await response.json() as { readOnly: boolean; scope: string; descriptors: Array<{key: string; effective: unknown; editable: boolean}> };
    expect(result.readOnly).toBe(true);
    expect(result.scope).toBe('parent');
    expect(result.descriptors.map(d=>d.key)).toContain('rateLimit.overrides.shell_exec.dailyQuota');
    expect(result.descriptors.every(d=>d.editable === false)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/DONT_EXPOSE_|test-only-secret-token/);
    const write = await fetch(url, { method: 'POST', headers: { authorization: 'Bearer test-only-secret-token', 'content-type': 'application/json' }, body: '{"rateLimit.enabled":false}' });
    expect(write.status).toBeGreaterThanOrEqual(400);
    expect(container.config.rateLimit.enabled).toBe(true);
  });
});
