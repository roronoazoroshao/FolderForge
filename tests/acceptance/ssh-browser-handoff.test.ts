import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
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
import { type AddressInfo } from 'node:net';
import { chromium, type Browser } from 'playwright-core';
import { createSshLocalBridge } from '../../src/operator/ssh-local-bridge.js';
import { createSshBrowserInvitation } from '../../src/operator/ssh-dashboard-launcher.js';

const required = process.env.FOLDERFORGE_REQUIRE_BROWSER_E2E === '1';
const servers: Server[] = [];
const browsers: Browser[] = [];
const cleanup: Array<() => Promise<void> | void> = [];
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(browsers.splice(0).map(browser => browser.close()));
  await Promise.all(cleanup.splice(0).map(fn => fn()));
  await Promise.all(servers.splice(0).map(server =>
    new Promise<void>(resolve => server.close(() => resolve()))));
  vi.restoreAllMocks();
  roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true }));
});

describe.skipIf(!required)(
  'real Chromium file-invitation to browser operator-cookie handoff', () => {
    it('POSTs an owner-only file invitation and verifies the HttpOnly cookie survives redirect', async () => {
      let exchanges = 0;
      const upstream = createServer((req, res) => {
        if (req.url === '/operator/ssh-session/exchange') {
          exchanges += 1;
          res.writeHead(200, {
            'set-cookie': 'ff_ssh_operator_session=opaque; HttpOnly; SameSite=Strict; Path=/',
            'cache-control': 'no-store',
          });
          res.end('{"verified":true}');
          return;
        }
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end(req.headers.cookie?.includes('ff_ssh_operator_session=opaque')
          ? 'verified browser' : 'unauthenticated browser');
      });
      servers.push(upstream);
      upstream.listen(0, '127.0.0.1');
      await once(upstream, 'listening');
      const port = (upstream.address() as AddressInfo).port;
      const token = 'a'.repeat(43);
      let secret: string | null = 'b'.repeat(43);
      const bridge = await createSshLocalBridge({
        forwardPort: port, invitationToken: token,
        takeBootstrap: () => {
          const result = secret;
          secret = null;
          return result;
        },
      });
      cleanup.push(bridge.close);
      const invite = createSshBrowserInvitation(bridge.origin, token);
      cleanup.push(invite.cleanup);
      const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
      browsers.push(browser);
      const attacker = await browser.newContext();
      const rogue = await attacker.newPage();
      await rogue.goto(bridge.origin + '/');
      expect(await rogue.locator('body').innerText()).toContain('unauthenticated');
      await attacker.close();

      const owner = await browser.newContext();
      const page = await owner.newPage();
      await page.goto(invite.url);
      await page.waitForURL(bridge.origin + '/', { timeout: 10_000 });
      // The redirect comes from a file:// initiator; test a subsequent
      // same-origin navigation to distinguish SameSite redirect behavior.
      await page.goto(bridge.origin + '/');
      expect(await page.locator('body').innerText()).toContain('verified browser');
      expect(exchanges).toBe(1);
      const cookies = await owner.cookies(bridge.origin);
      expect(cookies.some(cookie => cookie.name === 'ff_ssh_operator_session' &&
        cookie.httpOnly && cookie.sameSite === 'Strict')).toBe(true);
      await owner.close();
    }, 35_000);

    it('drives the REAL Mission Control Fleet button with an OS-owner browser session', async () => {
      const root = mkdtempSync(join(tmpdir(), 'ff-real-owner-ui-'));
      roots.push(root);
      const config = defaultConfig(root);
      config.rateLimit.enabled = false;
      const container = new Container(config);
      const project = join(root, 'project');
      mkdirSync(project);
      const { instance } = container.fleet.create({ projectPath: project, authMode: 'none' });
      const uid = process.getuid?.() ?? 0;
      const store = new TrustedHostStore({
        operatorRoot: join(root, 'operator'), currentUid: uid, now: Date.now,
      });
      const installationId = store.getOrCreateInstallationId();
      const service = new TrustedHostConsentService({
        fleet: container.fleet, store, installationId, serviceUid: uid,
        now: Date.now, isWriteFrozen: () => false, recordAudit: () => {},
      });
      vi.spyOn(container, 'trustedHostConsentService').mockReturnValue(service);
      vi.spyOn(container.fleet, 'start').mockImplementation(id => container.fleet.get(id));
      const broker = new SshSessionBroker({
        serviceUid: uid, installationId, operatorRoot: join(root, 'ssh'),
        projectRoots: [project], now: Date.now,
      });
      const dashboard = startDashboard(container, buildRegistry(container), {
        host: '127.0.0.1', port: 0, sshOperatorBroker: broker,
      });
      servers.push(dashboard);
      if (!dashboard.listening) await once(dashboard, 'listening');
      const dashboardPort = (dashboard.address() as AddressInfo).port;
      const bootstrap = broker.openFromHost(uid, 'local-operator-launch');
      let secret: string | null = bootstrap.bootstrapSecret;
      const token = 'p'.repeat(43);
      const bridge = await createSshLocalBridge({
        forwardPort: dashboardPort,
        invitationToken: token, landingPath: '/app/',
        takeBootstrap: () => {
          const value = secret;
          secret = null;
          return value;
        },
      });
      cleanup.push(bridge.close);
      const invite = createSshBrowserInvitation(bridge.origin, token);
      cleanup.push(invite.cleanup);
      const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
      browsers.push(browser);
      const context = await browser.newContext();
      const page = await context.newPage();
      const browserErrors: string[] = [];
      page.on('pageerror', error => browserErrors.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error') browserErrors.push(message.text());
      });
      page.on('response', response => {
        if (response.status() >= 400) browserErrors.push(
          response.status() + ' ' + new URL(response.url()).pathname);
      });
      await page.goto(invite.url);
      await page.waitForURL(bridge.origin + '/app/', { timeout: 10_000 });
      const fleetNavigation = await page.goto(bridge.origin + '/app/fleet');
      try {
        await expect.poll(() => page.getByRole('button', {
          name: /Allow AI to operate on this computer/i,
        }).count(), { timeout: 12_000 }).toBe(1);
      } catch (error) {
        // On CI, print diagnostic-only paths/content (never cookies or tokens).
        const fleetFetch = await page.evaluate(async () => {
          const result = await fetch('/fleet');
          return { status: result.status, body: (await result.text()).slice(0, 450) };
        });
        console.error('FLEET_OWNER_UI_E2E_DIAGNOSTICS', JSON.stringify({
          route: new URL(page.url()).pathname,
          navigationStatus: fleetNavigation?.status(),
          title: await page.title(),
          renderedText: (await page.locator('body').innerText()).slice(0, 800),
          fleetFetch, browserErrors: browserErrors.slice(0, 20),
        }));
        throw error;
      }
      const afterClick: Array<{ path: string; status: number; message: string }> = [];
      page.on('response', async response => {
        const path = new URL(response.url()).pathname;
        if (path.includes('/operator/ssh-session/status') ||
            path.includes('/one-click-trusted-host')) {
          // Never print response bodies: they may contain a newly minted token.
          let errorCode = 'ok';
          if (!response.ok()) {
            try {
              // Only the server's static error identifier is safe to log.
              const payload = await response.json() as { error?: string };
              errorCode = /^[A-Z_]{3,100}$/.test(payload.error ?? '')
                ? payload.error! : 'failed';
            } catch { errorCode = 'failed'; }
          }
          afterClick.push({ path, status: response.status(), message: errorCode });
        }
      });
      await page.getByRole('button', {
        name: /Allow AI to operate on this computer/i,
      }).click();
      try {
        await expect.poll(() => container.fleet.get(instance.id).terminalExecution, {
          timeout: 12_000,
        }).toBe('trusted-host');
      } catch (error) {
        const browserStatus = await page.evaluate(async () => {
          const result = await fetch('/operator/ssh-session/status');
          const body = await result.json() as { verified?: boolean; source?: string };
          return { http: result.status, verified: body.verified, source: body.source };
        });
        console.error('FLEET_ONE_CLICK_DIAGNOSTICS', JSON.stringify({
          afterClick, browserStatus,
          ui: (await page.locator('body').innerText()).slice(-1600),
          browserErrors: browserErrors.slice(0, 12),
          instance: {
            state: container.fleet.get(instance.id).state,
            terminalExecution: container.fleet.get(instance.id).terminalExecution,
            authMode: container.fleet.get(instance.id).authMode,
          },
        }));
        throw error;
      }
      expect(container.fleet.get(instance.id)).toMatchObject({
        authMode: 'token', toolsPreset: 'full', policyMode: 'danger',
      });
      expect(() => service.assertAuthorized(instance.id, {
        toolsPreset: 'full', policyMode: 'danger', terminalExecution: 'trusted-host',
      })).not.toThrow();
      await expect.poll(() => page.getByRole('button', {
        name: /Turn off AI access/i,
      }).count(), { timeout: 6_000 }).toBe(1);
      // No second mandatory credential-popup confirmation after the user's
      // one explicit enable click. The token remains optional to inspect.
      expect(await page.getByText(/Shown exactly once — copy it now/i).count()).toBe(0);
      expect(await page.getByRole('button', { name: /Show connection key/i }).count()).toBe(1);
      await context.close();
    }, 40_000);

    it('opens local Mission Control app directly from a one-time owner invitation', async () => {
      let exchanges = 0;
      const server = createServer((req, res) => {
        if (req.url === '/operator/ssh-session/exchange') {
          exchanges++;
          res.writeHead(200, {
            'set-cookie': 'ff_ssh_operator_session=localproof; HttpOnly; SameSite=Strict; Path=/',
          });
          res.end('{"verified":true}');
          return;
        }
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end(req.url === '/app/' && req.headers.cookie?.includes('localproof')
          ? 'owner app session' : 'not authorized');
      });
      servers.push(server);
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const token = 'c'.repeat(43);
      let secret: string | null = 'd'.repeat(43);
      const bridge = await createSshLocalBridge({
        forwardPort: (server.address() as AddressInfo).port,
        invitationToken: token,
        landingPath: '/app/',
        takeBootstrap: () => {
          const value = secret;
          secret = null;
          return value;
        },
      });
      cleanup.push(bridge.close);
      const invite = createSshBrowserInvitation(bridge.origin, token);
      cleanup.push(invite.cleanup);
      const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
      browsers.push(browser);
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(invite.url);
      await page.waitForURL(bridge.origin + '/app/', { timeout: 10_000 });
      // The file:// initiated landing may not send SameSite=Strict yet.
      // It must still render the app shell, rather than a denied bridge page.
      expect(await page.locator('body').innerText()).not.toContain('SSH_DESKTOP_BINDING_DENIED');
      await page.goto(bridge.origin + '/app/');
      expect(await page.locator('body').innerText()).toContain('owner app session');
      expect(exchanges).toBe(1);
      await context.close();
    }, 35_000);
  },
);
