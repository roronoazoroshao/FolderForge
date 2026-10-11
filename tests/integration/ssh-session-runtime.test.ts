import { afterEach, describe, expect, it } from 'vitest';
import { chmodSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openSshOperatorIpcClient } from '../../src/operator/ssh-operator-ipc.js';
import { startSshOperatorRuntime } from '../../src/operator/ssh-session-runtime.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function harness() {
  const root = mkdtempSync(join(tmpdir(), 'ff-ssh-runtime-'));
  roots.push(root);
  const uid = process.getuid?.() ?? 0;
  return {
    root,
    options: {
      operatorRoot: root,
      serviceUid: uid,
      installationId: 'runtime-test-install',
      projectRoots: [join(root, '..', 'other-project')],
      now: Date.now,
    },
  };
}

describe.skipIf(process.platform !== 'linux' && process.platform !== 'darwin')(
  'Dashboard-owned SSH IPC runtime (no browser elevation)', () => {
    it('shares the exact live broker with remote-exec IPC clients and revokes on EOF', async () => {
      const h = harness();
      const running = await startSshOperatorRuntime(h.options);
      try {
        expect(existsSync(running.socketPath)).toBe(true);
        const client = await openSshOperatorIpcClient(running.socketPath, h.options.serviceUid);
        const bootstrap = client.openFromHost(h.options.serviceUid);
        const session = running.broker.exchangeBootstrap(bootstrap.bootstrapSecret);
        expect(running.broker.assertLiveSession(session.sessionId).installationId)
          .toBe(h.options.installationId);
        client.revokeLease(bootstrap.leaseId);
        await new Promise(resolve => setTimeout(resolve, 30));
        expect(() => running.broker.assertLiveSession(session.sessionId))
          .toThrow('SSH_SESSION_UNAVAILABLE');
      } finally {
        await running.close();
      }
      expect(existsSync(running.socketPath)).toBe(false);
    });

    it('refuses an operator directory accessible to other OS users before opening IPC', async () => {
      const h = harness();
      chmodSync(h.root, 0o755);
      await expect(startSshOperatorRuntime(h.options))
        .rejects.toThrow('UNSAFE_SSH_OPERATOR_RUNTIME_ROOT');
      expect(existsSync(join(h.root, 'ssh-operator.sock'))).toBe(false);
      expect(existsSync(join(h.root, 'ssh-sessions'))).toBe(false);
    });

    it('fails closed on a second competing Dashboard broker, without taking over its socket', async () => {
      const h = harness();
      const first = await startSshOperatorRuntime(h.options);
      try {
        await expect(startSshOperatorRuntime(h.options))
          .rejects.toThrow('SSH_OPERATOR_IPC_ALREADY_BOUND');
        expect(existsSync(first.socketPath)).toBe(true);
      } finally {
        await first.close();
      }
    });
  },
);
