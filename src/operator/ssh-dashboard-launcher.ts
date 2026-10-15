import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createSshLocalBridge } from './ssh-local-bridge.js';

const HOST_RE = /^(?:[A-Za-z0-9_.-]+@)?[A-Za-z0-9_.-]+$/;
const HELPER_PROTOCOL = 'folderforge-ssh-operator-bootstrap-v1';

export function parseSshDashboardArgs(args: readonly string[]): {
  host: string;
  dashboardPort: number;
} {
  let host: string | undefined;
  let dashboardPort = 7332;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--host' && !host) {
      host = args[++index];
      if (!host || !HOST_RE.test(host) || host.startsWith('-')) {
        throw new Error('SSH_DASHBOARD_INVALID_HOST');
      }
    } else if (arg === '--dashboard-port') {
      const raw = args[++index];
      dashboardPort = Number(raw);
      if (!raw || !/^\d{1,5}$/.test(raw) ||
          !Number.isSafeInteger(dashboardPort) || dashboardPort < 1 ||
          dashboardPort > 65535) throw new Error('SSH_DASHBOARD_INVALID_PORT');
    } else {
      throw new Error('SSH_DASHBOARD_UNSUPPORTED_OPTION');
    }
  }
  if (!host) throw new Error('SSH_DASHBOARD_HOST_REQUIRED');
  return { host, dashboardPort };
}

export function buildSshDashboardArgv(
  host: string,
  localPort: number,
  dashboardPort: number,
): string[] {
  if (!HOST_RE.test(host) || host.startsWith('-') ||
      ![localPort, dashboardPort].every(
        p => Number.isSafeInteger(p) && p > 0 && p <= 65535,
      )) {
    throw new Error('SSH_DASHBOARD_INVALID_TARGET');
  }
  return [
    '-T',
    '-o', 'StrictHostKeyChecking=yes',
    '-o', 'ForwardAgent=no',
    '-o', 'ExitOnForwardFailure=yes',
    '-L', '127.0.0.1:' + localPort + ':127.0.0.1:' + dashboardPort,
    host,
    'folderforge', 'operator', 'dashboard-session', 'serve', '--stdio',
  ];
}

export function createSshBrowserInvitation(origin: string, token: string): {
  path: string;
  url: string;
  cleanup(): void;
} {
  if (process.platform !== 'linux' && process.platform !== 'darwin') {
    throw new Error('SSH_BROWSER_INVITATION_PLATFORM_UNSUPPORTED');
  }
  if (!/^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(origin) ||
      !/^[A-Za-z0-9_-]{43,128}$/.test(token)) {
    throw new Error('SSH_BROWSER_INVITATION_INVALID');
  }
  const directory = mkdtempSync(join(tmpdir(), 'folderforge-ssh-invite-'));
  const path = join(directory, 'open.html');
  const document = [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="referrer" content="no-referrer"><title>Open FolderForge</title></head>',
    '<body><p>Opening your verified FolderForge session…</p>',
    '<form id="launch" method="POST" action="' + origin + '/__folderforge/activate">',
    '<input type="hidden" name="pair" value="' + token + '">',
    '<button type="submit">Open FolderForge</button></form>',
    '<script>document.getElementById("launch").submit();</script>',
    '</body></html>',
  ].join('');
  try {
    writeFileSync(path, document, { mode: 0o600, flag: 'wx' });
  } catch (err) {
    rmSync(directory, { recursive: true, force: true });
    throw err;
  }
  return {
    path,
    url: pathToFileURL(path).href,
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}

async function freeLoopbackPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('SSH_DASHBOARD_NO_LOCAL_PORT');
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function readSshBootstrap(child: ChildProcess): Promise<{
  secret: string; dashboardCredential?: string;
}> {
  if (!child.stdout) throw new Error('SSH_DASHBOARD_NO_STDOUT');
  return new Promise((resolve, reject) => {
    let data = '';
    let done = false;
    const cleanup = () => {
      clearTimeout(timer);
      child.stdout?.off('data', onData);
      child.off('close', onExit);
      child.off('error', onError);
    };
    const complete = (error?: Error, payload?: {
      secret: string; dashboardCredential?: string;
    }) => {
      if (done) return;
      done = true;
      cleanup();
      if (error) reject(error);
      else resolve(payload!);
    };
    const onExit = () => complete(new Error('SSH_DASHBOARD_HELPER_DISCONNECTED'));
    const onError = (error: Error) => complete(error);
    const onData = (chunk: Buffer) => {
      data += chunk.toString('utf8');
      if (Buffer.byteLength(data) > 2048) {
        complete(new Error('SSH_DASHBOARD_HELPER_OVERSIZED'));
        return;
      }
      const eol = data.indexOf('\n');
      if (eol === -1) return;
      try {
        const proof = JSON.parse(data.slice(0, eol)) as Record<string, unknown>;
        if (proof.protocol !== HELPER_PROTOCOL ||
            typeof proof.bootstrapSecret !== 'string' ||
            !/^[A-Za-z0-9_-]{43,128}$/.test(proof.bootstrapSecret)) {
          throw new Error('SSH_DASHBOARD_HELPER_INVALID');
        }
        if (proof.dashboardCredential !== undefined &&
            (typeof proof.dashboardCredential !== 'string' ||
              proof.dashboardCredential.length > 512 ||
              /[\x00-\x1f\x7f]/.test(proof.dashboardCredential))) {
          throw new Error('SSH_DASHBOARD_HELPER_INVALID');
        }
        complete(undefined, {
          secret: proof.bootstrapSecret,
          ...(typeof proof.dashboardCredential === 'string'
            ? { dashboardCredential: proof.dashboardCredential } : {}),
        });
      } catch { complete(new Error('SSH_DASHBOARD_HELPER_INVALID')); }
    };
    const timer = setTimeout(
      () => complete(new Error('SSH_DASHBOARD_HELPER_TIMEOUT')), 30_000,
    );
    child.stdout!.on('data', onData);
    child.once('close', onExit);
    child.once('error', onError);
  });
}

async function openDefaultBrowser(url: string): Promise<void> {
  const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, [url], {
      stdio: 'ignore', windowsHide: true, shell: false,
    });
    child.once('error', reject);
    child.once('close', code => code === 0
      ? resolve()
      : reject(new Error('SSH_DASHBOARD_BROWSER_UNAVAILABLE')));
  });
}

/**
 * One interactive SSH login, then a desktop-created browser invitation.
 * No remote bootstrap secret or browser-pairing token is placed in argv/URL.
 * The SSH channel remains live until user closes this process or disconnects.
 */
export async function executeSshDashboardCli(args: readonly string[]): Promise<void> {
  if (process.platform !== 'linux' && process.platform !== 'darwin') {
    throw new Error('SSH_DASHBOARD_PLATFORM_UNSUPPORTED');
  }
  const { host, dashboardPort } = parseSshDashboardArgs(args);
  const forwardPort = await freeLoopbackPort();
  const child = spawn('ssh', buildSshDashboardArgv(host, forwardPort, dashboardPort), {
    stdio: ['pipe', 'pipe', 'inherit'],
    windowsHide: true, shell: false,
  });
  let invitation: ReturnType<typeof createSshBrowserInvitation> | undefined;
  let bridge: Awaited<ReturnType<typeof createSshLocalBridge>> | undefined;
  try {
    const ownerProof = await readSshBootstrap(child);
    let secret: string | null = ownerProof.secret;
    const token = randomBytes(32).toString('base64url');
    bridge = await createSshLocalBridge({
      forwardPort,
      invitationToken: token,
      ...(ownerProof.dashboardCredential
        ? { upstreamCredential: ownerProof.dashboardCredential } : {}),
      // An owner entering via VS Code must land in the actual SPA, not the
      // root legacy dashboard. The one-time browser pairing remains unchanged.
      landingPath: '/app/',
      takeBootstrap: () => {
        const value = secret;
        secret = null;
        return value;
      },
    });
    invitation = createSshBrowserInvitation(bridge.origin, token);
    await openDefaultBrowser(invitation.url);
    await new Promise<void>((resolve, reject) => {
      if (child.exitCode !== null) { resolve(); return; }
      child.once('error', reject);
      child.once('close', () => resolve());
    });
  } finally {
    invitation?.cleanup();
    if (bridge) await bridge.close();
    child.stdin?.end();
    if (child.exitCode === null) child.kill('SIGTERM');
  }
}
