import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import {
  runSshDashboardHelper,
  isSshDashboardHelperCommand,
  type SshHelperBroker,
} from '../../src/operator/ssh-session-helper.js';

function fixture(uid = 1001) {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  let output = '';
  stdout.on('data', chunk => { output += chunk.toString(); });
  const revoke = vi.fn();
  const broker: SshHelperBroker = {
    serviceUid: 1001,
    openFromHost: vi.fn(() => ({
      bootstrapSecret: 'sensitive-bootstrap-never-logged',
      leaseId: 'lease-unique',
      expiresAt: 1_800_000_000_000,
    })),
    revokeLease: revoke,
  };
  return { io: { osUid: uid, stdin, stdout }, broker, revoke, output: () => output };
}

describe('SSH remote-exec Dashboard helper', () => {
  it('accepts only exact operator dashboard-session serve --stdio argv', () => {
    expect(isSshDashboardHelperCommand(['operator', 'dashboard-session', 'serve', '--stdio'])).toBe(true);
    for (const args of [
      ['operator', 'dashboard-session', 'serve'],
      ['operator', 'dashboard-session', 'serve', '--stdio', '--yes'],
      ['operator', 'trusted-host', 'approve', 'req_fake'],
      ['dashboard', 'ssh'],
    ]) expect(isSshDashboardHelperCommand(args)).toBe(false);
  });

  it('rejects the wrong OS UID before broker session creation or emitting a secret', async () => {
    const h = fixture(2002);
    await expect(runSshDashboardHelper(h.io, h.broker)).rejects.toThrow('WRONG_OPERATOR_UID');
    expect(h.broker.openFromHost).not.toHaveBeenCalled();
    expect(h.output()).toBe('');
  });

  it('exposes a versioned bootstrap only over stdout, then revokes on SSH stdin EOF', async () => {
    const h = fixture();
    const running = runSshDashboardHelper(h.io, h.broker);
    await vi.waitFor(() => expect(h.output()).toContain('bootstrapSecret'));
    const printed = JSON.parse(h.output().trim());
    expect(printed).toEqual({
      protocol: 'folderforge-ssh-operator-bootstrap-v1',
      bootstrapSecret: 'sensitive-bootstrap-never-logged',
      leaseId: 'lease-unique',
      expiresAt: 1_800_000_000_000,
    });
    h.io.stdin.end();
    await running;
    expect(h.revoke).toHaveBeenCalledOnce();
    expect(h.revoke).toHaveBeenCalledWith('lease-unique');
  });

  it('revokes on premature channel close and never sends another bootstrap', async () => {
    const h = fixture();
    const running = runSshDashboardHelper(h.io, h.broker);
    await vi.waitFor(() => expect(h.output()).toContain('bootstrapSecret'));
    h.io.stdin.destroy();
    await running;
    expect(h.revoke).toHaveBeenCalledOnce();
    expect(h.output().split('\n').filter(Boolean)).toHaveLength(1);
  });
});
