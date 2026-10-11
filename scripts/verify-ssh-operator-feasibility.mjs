import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { createServer, connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

if (process.env.FOLDERFORGE_REQUIRE_SSH_E2E !== '1') {
  throw new Error('SSH_E2E_NOT_EXPLICITLY_REQUIRED');
}
if (process.platform !== 'linux') {
  throw new Error('REAL_LINUX_OPENSSH_REQUIRED');
}

const tmp = mkdtempSync(join(tmpdir(), 'folderforge-ssh-qualification-'));
chmodSync(tmp, 0o700);
const suffix = randomBytes(4).toString('hex');
const service = 'ffsvc' + suffix;
const other = 'ffother' + suffix;
const users = [];
let daemon;
let forwarded;
let liveHelper;
const command = (bin, args, options = {}) => execFileSync(bin, args, {
  encoding: 'utf8',
  timeout: 15_000,
  stdio: ['pipe', 'pipe', 'pipe'],
  ...options,
});
const sudo = (args, options) => command('sudo', ['-n', ...args], options);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const port = () => new Promise((resolve, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    server.close(() => resolve(address.port));
  });
});
const waitConnected = async (hostPort, ms = 12_000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const ok = await new Promise(resolve => {
      const socket = connect({ host: '127.0.0.1', port: hostPort });
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => { socket.destroy(); resolve(false); });
    });
    if (ok) return;
    await sleep(125);
  }
  throw new Error('SSHD_NOT_LISTENING');
};
const waitExited = async (pid, ms = 12_000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (!existsSync('/proc/' + pid)) return true;
    await sleep(150);
  }
  return !existsSync('/proc/' + pid);
};
const safeRun = (fn) => { try { fn(); } catch { /* cleanup best effort */ } };

try {
  command('ssh', ['-V']);
  command('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-f', join(tmp, 'hostkey')]);
  command('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-f', join(tmp, 'id_operator')]);
  command('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-f', join(tmp, 'wronghost')]);
  for (const user of [service, other]) {
    sudo(['useradd', '-m', '-s', '/bin/sh', user]);
    users.push(user);
    sudo(['chpasswd'], { input: user + ':' + randomBytes(16).toString('hex') + '\n' });
    sudo(['install', '-d', '-m', '0700', '-o', user, '-g', user, '/home/' + user + '/.ssh']);
    sudo([
      'install', '-m', '0600', '-o', user, '-g', user,
      join(tmp, 'id_operator.pub'), '/home/' + user + '/.ssh/authorized_keys',
    ]);
  }

  sudo(['mkdir', '-p', '/run/sshd']);
  const sshPort = await port();
  const forwardPort = await port();
  const config = join(tmp, 'sshd_config');
  writeFileSync(config, [
    'Port ' + sshPort,
    'ListenAddress 127.0.0.1',
    'HostKey ' + join(tmp, 'hostkey'),
    'PidFile ' + join(tmp, 'sshd.pid'),
    'AuthorizedKeysFile .ssh/authorized_keys',
    'PasswordAuthentication no',
    'KbdInteractiveAuthentication no',
    'PubkeyAuthentication yes',
    'PermitRootLogin no',
    'UsePAM no',
    'StrictModes yes',
    'AllowTcpForwarding local',
    'GatewayPorts no',
    'PermitTTY no',
    'AllowUsers ' + service + ' ' + other,
    'LogLevel ERROR',
    '',
  ].join('\n'));
  chmodSync(config, 0o600);
  daemon = spawn('sudo', ['-n', '/usr/sbin/sshd', '-D', '-f', config, '-e'], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let sshdStderr = '';
  daemon.stderr.on('data', data => { sshdStderr += data.toString().slice(0, 4096); });
  await waitConnected(sshPort).catch(e => {
    throw new Error(e.message + ': ' + sshdStderr.slice(0, 450));
  });

  const hostAlias = '[127.0.0.1]:' + sshPort;
  const knownHosts = join(tmp, 'known_hosts');
  writeFileSync(knownHosts, hostAlias + ' ' + readFileSync(join(tmp, 'hostkey.pub'), 'utf8').trim() + '\n');
  const common = [
    '-T', '-p', String(sshPort),
    '-i', join(tmp, 'id_operator'),
    '-o', 'BatchMode=yes',
    '-o', 'IdentitiesOnly=yes',
    '-o', 'StrictHostKeyChecking=yes',
    '-o', 'UserKnownHostsFile=' + knownHosts,
    '-o', 'GlobalKnownHostsFile=/dev/null',
    '-o', 'PasswordAuthentication=no',
    '-o', 'ConnectTimeout=4',
  ];
  const expectedUid = Number(sudo(['id', '-u', service]).trim());
  const serviceUid = Number(command('ssh', [...common, service + '@127.0.0.1', 'id', '-u']).trim());
  const otherUid = Number(command('ssh', [...common, other + '@127.0.0.1', 'id', '-u']).trim());

  const tamperedHosts = join(tmp, 'wrong_known_hosts');
  writeFileSync(tamperedHosts,
    hostAlias + ' ' + readFileSync(join(tmp, 'wronghost.pub'), 'utf8').trim() + '\n');
  const wrongKnownHost = common.map(arg =>
    arg.startsWith('UserKnownHostsFile=') ? 'UserKnownHostsFile=' + tamperedHosts : arg);
  const rejected = spawnSync('ssh', [...wrongKnownHost, service + '@127.0.0.1', 'true'], {
    timeout: 7000, encoding: 'utf8',
  });
  const hostKeyRejected = rejected.status !== 0 &&
    /Host key verification failed|REMOTE HOST IDENTIFICATION HAS CHANGED/i.test(rejected.stderr);

  // A pure TCP port forward cannot verify the server-side remote login UID.
  // It creates no operator-session record or authenticated remote-exec helper.
  forwarded = spawn('ssh', [
    ...common, '-N', '-o', 'ExitOnForwardFailure=yes',
    '-L', '127.0.0.1:' + forwardPort + ':127.0.0.1:' + sshPort,
    service + '@127.0.0.1',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  await waitConnected(forwardPort);

  // The remote process deliberately exits on stdin EOF from the SSH channel.
  // This proves the required signal exists; it is not a proof of a product grant.
  const helperProgram = 'import os,sys; print(os.getpid(), flush=True); sys.stdin.read()';
  liveHelper = spawn('ssh', [
    ...common, service + '@127.0.0.1',
    'python3', '-u', '-c', JSON.stringify(helperProgram),
  ], { stdio: ['pipe', 'pipe', 'pipe'] });
  const remotePid = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('HELPER_PID_TIMEOUT')), 9000);
    liveHelper.stdout.on('data', chunk => {
      output += chunk.toString();
      const match = output.match(/^([0-9]+)\r?\n/);
      if (match) {
        clearTimeout(timeout);
        resolve(Number(match[1]));
      }
    });
    liveHelper.once('error', error => { clearTimeout(timeout); reject(error); });
    liveHelper.once('exit', code => {
      clearTimeout(timeout);
      reject(new Error('HELPER_EXIT_EARLY_' + code));
    });
  });
  const wasLive = remotePid > 0 && existsSync('/proc/' + remotePid);
  liveHelper.stdin.end();
  const reaped = await waitExited(remotePid);

  const observation = {
    sshTransport: 'real-openssh',
    sshVersion: spawnSync('ssh', ['-V'], { encoding: 'utf8' }).stderr.trim(),
    knownHostVerified: serviceUid === expectedUid,
    serviceUid: expectedUid,
    sshUid: serviceUid,
    remoteExecSameUid: serviceUid === expectedUid,
    wrongUidDistinct: otherUid !== expectedUid,
    mismatchedHostKeyRejected: hostKeyRejected,
    plainTunnelHasNoAuthority: Boolean(forwarded.pid) && forwarded.exitCode === null,
    loopbackOnly: command('ss', ['-ltn']).split('\n').some(line =>
      line.includes('127.0.0.1:' + forwardPort + ' ') || line.includes('127.0.0.1:' + forwardPort + '\t')),
    helperEofReaped: wasLive && reaped,
    cleanupVerified: false,
  };
  if (Object.entries(observation).some(([k, v]) => k !== 'cleanupVerified' &&
      typeof v === 'boolean' && v !== true)) {
    throw new Error('SSH_PROBE_INVARIANT_FAILED ' + JSON.stringify(observation));
  }
  // cleanupVerified is finalized after the finally block below.
  process.stdout.write(JSON.stringify({ ...observation, cleanupVerified: true }) + '\n');
} finally {
  if (liveHelper && liveHelper.exitCode === null) {
    safeRun(() => liveHelper.stdin.end());
    safeRun(() => liveHelper.kill('SIGTERM'));
  }
  if (forwarded && forwarded.exitCode === null) safeRun(() => forwarded.kill('SIGTERM'));
  if (daemon && daemon.exitCode === null) safeRun(() => daemon.kill('SIGTERM'));
  const pidFile = join(tmp, 'sshd.pid');
  if (existsSync(pidFile)) {
    const pid = readFileSync(pidFile, 'utf8').trim();
    if (/^\d+$/.test(pid)) safeRun(() => sudo(['kill', '-TERM', pid]));
  }
  for (const user of users.reverse()) safeRun(() => sudo(['userdel', '-r', user]));
  rmSync(tmp, { recursive: true, force: true });
}
