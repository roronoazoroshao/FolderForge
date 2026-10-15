'use strict';
const vscode = require('vscode');
const { spawn } = require('node:child_process');
const { resolveRemoteAlias, parseTrustedUri, buildVerifiedLauncher, globalSetting } = require('./core.cjs');

const sessions = new Map();
let output;

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
  if (sessions.has(host)) {
    await vscode.window.showInformationMessage(
      'A verified FolderForge SSH session for ' + host + ' is already active.');
    return;
  }
  const choice = await vscode.window.showWarningMessage(
    'Open a verified FolderForge owner session for SSH host "' + host +
      '"? This permits AI host execution ONLY if you subsequently enable it in Mission Control.',
    { modal: true },
    'Open verified session');
  if (choice !== 'Open verified session') return;
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
      sessions.delete(host);
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
