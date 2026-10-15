'use strict';

// Pure helpers: never accept a target from a web page / vscode:// link.
// The SSH host must come from the *active* VS Code Remote-SSH workspace.
const EXTENSION_ID = 'musashishao.folderforge-remote-ssh';
const SSH_ALIAS = /^[A-Za-z0-9_.-]+$/;

function parseRemoteSshAuthority(authority) {
  if (typeof authority !== 'string' || !authority.startsWith('ssh-remote+')) {
    throw new Error('VSCODE_REMOTE_SSH_REQUIRED');
  }
  const alias = authority.slice('ssh-remote+'.length);
  if (!SSH_ALIAS.test(alias) || alias.startsWith('-') || alias === '.' || alias === '..') {
    throw new Error('VSCODE_SSH_ALIAS_UNSAFE');
  }
  return alias;
}

function resolveRemoteAlias(uris, active) {
  const remotes = (uris || []).filter(x => x && x.scheme === 'vscode-remote');
  if (!remotes.length) throw new Error('VSCODE_REMOTE_SSH_REQUIRED');
  const aliases = [...new Set(remotes.map(x => parseRemoteSshAuthority(x.authority)))];
  if (aliases.length === 1) return aliases[0];
  if (active && active.scheme === 'vscode-remote') {
    const alias = parseRemoteSshAuthority(active.authority);
    if (aliases.includes(alias)) return alias;
  }
  throw new Error('AMBIGUOUS_VSCODE_SSH_HOST');
}

function parseTrustedUri(uri, expectedScheme = 'vscode') {
  return !!uri && uri.scheme === expectedScheme && uri.authority === EXTENSION_ID &&
    uri.path === '/verify' && !uri.query && !uri.fragment;
}

// Workspace settings can be changed by a remote repository. For a UI-host
// extension that spawns a LOCAL binary, only the local User setting is trusted.
function globalSetting(inspected, fallback) {
  return inspected && inspected.globalValue !== undefined
    ? inspected.globalValue
    : inspected && inspected.defaultValue !== undefined
      ? inspected.defaultValue
      : fallback;
}

function buildVerifiedLauncher(host, port, executable = 'folderforge') {
  if (typeof host !== 'string' || !SSH_ALIAS.test(host) || host.startsWith('-')) {
    throw new Error('VSCODE_SSH_ALIAS_UNSAFE');
  }
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('VSCODE_DASHBOARD_PORT_INVALID');
  }
  if (typeof executable !== 'string' || !executable.trim()) {
    throw new Error('VSCODE_LOCAL_FOLDERFORGE_MISSING');
  }
  return {
    executable,
    argv: ['dashboard', 'ssh', '--host', host, '--dashboard-port', String(port)],
  };
}

module.exports = {
  EXTENSION_ID, parseRemoteSshAuthority, resolveRemoteAlias,
  parseTrustedUri, buildVerifiedLauncher, globalSetting,
};
