import { afterEach, describe, expect, it } from 'vitest';
import { lstatSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SshSessionBroker } from '../../src/operator/ssh-session-broker.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function harness() {
  const root = mkdtempSync(join(tmpdir(), 'ff-ssh-broker-'));
  roots.push(root);
  let time = 1_900_000_000_000;
  const options = {
    serviceUid: process.getuid?.() ?? 0,
    installationId: 'install-ssh-broker-test',
    operatorRoot: join(root, 'operator'),
    projectRoots: [join(root, 'project')],
    now: () => time,
  };
  const broker = new SshSessionBroker(options);
  return { root, options, broker, now: (t: number) => { time = t; }, epoch: time };
}

describe('host-only SSH operator session broker', () => {
  it('accepts real service UID and exchanges a 256-bit bootstrap once', () => {
    const h = harness();
    const grant = h.broker.openFromHost(h.options.serviceUid);
    expect(Buffer.from(grant.bootstrapSecret, 'base64url').length).toBeGreaterThanOrEqual(32);
    expect(grant.expiresAt - h.epoch).toBeLessThanOrEqual(60_000);
    const session = h.broker.exchangeBootstrap(grant.bootstrapSecret);
    expect(session.sessionId.length).toBeGreaterThanOrEqual(43);
    expect(session.leaseId).toBe(grant.leaseId);
    expect(h.broker.assertLiveSession(session.sessionId).source).toBe('ssh-remote-exec');
    expect(() => h.broker.exchangeBootstrap(grant.bootstrapSecret)).toThrow('SSH_BOOTSTRAP_UNAVAILABLE');
  });

  it('rejects wrong UID and invalid bootstrap secrets before creating a session', () => {
    const h = harness();
    expect(() => h.broker.openFromHost(h.options.serviceUid + 1)).toThrow('WRONG_OPERATOR_UID');
    expect(() => h.broker.exchangeBootstrap('forged-secret')).toThrow('SSH_BOOTSTRAP_UNAVAILABLE');
  });

  it('expires bootstrap in at most 60s and live sessions after 15m idle or 8h absolute', () => {
    const h = harness();
    const expiring = h.broker.openFromHost(h.options.serviceUid);
    h.now(h.epoch + 60_001);
    expect(() => h.broker.exchangeBootstrap(expiring.bootstrapSecret)).toThrow('SSH_BOOTSTRAP_UNAVAILABLE');

    h.now(h.epoch);
    const fresh = h.broker.openFromHost(h.options.serviceUid);
    const session = h.broker.exchangeBootstrap(fresh.bootstrapSecret);
    h.now(h.epoch + 15 * 60_000 + 1);
    expect(() => h.broker.assertLiveSession(session.sessionId)).toThrow('SSH_SESSION_EXPIRED');

    h.now(h.epoch);
    const long = h.broker.openFromHost(h.options.serviceUid);
    const keepalive = h.broker.exchangeBootstrap(long.bootstrapSecret);
    for (let t = h.epoch + 10 * 60_000; t <= h.epoch + 8 * 60 * 60_000; t += 10 * 60_000) {
      h.now(t);
      if (t < h.epoch + 8 * 60 * 60_000) {
        expect(h.broker.assertLiveSession(keepalive.sessionId).source).toBe('ssh-remote-exec');
      }
    }
    h.now(h.epoch + 8 * 60 * 60_000 + 1);
    expect(() => h.broker.assertLiveSession(keepalive.sessionId)).toThrow('SSH_SESSION_EXPIRED');
  });

  it('revokes session on channel EOF and does not revive it after a process restart', () => {
    const h = harness();
    const first = h.broker.openFromHost(h.options.serviceUid);
    const issued = h.broker.exchangeBootstrap(first.bootstrapSecret);
    h.broker.revokeLease(first.leaseId);
    expect(() => h.broker.assertLiveSession(issued.sessionId)).toThrow('SSH_SESSION_UNAVAILABLE');

    const second = h.broker.openFromHost(h.options.serviceUid);
    const live = h.broker.exchangeBootstrap(second.bootstrapSecret);
    const restarted = new SshSessionBroker(h.options);
    expect(() => restarted.assertLiveSession(live.sessionId)).toThrow('SSH_SESSION_UNAVAILABLE');
    h.broker.revokeSession(live.sessionId);
    expect(() => h.broker.assertLiveSession(live.sessionId)).toThrow('SSH_SESSION_UNAVAILABLE');
  });

  it('keeps operator files outside project roots with owner-only permissions', () => {
    const h = harness();
    const grant = h.broker.openFromHost(h.options.serviceUid);
    const operator = lstatSync(h.options.operatorRoot);
    expect(operator.mode & 0o077).toBe(0);
    expect(operator.uid).toBe(h.options.serviceUid);
    expect(grant.leaseId).toMatch(/^[0-9a-f-]{36}$/);
    expect(() => new SshSessionBroker({ ...h.options, operatorRoot: join(h.root, 'project', 'operator') }))
      .toThrow('UNSAFE_SSH_SESSION_ROOT');
    const link = join(h.root, 'alias');
    symlinkSync(h.options.operatorRoot, link);
    expect(() => new SshSessionBroker({ ...h.options, operatorRoot: link }))
      .toThrow();
  });
});
