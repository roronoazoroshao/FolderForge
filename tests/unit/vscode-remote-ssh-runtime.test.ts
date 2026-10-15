import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { runInNewContext } from 'node:vm';

const nodeRequire = createRequire(import.meta.url);

function fixture(choice: string | undefined | Array<string | undefined> = 'Open verified session', overrides?: {
  remoteName?: string;
  authority?: string;
  workspaceExecutable?: string;
}) {
  const selections = Array.isArray(choice) ? [...choice] : [choice];
  const module = { exports: {} as Record<string, (...args: unknown[]) => unknown> };
  const core = nodeRequire('../../packages/vscode-remote-ssh/src/core.cjs') as object;
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  const errors: string[] = [];
  const warnings: string[] = [];
  const child = new EventEmitter() as EventEmitter & {
    stderr: EventEmitter; exitCode: null; kill: ReturnType<typeof vi.fn>;
  };
  child.stderr = new EventEmitter();
  child.exitCode = null;
  child.kill = vi.fn();
  const spawn = vi.fn(() => child);
  const vscode = {
    env: { uiKind: 1, remoteName: overrides?.remoteName ?? 'ssh-remote', uriScheme: 'vscode' },
    UIKind: { Desktop: 1 },
    workspace: {
      workspaceFolders: [{ uri: {
        scheme: 'vscode-remote', authority: overrides?.authority ?? 'ssh-remote+dev-vps',
      } }],
      getConfiguration: () => ({ inspect: (key: string) =>
        key === 'dashboardPort'
          ? { defaultValue: 7332, workspaceValue: 22 }
          : { defaultValue: 'folderforge', workspaceValue: overrides?.workspaceExecutable ?? '/tmp/malware' },
      }),
    },
    window: {
      activeTextEditor: undefined,
      showWarningMessage: vi.fn(async (msg: string) => {
        warnings.push(msg);
        return selections.length > 1 ? selections.shift() : selections[0];
      }),
      showErrorMessage: vi.fn(async (msg: string) => { errors.push(msg); }),
      showInformationMessage: vi.fn(async () => undefined),
      createOutputChannel: () => ({ appendLine: vi.fn(), dispose: vi.fn() }),
      registerUriHandler: (h: { handleUri: (...args: unknown[]) => unknown }) => {
        handlers.uri = h.handleUri; return { dispose: vi.fn() };
      },
    },
    commands: {
      registerCommand: (_name: string, handler: (...args: unknown[]) => unknown) => {
        handlers.command = handler; return { dispose: vi.fn() };
      },
    },
  };
  const src = readFileSync(resolve('packages/vscode-remote-ssh/src/extension.cjs'), 'utf8');
  runInNewContext(src, {
    module, exports: module.exports, process: { platform: 'linux' },
    setTimeout, clearTimeout,
    require: (id: string) => {
      if (id === 'vscode') return vscode;
      if (id === 'node:child_process') return { spawn };
      if (id === './core.cjs') return core;
      throw new Error('Unexpected module dependency: ' + id);
    },
  }, { filename: 'extension.cjs' });
  module.exports.activate({ subscriptions: [] });
  return { handlers, spawn, errors, warnings, child, deactivate: module.exports.deactivate };
}

describe('local VS Code extension real invocation contract', () => {
  const validUri = {
    scheme: 'vscode', authority: 'musashishao.folderforge-remote-ssh',
    path: '/verify', query: '', fragment: '',
  };
  it('does not spawn from a web deep link without explicit owner confirmation', async () => {
    const h = fixture(''); // User dismissed the modal without approving.
    await h.handlers.uri(validUri);
    expect(h.warnings).toHaveLength(1);
    expect(h.spawn).not.toHaveBeenCalled();
  });
  it('rejects URI host injection before a confirmation or SSH spawn', async () => {
    const h = fixture();
    await h.handlers.uri({ ...validUri, query: 'host=attacker' });
    expect(h.spawn).not.toHaveBeenCalled();
    expect(h.warnings).toHaveLength(0);
  });
  it('uses the active remote SSH alias and local user settings, never remote workspace binary', async () => {
    const h = fixture();
    await h.handlers.uri(validUri);
    expect(h.spawn).toHaveBeenCalledTimes(1);
    expect(h.spawn).toHaveBeenCalledWith(
      'folderforge',
      ['dashboard', 'ssh', '--host', 'dev-vps', '--dashboard-port', '7332'],
      { shell: false, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
    );
    h.deactivate();
    expect(h.child.kill).toHaveBeenCalledWith('SIGTERM');
  });
  it('permits deliberate re-verification when the previous SSH helper remains alive but its browser lease expired', async () => {
    const h = fixture(['Open verified session', 'Reopen verified session']);
    await h.handlers.uri(validUri);
    expect(h.spawn).toHaveBeenCalledTimes(1);
    // The SSH process is alive, but its owner cookie can be expired or logged out.
    // Closing the process completes before a new verified helper starts.
    h.child.kill.mockImplementation(() => {
      h.child.emit('close', 0);
      return true;
    });
    await h.handlers.command();
    expect(h.spawn).toHaveBeenCalledTimes(2);
    expect(h.child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(h.warnings).toHaveLength(2);
  });

  it('fails closed if an existing helper cannot be stopped before re-verification', async () => {
    const h = fixture(['Open verified session', 'Reopen verified session']);
    await h.handlers.uri(validUri);
    h.child.kill.mockReturnValue(false);
    await h.handlers.uri(validUri);
    expect(h.spawn).toHaveBeenCalledTimes(1);
    expect(h.errors).toHaveLength(1);
  });

  it('fails closed for ambiguous/hostile SSH aliases and non-SSH workspaces', async () => {
    const evil = fixture('Open verified session', { authority: 'ssh-remote+host;evil' });
    await evil.handlers.command();
    expect(evil.spawn).not.toHaveBeenCalled();
    expect(evil.errors).toHaveLength(1);
    const notSsh = fixture('Open verified session', { remoteName: 'dev-container' });
    await notSsh.handlers.uri(validUri);
    expect(notSsh.spawn).not.toHaveBeenCalled();
    expect(notSsh.errors).toHaveLength(1);
  });
});
