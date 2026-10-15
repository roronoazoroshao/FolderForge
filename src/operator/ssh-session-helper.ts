import type { Readable, Writable } from 'node:stream';

/**
 * Host-side remote-exec transport contract. This module never accepts a
 * browser credential or HTTP-derived "SSH user" header as an authority.
 *
 * A production entrypoint must obtain osUid from process.getuid() and the
 * broker from the service-owned local installation.
 */
export interface SshHelperIO {
  readonly osUid: number;
  readonly stdin: Readable;
  readonly stdout: Writable;
}

export interface SshHelperBootstrap {
  readonly bootstrapSecret: string;
  readonly leaseId: string;
  readonly expiresAt: number;
  /** Never exposed through HTTP or browser URI; private SSH helper only. */
  readonly dashboardCredential?: string;
}

export interface SshHelperBroker {
  readonly serviceUid: number;
  openFromHost(uid: number): SshHelperBootstrap;
  revokeLease(leaseId: string): void;
}

export function isSshDashboardHelperCommand(args: readonly string[]): boolean {
  return args.length === 4 &&
    args[0] === 'operator' &&
    args[1] === 'dashboard-session' &&
    args[2] === 'serve' &&
    args[3] === '--stdio';
}

/** Keep the SSH remote exec channel open until the caller closes its stdin. */
export async function runSshDashboardHelper(io: SshHelperIO, broker: SshHelperBroker): Promise<void> {
  if (!Number.isSafeInteger(io.osUid) || io.osUid < 0 ||
      io.osUid !== broker.serviceUid) {
    throw new Error('WRONG_OPERATOR_UID');
  }
  if (io.stdin.destroyed || io.stdin.readableEnded || io.stdout.destroyed) {
    throw new Error('SSH_HELPER_CHANNEL_UNAVAILABLE');
  }

  const bootstrap = broker.openFromHost(io.osUid);
  try {
    const closed = new Promise<void>((resolve) => {
      let complete = false;
      const finish = () => {
        if (complete) return;
        complete = true;
        resolve();
      };
      io.stdin.once('end', finish);
      io.stdin.once('close', finish);
      io.stdin.once('error', finish);
      io.stdout.once('close', finish);
      io.stdout.once('error', finish);
    });

    io.stdout.write(JSON.stringify({
      protocol: 'folderforge-ssh-operator-bootstrap-v1',
      bootstrapSecret: bootstrap.bootstrapSecret,
      leaseId: bootstrap.leaseId,
      expiresAt: bootstrap.expiresAt,
      ...(bootstrap.dashboardCredential ? { dashboardCredential: bootstrap.dashboardCredential } : {}),
    }) + '\n');
    io.stdin.resume();
    await closed;
  } finally {
    // Disconnection must invalidate new host-authorization attempts.
    broker.revokeLease(bootstrap.leaseId);
  }
}
