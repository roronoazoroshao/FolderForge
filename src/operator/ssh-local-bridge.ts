import { timingSafeEqual } from 'node:crypto';
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http';
import { type AddressInfo } from 'node:net';
import { SSH_BROWSER_CHANNEL_HEADER } from './ssh-browser-channel.js';

/**
 * The remote SSH bootstrap remains inside the workstation launcher. A local
 * browser must first present a DIFFERENT one-time invitation, ideally carried
 * by a 0600 owner-only file and an HTML POST, never a URL or query parameter.
 *
 * This does not defend against a compromised browser/extension or arbitrary
 * same-UID code execution, which must remain explicit residual risks.
 */
export interface SshLocalBridgeOptions {
  forwardPort: number;
  invitationToken: string;
  takeBootstrap: () => string | null;
  now?: () => number;
  invitationTtlMs?: number;
  landingPath?: string;
  /** Owner-only Dashboard credential: used only for trusted IPC exchange. */
  upstreamCredential?: string;
  /** Secret derivative held ONLY by the local verified SSH proxy, not browser JS. */
  browserChannelProof?: string;
}

export interface SshLocalBridge {
  readonly origin: string;
  close(): Promise<void>;
}

function validSecret(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43,128}$/.test(value);
}

function sameToken(a: string, b: string): boolean {
  const l = Buffer.from(a);
  const r = Buffer.from(b);
  return l.length === r.length && timingSafeEqual(l, r);
}

function loopback(req: IncomingMessage): boolean {
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1']
    .includes(req.socket.remoteAddress ?? '');
}

function deny(res: ServerResponse, status: number): void {
  res.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
  });
  res.end(JSON.stringify({ error: 'SSH_DESKTOP_BINDING_DENIED' }));
}

async function readBounded(req: IncomingMessage, maxBytes: number): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const piece = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += piece.length;
    if (total > maxBytes) throw new Error('SSH_LOCAL_BINDING_TOO_LARGE');
    chunks.push(piece);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function exchangeRemote(port: number, secret: string, credential?: string): Promise<string | null> {
  const base = 'http://127.0.0.1:' + port;
  return new Promise((resolve, reject) => {
    const upstream = httpRequest(base + '/operator/ssh-session/exchange', {
      method: 'POST',
      headers: {
        origin: base,
        'sec-fetch-site': 'same-origin',
        'x-folderforge-ssh-bootstrap': secret,
        ...(credential ? { authorization: 'Bearer ' + credential } : {}),
        'content-length': '0',
      },
      timeout: 5_000,
    }, response => {
      // Return only the browser HttpOnly session cookie. Never forward the
      // bootstrap secret, CSRF token or upstream response body to the HTML file.
      response.resume();
      const cookie = response.headers['set-cookie']?.find(v =>
        v.startsWith('ff_ssh_operator_session=') && v.includes('HttpOnly'));
      resolve(response.statusCode === 200 ? cookie ?? null : null);
    });
    upstream.on('timeout', () => upstream.destroy(new Error('SSH_OPERATOR_EXCHANGE_TIMEOUT')));
    upstream.on('error', reject);
    upstream.end();
  });
}

/**
 * Before lending the remote Dashboard credential to any browser request,
 * re-check the server-owned SSH session. This also handles broker idle/absolute
 * expiry and explicit logout while the outer OpenSSH process remains alive.
 */
async function remoteOwnerSessionLive(port: number, cookie: string, credential: string, browserChannelProof?: string): Promise<boolean> {
  return new Promise(resolve => {
    const req = httpRequest({
      hostname: '127.0.0.1', port,
      path: '/operator/ssh-session/status', method: 'GET',
      headers: { cookie, authorization: 'Bearer ' + credential,
        ...(browserChannelProof ? { [SSH_BROWSER_CHANNEL_HEADER]: browserChannelProof } : {}) },
      timeout: 5_000,
    }, response => {
      if (response.statusCode !== 200) {
        response.resume();
        resolve(false);
        return;
      }
      let content = '';
      response.on('data', piece => {
        content += piece.toString('utf8');
        if (content.length > 1024) response.destroy();
      });
      response.once('end', () => {
        try { resolve((JSON.parse(content) as { verified?: boolean }).verified === true); }
        catch { resolve(false); }
      });
      response.once('error', () => resolve(false));
    });
    req.once('timeout', () => req.destroy());
    req.once('error', () => resolve(false));
    req.end();
  });
}

function boundOwnerCookie(cookieHeader: string | undefined, expected: string | null): boolean {
  if (!expected || !cookieHeader) return false;
  const values = cookieHeader.split(';').map(x => x.trim())
    .filter(x => x.startsWith('ff_ssh_operator_session='));
  return values.length === 1 && sameToken(values[0]!, expected);
}

export async function createSshLocalBridge(
  opts: SshLocalBridgeOptions,
): Promise<SshLocalBridge> {
  if (!Number.isSafeInteger(opts.forwardPort) ||
      opts.forwardPort < 1 || opts.forwardPort > 65535 ||
      !validSecret(opts.invitationToken) ||
      (opts.browserChannelProof !== undefined && !validSecret(opts.browserChannelProof))) {
    throw new Error('INVALID_SSH_LOCAL_BRIDGE_INPUT');
  }
  const now = opts.now ?? Date.now;
  const ttl = opts.invitationTtlMs ?? 60_000;
  const landingPath = opts.landingPath ?? '/';
  if (landingPath !== '/' && landingPath !== '/app/' &&
      !/^\/app\/\?token=[A-Za-z0-9_-]{32,128}$/.test(landingPath)) {
    throw new Error('INVALID_SSH_BRIDGE_LANDING');
  }
  if (!Number.isSafeInteger(ttl) || ttl < 1 || ttl > 60_000) {
    throw new Error('INVALID_SSH_INVITATION_TTL');
  }
  const expiresAt = now() + ttl;
  let used = false;
  let pairedCookie: string | null = null;
  let origin = '';

  const server = createServer((req, res) => {
    void (async () => {
      if (!loopback(req) || req.headers.host !== origin.slice('http://'.length)) {
        deny(res, 403);
        return;
      }
      const url = new URL(req.url ?? '/', origin);
      if (url.pathname === '/__folderforge/activate') {
        if (req.method !== 'POST' || url.search ||
            req.headers['content-type'] !== 'application/x-www-form-urlencoded' ||
            ![undefined, 'null'].includes(req.headers.origin)) {
          deny(res, 403);
          return;
        }
        let body: string;
        try { body = await readBounded(req, 512); }
        catch { deny(res, 413); return; }
        const fields = new URLSearchParams(body);
        const token = fields.get('pair');
        if (used || now() >= expiresAt || !validSecret(token) ||
            fields.getAll('pair').length !== 1 ||
            !sameToken(token, opts.invitationToken)) {
          deny(res, 403);
          return;
        }
        // Mark before awaiting the remote exchange: exactly one concurrent
        // request can consume the invitation, including an upstream failure.
        used = true;
        const secret = opts.takeBootstrap();
        if (!validSecret(secret)) { deny(res, 403); return; }
        let cookie: string | null;
        try { cookie = await exchangeRemote(opts.forwardPort, secret, opts.upstreamCredential); }
        catch { deny(res, 502); return; }
        if (!cookie) { deny(res, 403); return; }
        // Only the exact HttpOnly browser session returned by this one-time
        // owner exchange may activate Dashboard auth on the local proxy.
        const verifiedCookie = cookie.split(';', 1)[0]!;
        if (!/^ff_ssh_operator_session=[A-Za-z0-9_-]{43,128}$/.test(verifiedCookie)) {
          deny(res, 403);
          return;
        }
        pairedCookie = verifiedCookie;
        res.writeHead(303, {
          location: landingPath,
          'set-cookie': cookie,
          'cache-control': 'no-store',
          'referrer-policy': 'no-referrer',
        });
        res.end();
        return;
      }
      // Ordinary UI requests must never control the SSH exchange endpoint
      // directly or supply a claimed SSH UID/bootstrap header upstream.
      if (url.pathname.startsWith('/__folderforge/') ||
          url.pathname === '/operator/ssh-session/exchange') {
        deny(res, 403);
        return;
      }
      const incomingOrigin = req.headers.origin;
      const incomingSite = req.headers['sec-fetch-site'];
      // A real file:// owner invitation produces a *cross-site* top-level
      // document navigation after its successful 303. This exception permits
      // fetching ONLY the read-only app HTML, and ONLY after one valid pairing.
      // Never allow cross-site API calls, subresources or mutations.
      const pairedAppNavigation = used && req.method === 'GET' &&
        url.pathname.startsWith('/app/') && incomingOrigin === undefined &&
        incomingSite === 'cross-site' &&
        req.headers['sec-fetch-mode'] === 'navigate' &&
        req.headers['sec-fetch-dest'] === 'document';
      if ((incomingOrigin !== undefined && incomingOrigin !== origin) ||
          (incomingSite !== undefined &&
            !['none', 'same-origin'].includes(String(incomingSite)) && !pairedAppNavigation) ||
          (req.method !== 'GET' && req.method !== 'HEAD' && incomingOrigin !== origin)) {
        deny(res, 403);
        return;
      }
      const ownerBound = boundOwnerCookie(req.headers.cookie, pairedCookie);
      if (opts.upstreamCredential && !pairedAppNavigation) {
        // Do not convert an ambient localhost / forged cookie into Dashboard
        // bearer auth. The live upstream broker, not a 200 response from
        // port-forwarding, decides if this is a verified owner browser.
        if (!ownerBound ||
            !await remoteOwnerSessionLive(opts.forwardPort, pairedCookie!,
              opts.upstreamCredential, opts.browserChannelProof)) {
          deny(res, 403);
          return;
        }
      }
      const filtered = { ...req.headers };
      if (opts.upstreamCredential && (ownerBound || pairedAppNavigation)) {
        // Keep the Dashboard credential *inside this process*. Never expose
        // it in a location/query parameter, browser JS, or Set-Cookie.
        filtered.authorization = 'Bearer ' + opts.upstreamCredential;
        delete filtered['x-api-key'];
      }
      // Never forward operator cookies on an inherited cross-site navigation;
      // the app's subsequent same-origin requests carry the browser session.
      if (pairedAppNavigation) delete filtered.cookie;
      for (const key of Object.keys(filtered)) {
        if (key === SSH_BROWSER_CHANNEL_HEADER ||
            key === 'x-folderforge-ssh-bootstrap' || key.startsWith('x-ssh-') ||
            key.startsWith('x-forwarded-') || key === 'connection' ||
            key === 'proxy-authorization') delete filtered[key];
      }
      // Only the verified bridge can add this proof to a browser-bound
      // request. Any caller-supplied version was stripped above.
      if (ownerBound && opts.browserChannelProof) {
        filtered[SSH_BROWSER_CHANNEL_HEADER] = opts.browserChannelProof;
      }
      filtered.host = '127.0.0.1:' + opts.forwardPort;
      if (incomingOrigin === origin) filtered.origin = 'http://127.0.0.1:' + opts.forwardPort;
      const upstream = httpRequest({
        hostname: '127.0.0.1', port: opts.forwardPort,
        method: req.method, path: req.url, headers: filtered,
      }, response => {
        if (!res.headersSent) res.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(res);
      });
      upstream.on('error', () => {
        if (!res.headersSent) deny(res, 502);
        else res.destroy();
      });
      req.pipe(upstream);
    })().catch(() => { if (!res.headersSent) deny(res, 500); });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
  let closed = false;
  return {
    origin,
    close: async () => {
      if (closed) return;
      closed = true;
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close(error => error ? reject(error) : resolve()));
    },
  };
}
