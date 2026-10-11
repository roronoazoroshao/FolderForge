import { describe, expect, it } from 'vitest';
import {
  checkLocalTerminal,
  detectConsentPlatform,
  requireSupportedLocalPlatform,
} from '../../src/operator/trusted-host-platform.js';
import { defaultHostConsentRoot, validateLinuxOperatorBase } from '../../src/operator/trusted-host-cli.js';
import { mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { operatorStateOutsideProjects } from '../../src/operator/trusted-host-scope.js';

describe('host operator consent platform boundary', () => {
  it('distinguishes macOS, Linux and unsupported platforms', () => {
    expect(detectConsentPlatform('darwin')).toBe('darwin');
    expect(detectConsentPlatform('linux')).toBe('linux');
    expect(detectConsentPlatform('win32')).toBe('unsupported');
    expect(detectConsentPlatform('freebsd')).toBe('unsupported');
  });

  it('fails closed on unsupported platforms', () => {
    expect(() => requireSupportedLocalPlatform('win32')).toThrow('LOCAL_CONFIRMATION_UNAVAILABLE');
    expect(() => requireSupportedLocalPlatform('unknown')).toThrow('LOCAL_CONFIRMATION_UNAVAILABLE');
    expect(() => requireSupportedLocalPlatform('darwin')).not.toThrow();
    expect(() => requireSupportedLocalPlatform('linux')).not.toThrow();
  });

  it.skipIf(process.platform !== 'linux')('uses a durable Linux operator root separate from a home-wide agent workspace', () => {
    const consentRoot = defaultHostConsentRoot();
    expect(consentRoot).toBe(`/var/tmp/folderforge-operator-consent-${process.getuid()}`);
    expect(consentRoot.startsWith(process.env.HOME ?? '/home/')).toBe(false);
    expect(operatorStateOutsideProjects(consentRoot, [homedir()])).toBe(true);
  });

  it.skipIf(process.platform !== 'linux')('requires a root-owned sticky Linux state parent; rejects symlink and untrusted owner', () => {
    expect(() => validateLinuxOperatorBase('/var/tmp')).not.toThrow();
    const tmp = mkdtempSync(join(tmpdir(), 'ff-linux-parent-test-'));
    try {
      const symlink = join(tmp, 'link');
      symlinkSync('/var/tmp', symlink);
      expect(() => validateLinuxOperatorBase(symlink)).toThrow('UNSAFE_LINUX_OPERATOR_PARENT');
      expect(() => validateLinuxOperatorBase(tmp)).toThrow('UNSAFE_LINUX_OPERATOR_PARENT');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('requires both interactive input and output, never silently grants over a pipe', () => {
    expect(() => checkLocalTerminal({ stdinIsTTY: false, stdoutIsTTY: true })).toThrow('LOCAL_TERMINAL_REQUIRED');
    expect(() => checkLocalTerminal({ stdinIsTTY: true, stdoutIsTTY: false })).toThrow('LOCAL_TERMINAL_REQUIRED');
    expect(() => checkLocalTerminal({ stdinIsTTY: true, stdoutIsTTY: true })).not.toThrow();
  });
});
