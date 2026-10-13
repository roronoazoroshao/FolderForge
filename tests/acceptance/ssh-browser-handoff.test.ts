import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { type AddressInfo } from 'node:net';
import { chromium, type Browser } from 'playwright-core';
import { createSshLocalBridge } from '../../src/operator/ssh-local-bridge.js';
import { createSshBrowserInvitation } from '../../src/operator/ssh-dashboard-launcher.js';

const required = process.env.FOLDERFORGE_REQUIRE_BROWSER_E2E === '1';
const servers: Server[] = [];
const browsers: Browser[] = [];
const cleanup: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  await Promise.all(browsers.splice(0).map(browser => browser.close()));
  await Promise.all(cleanup.splice(0).map(fn => fn()));
  await Promise.all(servers.splice(0).map(server =>
    new Promise<void>(resolve => server.close(() => resolve()))));
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
