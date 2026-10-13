import { afterEach, describe, expect, it } from 'vitest';
import { chmodSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
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

    it('binds a native local-owner app open to a distinct source and revokes its OS-owned lease', async () => {
      const h = harness();
      const runtime = await startSshOperatorRuntime(h.options);
      try {
        expect(existsSync(runtime.localSocketPath)).toBe(true);
        const local = await openSshOperatorIpcClient(runtime.localSocketPath, h.options.serviceUid);
        const proof = local.openFromHost(h.options.serviceUid);
        const session = runtime.broker.exchangeBootstrap(proof.bootstrapSecret);
        expect(runtime.broker.assertLiveSession(session.sessionId)).toMatchObject({
          source: 'local-operator-launch',
          installationId: h.options.installationId,
          serviceUid: h.options.serviceUid,
        });
        const fakeSsh = await openSshOperatorIpcClient(runtime.socketPath, h.options.serviceUid);
        const sshProof = fakeSsh.openFromHost(h.options.serviceUid);
        const sshSession = runtime.broker.exchangeBootstrap(sshProof.bootstrapSecret);
        expect(runtime.broker.assertLiveSession(sshSession.sessionId).source).toBe('ssh-remote-exec');
        local.revokeLease(proof.leaseId);
        fakeSsh.revokeLease(sshProof.leaseId);
        await new Promise(resolve => setTimeout(resolve, 30));
        expect(() => runtime.broker.assertLiveSession(session.sessionId)).toThrow();
        expect(() => runtime.broker.assertLiveSession(sshSession.sessionId)).toThrow();
      } finally {
        await runtime.close();
      }
      expect(existsSync(runtime.localSocketPath)).toBe(false);
    });

    it('verifies a separate helper PROCESS talks to the same Dashboard broker (not CLI/sshd E2E)', async () => {
      const h = harness();
      const running = await startSshOperatorRuntime(h.options);
      const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
      const helper = spawn(process.execPath, [
        '--import', 'tsx',
        join(repoRoot, 'tests', 'fixtures', 'ssh-operator-helper-child.ts'),
        h.root,
      ], { cwd: repoRoot, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });

      try {
        const proof = await new Promise<{ bootstrapSecret: string; leaseId: string }>((resolve, reject) => {
          let output = '';
          const timeout = setTimeout(() => reject(new Error('SSH_HELPER_CLI_START_TIMEOUT')), 15_000);
          helper.once('error', reject);
          helper.once('exit', (code) => reject(new Error('SSH_HELPER_CLI_PREMATURE_EXIT:' + code)));
          helper.stdout.on('data', chunk => {
            output += chunk.toString('utf8');
            const newline = output.indexOf('\n');
            if (newline < 0) return;
            clearTimeout(timeout);
            try {
              resolve(JSON.parse(output.slice(0, newline)) as { bootstrapSecret: string; leaseId: string });
            } catch (error) { reject(error); }
          });
        });
        const session = running.broker.exchangeBootstrap(proof.bootstrapSecret);
        expect(session.leaseId).toBe(proof.leaseId);
        expect(running.broker.assertLiveSession(session.sessionId).source)
          .toBe('ssh-remote-exec');

        const closed = once(helper, 'close');
        helper.stdin.end();
        await closed;
        let revoked = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          try { running.broker.assertLiveSession(session.sessionId); }
          catch { revoked = true; break; }
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        expect(revoked).toBe(true);
      } finally {
        if (helper.exitCode === null) helper.kill();
        await running.close();
      }
    }, 20_000);

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
