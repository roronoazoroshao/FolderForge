import { constants, closeSync, existsSync, fsyncSync, fstatSync, lstatSync, mkdirSync, openSync, unlinkSync, writeSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { operatorStateOutsideProjects } from './trusted-host-scope.js';

/** Host-only hash receipts. Raw SSH bootstrap secrets are never persisted. */
export class SshSessionStore {
  readonly root: string;
  private readonly uid: number;

  constructor(opts: { root: string; uid: number; projectRoots: string[] }) {
    if (!Number.isSafeInteger(opts.uid) || opts.uid < 0) throw new Error('INVALID_OPERATOR_UID');
    this.root = resolve(opts.root);
    this.uid = opts.uid;
    if (!operatorStateOutsideProjects(this.root, opts.projectRoots)) {
      throw new Error('UNSAFE_SSH_SESSION_ROOT');
    }
    if (!existsSync(this.root)) mkdirSync(this.root, { recursive: true, mode: 0o700 });
    const st = lstatSync(this.root);
    if (!st.isDirectory() || st.isSymbolicLink() || st.uid !== opts.uid ||
        (st.mode & 0o077) !== 0) {
      throw new Error('UNSAFE_SSH_SESSION_ROOT');
    }
  }

  private pathFor(leaseId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leaseId)) {
      throw new Error('INVALID_SSH_LEASE');
    }
    return join(this.root, 'bootstrap-' + leaseId + '.json');
  }

  record(leaseId: string, secretDigest: string, expiresAt: number): void {
    if (!/^[a-f0-9]{64}$/.test(secretDigest) || !Number.isSafeInteger(expiresAt)) {
      throw new Error('INVALID_SSH_BOOTSTRAP');
    }
    const fd = openSync(
      this.pathFor(leaseId),
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    try {
      const st = fstatSync(fd);
      if (!st.isFile() || st.uid !== this.uid || st.nlink !== 1 ||
          (st.mode & 0o077) !== 0) {
        throw new Error('INVALID_SSH_BOOTSTRAP_FILE');
      }
      writeSync(fd, JSON.stringify({ digest: secretDigest, expiresAt }));
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  }

  remove(leaseId: string): void {
    const path = this.pathFor(leaseId);
    if (existsSync(path)) unlinkSync(path);
  }
}
