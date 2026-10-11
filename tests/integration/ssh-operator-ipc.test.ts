import { afterEach, describe, expect, it } from 'vitest';
import { lstatSync, mkdtempSync, rmSync } from 'node:fs';
import { PassThrough } from 'node:stream';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SshSessionBroker } from '../../src/operator/ssh-session-broker.js';
import {
  openSshOperatorIpcClient,
  startSshOperatorIpcServer,
} from '../../src/operator/ssh-operator-ipc.js';
import { runSshDashboardHelper } from '../../src/operator/ssh-session-helper.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function harness() {
  const root = mkdtempSync(join(tmpdir(), 'ff-ssh-ipc-'));
  roots.push(root);
  const uid = process.getuid?.() ?? 0;
  const broker = new SshSessionBroker({
    serviceUid: uid, installationId: 'ipc-instance-test',
    operatorRoot: join(root, 'protected'), projectRoots: [join(root, 'workspace')],
    now: Date.now,
  });
  return { root, uid, broker, socketPath: join(root, 'protected', 'operator.sock') };
}
async function until(condition: () => boolean, timeout = 3000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (!condition() && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 20));
  }
  expect(condition()).toBe(true);
}

describe('real Unix-socket SSH host broker transport', () => {
  it('registers a live lease in the SERVER broker, never in the remote helper process', async () => {
    const h = harness();
    const server = await startSshOperatorIpcServer(h.broker, h.socketPath);
    try {
      const client = await openSshOperatorIpcClient(h.socketPath, h.uid);
      const bootstrap = await client.openFromHost(h.uid);
      expect(bootstrap.bootstrapSecret).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const session = h.broker.exchangeBootstrap(bootstrap.bootstrapSecret);
      expect(h.broker.assertLiveSession(session.sessionId).source).toBe('ssh-remote-exec');
      client.revokeLease(bootstrap.leaseId);
      await until(() => {
        try { h.broker.assertLiveSession(session.sessionId); return false; }
        catch { return true; }
      });
    } finally { await server.close(); }
  });

  it('protects the socket and denies wrong UID asserted by client', async () => {
    const h = harness();
    const server = await startSshOperatorIpcServer(h.broker, h.socketPath);
    try {
      const st = lstatSync(h.socketPath);
      expect(st.isSocket()).toBe(true);
      expect(st.uid).toBe(h.uid);
      expect(st.mode & 0o077).toBe(0);
      await expect(openSshOperatorIpcClient(h.socketPath, h.uid + 1))
        .rejects.toThrow('WRONG_OPERATOR_UID');
    } finally { await server.close(); }
  });

  it('allows the existing helper protocol to keep and close the server-owned lease', async () => {
    const h = harness();
    const server = await startSshOperatorIpcServer(h.broker, h.socketPath);
    try {
      const brokerClient = await openSshOperatorIpcClient(h.socketPath, h.uid);
      const input = new PassThrough();
      const output = new PassThrough();
      let stdout = '';
      output.on('data', chunk => { stdout += chunk.toString(); });
      const running = runSshDashboardHelper({ osUid: h.uid, stdin: input, stdout: output }, brokerClient);
      await until(() => stdout.includes('bootstrapSecret'));
      const payload = JSON.parse(stdout.trim()) as { bootstrapSecret: string; leaseId: string };
      const session = h.broker.exchangeBootstrap(payload.bootstrapSecret);
      expect(h.broker.assertLiveSession(session.sessionId).serviceUid).toBe(h.uid);
      input.end();
      await running;
      await until(() => {
        try { h.broker.assertLiveSession(session.sessionId); return false; }
        catch { return true; }
      });
    } finally { await server.close(); }
  });

  it('removes its protected socket on shutdown and refuses an occupied socket path', async () => {
    const h = harness();
    const server = await startSshOperatorIpcServer(h.broker, h.socketPath);
    await expect(startSshOperatorIpcServer(h.broker, h.socketPath)).rejects.toThrow();
    await server.close();
    expect(() => lstatSync(h.socketPath)).toThrow();
  });
});
