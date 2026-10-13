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
import { SshSessionBroker } from '../../src/operator/ssh-session-broker.js';

const roots: string[] = [];
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(s => new Promise<void>(resolve => s.close(() => resolve()))));
  roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true }));
  vi.restoreAllMocks();
});

async function setup(authMode: 'api-key' | 'none' = 'api-key', withBroker = true) {
  const root = mkdtempSync(join(tmpdir(), 'ff-ssh-oneclick-'));
  roots.push(root);
  const config = defaultConfig(root);
  config.rateLimit.enabled = false;
  const container = new Container(config);
  const project = join(root, 'workspace');
  mkdirSync(project);
  const { instance } = container.fleet.create({ projectPath: project, authMode });
  const uid = process.getuid?.() ?? 0;
  const store = new TrustedHostStore({ operatorRoot: join(root, 'operator'), currentUid: uid, now: Date.now });
  const installationId = store.getOrCreateInstallationId();
  const service = new TrustedHostConsentService({
    fleet: container.fleet, store, installationId, serviceUid: uid,
    now: Date.now, isWriteFrozen: () => false, recordAudit: () => {},
  });
  vi.spyOn(container, 'trustedHostConsentService').mockReturnValue(service);
  const broker = new SshSessionBroker({
    serviceUid: uid, installationId,
    operatorRoot: join(root, 'ssh'), projectRoots: [project], now: Date.now,
  });
  const server = startDashboard(container, buildRegistry(container), {
    host: '127.0.0.1', port: 0,
    ...(withBroker ? { sshOperatorBroker: broker } : {}),
  });
  servers.push(server);
  if (!server.listening) await once(server, 'listening');
  const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
  const url = base + '/fleet/' + instance.id + '/one-click-trusted-host';
  const profile = { toolsPreset: 'full', policyMode: 'danger', terminalExecution: 'trusted-host' };
  const bootstrap = broker.openFromHost(uid);
  const proof = await fetch(base + '/operator/ssh-session/exchange', {
    method: 'POST',
    headers: { origin: base, 'sec-fetch-site': 'same-origin',
      'x-folderforge-ssh-bootstrap': bootstrap.bootstrapSecret },
  });
  const view = proof.ok ? await proof.json() as { csrfToken: string } : null;
  const cookie = proof.headers.get('set-cookie')?.split(';')[0] ?? '';
  const enable = (headers: Record<string, string> = {}, body: unknown = profile) =>
    fetch(url, { method: 'POST',
      headers: { origin: base, 'sec-fetch-site': 'same-origin',
        'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  return { root, container, instance, service, store, broker, base, bootstrap, view, cookie, enable, profile };
}

describe('SSH-verified one-click Fleet enrollment', () => {
  it('never grants host execution with localhost, dashboard credentials, claimed UID or forged headers', async () => {
    const h = await setup();
    const forged = await h.enable({
      'x-ssh-operator-csrf': 'forged', 'x-ssh-user': String(process.getuid?.() ?? 0),
      'x-folderforge-ssh-bootstrap': 'fake',
    });
    expect(forged.status).toBe(403);
    expect(h.container.fleet.get(h.instance.id).terminalExecution).toBe('sandbox-required');
    expect(h.store.findPendingByInstance(h.instance.id)).toBeNull();
    const wrongOrigin = await h.enable({
      origin: 'https://attacker.example', cookie: h.cookie,
      'x-ssh-operator-csrf': h.view!.csrfToken,
    });
    expect(wrongOrigin.status).toBe(403);
    const missingCsrf = await h.enable({ cookie: h.cookie });
    expect(missingCsrf.status).toBe(403);
    h.broker.revokeLease(h.bootstrap.leaseId);
    const disconnected = await h.enable({
      cookie: h.cookie, 'x-ssh-operator-csrf': h.view!.csrfToken,
    });
    expect(disconnected.status).toBe(403);
    expect(h.store.findPendingByInstance(h.instance.id)).toBeNull();
  });

  it('saves full/danger/trusted-host in one authenticated browser action with no CLI approval', async () => {
    const h = await setup();
    const enabled = await h.enable({ cookie: h.cookie, 'x-ssh-operator-csrf': h.view!.csrfToken });
    expect(enabled.status).toBe(200);
    const data = await enabled.json() as Record<string, unknown>;
    expect(data.status).toBe('persisted');
    expect(data.runtime).toBeDefined();
    expect(JSON.stringify(data)).not.toContain(h.view!.csrfToken);
    expect(h.container.fleet.get(h.instance.id)).toMatchObject(h.profile);
    const grant = h.store.readGrantByScope(h.service.authorizationDigest(h.instance.id, h.profile as { toolsPreset: string; policyMode: string; terminalExecution: 'trusted-host' }));
    expect(grant).not.toBeNull();
    // An unchanged enabled profile should be safely idempotent without another approval.
    const repeated = await h.enable({ cookie: h.cookie, 'x-ssh-operator-csrf': h.view!.csrfToken });
    expect(repeated.status).toBe(200);
  });

  it('fails closed for no-auth MCP instances: no temporary unsafe elevation', async () => {
    const h = await setup('none');
    const denied = await h.enable({ cookie: h.cookie, 'x-ssh-operator-csrf': h.view!.csrfToken });
    expect(denied.status).toBe(409);
    expect(h.container.fleet.get(h.instance.id).authMode).toBe('none');
    expect(h.container.fleet.get(h.instance.id).terminalExecution).toBe('sandbox-required');
    expect(h.store.findPendingByInstance(h.instance.id)).toBeNull();
  });

  it('fails closed if no SSH-backed session broker is installed', async () => {
    const h = await setup('api-key', false);
    const rejected = await h.enable({ cookie: 'random', 'x-ssh-operator-csrf': 'random' });
    expect(rejected.status).toBe(403);
    expect(h.container.fleet.get(h.instance.id).terminalExecution).toBe('sandbox-required');
  });
});
