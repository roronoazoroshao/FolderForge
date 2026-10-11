import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { defaultConfig } from '../../src/runtime/config.js';
import { Container } from '../../src/runtime/container.js';
import { FleetManager } from '../../src/provisioner/fleet-manager.js';
import { requireSupportedLocalPlatform } from '../../src/operator/trusted-host-platform.js';

const roots: string[] = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'ff-host-conformance-'));
  roots.push(root);
  const project = join(root, 'workspace');
  mkdirSync(project);
  return { root, project };
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('Fleet trusted-host compatibility / qualification matrix', () => {
  it('keeps default v3.0.1 danger-mode process shell and Fleet profile sandbox-required', () => {
    const h = fixture();
    const config = defaultConfig(h.root);
    expect(config.terminal.sandbox).toMatchObject({ mode: 'process', requireInDanger: true });
    const fleet = new FleetManager(h.root);
    const { instance } = fleet.create({ projectPath: h.project, authMode: 'api-key' });
    expect(instance.terminalExecution).toBe('sandbox-required');
    expect(readFileSync(join(h.root, '.folderforge/fleet', `${instance.id}.yaml`), 'utf8'))
      .toContain('requireInDanger: true');
    expect(() => fleet.setTerminalExecution(instance.id, 'trusted-host'))
      .toThrow(/operator startup opt-in/);
    expect(fleet.get(instance.id).terminalExecution).toBe('sandbox-required');
  });

  it('does not enable operator consent on Linux or unqualified platforms', () => {
    const h = fixture();
    const container = new Container(defaultConfig(h.root));
    if (process.platform !== 'darwin') {
      expect(container.trustedHostConsentService()).toBeNull();
    }
    expect(() => requireSupportedLocalPlatform('linux')).toThrow('LOCAL_CONFIRMATION_UNAVAILABLE');
    expect(() => requireSupportedLocalPlatform('win32')).toThrow('LOCAL_CONFIRMATION_UNAVAILABLE');
    expect(() => requireSupportedLocalPlatform('darwin')).not.toThrow();
  });

  it('preserves the legacy explicit parent host opt-in only for authenticated children', () => {
    const h = fixture();
    const fleet = new FleetManager(h.root, { allowTrustedHostExecution: true });
    const { instance } = fleet.create({ projectPath: h.project, authMode: 'token' });
    expect(instance.terminalExecution).toBe('trusted-host');
    expect(readFileSync(join(h.root, '.folderforge/fleet', `${instance.id}.yaml`), 'utf8'))
      .toContain('requireInDanger: false');
    const second = join(h.root, 'anonymous');
    mkdirSync(second);
    expect(() => fleet.create({ projectPath: second, authMode: 'none' }))
      .toThrow(/authenticated MCP access/i);
    expect(existsSync(join(h.root, '.folderforge/fleet.json'))).toBe(true);
  });

  it('refuses an explicit unauthorized trusted-host profile without partially saving a new instance', () => {
    const h = fixture();
    const fleet = new FleetManager(h.root);
    expect(() => fleet.create({
      projectPath: h.project, authMode: 'oauth',
      terminalExecution: 'trusted-host',
    })).toThrow(/operator startup opt-in/i);
    expect(fleet.list()).toEqual([]);
  });
});
