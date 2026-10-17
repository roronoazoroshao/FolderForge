import { afterEach, describe, expect, it, vi } from 'vitest';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { defaultConfig } from '../../src/runtime/config.js';
import { Container } from '../../src/runtime/container.js';
import { startDashboard } from '../../src/dashboard/server.js';
import { buildRegistry } from '../../src/tools/index.js';
import { TrustedHostStore } from '../../src/operator/trusted-host-store.js';
import { TrustedHostConsentService } from '../../src/operator/trusted-host-consent.js';

const roots: string[] = [];
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(s => new Promise<void>(r => s.close(() => r()))));
  roots.splice(0).forEach(r => rmSync(r, { recursive: true, force: true }));
});

async function harness(auth: { token?: string; requireAuth?: boolean } = { token: 'dev-host-token', requireAuth: false }) {
  const root = mkdtempSync(join(tmpdir(), 'ff-host-api-'));
  roots.push(root);
  const config = defaultConfig(root);
  config.rateLimit.enabled = false;
  const container = new Container(config);
  const project = join(root, 'project');
  mkdirSync(project);
  const { instance } = container.fleet.create({ projectPath: project, authMode: 'api-key' });
  const store = new TrustedHostStore({ operatorRoot: join(root, 'operator'), currentUid: process.getuid?.() ?? 0, now: Date.now });
  const service = new TrustedHostConsentService({
    fleet: container.fleet, store, installationId: 'test-install',
    serviceUid: process.getuid?.() ?? 0, now: Date.now,
    isWriteFrozen: () => false, recordAudit: () => {},
  });
  vi.spyOn(container, 'trustedHostConsentService').mockReturnValue(service);
  const server = startDashboard(container, buildRegistry(container), {
    host: '127.0.0.1', port: 0, ...auth,
  });
  servers.push(server);
  if (!server.listening) await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const path = `/fleet/${instance.id}/profile-intents`;
  const tuple = { toolsPreset: 'full', policyMode: 'danger', terminalExecution: 'trusted-host' };
  const request = (headers: Record<string,string>, suffix = '', method = 'POST') =>
    fetch(`${base}${path}${suffix}`, { method, headers: { 'content-type': 'application/json', ...headers }, body: method === 'POST' ? JSON.stringify(tuple) : undefined });
  return { container, instance, base, path, service, store, request, tuple };
}

describe('sensitive Fleet profile-intents API', () => {
  it('denies anonymous, query-token, cross-origin, and missing-origin requests', async () => {
    const h = await harness();
    const origin = h.base;
    expect((await h.request({ origin })).status).toBe(401);
    expect((await h.request({ origin }, '?token=dev-host-token')).status).toBe(401);
    expect((await h.request({ origin: 'https://attacker.example', authorization: 'Bearer dev-host-token' })).status).toBe(403);
    expect((await h.request({ authorization: 'Bearer dev-host-token' })).status).toBe(403);
    expect(h.store.findPendingByInstance(h.instance.id)).toBeNull();
  });

  it('rejects a request ID that does not exist for the Fleet instance', async () => {
    const h = await harness();
    const headers = { origin: h.base, authorization: 'Bearer dev-host-token' };
    const invalid = await fetch(`${h.base}${h.path}/req_missing`, { headers });
    expect(invalid.status).toBe(409);
  });

  it('exposes read-only execution-authority only to scoped bearer admin', async () => {
    const h = await harness();
    const url = `${h.base}/fleet/${h.instance.id}/execution-authority`;
    const origin = h.base;
    expect((await fetch(url, { headers: { origin } })).status).toBe(401);
    expect((await fetch(`${url}?token=dev-host-token`, { headers: { origin } })).status).toBe(401);
    expect((await fetch(url, {
      headers: { origin: 'https://cross-site.invalid', authorization: 'Bearer dev-host-token' },
    })).status).toBe(403);
    const response = await fetch(url, {
      headers: { origin, authorization: 'Bearer dev-host-token' },
    });
    expect(response.status).toBe(200);
    const result = await response.json() as Record<string, unknown>;
    expect(result.authority).toBe('local-operator-only');
    expect(result.instanceId).toBe(h.instance.id);
    expect(result.runtime).toBeDefined();
    expect(JSON.stringify(result)).not.toContain('dev-host-token');
    expect((await fetch(url, {
      method: 'POST', headers: { origin, authorization: 'Bearer dev-host-token' },
    })).status).toBe(405);
  });

  it('allows an unauthenticated loopback Control Panel to stage consent, but never grant host execution by HTTP', async () => {
    const h = await harness({ token: undefined, requireAuth: false });
    const headers = { origin: h.base, 'sec-fetch-site': 'same-origin' };
    const created = await h.request(headers);
    expect(created.status).toBe(202);
    const { requestId } = await created.json() as { requestId: string };
    expect(h.store.readPending(requestId)).not.toBeNull();
    expect(h.container.fleet.get(h.instance.id).terminalExecution).not.toBe('trusted-host');
    expect((await fetch(`${h.base}${h.path}/${requestId}`, { headers })).status).toBe(200);
    // Browsers normally omit Origin on same-origin GET fetches, but send Sec-Fetch-Site.
    const sameOriginGet = await fetch(`${h.base}${h.path}/${requestId}`, {
      headers: { 'sec-fetch-site': 'same-origin' },
    });
    expect(sameOriginGet.status).toBe(200);
    const apply = await fetch(`${h.base}${h.path}/${requestId}/apply`, { method: 'POST', headers });
    expect(apply.status).toBe(409);
    expect(h.container.fleet.get(h.instance.id).terminalExecution).not.toBe('trusted-host');
    const noOrigin = await h.request({});
    expect(noOrigin.status).toBe(403);
    const crossOrigin = await h.request({ origin: 'https://attacker.example' });
    expect(crossOrigin.status).toBe(403);
  });

  it('allows one-click host access from an explicitly token-authenticated loopback Dashboard, without VS Code', async () => {
    const h = await harness({ token: 'dev-host-token', requireAuth: true });
    const url = `${h.base}/fleet/${h.instance.id}/one-click-trusted-host`;
    const headers = {
      origin: h.base, 'sec-fetch-site': 'same-origin',
      authorization: 'Bearer dev-host-token', 'content-type': 'application/json',
    };
    const status = await fetch(h.base + '/fleet/owner-capability', { headers });
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({ ready: true, mode: 'dashboard-admin' });
    const saved = await fetch(url, { method: 'POST', headers, body: JSON.stringify(h.tuple) });
    expect(saved.status).toBe(200);
    expect(h.container.fleet.get(h.instance.id)).toMatchObject(h.tuple);
    expect(h.service.assertAuthorized(h.instance.id, h.tuple as {
      toolsPreset: string; policyMode: string; terminalExecution: 'trusted-host';
    })).toBeUndefined();
  });

  it('never treats unauthenticated port forwarding, query tokens, or cross-site requests as owner consent', async () => {
    const h = await harness({ token: undefined, requireAuth: false });
    const url = `${h.base}/fleet/${h.instance.id}/one-click-trusted-host`;
    const body = JSON.stringify(h.tuple);
    const plain = await fetch(url, { method: 'POST', headers: {
      origin: h.base, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json',
    }, body });
    expect(plain.status).toBe(403);
    expect(h.container.fleet.get(h.instance.id).terminalExecution).not.toBe('trusted-host');
    const secured = await harness({ token: 'dev-host-token', requireAuth: true });
    const protectedUrl = `${secured.base}/fleet/${secured.instance.id}/one-click-trusted-host`;
    const withQuery = await fetch(protectedUrl + '?token=dev-host-token', {
      method: 'POST', headers: { origin: secured.base, 'content-type': 'application/json' }, body,
    });
    expect(withQuery.status).toBe(401);
    const wrongOrigin = await fetch(protectedUrl, { method: 'POST', headers: {
      origin: 'https://attacker.invalid', 'sec-fetch-site': 'cross-site',
      authorization: 'Bearer dev-host-token', 'content-type': 'application/json',
    }, body });
    expect(wrongOrigin.status).toBe(403);
    expect(secured.container.fleet.get(secured.instance.id).terminalExecution).not.toBe('trusted-host');
  });

  it('keeps credential enforcement when token is configured, even if the dashboard is bound to localhost', async () => {
    const h = await harness();
    expect((await h.request({ origin: h.base })).status).toBe(401);
    const valid = await h.request({ origin: h.base, authorization: 'Bearer dev-host-token' });
    expect(valid.status).toBe(202);
  });

  it('creates one pending intent with bearer admin and never grants host execution over HTTP', async () => {
    const h = await harness();
    const headers = { origin: h.base, authorization: 'Bearer dev-host-token' };
    const result = await h.request(headers);
    expect(result.status).toBe(202);
    const body = await result.json() as { requestId: string; status: string };
    expect(body.status).toBe('pending');
    expect(body.requestId).toMatch(/^req_/);
    expect(h.store.findPendingByInstance(h.instance.id)?.requestId).toBe(body.requestId);
    const status = await fetch(`${h.base}${h.path}/${body.requestId}`, { headers });
    expect(status.status).toBe(200);
    expect((await status.json() as {status:string}).status).toBe('pending');
    expect(h.container.fleet.get(h.instance.id).terminalExecution).not.toBe('trusted-host');
  });

  it('refuses apply until local approval, then commits the exact scope without a remote approval endpoint', async () => {
    const h = await harness();
    const headers = { origin: h.base, authorization: 'Bearer dev-host-token', 'content-type': 'application/json' };
    const created = await h.request(headers);
    const { requestId } = await created.json() as { requestId: string };
    const applyUrl = `${h.base}${h.path}/${requestId}/apply`;
    const before = await fetch(applyUrl, { method: 'POST', headers });
    expect(before.status).toBe(409);
    expect(h.container.fleet.get(h.instance.id).toolsPreset).not.toBe('full');
    const pending = h.store.readPending(requestId)!;
    h.store.consumeLocalApproval(requestId, pending.scopeHash);
    const applied = await fetch(applyUrl, { method: 'POST', headers });
    expect(applied.status).toBe(200);
    expect(h.container.fleet.get(h.instance.id).toolsPreset).toBe('full');
    expect(h.container.fleet.get(h.instance.id).policyMode).toBe('danger');
    expect(h.container.fleet.get(h.instance.id).terminalExecution).toBe('trusted-host');
    expect((await fetch(applyUrl, { method: 'POST', headers: { origin: h.base } })).status).toBe(401);
  });
});
