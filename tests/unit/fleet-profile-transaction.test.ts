import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { lstatSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FleetManager } from '../../src/provisioner/fleet-manager.js';
import { FleetProfileTransaction, supportsDirectoryFsync } from '../../src/provisioner/fleet-profile-transaction.js';
import type { FleetProfileTuple } from '../../src/operator/trusted-host-scope.js';

const tuple: FleetProfileTuple = { toolsPreset: 'full', policyMode: 'danger', terminalExecution: 'trusted-host' };
const roots: string[] = [];
function fixture(phase?: 'prepared' | 'yaml-renamed' | 'state-renamed' | 'committed') {
  const root = mkdtempSync(join(tmpdir(), 'ff-profile-tx-'));
  roots.push(root);
  const project = join(root, 'project');
  mkdirSync(project);
  const fleet = new FleetManager(root);
  const { instance } = fleet.create({ projectPath: project, authMode: 'api-key' });
  const statePath = join(root, '.folderforge', 'fleet.json');
  const yamlPath = join(root, '.folderforge', 'fleet', `${instance.id}.yaml`);
  const before = { json: readFileSync(statePath, 'utf8'), yaml: readFileSync(yamlPath, 'utf8') };
  const tx = new FleetProfileTransaction({
    root, authorize: (id, _tuple, digest) => { if (id !== instance.id || digest !== 'allowed-digest') throw new Error('CONSENT_REQUIRED'); },
    onPhase: (name) => { if (name === phase) throw new Error(`FAULT_AT_${name}`); },
  });
  return { root, tx, before, statePath, yamlPath, instance };
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function anonymousFixture(phase?: 'prepared' | 'yaml-renamed' | 'state-renamed' | 'committed') {
  const root = mkdtempSync(join(tmpdir(), 'ff-profile-token-tx-'));
  roots.push(root);
  const project = join(root, 'project');
  mkdirSync(project);
  const fleet = new FleetManager(root);
  const { instance } = fleet.create({ projectPath: project, authMode: 'none' });
  const statePath = join(root, '.folderforge', 'fleet.json');
  const yamlPath = join(root, '.folderforge', 'fleet', `${instance.id}.yaml`);
  const before = { json: readFileSync(statePath, 'utf8'), yaml: readFileSync(yamlPath, 'utf8') };
  const token = 'q'.repeat(43);
  const tokenSha256 = createHash('sha256').update(token).digest('hex');
  const upgrade = {
    token, tokenSha256,
    renderYaml: (_record: unknown, secret: string) =>
      before.yaml
        .replace('      mode: "none"', '      mode: "token"\n    token: "' + secret + '"\n    requireAuth: true')
        .replace('  defaultMode: "dev"', '  defaultMode: "danger"')
        .replace('    requireInDanger: true', '    requireInDanger: false'),
  };
  const tx = new FleetProfileTransaction({
    root, authorize: (_id, _tuple, digest) => {
      if (digest !== 'allowed-digest') throw new Error('CONSENT_REQUIRED');
    },
    onPhase: name => {
      if (name === phase) throw new Error('FAULT_AT_' + name);
    },
  });
  return { root, instance, statePath, yamlPath, before, tx, token, tokenSha256, upgrade };
}


describe('atomic no-auth credential + trusted-host grant profile', () => {
  it('commits token auth, matching token hash, and full danger profile in a single journal', () => {
    const h = anonymousFixture();
    const state = h.tx.commit(h.instance.id, tuple, 'allowed-digest', h.upgrade);
    expect(state).toMatchObject({ authMode: 'token', tokenSha256: h.tokenSha256, ...tuple });
    expect(JSON.parse(readFileSync(h.statePath, 'utf8')).instances[0].authMode).toBe('token');
    expect(readFileSync(h.statePath, 'utf8')).not.toContain(h.token);
    const yaml = readFileSync(h.yamlPath, 'utf8');
    expect(yaml).toContain(h.token);
    expect(yaml).toContain('    requireAuth: true');
    expect(yaml).toContain('    requireInDanger: false');
  });
  it.each(['prepared', 'yaml-renamed', 'state-renamed'] as const)(
    'recovers BOTH auth and privilege state to anonymous sandbox after crash at %s', phase => {
      const h = anonymousFixture(phase);
      expect(() => h.tx.commit(h.instance.id, tuple, 'allowed-digest', h.upgrade))
        .toThrow('FAULT_AT_' + phase);
      const recovery = new FleetProfileTransaction({ root: h.root, authorize: () => {} });
      recovery.recoverBeforeReadOrStart();
      expect(readFileSync(h.yamlPath, 'utf8')).toBe(h.before.yaml);
      expect(readFileSync(h.statePath, 'utf8')).toBe(h.before.json);
      expect(readFileSync(h.yamlPath, 'utf8')).not.toContain(h.token);
    },
  );
  it('rolls committed auth+profile forward together after crash at committed', () => {
    const h = anonymousFixture('committed');
    expect(() => h.tx.commit(h.instance.id, tuple, 'allowed-digest', h.upgrade))
      .toThrow('FAULT_AT_committed');
    new FleetProfileTransaction({ root: h.root, authorize: () => {} }).recoverBeforeReadOrStart();
    expect(JSON.parse(readFileSync(h.statePath, 'utf8')).instances[0])
      .toMatchObject({ authMode: 'token', terminalExecution: 'trusted-host' });
    expect(readFileSync(h.yamlPath, 'utf8')).toContain(h.token);
  });
  it('refuses an invalid digest/token pair before any write', () => {
    const h = anonymousFixture();
    expect(() => h.tx.commit(h.instance.id, tuple, 'allowed-digest', {
      ...h.upgrade, tokenSha256: 'f'.repeat(64),
    })).toThrow('INVALID_FLEET_TOKEN_UPGRADE');
    expect(readFileSync(h.yamlPath, 'utf8')).toBe(h.before.yaml);
    expect(readFileSync(h.statePath, 'utf8')).toBe(h.before.json);
  });
});

describe('crash-consistent Fleet profile transaction', () => {
  it('documents and gates platform directory fsync without weakening macOS/APFS', () => {
    expect(supportsDirectoryFsync('win32')).toBe(false);
    expect(supportsDirectoryFsync('darwin')).toBe(true);
    expect(supportsDirectoryFsync('linux')).toBe(true);
  });

  it('rejects a stale legacy Fleet writer after a committed profile transaction', () => {
    const h = fixture();
    const stale = new FleetManager(h.root);
    h.tx.commit(h.instance.id, tuple, 'allowed-digest');
    const afterCommit = readFileSync(h.statePath, 'utf8');
    expect(() => stale.setPolicyMode(h.instance.id, 'safe')).toThrow('FLEET_PROFILE_STALE_WRITER');
    expect(readFileSync(h.statePath, 'utf8')).toBe(afterCommit);
    expect(() => stale.setToolsPreset(h.instance.id, 'vibe')).toThrow('FLEET_PROFILE_STALE_WRITER');
  });

  it('blocks legacy Fleet setters while profile lock is held before PREPARED journal', () => {
    const h = fixture();
    const spawned: string[] = [];
    const competing = new FleetManager(h.root, {
      mainJs: process.execPath,
      spawn: (command) => {
        spawned.push(command);
        return { sessionId: 'proc_test', pid: 100000 };
      },
    });
    const tx = new FleetProfileTransaction({
      root: h.root,
      authorize: () => {
        // The writer lock exists but PREPARED does not. Previously mutable()
        // only checked for a journal and accepted this competing mutation.
        expect(() => competing.setPolicyMode(h.instance.id, 'safe')).toThrow('FLEET_PROFILE_BUSY');
        expect(() => competing.setToolsPreset(h.instance.id, 'full')).toThrow('FLEET_PROFILE_BUSY');
        expect(() => competing.setAutoRestart(h.instance.id, true)).toThrow('FLEET_PROFILE_BUSY');
        expect(() => competing.start(h.instance.id)).toThrow('FLEET_PROFILE_BUSY');
        expect(spawned).toEqual([]);
        expect(readFileSync(h.statePath, 'utf8')).toBe(h.before.json);
      },
    });
    const result = tx.commit(h.instance.id, tuple, 'allowed-digest');
    expect(result.terminalExecution).toBe('trusted-host');
  });

  it('preserves YAML credentials while changing only requested tuple', () => {
    const h = fixture();
    const updated = h.tx.commit(h.instance.id, tuple, 'allowed-digest');
    expect(updated.toolsPreset).toBe('full');
    expect(updated.policyMode).toBe('danger');
    expect(updated.terminalExecution).toBe('trusted-host');
    const yaml = readFileSync(h.yamlPath, 'utf8');
    expect(yaml).toMatch(/requireInDanger: false/);
    expect(yaml).toMatch(/defaultMode: "danger"/);
    expect(yaml).toMatch(/apiKeys:/);
    expect(yaml).toContain(h.before.yaml.match(/ffk_[A-Za-z0-9_-]+/)?.[0] ?? 'NOT_FOUND');
    expect(readFileSync(h.statePath, 'utf8')).toContain('"toolsPreset": "full"');
  });

  it.each(['prepared', 'yaml-renamed', 'state-renamed'] as const)(
    'recovers the old coherent tuple after a crash at %s', (phase) => {
      const h = fixture(phase);
      expect(() => h.tx.commit(h.instance.id, tuple, 'allowed-digest')).toThrow(`FAULT_AT_${phase}`);
      const reloaded = new FleetProfileTransaction({ root: h.root, authorize: () => {} });
      reloaded.recoverBeforeReadOrStart();
      expect(readFileSync(h.yamlPath, 'utf8')).toBe(h.before.yaml);
      expect(readFileSync(h.statePath, 'utf8')).toBe(h.before.json);
    },
  );

  it('reclaims a demonstrably dead writer lock before recovering PREPARED journal', () => {
    const h = fixture('yaml-renamed');
    expect(() => h.tx.commit(h.instance.id, tuple, 'allowed-digest')).toThrow('FAULT_AT_yaml-renamed');
    const lock = join(h.root, '.folderforge', 'fleet-profile.lock');
    writeFileSync(lock, '2147483646', { mode: 0o600 });
    const restarted = new FleetProfileTransaction({ root: h.root, authorize: () => {} });
    restarted.recoverBeforeReadOrStart();
    expect(readFileSync(h.yamlPath, 'utf8')).toBe(h.before.yaml);
    expect(readFileSync(h.statePath, 'utf8')).toBe(h.before.json);
    expect(() => lstatSync(lock)).toThrow();
  });

  it('never reclaims a lock owned by an OS process that is still alive', () => {
    const h = fixture('prepared');
    expect(() => h.tx.commit(h.instance.id, tuple, 'allowed-digest')).toThrow('FAULT_AT_prepared');
    const lock = join(h.root, '.folderforge', 'fleet-profile.lock');
    writeFileSync(lock, String(process.pid), { mode: 0o600 });
    const competing = new FleetProfileTransaction({ root: h.root, authorize: () => {} });
    expect(() => competing.recoverBeforeReadOrStart()).toThrow('FLEET_PROFILE_BUSY');
    expect(readFileSync(lock, 'utf8')).toBe(String(process.pid));
  });

  it('recovers committed new values after crash before final cleanup', () => {
    const h = fixture('committed');
    expect(() => h.tx.commit(h.instance.id, tuple, 'allowed-digest')).toThrow('FAULT_AT_committed');
    const tx = new FleetProfileTransaction({ root: h.root, authorize: () => {} });
    tx.recoverBeforeReadOrStart();
    const fleetState = JSON.parse(readFileSync(h.statePath, 'utf8'));
    expect(fleetState.instances[0].toolsPreset).toBe('full');
    expect(readFileSync(h.yamlPath, 'utf8')).toMatch(/requireInDanger: false/);
  });

  it('fails closed on invalid approval without touching any persisted file', () => {
    const h = fixture();
    expect(() => h.tx.commit(h.instance.id, tuple, 'denied')).toThrow('CONSENT_REQUIRED');
    expect(readFileSync(h.yamlPath, 'utf8')).toBe(h.before.yaml);
    expect(readFileSync(h.statePath, 'utf8')).toBe(h.before.json);
  });

  it('rejects symlink replacement and never follows an unsafe YAML pointer', () => {
    const h = fixture();
    rmSync(h.yamlPath);
    symlinkSync(h.statePath, h.yamlPath);
    expect(() => h.tx.commit(h.instance.id, tuple, 'allowed-digest')).toThrow();
    expect(lstatSync(h.yamlPath).isSymbolicLink()).toBe(true);
    expect(readFileSync(h.statePath, 'utf8')).toBe(h.before.json);
  });

  it('halts on corrupt recovery journal instead of allowing a Fleet start', () => {
    const h = fixture();
    const journal = join(h.root, '.folderforge', 'fleet-profile.journal');
    writeFileSync(journal, '{bad-json', { mode: 0o600 });
    expect(() => h.tx.recoverBeforeReadOrStart()).toThrow('RECOVERY_REQUIRED');
    expect(readFileSync(h.yamlPath, 'utf8')).toBe(h.before.yaml);
  });
});
