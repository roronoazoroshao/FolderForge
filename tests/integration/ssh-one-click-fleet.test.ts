import { afterEach, describe, expect, it, vi } from 'vitest';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { defaultConfig } from '../../src/runtime/config.js';
import { Container } from '../../src/runtime/container.js';
import { startDashboard } from '../../src/dashboard/server.js';
import { buildRegistry } from '../../src/tools/index.js';
import { TrustedHostStore } from '../../src/operator/trusted-host-store.js';
import { TrustedHostConsentService } from '../../src/operator/trusted-host-consent.js';
import { SshSessionBroker } from '../../src/operator/ssh-session-broker.js';
import { deriveSshBrowserChannel, SSH_BROWSER_CHANNEL_HEADER } from '../../src/operator/ssh-browser-channel.js';

const roots: string[] = [];
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(s => new Promise<void>(resolve => s.close(() => resolve()))));
  roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true }));
  vi.restoreAllMocks();
});

async function setup(authMode: 'api-key' | 'none' = 'api-key', withBroker = true, proofSource: 'ssh-remote-exec' | 'local-operator-launch' = 'ssh-remote-exec') {
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
  const bootstrap = broker.openFromHost(uid, proofSource);
  const browserChannel = deriveSshBrowserChannel(bootstrap.bootstrapSecret);
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
        'content-type': 'application/json',
        [SSH_BROWSER_CHANNEL_HEADER]: browserChannel, ...headers },
      body: JSON.stringify(body),
    });
  return { root, container, instance, service, store, broker, base, bootstrap, view, cookie, enable, profile, browserChannel };
}

describe('SSH-verified one-click Fleet enrollment', () => {
  it('rejects a valid remote SSH cookie and copied CSRF through an ordinary forwarded browser port', async () => {
    const h = await setup();
    const directStatus = await fetch(h.base + '/operator/ssh-session/status', {
      headers: { cookie: h.cookie },
    });
    expect(await directStatus.json()).toEqual({ verified: false });
    const stolenCookie = await fetch(h.base + '/fleet/' + h.instance.id + '/one-click-trusted-host', {
      method: 'POST',
      headers: { origin: h.base, 'sec-fetch-site': 'same-origin',
        cookie: h.cookie, 'x-folderforge-operator-csrf': h.view!.csrfToken,
        'content-type': 'application/json' },
      body: JSON.stringify(h.profile),
    });
    expect(stolenCookie.status).toBe(403);
    expect(h.container.fleet.get(h.instance.id).terminalExecution).toBe('sandbox-required');
    const verified = await h.enable({
      cookie: h.cookie, 'x-folderforge-operator-csrf': h.view!.csrfToken,
    });
    expect(verified.status).toBe(200);
  });

  it('never grants host execution with localhost, dashboard credentials, claimed UID or forged headers', async () => {
    const h = await setup();
    const forged = await h.enable({
      'x-folderforge-operator-csrf': 'forged', 'x-ssh-user': String(process.getuid?.() ?? 0),
      'x-folderforge-ssh-bootstrap': 'fake',
    });
    expect(forged.status).toBe(403);
    expect(h.container.fleet.get(h.instance.id).terminalExecution).toBe('sandbox-required');
    expect(h.store.findPendingByInstance(h.instance.id)).toBeNull();
    const wrongOrigin = await h.enable({
      origin: 'https://attacker.example', cookie: h.cookie,
      'x-folderforge-operator-csrf': h.view!.csrfToken,
    });
    expect(wrongOrigin.status).toBe(403);
    const missingCsrf = await h.enable({ cookie: h.cookie });
    expect(missingCsrf.status).toBe(403);
    h.broker.revokeLease(h.bootstrap.leaseId);
    const disconnected = await h.enable({
      cookie: h.cookie, 'x-folderforge-operator-csrf': h.view!.csrfToken, [SSH_BROWSER_CHANNEL_HEADER]: h.browserChannel,
    });
    expect(disconnected.status).toBe(403);
    expect(h.store.findPendingByInstance(h.instance.id)).toBeNull();
  });

  it('saves full/danger/trusted-host in one authenticated browser action with no CLI approval', async () => {
    const h = await setup();
    const enabled = await h.enable({ cookie: h.cookie, 'x-folderforge-operator-csrf': h.view!.csrfToken, [SSH_BROWSER_CHANNEL_HEADER]: h.browserChannel });
    expect(enabled.status).toBe(200);
    const data = await enabled.json() as Record<string, unknown>;
    expect(data.status).toBe('persisted');
    expect(data.runtime).toBeDefined();
    expect(JSON.stringify(data)).not.toContain(h.view!.csrfToken);
    expect(h.container.fleet.get(h.instance.id)).toMatchObject(h.profile);
    const grant = h.store.readGrantByScope(h.service.authorizationDigest(h.instance.id, h.profile as { toolsPreset: string; policyMode: string; terminalExecution: 'trusted-host' }));
    expect(grant).not.toBeNull();
    // An unchanged enabled profile should be safely idempotent without another approval.
    const repeated = await h.enable({ cookie: h.cookie, 'x-folderforge-operator-csrf': h.view!.csrfToken, [SSH_BROWSER_CHANNEL_HEADER]: h.browserChannel });
    expect(repeated.status).toBe(200);
  });

  it('is idempotent for an already-authorized running child without stopping or issuing a new grant', async () => {
    const h = await setup();
    const headers = { cookie: h.cookie, 'x-folderforge-operator-csrf': h.view!.csrfToken, [SSH_BROWSER_CHANNEL_HEADER]: h.browserChannel };
    const first = await h.enable(headers);
    expect(first.status).toBe(200);
    const realGet = h.container.fleet.get.bind(h.container.fleet);
    vi.spyOn(h.container.fleet, 'get').mockImplementation(id => ({
      ...realGet(id), state: 'running', pid: 99333, sessionId: 'live-existing',
    }));
    const stop = vi.spyOn(h.container.fleet, 'stopForTrustedHostTransition');
    const second = await h.enable(headers);
    expect(second.status).toBe(200);
    expect((await second.json() as { newlyApproved: boolean }).newlyApproved).toBe(false);
    expect(stop).not.toHaveBeenCalled();
  });

  it('automatically requests a stopped child start after the one-click profile is committed', async () => {
    const h = await setup();
    const started = vi.spyOn(h.container.fleet, 'start').mockImplementation(id =>
      h.container.fleet.get(id),
    );
    const enabled = await h.enable({
      cookie: h.cookie, 'x-folderforge-operator-csrf': h.view!.csrfToken, [SSH_BROWSER_CHANNEL_HEADER]: h.browserChannel,
    });
    expect(enabled.status).toBe(200);
    const response = await enabled.json() as {
      status: string;
      activation: { status: string };
    };
    expect(response.status).toBe('persisted');
    expect(response.activation.status).toBe('start_requested');
    expect(started).toHaveBeenCalledTimes(1);
    expect(started).toHaveBeenCalledWith(h.instance.id);
    expect(h.container.fleet.get(h.instance.id)).toMatchObject(h.profile);
  });

  it('does not lie about runtime readiness when automatic child startup fails', async () => {
    const h = await setup();
    vi.spyOn(h.container.fleet, 'start').mockImplementation(() => {
      throw new Error('TEST_SPAWN_UNAVAILABLE');
    });
    const enabled = await h.enable({
      cookie: h.cookie, 'x-folderforge-operator-csrf': h.view!.csrfToken, [SSH_BROWSER_CHANNEL_HEADER]: h.browserChannel,
    });
    expect(enabled.status).toBe(200);
    const response = await enabled.json() as {
      status: string;
      activation: { status: string; message: string };
    };
    expect(response.status).toBe('persisted');
    expect(response.activation).toMatchObject({
      status: 'failed', message: 'TEST_SPAWN_UNAVAILABLE',
    });
    expect(h.container.fleet.get(h.instance.id).terminalExecution).toBe('trusted-host');
    expect(h.container.fleet.get(h.instance.id).state).not.toBe('running');
  });

  it('enables from an OS-owned local Control Panel launch without a separate SSH command', async () => {
    const h = await setup('api-key', true, 'local-operator-launch');
    const authorized = await h.enable({
      cookie: h.cookie, 'x-folderforge-operator-csrf': h.view!.csrfToken, [SSH_BROWSER_CHANNEL_HEADER]: h.browserChannel,
    });
    expect(authorized.status).toBe(200);
    expect(h.container.fleet.get(h.instance.id)).toMatchObject(h.profile);
    const status = await fetch(h.base + '/operator/ssh-session/status', {
      headers: { cookie: h.cookie },
    });
    expect(await status.json()).toMatchObject({
      verified: true, source: 'local-operator-launch',
    });
  });

  it('does not let an arbitrary localhost request restart a previously approved host-execution child', async () => {
    const h = await setup();
    const start = vi.spyOn(h.container.fleet, 'start').mockImplementation(id =>
      h.container.fleet.get(id),
    );
    const headers = { cookie: h.cookie, 'x-folderforge-operator-csrf': h.view!.csrfToken, [SSH_BROWSER_CHANNEL_HEADER]: h.browserChannel };
    const approval = await h.enable(headers);
    expect(approval.status).toBe(200);
    const endpoint = h.base + '/fleet/' + h.instance.id + '/start';
    const attack = await fetch(endpoint, { method: 'POST',
      headers: { origin: 'https://malicious.example' },
    });
    expect(attack.status).toBe(403);
    const localhostNoProof = await fetch(endpoint, { method: 'POST',
      headers: { origin: h.base, 'sec-fetch-site': 'same-origin' },
    });
    expect(localhostNoProof.status).toBe(403);
    expect(start).toHaveBeenCalledTimes(1); // automatic start only
    const authorized = await fetch(endpoint, { method: 'POST',
      headers: { ...headers, origin: h.base, 'sec-fetch-site': 'same-origin' },
    });
    expect(authorized.status).toBe(200);
    expect(start).toHaveBeenCalledTimes(2);
    const restart = await fetch(h.base + '/fleet/' + h.instance.id + '/restart', {
      method: 'POST', headers: { origin: h.base, 'sec-fetch-site': 'same-origin' },
    });
    expect(restart.status).toBe(403);
  });

  it('disables previously granted host access from the same verified UI without terminal revoke', async () => {
    const h = await setup();
    const headers = {
      origin: h.base,
      'sec-fetch-site': 'same-origin',
      cookie: h.cookie,
      'x-folderforge-operator-csrf': h.view!.csrfToken,
      [SSH_BROWSER_CHANNEL_HEADER]: h.browserChannel,
    };
    // No verified browser context -> no revocation either.
    const rejected = await fetch(h.base + '/fleet/' + h.instance.id + '/one-click-trusted-host', {
      method: 'DELETE', headers: { origin: h.base },
    });
    expect(rejected.status).toBe(403);
    const granted = await h.enable(headers);
    expect(granted.status).toBe(200);
    const statusUrl = h.base + '/fleet/' + h.instance.id + '/one-click-trusted-host';
    const before = await fetch(statusUrl, { headers });
    expect((await before.json() as { status: string }).status).toBe('approved');
    const revoked = await fetch(statusUrl, { method: 'DELETE', headers });
    expect(revoked.status).toBe(200);
    const body = await revoked.json() as { status: string };
    expect(body.status).toBe('revoked');
    const after = await fetch(statusUrl, { headers });
    expect((await after.json() as { status: string }).status).not.toBe('approved');
    expect(() => h.service.assertAuthorized(h.instance.id, h.profile as {
      toolsPreset: string; policyMode: string; terminalExecution: 'trusted-host';
    })).toThrow('TRUSTED_HOST_CONSENT_REQUIRED');
  });

  it('atomically upgrades anonymous MCP to a new token and scoped trusted-host profile with no user CLI', async () => {
    const h = await setup('none');
    const headers = { cookie: h.cookie, 'x-folderforge-operator-csrf': h.view!.csrfToken, [SSH_BROWSER_CHANNEL_HEADER]: h.browserChannel };
    const approved = await h.enable(headers);
    expect(approved.status).toBe(200);
    expect(approved.headers.get('cache-control')).toBe('no-store');
    const response = await approved.json() as {
      status: string; credential?: { kind: string; value: string };
    };
    expect(response.status).toBe('persisted');
    expect(response.credential?.kind).toBe('token');
    expect(response.credential?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const stored = h.container.fleet.get(h.instance.id);
    expect(stored.authMode).toBe('token');
    expect(stored.terminalExecution).toBe('trusted-host');
    expect(stored.tokenSha256).not.toContain(response.credential!.value);
    expect(() => h.service.assertAuthorized(h.instance.id, h.profile as {
      toolsPreset: string; policyMode: string; terminalExecution: 'trusted-host';
    })).not.toThrow();
    const repeat = await h.enable(headers);
    expect(repeat.status).toBe(200);
    expect((await repeat.json() as { credential?: unknown }).credential).toBeUndefined();
  });

  it('fails closed if no SSH-backed session broker is installed', async () => {
    const h = await setup('api-key', false);
    const rejected = await h.enable({ cookie: 'random', 'x-folderforge-operator-csrf': 'random' });
    expect(rejected.status).toBe(403);
    expect(h.container.fleet.get(h.instance.id).terminalExecution).toBe('sandbox-required');
  });
  it('quickstarts a new full/danger/trusted-host Fleet from a single verified browser POST', async () => {
    const h = await setup();
    const project = join(h.root, 'new-project');
    mkdirSync(project);
    const start = vi.spyOn(h.container.fleet, 'start').mockImplementation(id => h.container.fleet.get(id));
    const quickstart = (headers: Record<string, string>, target = project) =>
      fetch(h.base + '/fleet/quickstart', {
        method: 'POST',
        headers: { origin: h.base, 'sec-fetch-site': 'same-origin',
          'content-type': 'application/json', ...headers },
        body: JSON.stringify({ projectPath: target }),
      });

    const denied = await quickstart({ cookie: h.cookie, 'x-folderforge-operator-csrf': h.view!.csrfToken });
    expect(denied.status).toBe(403);
    expect(h.container.fleet.list()).toHaveLength(1);

    const created = await quickstart({
      cookie: h.cookie, 'x-folderforge-operator-csrf': h.view!.csrfToken,
      [SSH_BROWSER_CHANNEL_HEADER]: h.browserChannel,
    });
    expect(created.status).toBe(201);
    expect(created.headers.get('cache-control')).toBe('no-store');
    const data = await created.json() as {
      ok: boolean; data: { id: string; token: string;
        activation: { status: string }; instance: { authMode: string } };
    };
    expect(data.ok).toBe(true);
    expect(data.data.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(data.data.activation.status).toBe('start_requested');
    expect(data.data.instance.authMode).toBe('token');
    expect(h.container.fleet.list()).toHaveLength(2);
    expect(h.container.fleet.get(data.data.id)).toMatchObject({
      projectPath: project, toolsPreset: 'full', policyMode: 'danger',
      terminalExecution: 'trusted-host', authMode: 'token',
    });
    expect(start).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledWith(data.data.id);
    expect(() => h.service.assertAuthorized(data.data.id, {
      toolsPreset: 'full', policyMode: 'danger', terminalExecution: 'trusted-host',
    })).not.toThrow();
    expect(JSON.stringify(h.container.fleet.list())).not.toContain(data.data.token);
  });

  it('quickstart refuses unauthenticated, out-of-root or stale owner access before provisioning', async () => {
    const h = await setup();
    const project = join(h.root, 'next-project');
    mkdirSync(project);
    const url = h.base + '/fleet/quickstart';
    const headers = {
      origin: h.base, 'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
      cookie: h.cookie, 'x-folderforge-operator-csrf': h.view!.csrfToken,
      [SSH_BROWSER_CHANNEL_HEADER]: h.browserChannel,
    };
    const call = (target: string, overrides: Record<string, string> = {}) =>
      fetch(url, { method: 'POST', headers: { ...headers, ...overrides },
        body: JSON.stringify({ projectPath: target }) });
    expect((await call(project, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await call('/etc')).status).toBe(409);
    expect(h.container.fleet.list()).toHaveLength(1);
    h.broker.revokeLease(h.bootstrap.leaseId);
    expect((await call(project)).status).toBe(403);
    expect(h.container.fleet.list()).toHaveLength(1);
  });

  it.skipIf(process.platform === 'win32')('quickstart rejects an allowed-root symlink that escapes the root', async () => {
    const h = await setup();
    const outside = mkdtempSync(join(tmpdir(), 'ff-quickstart-outside-'));
    roots.push(outside);
    const alias = join(h.root, 'escape-alias');
    symlinkSync(outside, alias, 'dir');
    const response = await fetch(h.base + '/fleet/quickstart', {
      method: 'POST',
      headers: {
        origin: h.base, 'sec-fetch-site': 'same-origin',
        'content-type': 'application/json', cookie: h.cookie,
        'x-folderforge-operator-csrf': h.view!.csrfToken,
        [SSH_BROWSER_CHANNEL_HEADER]: h.browserChannel,
      },
      body: JSON.stringify({ projectPath: alias }),
    });
    expect(response.status).toBe(409);
    expect(h.container.fleet.list()).toHaveLength(1);
  });

});
