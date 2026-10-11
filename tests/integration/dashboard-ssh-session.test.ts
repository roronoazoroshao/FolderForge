import { afterEach, describe, expect, it } from 'vitest';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { defaultConfig } from '../../src/runtime/config.js';
import { Container } from '../../src/runtime/container.js';
import { startDashboard } from '../../src/dashboard/server.js';
import { buildRegistry } from '../../src/tools/index.js';
import { SshSessionBroker } from '../../src/operator/ssh-session-broker.js';

const roots: string[] = [];
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(s => new Promise<void>(resolve => s.close(() => resolve()))));
  roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true }));
});

async function setup() {
  const root = mkdtempSync(join(tmpdir(), 'ff-dash-ssh-'));
  roots.push(root);
  const config = defaultConfig(root);
  config.rateLimit.enabled = false;
  const container = new Container(config);
  const broker = new SshSessionBroker({
    serviceUid: process.getuid?.() ?? 0, installationId: 'dash-ssh-fixture',
    operatorRoot: join(root, 'operator-ssh'), projectRoots: [join(root, 'workspace')],
    now: Date.now,
  });
  const server = startDashboard(container, buildRegistry(container), {
    host: '127.0.0.1', port: 0, sshOperatorBroker: broker,
  });
  servers.push(server);
  if (!server.listening) await once(server, 'listening');
  const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
  const bootstrap = broker.openFromHost(broker.serviceUid);
  return { base, broker, bootstrap };
}
const exchange = (base: string, secret: string, headers: Record<string, string> = {}, query = '') =>
  fetch(base + '/operator/ssh-session/exchange' + query, {
    method: 'POST',
    headers: {
      origin: base, 'sec-fetch-site': 'same-origin',
      'x-folderforge-ssh-bootstrap': secret, ...headers,
    },
  });

describe('SSH operator browser sessions (no ambient loopback elevation)', () => {
  it('refuses a missing proof, query token and forged origin even on 127.0.0.1', async () => {
    const h = await setup();
    expect((await exchange(h.base, 'not-a-proof')).status).toBe(401);
    expect((await exchange(h.base, 'not-a-proof', {}, '?token=fake')).status).toBe(401);
    expect((await exchange(h.base, h.bootstrap.bootstrapSecret, { origin: 'https://attacker.example' })).status).toBe(403);
    expect((await exchange(h.base, h.bootstrap.bootstrapSecret, { 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    const forgedHost = await fetch(h.base + '/operator/ssh-session/exchange', {
      method: 'POST', headers: {
        host: 'evil.example', origin: 'http://evil.example',
        'x-folderforge-ssh-bootstrap': h.bootstrap.bootstrapSecret,
      },
    });
    expect(forgedHost.status).toBe(403);
    expect((await fetch(h.base + '/operator/ssh-session/status')).status).toBe(200);
    const status = await fetch(h.base + '/operator/ssh-session/status');
    expect(await status.json()).toMatchObject({ verified: false });
  });

  it('exchanges a real leased bootstrap once into HttpOnly cookie and CSRF token', async () => {
    const h = await setup();
    const approved = await exchange(h.base, h.bootstrap.bootstrapSecret);
    expect(approved.status).toBe(200);
    expect(approved.headers.get('set-cookie')).toContain('HttpOnly');
    expect(approved.headers.get('set-cookie')).toContain('SameSite=Strict');
    expect(approved.headers.get('cache-control')).toBe('no-store');
    const credential = approved.headers.get('set-cookie')!.split(';')[0]!;
    const view = await approved.json() as { verified: boolean; csrfToken: string };
    expect(view.verified).toBe(true);
    expect(view.csrfToken.length).toBeGreaterThanOrEqual(43);
    expect(JSON.stringify(view)).not.toContain(h.bootstrap.bootstrapSecret);
    expect((await exchange(h.base, h.bootstrap.bootstrapSecret)).status).toBe(401);
    const status = await fetch(h.base + '/operator/ssh-session/status', { headers: { cookie: credential } });
    expect(await status.json()).toMatchObject({ verified: true, source: 'ssh-remote-exec' });

    const invalidLogout = await fetch(h.base + '/operator/ssh-session/logout', {
      method: 'POST', headers: { origin: h.base, cookie: credential },
    });
    expect(invalidLogout.status).toBe(403);
    const loggedOut = await fetch(h.base + '/operator/ssh-session/logout', {
      method: 'POST', headers: {
        origin: h.base, 'sec-fetch-site': 'same-origin',
        cookie: credential, 'x-ssh-operator-csrf': view.csrfToken,
      },
    });
    expect(loggedOut.status).toBe(200);
    const after = await fetch(h.base + '/operator/ssh-session/status', { headers: { cookie: credential } });
    expect(await after.json()).toMatchObject({ verified: false });
  });

  it('invalidates the browser session when its server-owned SSH lease is revoked', async () => {
    const h = await setup();
    const res = await exchange(h.base, h.bootstrap.bootstrapSecret);
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie')!.split(';')[0]!;
    h.broker.revokeLease(h.bootstrap.leaseId);
    const status = await fetch(h.base + '/operator/ssh-session/status', { headers: { cookie } });
    expect(await status.json()).toMatchObject({ verified: false });
  });
});
