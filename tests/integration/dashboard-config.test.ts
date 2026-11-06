import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  it('edits shell_exec quota only from signed same-origin owner; keeps revisions and freeze', async () => {
    const root = mkdtempSync(join(tmpdir(), 'folderforge-quota-http-'));
    const config = defaultConfig(root);
    const container = new Container(config);
    const server = startDashboard(container, buildRegistry(container), {
      host: '127.0.0.1', port: 0, token: 'test-only-secret-token', requireAuth: true,
    });
    items.push({ root, close: () => new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())) });
    if (!server.listening) await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const bearer = { authorization: 'Bearer test-only-secret-token' };
    const origin = { ...bearer, origin: base, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' };
    const value = { dailyQuota: 100, maxCalls: 5, windowMs: 5000 };
    const input = { scope: 'parent', key: 'rateLimit.overrides.shell_exec', expectedRevision: 'initial', value };
    const post = async (route: string, body: unknown, headers: Record<string, string> = origin) =>
      fetch(base + route, { method: 'POST', headers, body: JSON.stringify(body) });

    expect((await fetch(base + '/operator/config/quota')).status).toBe(401);
    const before = await fetch(base + '/operator/config/quota', { headers: bearer });
    expect(before.status).toBe(200);
    expect(await before.json()).toMatchObject({ source: 'startup', revision: 'initial', effective: { dailyQuota: 1000 } });
    expect((await post('/operator/config/validate', input, { origin: base, 'content-type': 'application/json' })).status).toBe(401);
    expect((await post('/operator/config/apply', input, { ...bearer, 'content-type': 'application/json' })).status).toBe(403);
    expect((await post('/operator/config/apply', input, { ...origin, origin: 'http://evil.example' })).status).toBe(403);
    expect((await post('/operator/config/apply', input, { ...origin, 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    expect((await post('/operator/config/apply', { ...input, 'rateLimit.enabled': false })).status).toBe(400);
    expect((await post('/operator/config/apply', { ...input, value: { ...value, dailyQuota: '100' } })).status).toBe(400);

    const auditSpy = vi.spyOn(container.audit, 'record');
    const preview = await post('/operator/config/validate', input);
    expect(preview.status).toBe(200);
    expect(await preview.json()).toMatchObject({ expectedRevision: 'initial', effective: value });
    expect(container.rateLimiter.ruleFor('shell_exec').dailyQuota).toBe(1000);
    container.rateLimiter.hit('shell_exec');
    container.rateLimiter.hit('shell_exec');
    auditSpy.mockImplementationOnce(() => { throw new Error('AUDIT_UNAVAILABLE_FIXTURE'); });
    const denied = await post('/operator/config/apply', input);
    expect(denied.status).toBe(503);
    expect(container.rateLimiter.ruleFor('shell_exec').dailyQuota).toBe(1000);
    const applied = await post('/operator/config/apply', input);
    expect(applied.status).toBe(200);
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({ summary: 'shell_exec_quota_change_requested' }),
      { required: true },
    );
    const saved = await applied.json() as { revision: string; effective: typeof value; usage: { windowCount: number } };
    expect(saved.effective).toEqual(value);
    expect(saved.revision).not.toBe('initial');
    expect(saved.usage.windowCount).toBe(2);
    expect(container.rateLimiter.ruleFor('shell_exec').dailyQuota).toBe(100);
    expect((await post('/operator/config/apply', input)).status).toBe(409);
    expect(container.rateLimiter.ruleFor('shell_exec').dailyQuota).toBe(100);
    container.missionControl.setWriteFreeze(true, 'owner-test');
    const next = { ...input, expectedRevision: saved.revision, value: { ...value, dailyQuota: 200 } };
    expect((await post('/operator/config/apply', next)).status).toBe(409);
    expect(container.rateLimiter.ruleFor('shell_exec').dailyQuota).toBe(100);
  });

});
