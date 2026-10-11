import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { SshHelperBroker, SshHelperBootstrap } from './ssh-session-helper.js';
import { SshSessionStore } from './ssh-session-store.js';

const authorityMarker: unique symbol = Symbol('folderforge-ssh-operator-authority');
const BOOTSTRAP_TTL_MS = 60_000;
const SESSION_IDLE_TTL_MS = 15 * 60_000;
const SESSION_ABSOLUTE_TTL_MS = 8 * 60 * 60_000;

export interface SshOperatorAuthority {
  readonly source: 'ssh-remote-exec';
  readonly installationId: string;
  readonly serviceUid: number;
  readonly leaseId: string;
  readonly sessionId: string;
  readonly [authorityMarker]: true;
}

export interface SshOperatorSession {
  readonly sessionId: string;
  readonly leaseId: string;
  readonly expiresAt: number;
  readonly absoluteExpiresAt: number;
}

type LeaseRecord = {
  digest: Buffer;
  expiresAt: number;
};

type SessionRecord = {
  leaseId: string;
  lastSeenAt: number;
  absoluteExpiresAt: number;
};

/**
 * The server-owned broker. An SSH helper in another OS process must register
 * through a protected host-local IPC bridge, not by creating a new broker;
 * the bridge is a separate task and must be proven before any HTTP routes
 * are allowed to call this object.
 */
export class SshSessionBroker implements SshHelperBroker {
  readonly serviceUid: number;
  readonly installationId: string;
  private readonly now: () => number;
  private readonly store: SshSessionStore;
  private readonly leases = new Map<string, LeaseRecord>();
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly issuedAuthorities = new WeakSet<object>();

  constructor(opts: {
    serviceUid: number;
    installationId: string;
    operatorRoot: string;
    projectRoots: string[];
    now: () => number;
  }) {
    if (!Number.isSafeInteger(opts.serviceUid) || opts.serviceUid < 0 ||
        !opts.installationId || opts.installationId.length > 128) {
      throw new Error('INVALID_SSH_OPERATOR_IDENTITY');
    }
    this.serviceUid = opts.serviceUid;
    this.installationId = opts.installationId;
    this.now = opts.now;
    this.store = new SshSessionStore({
      root: opts.operatorRoot, uid: opts.serviceUid, projectRoots: opts.projectRoots,
    });
  }

  private digest(secret: string): Buffer {
    return createHash('sha256').update(secret).digest();
  }

  openFromHost(uid: number): SshHelperBootstrap {
    if (uid !== this.serviceUid || !Number.isSafeInteger(uid)) {
      throw new Error('WRONG_OPERATOR_UID');
    }
    if (this.leases.size >= 128) {
      throw new Error('SSH_SESSION_CAPACITY_EXCEEDED');
    }
    const secret = randomBytes(32).toString('base64url');
    const leaseId = randomUUID();
    const expiresAt = this.now() + BOOTSTRAP_TTL_MS;
    const digest = this.digest(secret);
    this.store.record(leaseId, digest.toString('hex'), expiresAt);
    this.leases.set(leaseId, { digest, expiresAt });
    return { bootstrapSecret: secret, leaseId, expiresAt };
  }

  exchangeBootstrap(secret: string): SshOperatorSession {
    if (typeof secret !== 'string' || secret.length < 43 || secret.length > 128) {
      throw new Error('SSH_BOOTSTRAP_UNAVAILABLE');
    }
    const candidate = this.digest(secret);
    for (const [leaseId, record] of this.leases) {
      if (!timingSafeEqual(candidate, record.digest)) continue;
      // Consumed records are erased even when expired, so retries never mint.
      this.leases.delete(leaseId);
      this.store.remove(leaseId);
      if (record.expiresAt <= this.now()) throw new Error('SSH_BOOTSTRAP_UNAVAILABLE');
      const sessionId = randomBytes(32).toString('base64url');
      const session: SessionRecord = {
        leaseId,
        lastSeenAt: this.now(),
        absoluteExpiresAt: this.now() + SESSION_ABSOLUTE_TTL_MS,
      };
      // An exchanged bootstrap retains its live lease until SSH disconnect.
      this.leases.set(leaseId, { digest: Buffer.alloc(32), expiresAt: session.absoluteExpiresAt });
      this.sessions.set(this.digest(sessionId).toString('hex'), session);
      return {
        sessionId,
        leaseId,
        expiresAt: this.now() + SESSION_IDLE_TTL_MS,
        absoluteExpiresAt: session.absoluteExpiresAt,
      };
    }
    throw new Error('SSH_BOOTSTRAP_UNAVAILABLE');
  }

  assertLiveSession(sessionId: string): SshOperatorAuthority {
    if (typeof sessionId !== 'string' || sessionId.length < 43 || sessionId.length > 128) {
      throw new Error('SSH_SESSION_UNAVAILABLE');
    }
    const key = this.digest(sessionId).toString('hex');
    const session = this.sessions.get(key);
    if (!session || !this.leases.has(session.leaseId)) {
      throw new Error('SSH_SESSION_UNAVAILABLE');
    }
    if (session.absoluteExpiresAt <= this.now() ||
        session.lastSeenAt + SESSION_IDLE_TTL_MS <= this.now()) {
      this.sessions.delete(key);
      throw new Error('SSH_SESSION_EXPIRED');
    }
    session.lastSeenAt = this.now();
    const authority: SshOperatorAuthority = Object.freeze({
      source: 'ssh-remote-exec',
      installationId: this.installationId,
      serviceUid: this.serviceUid,
      leaseId: session.leaseId,
      sessionId,
      [authorityMarker]: true as const,
    });
    this.issuedAuthorities.add(authority);
    return authority;
  }

  assertAuthorityLive(authority: SshOperatorAuthority): void {
    if (!authority || typeof authority !== 'object' ||
        !this.issuedAuthorities.has(authority)) {
      throw new Error('SSH_OPERATOR_AUTHORITY_INVALID');
    }
    this.assertLiveSession(authority.sessionId);
  }

  revokeLease(leaseId: string): void {
    this.leases.delete(leaseId);
    this.store.remove(leaseId);
    for (const [key, record] of this.sessions) {
      if (record.leaseId === leaseId) this.sessions.delete(key);
    }
  }

  revokeSession(sessionId: string): void {
    if (typeof sessionId !== 'string') return;
    this.sessions.delete(this.digest(sessionId).toString('hex'));
  }
}
