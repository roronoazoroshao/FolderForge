import {
  chmodSync, existsSync, lstatSync, unlinkSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createConnection, createServer, type Server, type Socket } from 'node:net';
import type { SshHelperBootstrap, SshHelperBroker } from './ssh-session-helper.js';
import type { SshSessionBroker, OperatorProofSource } from './ssh-session-broker.js';

const PROTOCOL = 'folderforge-ssh-operator-bootstrap-v1';

/**
 * Unix socket is protected by a 0700 service-UID directory and a 0600 socket.
 * A plain HTTP request is never a caller. On hosts where actual peer UID cannot
 * be verified using the Node transport, the owner-only socket path is the
 * access boundary; arbitrary code running as that *same* UID is out of scope.
 */
export async function startSshOperatorIpcServer(
  broker: SshSessionBroker,
  socketPath: string,
  proofSource: OperatorProofSource = 'ssh-remote-exec',
): Promise<{ socketPath: string; close(): Promise<void> }> {
  if (process.platform !== 'linux' && process.platform !== 'darwin') {
    throw new Error('SSH_OPERATOR_PLATFORM_UNSUPPORTED');
  }
  if (process.getuid?.() !== broker.serviceUid) throw new Error('WRONG_OPERATOR_UID');
  const path = resolve(socketPath);
  const directory = lstatSync(dirname(path));
  if (!directory.isDirectory() || directory.isSymbolicLink() ||
      directory.uid !== broker.serviceUid || (directory.mode & 0o077) !== 0) {
    throw new Error('UNSAFE_SSH_OPERATOR_IPC_DIRECTORY');
  }
  if (existsSync(path)) throw new Error('SSH_OPERATOR_IPC_ALREADY_BOUND');

  const sockets = new Set<Socket>();
  const server: Server = createServer((socket) => {
    sockets.add(socket);
    let leaseId: string | undefined;
    try {
      const bootstrap = broker.openFromHost(broker.serviceUid, proofSource);
      leaseId = bootstrap.leaseId;
      const wire: SshHelperBootstrap & { protocol: typeof PROTOCOL } = {
        protocol: PROTOCOL, ...bootstrap,
      };
      socket.write(JSON.stringify(wire) + '\n');
    } catch {
      socket.destroy();
    }
    socket.once('close', () => {
      sockets.delete(socket);
      if (leaseId) broker.revokeLease(leaseId);
    });
  });

  try {
    await new Promise<void>((done, fail) => {
      server.once('error', fail);
      server.listen(path, () => {
        server.off('error', fail);
        done();
      });
    });
    chmodSync(path, 0o600);
    const st = lstatSync(path);
    if (!st.isSocket() || st.isSymbolicLink() ||
        st.uid !== broker.serviceUid || (st.mode & 0o077) !== 0) {
      throw new Error('UNSAFE_SSH_OPERATOR_IPC_SOCKET');
    }
  } catch (e) {
    for (const socket of sockets) socket.destroy();
    // If another Dashboard wins the EADDRINUSE race, its Unix socket belongs
    // to that other listener. NEVER remove it from this failed startup.
    // Only a listener that successfully bound this path may clean it up.
    const boundHere = server.listening;
    if (boundHere) {
      server.close();
      if (existsSync(path)) unlinkSync(path);
    }
    throw e;
  }

  let closed = false;
  return {
    socketPath: path,
    close: async () => {
      if (closed) return;
      closed = true;
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((done, fail) => server.close(error => error ? fail(error) : done()));
      if (existsSync(path)) unlinkSync(path);
    },
  };
}

/**
 * Connection runs inside the authenticated SSH remote-exec process. The
 * server has already registered the live lease and sends a one-time proof
 * on this private socket. Closing the socket revokes the associated lease.
 */
export async function openSshOperatorIpcClient(
  socketPath: string,
  expectedUid: number,
  opts: { handshakeTimeoutMs?: number } = {},
): Promise<SshHelperBroker> {
  // The broker must return its bootstrap proof within a bounded interval.
  // Never let a stalled host-owned IPC service hang the SSH launcher indefinitely.
  const handshakeTimeoutMs = opts.handshakeTimeoutMs ?? 5_000;
  if (!Number.isSafeInteger(handshakeTimeoutMs) ||
      handshakeTimeoutMs < 1 || handshakeTimeoutMs > 10_000) {
    throw new Error('INVALID_SSH_OPERATOR_IPC_TIMEOUT');
  }
  if (typeof process.getuid !== 'function' || process.getuid() !== expectedUid) {
    throw new Error('WRONG_OPERATOR_UID');
  }
  const path = resolve(socketPath);
  const parent = lstatSync(dirname(path));
  const node = lstatSync(path);
  if (!parent.isDirectory() || parent.isSymbolicLink() ||
      parent.uid !== expectedUid || (parent.mode & 0o077) !== 0 ||
      !node.isSocket() || node.isSymbolicLink() ||
      node.uid !== expectedUid || (node.mode & 0o077) !== 0) {
    throw new Error('UNSAFE_SSH_OPERATOR_IPC_SOCKET');
  }

  const socket = createConnection(path);
  const bootstrap = await new Promise<SshHelperBootstrap>((resolveReady, rejectReady) => {
    let bytes = '';
    let resolved = false;
    const fail = (error: Error) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      rejectReady(error);
    };
    socket.once('error', fail);
    socket.once('close', () => fail(new Error('SSH_OPERATOR_IPC_CLOSED')));
    socket.setTimeout(handshakeTimeoutMs, () => fail(new Error('SSH_OPERATOR_IPC_TIMEOUT')));
    socket.on('data', chunk => {
      if (resolved) return;
      bytes += chunk.toString('utf8');
      if (bytes.length > 2048) {
        fail(new Error('SSH_OPERATOR_IPC_TOO_LARGE'));
        return;
      }
      const newline = bytes.indexOf('\n');
      if (newline === -1) return;
      try {
        const record = JSON.parse(bytes.slice(0, newline)) as Record<string, unknown>;
        if (record.protocol !== PROTOCOL ||
            typeof record.bootstrapSecret !== 'string' ||
            typeof record.leaseId !== 'string' ||
            typeof record.expiresAt !== 'number') {
          throw new Error('SSH_OPERATOR_IPC_INVALID_PROOF');
        }
        resolved = true;
        // The live socket carries the revocation lease: do not time out the
        // channel after the initial handshake has succeeded.
        socket.setTimeout(0);
        resolveReady({
          bootstrapSecret: record.bootstrapSecret,
          leaseId: record.leaseId,
          expiresAt: record.expiresAt,
        });
      } catch (e) {
        fail(e instanceof Error ? e : new Error('SSH_OPERATOR_IPC_INVALID_PROOF'));
      }
    });
  });

  let delivered = false;
  return {
    serviceUid: expectedUid,
    openFromHost: (uid: number) => {
      if (uid !== expectedUid) throw new Error('WRONG_OPERATOR_UID');
      if (delivered || socket.destroyed) throw new Error('SSH_OPERATOR_BOOTSTRAP_ALREADY_USED');
      delivered = true;
      return bootstrap;
    },
    revokeLease: (leaseId: string) => {
      if (leaseId !== bootstrap.leaseId) throw new Error('SSH_OPERATOR_LEASE_MISMATCH');
      socket.end();
      socket.destroy();
    },
  };
}
