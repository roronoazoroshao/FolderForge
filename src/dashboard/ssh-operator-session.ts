import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SshSessionBroker, SshOperatorAuthority } from '../operator/ssh-session-broker.js';

const COOKIE = 'ff_ssh_operator_session';
const PATH = '/operator/ssh-session/';

function respond(res: ServerResponse, status: number, body: object): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(JSON.stringify(body));
}

function sessionCookie(req: IncomingMessage): string | null {
  const cookieHeader = req.headers.cookie;
  if (typeof cookieHeader !== 'string') return null;
  const parts = cookieHeader.split(';').map(v => v.trim());
  const value = parts.find(v => v.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  return value && /^[A-Za-z0-9_-]{43,128}$/.test(value) ? value : null;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Elevated SSH operator authority is not granted by a loopback peer address,
 * Dashboard API token, Origin, a user-provided header or a cookie alone.
 * Every privileged use rechecks the broker's live SSH channel lease.
 */
export class SshOperatorWebSessions {
  private readonly csrfBySession = new Map<string, string>();
  constructor(private readonly broker: SshSessionBroker) {}

  isRoute(req: IncomingMessage): boolean {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    return path.startsWith(PATH);
  }

  private originAllowed(req: IncomingMessage, write: boolean): boolean {
    const remote = req.socket.remoteAddress;
    if (remote !== '127.0.0.1' && remote !== '::1' && remote !== '::ffff:127.0.0.1') return false;
    const localPort = req.socket.localPort;
    if (!localPort || req.headers.host !== '127.0.0.1:' + localPort) return false;
    const fetchSite = req.headers['sec-fetch-site'];
    if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') return false;
    const origin = req.headers.origin;
    if (write) return origin === 'http://127.0.0.1:' + localPort;
    return origin === undefined || origin === 'http://127.0.0.1:' + localPort;
  }

  private key(sessionId: string): string {
    return createHash('sha256').update(sessionId).digest('hex');
  }

  private current(req: IncomingMessage): { sessionId: string; authority: SshOperatorAuthority } | null {
    const sessionId = sessionCookie(req);
    if (!sessionId) return null;
    try {
      const authority = this.broker.assertLiveSession(sessionId);
      if (!this.csrfBySession.has(this.key(sessionId))) return null;
      return { sessionId, authority };
    } catch {
      this.csrfBySession.delete(this.key(sessionId));
      return null;
    }
  }

  requirePrivilegedWrite(req: IncomingMessage): SshOperatorAuthority {
    if (!this.originAllowed(req, true)) throw new Error('SSH_OPERATOR_ORIGIN_DENIED');
    const current = this.current(req);
    if (!current) throw new Error('SSH_OPERATOR_SESSION_REQUIRED');
    const presented = req.headers['x-ssh-operator-csrf'];
    const expected = this.csrfBySession.get(this.key(current.sessionId));
    if (typeof presented !== 'string' || !expected || !safeEqual(presented, expected)) {
      throw new Error('SSH_OPERATOR_CSRF_DENIED');
    }
    this.broker.assertAuthorityLive(current.authority);
    return current.authority;
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    const method = req.method ?? 'GET';
    const write = method !== 'GET';
    if (!this.originAllowed(req, write)) {
      return respond(res, 403, { error: 'SSH_OPERATOR_ORIGIN_DENIED' });
    }

    if (path === PATH + 'exchange' && method === 'POST') {
      if (new URL(req.url ?? '/', 'http://localhost').search) {
        return respond(res, 401, { error: 'SSH_BOOTSTRAP_UNAVAILABLE' });
      }
      const secret = req.headers['x-folderforge-ssh-bootstrap'];
      if (typeof secret !== 'string' || secret.length > 128) {
        return respond(res, 401, { error: 'SSH_BOOTSTRAP_UNAVAILABLE' });
      }
      try {
        const session = this.broker.exchangeBootstrap(secret);
        const csrfToken = randomBytes(32).toString('base64url');
        this.csrfBySession.set(this.key(session.sessionId), csrfToken);
        // The only supported HTTP deployment for this handler is strict
        // loopback; do not set Domain or expose cookies to the launcher URL.
        res.setHeader('set-cookie', [
          COOKIE + '=' + session.sessionId,
          'HttpOnly', 'SameSite=Strict', 'Path=/', 'Max-Age=28800',
        ].join('; '));
        return respond(res, 200, {
          verified: true, source: 'ssh-remote-exec',
          csrfToken, expiresAt: session.expiresAt,
        });
      } catch {
        return respond(res, 401, { error: 'SSH_BOOTSTRAP_UNAVAILABLE' });
      }
    }

    if (path === PATH + 'status' && method === 'GET') {
      const active = this.current(req);
      // CSRF tokens are intentionally readable by the authenticated,
      // same-origin browser UI (the session cookie remains HttpOnly). This
      // enables a one-click form without a second operator interaction.
      // No-store and origin restrictions protect this response.
      return respond(res, 200, active
        ? {
            verified: true,
            source: 'ssh-remote-exec',
            csrfToken: this.csrfBySession.get(this.key(active.sessionId)),
          }
        : { verified: false });
    }

    if (path === PATH + 'logout' && method === 'POST') {
      let current: { sessionId: string; authority: SshOperatorAuthority } | null;
      try {
        this.requirePrivilegedWrite(req);
        current = this.current(req);
      } catch {
        return respond(res, 403, { error: 'SSH_OPERATOR_CSRF_DENIED' });
      }
      if (!current) return respond(res, 401, { error: 'SSH_OPERATOR_SESSION_REQUIRED' });
      this.csrfBySession.delete(this.key(current.sessionId));
      this.broker.revokeSession(current.sessionId);
      res.setHeader('set-cookie', COOKIE + '=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
      return respond(res, 200, { verified: false });
    }

    respond(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }
}
