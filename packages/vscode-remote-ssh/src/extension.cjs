'use strict';
const vscode = require('vscode');
const { spawn } = require('node:child_process');
const { resolveRemoteAlias, parseTrustedUri, buildVerifiedLauncher, globalSetting } = require('./core.cjs');

const sessions = new Map();
const pendingHosts = new Set();
let output;

// Wait for the previous helper to exit BEFORE opening another owner session.
// Failure to stop does not silently create concurrent privileged SSH leases.
async function retireSession(host, child) {
  if (child.exitCode == null && child.signalCode == null) {
    await new Promise((resolve, reject) => {
      let finished = false;
      const cleanup = () => {
        clearTimeout(timer);
        child.off('close', onClose);
        child.off('error', onError);
      };
      const settle = error => {
        if (finished) return;
        finished = true;
        cleanup();
        if (error) reject(error);
        else resolve();
      };
      const onClose = () => settle();
      const onError = () => settle(new Error('VSCODE_SSH_PREVIOUS_SESSION_STOP_FAILED'));
      const timer = setTimeout(() => settle(
        new Error('VSCODE_SSH_PREVIOUS_SESSION_STOP_TIMEOUT')), 5000);
      child.once('close', onClose);
      child.once('error', onError);
      try {
        if (!child.kill('SIGTERM')) onError();
      } catch {
        onError();
      }
    });
  }
  if (sessions.get(host) === child) sessions.delete(host);
}

/**
 * This runs ONLY in VS Code's local UI extension host. It intentionally
 * starts FolderForge's existing verified SSH helper instead of promoting
 * arbitrary VS Code-forwarded HTTP traffic to an OS-owner session.
 *
 * A vscode:// URI contains NO user-controlled SSH host or shell command.
 * A separate human confirmation is required even for valid deep links.
 */
async function verify() {
  if (vscode.env.uiKind !== vscode.UIKind.Desktop ||
      vscode.env.remoteName !== 'ssh-remote' ||
      !['linux', 'darwin'].includes(process.platform)) {
    await vscode.window.showErrorMessage(
      'Open a VS Code Desktop Remote-SSH workspace on macOS/Linux to verify FolderForge.');
    return;
  }
  let host;
  let launch;
  try {
    const uris = (vscode.workspace.workspaceFolders || []).map(folder => folder.uri);
    const activeUri = vscode.window.activeTextEditor?.document.uri;
    host = resolveRemoteAlias(uris, activeUri);
    const config = vscode.workspace.getConfiguration('folderforgeRemoteSsh');
    const port = globalSetting(config.inspect('dashboardPort'), 7332);
    const executable = globalSetting(config.inspect('executablePath'), 'folderforge');
    launch = buildVerifiedLauncher(host, port, executable);
  } catch (error) {
    await vscode.window.showErrorMessage('Unable to resolve a single trusted SSH workspace: ' + error.message);
    return;
  }
  // A still-running SSH helper does not prove its web session is still live.
  // Broker idle/absolute TTL, logout or a Dashboard restart may already
  // invalidate the cookie. The user must be able to deliberately re-verify.
  if (pendingHosts.has(host)) {
    await vscode.window.showInformationMessage(
      'FolderForge verification is already in progress for ' + host + '.');
    return;
  }
  pendingHosts.add(host);
  try {
    const existing = sessions.get(host);
    const action = existing ? 'Reopen verified session' : 'Open verified session';
    const prompt = existing
      ? 'Reopen FolderForge for SSH host "' + host +
        '"? This closes the previous SSH helper and starts a new verified browser session. ' +
        'AI host access still requires your separate consent in Mission Control.'
      : 'Open a verified FolderForge owner session for SSH host "' + host +
        '"? This permits AI host execution ONLY if you subsequently enable it in Mission Control.';
    const choice = await vscode.window.showWarningMessage(prompt, { modal: true }, action);
    if (choice !== action) return;
    if (existing) {
      try {
        await retireSession(host, existing);
      } catch {
        await vscode.window.showErrorMessage(
          'The previous verified SSH session did not close. AI access is unchanged. ' +
          'Check your SSH connection and retry verification.');
        return;
      }
    }
    // Never use shell:true: neither URI nor workspace files can inject commands.
    // The CLI enforces OpenSSH host-key validation and remote OS UID/lease proof.
    try {
      const child = spawn(launch.executable, launch.argv, {
        shell: false, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
      });
      sessions.set(host, child);
      child.stderr?.on('data', chunk => {
        // Don't persist raw remote output, CLI logs or potential credentials.
        const message = String(chunk);
        if (/not found|permission denied|host key verification failed|not recognized|no such file/i.test(message)) {
          output.appendLine('FolderForge SSH launch reported an installation/SSH error.');
        }
      });
      child.on('error', error => {
        if (sessions.get(host) === child) sessions.delete(host);
        output.appendLine('Verified SSH helper could not start: ' + error.code);
        void vscode.window.showErrorMessage(
          'Cannot start FolderForge locally. Install the FolderForge CLI on your PC and verify your SSH alias.');
      });
      child.on('exit', code => {
        if (sessions.get(host) === child) sessions.delete(host);
        if (code !== 0 && code !== null) {
          void vscode.window.showWarningMessage(
            'FolderForge verified SSH session closed (exit ' + code + '). Check the SSH alias and remote Dashboard port.');
        }
      });
    } catch {
      await vscode.window.showErrorMessage('Could not start the verified FolderForge SSH session.');
    }
  } finally {
    pendingHosts.delete(host);
  }
}

function activate(context) {
  output = vscode.window.createOutputChannel('FolderForge Remote-SSH');
  context.subscriptions.push(output);
  context.subscriptions.push(vscode.commands.registerCommand('folderforgeRemoteSsh.verify', verify));
  context.subscriptions.push(vscode.window.registerUriHandler({
    handleUri: async uri => {
      if (!parseTrustedUri(uri, vscode.env.uriScheme)) return;
      await verify();
    },
  }));
}

function deactivate() {
  for (const child of sessions.values()) {
    if (child.exitCode === null) child.kill('SIGTERM');
  }
  sessions.clear();
}

module.exports = { activate, deactivate };
