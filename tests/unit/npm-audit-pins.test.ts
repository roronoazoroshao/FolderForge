import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('full dependency audit pins', () => {
  it('pins patched minimatch across ESLint and TypeScript-ESLint dev dependencies', () => {
    const manifest = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as {
      overrides: Record<string, string>;
    };
    const lock = JSON.parse(readFileSync(resolve('package-lock.json'), 'utf8')) as {
      packages: Record<string, { version?: string; integrity?: string }>;
    };
    expect(manifest.overrides.minimatch).toBe('11.0.3');
    expect(lock.packages['node_modules/minimatch']).toMatchObject({
      version: '11.0.3',
      integrity: 'sha512-iny/40PEGkNJQ5/Pv6z3nm6FbRAby32GeZRjCUJk2WnNDbgPSTcdI+DDvLqsgBdD4cD5sMtMheqPPnehCCa8Nw==',
    });
  });
});
