import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface LockEntry { version?: string }
interface PackageLock { packages: Record<string, LockEntry> }
interface RootPackage { overrides?: Record<string, string> }

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as RootPackage;
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as PackageLock;

describe('root dependency audit regression (GHSA-g3hv-75wg-m249)', () => {
  it('pins the patched minimatch release for both eslint and typescript-eslint', () => {
    expect(packageJson.overrides?.minimatch).toBe('11.0.1');
    const minimatchEntries = Object.entries(lock.packages)
      .filter(([path]) => path === 'node_modules/minimatch' || path.endsWith('/node_modules/minimatch'));
    expect(minimatchEntries.length).toBeGreaterThan(0);
    expect(minimatchEntries.map(([path, pkg]) => [path, pkg.version])).toEqual(
      minimatchEntries.map(([path]) => [path, '11.0.1']),
    );
    expect(lock.packages['node_modules/minimatch']?.version).toBe('11.0.1');
  });
});
