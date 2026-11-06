import { afterEach, describe, expect, it } from 'vitest';
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultConfig } from '../../src/runtime/config.js';
import { RateLimiter } from '../../src/policy/rate-limiter.js';
import { RateLimitSettings } from '../../src/operator/rate-limit-settings.js';

const roots: string[] = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'ff-quota-editor-'));
  roots.push(root);
  const config = defaultConfig(root);
  return { root, config, limiter: new RateLimiter(config.rateLimit) };
}
function request(revision: string, value = { dailyQuota: 500, maxCalls: 8, windowMs: 8000 }) {
  return { scope: 'parent', key: 'rateLimit.overrides.shell_exec', expectedRevision: revision, value };
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe('owner-controlled shell_exec quota persistence', () => {
  it('changes only bounded quota fields, without resetting accepted calls', () => {
    const { root, config, limiter } = fixture();
    const editor = new RateLimitSettings(root, config);
    expect(editor.describe(limiter)).toMatchObject({
      revision: 'initial', scope: 'parent', tool: 'shell_exec',
      source: 'startup', effective: { dailyQuota: 1000, maxCalls: 20, windowMs: 10000 },
    });
    for (let i = 0; i < 4; i++) expect(limiter.hit('shell_exec').allowed).toBe(true);
    const preview = editor.validate(request('initial'));
    expect(preview).toMatchObject({ effective: { dailyQuota: 500, maxCalls: 8, windowMs: 8000 } });
    expect(limiter.ruleFor('shell_exec').dailyQuota).toBe(1000);
    const after = editor.apply(request('initial'), 'owner-123', limiter);
    expect(after.revision).not.toBe('initial');
    expect(after.effective).toEqual({ dailyQuota: 500, maxCalls: 8, windowMs: 8000 });
    expect(after.usage.windowCount).toBe(4);
    expect(after.usage.dailyCount).toBe(4);
    expect(limiter.ruleFor('shell_exec').maxCalls).toBe(8);
    expect(limiter.hit('shell_exec').allowed).toBe(true);
    expect(lstatSync(join(root, '.folderforge', 'rate-limit-settings.json')).mode & 0o077).toBe(0);
  });

  it('fails closed on invalid values, unknown keys, disabled limiter and stale revision', () => {
    const { root, config, limiter } = fixture();
    const editor = new RateLimitSettings(root, config);
    for (const value of [
      { dailyQuota: 0, maxCalls: 8, windowMs: 8000 },
      { dailyQuota: 10001, maxCalls: 8, windowMs: 8000 },
      { dailyQuota: 500.5, maxCalls: 8, windowMs: 8000 },
      { dailyQuota: 500, maxCalls: 0, windowMs: 8000 },
      { dailyQuota: 500, maxCalls: 51, windowMs: 8000 },
      { dailyQuota: 500, maxCalls: 8, windowMs: 999 },
      { dailyQuota: 500, maxCalls: 8, windowMs: 60001 },
      { dailyQuota: '500', maxCalls: 8, windowMs: 8000 },
      { dailyQuota: 500, maxCalls: 8, windowMs: 8000, enabled: false },
    ]) {
      expect(() => editor.apply(request('initial', value as never), 'owner', limiter)).toThrow();
    }
    expect(() => editor.apply({ ...request('initial'), 'rateLimit.enabled': false }, 'owner', limiter)).toThrow();
    expect(() => editor.apply({ ...request('initial'), key: 'git_push' }, 'owner', limiter)).toThrow();
    expect(() => editor.apply(request('initial'), ' ', limiter)).toThrow();
    config.rateLimit.enabled = false;
    expect(() => editor.apply(request('initial'), 'owner', limiter)).toThrow();
    config.rateLimit.enabled = true;
    const applied = editor.apply(request('initial'), 'owner', limiter);
    expect(() => editor.apply(request('initial'), 'owner', limiter)).toThrow(/stale/i);
    expect(applied.revision).not.toBe('initial');
  });

  it('restores the exact effective rule after restart but not in-memory usage', () => {
    const { root, config, limiter } = fixture();
    const editor = new RateLimitSettings(root, config);
    limiter.hit('shell_exec');
    editor.apply(request('initial'), 'owner', limiter);
    const freshConfig = defaultConfig(root);
    const restored = new RateLimitSettings(root, freshConfig);
    const freshLimiter = new RateLimiter(freshConfig.rateLimit);
    expect(restored.describe(freshLimiter)).toMatchObject({
      source: 'operator', effective: { dailyQuota: 500, maxCalls: 8, windowMs: 8000 },
      usage: { windowCount: 0, dailyCount: 0 },
    });
    expect(freshLimiter.ruleFor('shell_exec').dailyQuota).toBe(500);
  });

  it('rejects concurrent stale processes, corrupt records and symlink storage', () => {
    const { root, config, limiter } = fixture();
    const first = new RateLimitSettings(root, config);
    const secondConfig = defaultConfig(root);
    const second = new RateLimitSettings(root, secondConfig);
    first.apply(request('initial'), 'owner-a', limiter);
    expect(() => second.apply(request('initial'), 'owner-b', new RateLimiter(secondConfig.rateLimit))).toThrow(/stale/i);
    const path = join(root, '.folderforge', 'rate-limit-settings.json');
    const bytes = readFileSync(path, 'utf8');
    writeFileSync(path, bytes.replace('"dailyQuota": 500', '"dailyQuota": 900'));
    expect(() => new RateLimitSettings(root, defaultConfig(root))).toThrow(/integrity|invalid/i);
    rmSync(path);
    symlinkSync(join(root, 'untrusted'), path);
    expect(() => new RateLimitSettings(root, defaultConfig(root))).toThrow(/symlink|invalid/i);
  });

  it('rejects a symlinked operator directory before any record can be loaded', () => {
    const { root, config } = fixture();
    const outside = mkdtempSync(join(tmpdir(), 'ff-quota-outside-'));
    roots.push(outside);
    symlinkSync(outside, join(root, '.folderforge'));
    expect(() => new RateLimitSettings(root, config)).toThrow(/symlink|invalid|operator-owned/i);
  });

  it.skipIf(process.platform === 'win32')('allows startup with an empty shared directory but refuses writes there', () => {
    const { root, config, limiter } = fixture();
    const folder = join(root, '.folderforge');
    mkdirSync(folder, { recursive: true });
    chmodSync(folder, 0o777);
    const editor = new RateLimitSettings(root, config);
    expect(editor.describe(limiter).revision).toBe('initial');
    expect(() => editor.apply(request('initial'), 'owner', limiter))
      .toThrow(/operator-owned|invalid/i);
    expect(limiter.ruleFor('shell_exec').dailyQuota).toBe(1000);
  });

  it.skipIf(process.platform === 'win32')('refuses existing quota records in a shared directory', () => {
    const { root, config, limiter } = fixture();
    const editor = new RateLimitSettings(root, config);
    editor.apply(request('initial'), 'owner', limiter);
    chmodSync(join(root, '.folderforge'), 0o777);
    expect(() => new RateLimitSettings(root, defaultConfig(root)))
      .toThrow(/invalid|operator-owned/i);
  });

  it('reports exact startup quota without fabricating an unset daily quota', () => {
    const { root, config, limiter } = fixture();
    delete config.rateLimit.overrides.shell_exec!.dailyQuota;
    const editor = new RateLimitSettings(root, config);
    expect(editor.describe(limiter).effective.dailyQuota).toBeUndefined();
  });

  it('preserves the rule when the persistent update is locked or cannot commit', () => {
    const { root, config, limiter } = fixture();
    const editor = new RateLimitSettings(root, config);
    mkdirSync(join(root, '.folderforge'), { recursive: true, mode: 0o700 });
    const lock = join(root, '.folderforge', 'rate-limit-settings.json.lock');
    writeFileSync(lock, 'other owner');
    expect(() => editor.apply(request('initial'), 'owner', limiter)).toThrow(/lock/i);
    expect(limiter.ruleFor('shell_exec').dailyQuota).toBe(1000);
    expect(editor.describe(limiter).revision).toBe('initial');
  });
});
