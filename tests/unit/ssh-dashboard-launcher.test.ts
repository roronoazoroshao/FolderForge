import { afterEach, describe, expect, it } from 'vitest';
import { lstatSync, readFileSync, rmSync } from 'node:fs';
import {
  buildSshDashboardArgv,
  createSshBrowserInvitation,
  parseSshDashboardArgs,
} from '../../src/operator/ssh-dashboard-launcher.js';

const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); });

describe('nontechnical one-login SSH dashboard launcher', () => {
  it('parses only a deliberate SSH destination and optional dashboard port', () => {
    expect(parseSshDashboardArgs(['--host', 'owner@box'])).toEqual({
      host: 'owner@box', dashboardPort: 7332,
    });
    expect(parseSshDashboardArgs(['--host', 'box', '--dashboard-port', '8532']))
      .toEqual({ host: 'box', dashboardPort: 8532 });
    expect(() => parseSshDashboardArgs(['--host', '-A'])).toThrow();
    expect(() => parseSshDashboardArgs(['--host', 'box;touch /tmp/evil'])).toThrow();
    expect(() => parseSshDashboardArgs(['--host', 'box', '--unsafe'])).toThrow();
    expect(() => parseSshDashboardArgs(['--host', 'box', '--dashboard-port', '99999'])).toThrow();
  });

  it('forces host-key verification, a loopback-only tunnel, remote exec, no SSH agent forwarding', () => {
    const args = buildSshDashboardArgv('owner@box', 49432, 7332);
    expect(args).toContain('StrictHostKeyChecking=yes');
    expect(args).toContain('ForwardAgent=no');
    expect(args).toContain('ExitOnForwardFailure=yes');
    expect(args).toContain('127.0.0.1:49432:127.0.0.1:7332');
    expect(args.slice(-5)).toEqual([
      'owner@box', 'folderforge', 'operator', 'dashboard-session', 'serve --stdio',
    ]);
    expect(args).not.toContain('-A');
    expect(args).not.toContain('StrictHostKeyChecking=no');
  });

  it('delivers only a different 0600 browser invitation via a local file, not URL or argv', () => {
    const token = 'a'.repeat(43);
    const secret = 'x'.repeat(43);
    const page = createSshBrowserInvitation('http://127.0.0.1:54321', token);
    cleanups.push(page.cleanup);
    const st = lstatSync(page.path);
    expect(st.isFile()).toBe(true);
    if (process.platform !== 'win32') {
      expect(st.mode & 0o077).toBe(0);
    }
    const contents = readFileSync(page.path, 'utf8');
    expect(contents).toContain('method="POST"');
    expect(contents).toContain('name="pair"');
    expect(contents).toContain(token);
    expect(contents).not.toContain(secret);
    expect(page.url).toMatch(/^file:\/\//);
    expect(page.url).not.toContain(token);
    page.cleanup();
    expect(() => lstatSync(page.path)).toThrow();
  });
});
