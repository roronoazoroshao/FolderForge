import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  parseRemoteSshAuthority, resolveRemoteAlias, parseTrustedUri,
  buildVerifiedLauncher, globalSetting,
} = require('../../packages/vscode-remote-ssh/src/core.cjs') as {
  parseRemoteSshAuthority: (s: string) => string;
  resolveRemoteAlias: (uris: Array<{ scheme: string; authority: string }>, active?: { scheme: string; authority: string }) => string;
  parseTrustedUri: (uri: { scheme: string; authority: string; path: string; query: string; fragment: string }) => boolean;
  buildVerifiedLauncher: (host: string, port: number, executable?: string) => { executable: string; argv: string[] };
  globalSetting: (x: { globalValue?: string; defaultValue?: string; workspaceValue?: string; workspaceFolderValue?: string } | undefined, fallback: string) => string;
};

describe('VS Code Remote-SSH UI host verification (no trust in forwarded HTTP)', () => {
  it('only trusts an active VS Code Remote-SSH workspace authority for target discovery', () => {
    expect(parseRemoteSshAuthority('ssh-remote+my-vps')).toBe('my-vps');
    expect(resolveRemoteAlias([
      { scheme: 'vscode-remote', authority: 'ssh-remote+my-vps' },
    ])).toBe('my-vps');
    expect(() => parseRemoteSshAuthority('dev-container+my-vps')).toThrow();
    expect(() => parseRemoteSshAuthority('ssh-remote+me;echo hacked')).toThrow();
    expect(() => parseRemoteSshAuthority('ssh-remote+evil@server')).toThrow();
    expect(() => resolveRemoteAlias([{ scheme: 'file', authority: '' }])).toThrow();
    expect(() => resolveRemoteAlias([
      { scheme: 'vscode-remote', authority: 'ssh-remote+a' },
      { scheme: 'vscode-remote', authority: 'ssh-remote+b' },
    ])).toThrow('AMBIGUOUS_VSCODE_SSH_HOST');
  });
  it('rejects adversarial deep-links with host, port, command, fragments or foreign authority', () => {
    const clean = { scheme: 'vscode', authority: 'musashishao.folderforge-remote-ssh',
      path: '/verify', query: '', fragment: '' };
    expect(parseTrustedUri(clean)).toBe(true);
    for (const malicious of [
      { ...clean, query: 'host=evil' },
      { ...clean, query: 'port=22' },
      { ...clean, query: 'command=rm' },
      { ...clean, fragment: 'anything' },
      { ...clean, path: '/run' },
      { ...clean, authority: 'attacker.extension' },
    ]) expect(parseTrustedUri(malicious)).toBe(false);
  });
  it('ignores remote workspace settings that attempt to replace a local executable', () => {
    expect(globalSetting({ globalValue: '/safe/local/folderforge',
      workspaceValue: '/tmp/evil', workspaceFolderValue: '/tmp/evil' },
    'folderforge')).toBe('/safe/local/folderforge');
    expect(globalSetting({ defaultValue: 'folderforge',
      workspaceValue: '/tmp/evil' }, 'fallback')).toBe('folderforge');
  });
  it('uses a fixed URI authority and never accepts hostile query parameters', () => {
    const uri = 'vscode://musashishao.folderforge-remote-ssh/verify';
    const parsed = new URL(uri);
    expect(parseTrustedUri({ scheme: parsed.protocol.slice(0, -1),
      authority: parsed.host, path: parsed.pathname,
      query: parsed.search.slice(1), fragment: parsed.hash.slice(1) })).toBe(true);
  });
  it('keeps the optional VS Code extension secure without requiring it for Fleet access', () => {
    const ui = readFileSync(resolve('packages/mission-control/src/screens/Fleet.tsx'), 'utf8');
    expect(ui).not.toContain('vscode://');
    expect(ui).toContain('Enable AI access');
    expect(ui).toContain('/fleet/owner-capability');
    const extension = readFileSync(resolve('packages/vscode-remote-ssh/src/extension.cjs'), 'utf8');
    expect(extension).toContain('shell: false');
    expect(extension).toContain('modal: true');
    expect(extension).toContain("vscode.env.remoteName !== 'ssh-remote'");
  });
  it('uses argv without a shell and accepts only a configured numeric dashboard port', () => {
    expect(buildVerifiedLauncher('my-vps', 7332)).toEqual({
      executable: 'folderforge',
      argv: ['dashboard', 'ssh', '--host', 'my-vps', '--dashboard-port', '7332'],
    });
    expect(() => buildVerifiedLauncher('evil; touch /tmp/attack', 7332)).toThrow();
    expect(() => buildVerifiedLauncher('my-vps', 0)).toThrow();
    expect(() => buildVerifiedLauncher('my-vps', 65536)).toThrow();
  });
});
