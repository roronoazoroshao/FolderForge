import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const required = process.env.FOLDERFORGE_REQUIRE_SSH_E2E === '1';

describe.skipIf(!required)('real OpenSSH operator feasibility (mandatory dedicated runner)', () => {
  it('proves known-host SSH remote execution, OS UID and channel EOF with wrong-UID and plain-forward negatives', () => {
    const result = execFileSync(
      process.execPath,
      [resolve('scripts/verify-ssh-operator-feasibility.mjs')],
      {
        cwd: process.cwd(),
        env: { ...process.env, FOLDERFORGE_REQUIRE_SSH_E2E: '1' },
        encoding: 'utf8',
        timeout: 150_000,
        maxBuffer: 2 * 1024 * 1024,
      },
    );

    const proof = JSON.parse(result.trim()) as Record<string, unknown>;
    expect(proof).toMatchObject({
      sshTransport: 'real-openssh',
      knownHostVerified: true,
      remoteExecSameUid: true,
      wrongUidDistinct: true,
      mismatchedHostKeyRejected: true,
      plainTunnelHasNoAuthority: true,
      loopbackOnly: true,
      helperEofReaped: true,
      cleanupVerified: true,
    });
    expect(typeof proof.sshVersion).toBe('string');
    expect(proof.sshUid).toBe(proof.serviceUid);
    expect(String(result)).not.toMatch(/PRIVATE KEY|BEGIN OPENSSH|ssh-rsa AAAA/);
  }, 165_000);
});
