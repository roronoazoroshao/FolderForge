import { lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SshSessionBroker } from './ssh-session-broker.js';
import { startSshOperatorIpcServer } from './ssh-operator-ipc.js';
import { operatorStateOutsideProjects } from './trusted-host-scope.js';

/** Host-owned socket location. It must never live inside an agent workspace. */
export function sshOperatorIpcSocketPath(operatorRoot: string): string {
  return join(resolve(operatorRoot), 'ssh-operator.sock');
}

export interface SshOperatorRuntime {
  readonly broker: SshSessionBroker;
  readonly socketPath: string;
  close(): Promise<void>;
}

/**
 * The Dashboard owns the broker and the IPC listener. Remote SSH-exec helpers
 * must connect to this listener; a helper-created broker cannot grant itself
 * browser authority. The directory is checked BEFORE creating any state.
 */
export async function startSshOperatorRuntime(opts: {
  operatorRoot: string;
  serviceUid: number;
  installationId: string;
  projectRoots: string[];
  now: () => number;
}): Promise<SshOperatorRuntime> {
  if (process.platform !== 'linux' && process.platform !== 'darwin') {
    throw new Error('SSH_OPERATOR_PLATFORM_UNSUPPORTED');
  }
  if (typeof process.getuid !== 'function' ||
      process.getuid() !== opts.serviceUid) {
    throw new Error('WRONG_OPERATOR_UID');
  }
  const root = resolve(opts.operatorRoot);
  const stat = lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink() ||
      stat.uid !== opts.serviceUid || (stat.mode & 0o077) !== 0 ||
      !operatorStateOutsideProjects(root, opts.projectRoots)) {
    throw new Error('UNSAFE_SSH_OPERATOR_RUNTIME_ROOT');
  }

  const broker = new SshSessionBroker({
    serviceUid: opts.serviceUid,
    installationId: opts.installationId,
    operatorRoot: join(root, 'ssh-sessions'),
    projectRoots: opts.projectRoots,
    now: opts.now,
  });
  const ipc = await startSshOperatorIpcServer(
    broker, sshOperatorIpcSocketPath(root),
  );
  return {
    broker,
    socketPath: ipc.socketPath,
    close: ipc.close,
  };
}
