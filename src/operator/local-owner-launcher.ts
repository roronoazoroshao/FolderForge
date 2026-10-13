import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';
import { createSshLocalBridge } from './ssh-local-bridge.js';
import { createSshBrowserInvitation } from './ssh-dashboard-launcher.js';
import { openSshOperatorIpcClient } from './ssh-operator-ipc.js';
import { localOwnerIpcSocketPath } from './ssh-session-runtime.js';
import { defaultHostConsentRoot } from './trusted-host-cli.js';
import { loadControlAuth } from '../control/auth-store.js';

/**
 * Launched AUTOMATICALLY by the on-host Mission Control open/start action.
 * This is not a new user-facing approval command. The protected local-owner
 * Unix socket, not HTTP localhost or a browser header, establishes OS identity.
 *
 * A detached desktop helper keeps a revocable lease for up to eight hours;
 * the Dashboard also enforces per-browser-session idle/absolute expiry.
 * Same-UID malicious processes and compromised browsers are out of scope.
 */
export async function openLocalOwnerBrowser(args: readonly string[]): Promise<void> {
  if (process.platform !== 'linux' && process.platform !== 'darwin') {
    throw new Error('LOCAL_OWNER_PLATFORM_UNSUPPORTED');
  }
  if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    throw new Error('LOCAL_OWNER_DESKTOP_UNAVAILABLE');
  }
  if (args.length !== 4 || args[0] !== '--port' || args[2] !== '--project') {
    throw new Error('LOCAL_OWNER_LAUNCHER_USAGE');
  }
  const port = Number(args[1]);
  const project = args[3];
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535 ||
      !project || !isAbsolute(project)) throw new Error('LOCAL_OWNER_LAUNCHER_INVALID_TARGET');

  const uid = process.getuid?.();
  if (!Number.isSafeInteger(uid) || uid === undefined || uid < 0) {
    throw new Error('LOCAL_OWNER_UID_UNAVAILABLE');
  }
  const ipc = await openSshOperatorIpcClient(
    localOwnerIpcSocketPath(defaultHostConsentRoot()), uid,
  );
  const bootstrap = ipc.openFromHost(uid);
  const credential = loadControlAuth(resolve(project))?.credential;
  const landingPath = credential
    ? '/app/?token=' + encodeURIComponent(credential)
    : '/app/';
  let secret: string | null = bootstrap.bootstrapSecret;
  let bridge: Awaited<ReturnType<typeof createSshLocalBridge>> | undefined;
  let invitation: ReturnType<typeof createSshBrowserInvitation> | undefined;
  try {
    // Browser-pairing proof lives only in a 0600 file, not in argv or URL.
    const token = randomBytes(32).toString('base64url');
    bridge = await createSshLocalBridge({
      forwardPort: port, invitationToken: token, landingPath,
      takeBootstrap: () => {
        const value = secret;
        secret = null;
        return value;
      },
    });
    invitation = createSshBrowserInvitation(bridge.origin, token);
    const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
    await new Promise<void>((done, fail) => {
      const child = spawn(command, [invitation!.url], {
        stdio: 'ignore', shell: false, windowsHide: true,
      });
      child.once('error', fail);
      child.once('close', code => code === 0
        ? done()
        : fail(new Error('LOCAL_OWNER_BROWSER_UNAVAILABLE')));
    });
    await new Promise<void>(done => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        process.off('SIGINT', finish);
        process.off('SIGTERM', finish);
        done();
      };
      const timer = setTimeout(finish, 8 * 60 * 60 * 1000);
      process.once('SIGINT', finish);
      process.once('SIGTERM', finish);
      // Closing/stopping the Control Panel must also terminate its detached
      // browser bridge promptly, not leave a useless eight-hour proxy.
      void ipc.disconnected.then(finish);
    });
  } finally {
    invitation?.cleanup();
    await bridge?.close();
    ipc.revokeLease(bootstrap.leaseId);
  }
}
