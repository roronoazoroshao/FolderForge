import { timingSafeEqual } from 'node:crypto';
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http';
import { type AddressInfo } from 'node:net';

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

async function exchangeRemote(port: number, secret: string): Promise<string | null> {
  const base = 'http://127.0.0.1:' + port;
  return new Promise((resolve, reject) => {
    const upstream = httpRequest(base + '/operator/ssh-session/exchange', {
      method: 'POST',
      headers: {
        origin: base,
        'sec-fetch-site': 'same-origin',
        'x-folderforge-ssh-bootstrap': secret,
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

export async function createSshLocalBridge(
  opts: SshLocalBridgeOptions,
): Promise<SshLocalBridge> {
  if (!Number.isSafeInteger(opts.forwardPort) ||
      opts.forwardPort < 1 || opts.forwardPort > 65535 ||
      !validSecret(opts.invitationToken)) {
    throw new Error('INVALID_SSH_LOCAL_BRIDGE_INPUT');
  }
  const now = opts.now ?? Date.now;
  const ttl = opts.invitationTtlMs ?? 60_000;
  if (!Number.isSafeInteger(ttl) || ttl < 1 || ttl > 60_000) {
    throw new Error('INVALID_SSH_INVITATION_TTL');
  }
  const expiresAt = now() + ttl;
  let used = false;
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
        try { cookie = await exchangeRemote(opts.forwardPort, secret); }
        catch { deny(res, 502); return; }
        if (!cookie) { deny(res, 403); return; }
        res.writeHead(303, {
          location: '/',
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
      if ((incomingOrigin !== undefined && incomingOrigin !== origin) ||
          (incomingSite !== undefined && !['none', 'same-origin'].includes(String(incomingSite))) ||
          (req.method !== 'GET' && req.method !== 'HEAD' && incomingOrigin !== origin)) {
        deny(res, 403);
        return;
      }
      const filtered = { ...req.headers };
      for (const key of Object.keys(filtered)) {
        if (key === 'x-folderforge-ssh-bootstrap' || key.startsWith('x-ssh-') ||
            key.startsWith('x-forwarded-') || key === 'connection' ||
            key === 'proxy-authorization') delete filtered[key];
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
