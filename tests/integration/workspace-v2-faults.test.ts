import { existsSync, realpathSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createV2Fixture, ensureFixturePath } from '../fixtures/workspace-v2-fixtures.js';

describe('FF-003 isolated workspace v2 fixture', () => {
  it('provides independent folders without touching the operator home', () => {
    const fixture = createV2Fixture();
    try {
      expect(existsSync(fixture.alpha)).toBe(true);
      expect(existsSync(fixture.beta)).toBe(true);
      expect(fixture.alpha).not.toBe(fixture.beta);
      expect(ensureFixturePath(fixture.root, fixture.alpha)).toBe(realpathSync(fixture.alpha));
      expect(() => ensureFixturePath(fixture.root, process.cwd())).toThrow(/FIXTURE_OUTSIDE_ROOT/);
    } finally {
      fixture.cleanup();
    }
    expect(existsSync(fixture.root)).toBe(false);
  });

  it('rejects symlink escapes from one workspace into a sibling workspace', () => {
    const fixture = createV2Fixture();
    try {
      const escape = join(fixture.alpha, 'escape');
      symlinkSync(fixture.beta, escape, 'dir');
      expect(() => ensureFixturePath(fixture.alpha, escape)).toThrow(/FIXTURE_OUTSIDE_ROOT/);
      expect(ensureFixturePath(fixture.alpha, fixture.alpha)).toBe(realpathSync(fixture.alpha));
    } finally {
      fixture.cleanup();
    }
  });
});
