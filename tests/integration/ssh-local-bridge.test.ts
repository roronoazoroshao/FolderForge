import { afterEach, describe, expect, it } from 'vitest';
import { createServer, request as httpRequest, type Server } from 'node:http';
import { once } from 'node:events';
import { type AddressInfo } from 'node:net';
import { createSshLocalBridge } from '../../src/operator/ssh-local-bridge.js';
import { SSH_BROWSER_CHANNEL_HEADER } from '../../src/operator/ssh-browser-channel.js';

const servers: Server[] = [];
const closes: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(closes.splice(0).map(close => close()));
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
});

async function fixture(upstreamCredential?: string, browserChannelProof?: string) {
  const seen: Array<{ url: string; host: string; origin: string; bootstrap: string; claimedUid: string; cookie: string; authorization: string; csrf: string; channel: string }> = [];
  let leaseLive = true;
  const target = createServer((req, res) => {
    seen.push({
      url: req.url || '',
      host: String(req.headers.host || ''),
      origin: String(req.headers.origin || ''),
      bootstrap: String(req.headers['x-folderforge-ssh-bootstrap'] || ''),
      claimedUid: String(req.headers['x-ssh-user'] || ''),
      cookie: String(req.headers.cookie || ''),
      authorization: String(req.headers.authorization || ''),
      csrf: String(req.headers['x-folderforge-operator-csrf'] || ''),
      channel: String(req.headers[SSH_BROWSER_CHANNEL_HEADER] || ''),
    });
    if (req.url === '/operator/ssh-session/exchange') {
      if (upstreamCredential && req.headers.authorization !== 'Bearer ' + upstreamCredential) {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end('{"error":"UNAUTHORIZED"}');
        return;
      }
      res.writeHead(200, {
        'content-type': 'application/json',
        'set-cookie': 'ff_ssh_operator_session=' + 'z'.repeat(43) + '; HttpOnly; SameSite=Strict; Path=/',
      });
      res.end(JSON.stringify({ verified: true }));
    } else if (req.url === '/operator/ssh-session/status') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ verified: leaseLive && req.headers.cookie ===
        'ff_ssh_operator_session=' + 'z'.repeat(43) }));
    } else {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('dashboard');
    }
  });
  servers.push(target);
  target.listen(0, '127.0.0.1');
  await once(target, 'listening');
  const forwardPort = (target.address() as AddressInfo).port;
  const token = 'b'.repeat(43);
  let secret: string | null = 's'.repeat(43);
  const bridge = await createSshLocalBridge({
    forwardPort, invitationToken: token,
    ...(upstreamCredential ? { upstreamCredential } : {}),
    ...(browserChannelProof ? { browserChannelProof } : {}),
    takeBootstrap: () => {
      const value = secret;
      secret = null;
      return value;
    },
  });
  closes.push(bridge.close);
  return { origin: bridge.origin, token, seen, forwardPort,
    revoke: () => { leaseLive = false; },
  };
}

describe('SSH desktop bridge: browser-intent binding', () => {
  it('never accepts browser-supplied channel proof; injects the owner proof only for paired cookie', async () => {
    const trustedChannel = 'p'.repeat(43);
    const h = await fixture(undefined, trustedChannel);
    const direct = await fetch(h.origin + '/app/', {
      headers: { [SSH_BROWSER_CHANNEL_HEADER]: 'attacker-value' },
    });
    expect(direct.status).toBe(200);
    expect(h.seen.at(-1)?.channel).toBe('');
    const invited = await fetch(h.origin + '/__folderforge/activate', {
      method: 'POST', redirect: 'manual',
      headers: { origin: 'null', 'content-type': 'application/x-www-form-urlencoded' },
      body: 'pair=' + h.token,
    });
    expect(invited.status).toBe(303);
    const cookie = invited.headers.get('set-cookie')!.split(';')[0]!;
    const accepted = await fetch(h.origin + '/operator/ssh-session/status', {
      headers: { cookie, [SSH_BROWSER_CHANNEL_HEADER]: 'attacker-value' },
    });
    expect(accepted.status).toBe(200);
    expect(h.seen.at(-1)?.channel).toBe(trustedChannel);
    expect(accepted.headers.get('set-cookie')).toBeNull();
    expect((await accepted.text())).not.toContain(trustedChannel);
  });

  it('authenticates the internal owner-only bootstrap without leaking the Dashboard bearer secret', async () => {
    const dashboardCredential = 'c'.repeat(43);
    const h = await fixture(dashboardCredential);
    const response = await fetch(h.origin + '/__folderforge/activate', {
      method: 'POST', redirect: 'manual',
      headers: { origin: 'null', 'content-type': 'application/x-www-form-urlencoded' },
      body: 'pair=' + h.token,
    });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/');
    expect(response.headers.get('set-cookie')).not.toContain(dashboardCredential);
    const exchange = h.seen.find(entry => entry.url === '/operator/ssh-session/exchange');
    expect(exchange?.authorization).toBe('Bearer ' + dashboardCredential);
    const unverified = await fetch(h.origin + '/app/', {
      headers: { 'x-folderforge-ssh-bootstrap': 'forged' },
    });
    expect(unverified.status).toBe(403);
    const cookie = response.headers.get('set-cookie')!.split(';')[0]!;
    const normal = await fetch(h.origin + '/app/', { headers: { cookie } });
    expect(normal.status).toBe(200);
    expect(h.seen[h.seen.length - 1]?.authorization).toBe('Bearer ' + dashboardCredential);
  });

  it('never proxies a configured Dashboard bearer from an anonymous localhost request', async () => {
    const credential = 'm'.repeat(32);
    const h = await fixture(credential);
    const unpaired = await fetch(h.origin + '/fleet');
    expect(unpaired.status).toBe(403);
    expect(h.seen.some(v => v.url === '/fleet')).toBe(false);
    const paired = await fetch(h.origin + '/__folderforge/activate', {
      method: 'POST', redirect: 'manual',
      headers: { origin: 'null', 'content-type': 'application/x-www-form-urlencoded' },
      body: 'pair=' + h.token,
    });
    expect(paired.status).toBe(303);
    const cookie = paired.headers.get('set-cookie')!.split(';')[0]!;
    const forged = await fetch(h.origin + '/fleet', {
      headers: { cookie: 'ff_ssh_operator_session=' + 'a'.repeat(43) },
    });
    expect(forged.status).toBe(403);
    expect(h.seen.some(v => v.url === '/fleet')).toBe(false);
    const authorized = await fetch(h.origin + '/fleet', { headers: { cookie } });
    expect(authorized.status).toBe(200);
    expect(h.seen.find(v => v.url === '/fleet')?.authorization).toBe('Bearer ' + credential);
    const post = await fetch(h.origin + '/fleet/flt_12345678/one-click-trusted-host', {
      method: 'POST', headers: { cookie, origin: h.origin, 'x-folderforge-operator-csrf': 'x'.repeat(43) },
      body: '{}',
    });
    expect(post.status).toBe(200);
    expect(h.seen.at(-1)?.authorization).toBe('Bearer ' + credential);
    // An SSH lease can expire/logout while the TCP forward still exists.
    // The proxy MUST stop supplying the Dashboard token in that case.
    h.revoke();
    const afterRevocation = await fetch(h.origin + '/fleet', { headers: { cookie } });
    expect(afterRevocation.status).toBe(403);
  });

  it('refuses missing/forged URL or header proof and never exchanges on a simple GET', async () => {
    const h = await fixture();
    const before = await fetch(h.origin + '/');
    expect(await before.text()).toBe('dashboard');
    expect(h.seen.some(req => req.url.endsWith('/exchange'))).toBe(false);

    const viaUrl = await fetch(h.origin + '/__folderforge/activate?pair=' + h.token, {
      method: 'POST', headers: { origin: 'null', 'content-type': 'application/x-www-form-urlencoded' },
      body: '',
    });
    expect(viaUrl.status).toBeGreaterThanOrEqual(400);
    const forged = await fetch(h.origin + '/__folderforge/activate', {
      method: 'POST',
      headers: { origin: 'null', 'content-type': 'application/x-www-form-urlencoded',
        'x-folderforge-ssh-bootstrap': 's'.repeat(43) },
      body: 'pair=invalid',
    });
    expect(forged.status).toBe(403);
    expect(h.seen.some(req => req.url.endsWith('/exchange'))).toBe(false);
  });

  it('does not accept cross-site app navigations until the owner has paired', async () => {
    const h = await fixture();
    const headers = {
      'sec-fetch-site': 'cross-site',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-dest': 'document',
    };
    const before = await fetch(h.origin + '/app/', { headers });
    expect(before.status).toBe(403);
    const paired = await fetch(h.origin + '/__folderforge/activate', {
      method: 'POST', redirect: 'manual',
      headers: { origin: 'null', 'content-type': 'application/x-www-form-urlencoded' },
      body: 'pair=' + h.token,
    });
    expect(paired.status).toBe(303);
    // Node fetch forces Sec-Fetch-Mode=cors. A real browser top-level
    // document navigation sends navigate/document, so use raw HTTP here.
    const after = await new Promise<number>((resolve, reject) => {
      const request = httpRequest(h.origin + '/app/', {
        method: 'GET',
        headers: { ...headers, cookie: 'ff_ssh_operator_session=forged' },
      }, res => {
        res.resume();
        res.once('end', () => resolve(res.statusCode ?? 0));
      });
      request.once('error', reject);
      request.end();
    });
    expect(after).toBe(200);
    expect(h.seen[h.seen.length - 1]?.url).toBe('/app/');
    // The cross-site navigation exception deliberately strips cookies, and
    // cannot be used to forward a manually supplied admin session.
    expect(h.seen[h.seen.length - 1]?.bootstrap).toBe('');
    expect(h.seen[h.seen.length - 1]?.cookie).toBe('');
  });

  it('exchanges once only after a POST body carries the separate desktop invitation proof', async () => {
    const h = await fixture();
    const exchange = await fetch(h.origin + '/__folderforge/activate', {
      method: 'POST', redirect: 'manual',
      headers: { origin: 'null', 'content-type': 'application/x-www-form-urlencoded',
        'x-ssh-user': 'spoofed' },
      body: 'pair=' + h.token,
    });
    expect(exchange.status).toBe(303);
    expect(exchange.headers.get('location')).toBe('/');
    expect(exchange.headers.get('set-cookie')).toContain('HttpOnly');
    const upgraded = h.seen.filter(v => v.url === '/operator/ssh-session/exchange');
    expect(upgraded).toHaveLength(1);
    expect(upgraded[0]?.bootstrap).toBe('s'.repeat(43));
    expect(upgraded[0]?.claimedUid).toBe('');
    expect(upgraded[0]?.host).toBe('127.0.0.1:' + h.forwardPort);
    expect(upgraded[0]?.origin).toBe('http://127.0.0.1:' + h.forwardPort);

    const replay = await fetch(h.origin + '/__folderforge/activate', {
      method: 'POST', redirect: 'manual',
      headers: { origin: 'null', 'content-type': 'application/x-www-form-urlencoded' },
      body: 'pair=' + h.token,
    });
    expect(replay.status).toBe(403);
  });

  it('forwards only the dedicated owner-session CSRF field while stripping spoofed SSH identity', async () => {
    const h = await fixture();
    const csrf = 'v'.repeat(43);
    const sent = await fetch(h.origin + '/fleet/flt_12345678/one-click-trusted-host', {
      method: 'POST',
      headers: {
        origin: h.origin,
        'sec-fetch-site': 'same-origin',
        'content-type': 'application/json',
        'x-folderforge-operator-csrf': csrf,
        'x-ssh-user': 'forged-root',
        'x-folderforge-ssh-bootstrap': 'forged',
      },
      body: '{}',
    });
    expect(sent.status).toBe(200);
    const seen = h.seen[h.seen.length - 1];
    expect(seen?.csrf).toBe(csrf);
    expect(seen?.claimedUid).toBe('');
    expect(seen?.bootstrap).toBe('');
  });

  it('does not turn an untrusted remote origin into a same-origin Dashboard write', async () => {
    const h = await fixture();
    const denied = await fetch(h.origin + '/fleet/arbitrary/trusted-host/apply', {
      method: 'POST',
      headers: { origin: 'https://malicious.example', 'content-type': 'application/json',
        'x-ssh-user': 'owner', 'x-folderforge-ssh-bootstrap': 'forged' },
      body: '{}',
    });
    expect(denied.status).toBe(403);
    const withRealLocalOrigin = await fetch(h.origin + '/ordinary', {
      method: 'POST',
      headers: { origin: h.origin, 'content-type': 'application/json',
        'x-ssh-user': 'owner', 'x-folderforge-ssh-bootstrap': 'forged' },
      body: '{}',
    });
    expect(withRealLocalOrigin.status).toBe(200);
    const last = h.seen[h.seen.length - 1];
    expect(last?.claimedUid).toBe('');
    expect(last?.bootstrap).toBe('');
    expect(last?.origin).toBe('http://127.0.0.1:' + h.forwardPort);
  });
});
