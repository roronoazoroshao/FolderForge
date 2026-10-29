import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

interface WorkflowMatrix {
  jobs?: {
    compatibility?: {
      strategy?: { matrix?: { os?: string[]; node?: number[] } };
    };
  };
}

describe('package and CI compatibility contract', () => {
  it('keeps package lifecycle scripts free of POSIX-only chmod/rm commands', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.build).toContain('scripts/ensure-bin-mode.mjs');
    expect(pkg.scripts.clean).toBe('node scripts/clean.mjs');
    expect(pkg.scripts.build).not.toMatch(/\bchmod\b/);
    expect(pkg.scripts.clean).not.toMatch(/\brm\s+-rf\b/);
  });

  it('keeps stdio package smoke in release and compatibility gates', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const workflowText = readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
    const releaseCheck = readFileSync(join(root, 'scripts', 'run-release-check.mjs'), 'utf8');
    expect(pkg.scripts['smoke:stdio']).toBe('node scripts/smoke-stdio.mjs');
    expect(pkg.scripts['release:check']).toBe('node scripts/run-release-check.mjs');
    expect(releaseCheck).toContain("['run', 'smoke:stdio']");
    expect(workflowText).toContain('npm run smoke:stdio');
  });

  it('keeps the container sandbox smoke in CI and the complete release gate', () => {
    const workflowText = readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
    const publishWorkflowText = readFileSync(join(root, '.github', 'workflows', 'publish-npm.yml'), 'utf8');
    const releaseCheck = readFileSync(join(root, 'scripts', 'run-release-check.mjs'), 'utf8');

    expect(releaseCheck).toContain("['run', 'smoke:sandbox']");
    expect(workflowText).toContain('npm run smoke:sandbox');
    expect(workflowText.indexOf('npm run smoke:sandbox')).toBeGreaterThan(
      workflowText.indexOf('npm run build'),
    );
    expect(workflowText).toContain('python@sha256:');
    expect(publishWorkflowText).toContain('FOLDERFORGE_SANDBOX_IMAGE: python@sha256:');
    expect(publishWorkflowText).toContain('docker pull --quiet "$FOLDERFORGE_SANDBOX_IMAGE"');
  });

  it('runs npm and the installed CLI through Node while still requiring the bin shim', () => {
    const smoke = readFileSync(join(root, 'scripts', 'smoke-package.mjs'), 'utf8');
    expect(smoke).toContain('process.env.npm_execpath');
    expect(smoke).toContain('run(process.execPath, [npmExecPath, ...args]');
    expect(smoke).toContain("join(installedRoot, 'dist', 'main.js')");
    expect(smoke).toContain('existsSync(binShim)');
    expect(smoke).toContain('run(process.execPath, [installedCli, ...args]');
    expect(smoke).not.toContain('commandInvocation');
  });

  it('pins patched runtime dependencies in both manifest and lockfile', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      overrides?: Record<string, string>;
    };
    const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8')) as {
      packages?: Record<string, { version?: string }>;
    };
    const patchedOverrides = {
      '@hono/node-server': '2.1.5',
      'body-parser': '2.4.0',
      'fast-uri': '4.2.3',
      'hono': '4.13.14',
      'ip-address': '10.7.5',
      'qs': '6.17.1',
    };
    for (const [name, version] of Object.entries(patchedOverrides)) {
      expect(pkg.overrides?.[name]).toBe(version);
      expect(lock.packages?.[`node_modules/${name}`]?.version).toBe(version);
    }
    expect(pkg.dependencies?.zod).toBe('^4.6.7');
    expect(lock.packages?.['node_modules/zod']?.version).toBe('4.6.7');
  });

  it('refreshes and re-verifies the release ref around all publish gates', () => {
    const preflight = readFileSync(join(root, 'scripts', 'release-preflight.mjs'), 'utf8');
    const releaseCheck = readFileSync(join(root, 'scripts', 'run-release-check.mjs'), 'utf8');
    const publisher = readFileSync(join(root, 'scripts', 'publish-release.mjs'), 'utf8');
    expect(preflight).toContain("['fetch', '--prune', 'origin', 'main']");
    expect(releaseCheck.match(/\['run', 'release:preflight'\]/g)).toHaveLength(2);
    expect(releaseCheck).toContain('delete env.npm_config_dry_run');
    expect(releaseCheck).toContain('delete env.NPM_CONFIG_DRY_RUN');
    expect(publisher).toContain('Refusing to publish with lifecycle scripts disabled');
  });

  it('keeps automated governance benchmark evidence out of the tracked baseline', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['benchmark:governance']).toContain(
      '--output .folderforge-ci/governance-benchmark.json',
    );
  });

  it('runs the pinned third-party MCP probe on Windows and preserves its artifact', () => {
    const workflowText = readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
    expect(workflowText).toMatch(
      /- name: Pinned third-party child MCP compatibility\n\s+if: matrix\.node == 22\n/,
    );
    expect(workflowText).toContain('name: child-mcp-third-party-${{ matrix.os }}-');
  });

  it('keeps Dependabot from proposing unsupported TypeScript minor or major upgrades', () => {
    const dependabot = parseYaml(readFileSync(join(root, '.github', 'dependabot.yml'), 'utf8')) as {
      updates?: Array<{ 'package-ecosystem'?: string; directory?: string; ignore?: Array<{
        'dependency-name': string; 'update-types'?: string[];
      }> }>;
    };
    const npmRoot = dependabot.updates?.find(update =>
      update['package-ecosystem'] === 'npm' && update.directory === '/');
    expect(npmRoot?.ignore).toContainEqual({
      'dependency-name': 'typescript',
      'update-types': ['version-update:semver-minor', 'version-update:semver-major'],
    });
  });

  it('tests both supported LTS lines on Linux, macOS, and Windows', () => {
    const workflow = parseYaml(readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8')) as WorkflowMatrix;
    const matrix = workflow.jobs?.compatibility?.strategy?.matrix;
    expect(matrix?.node).toEqual([22, 24]);
    expect(matrix?.os).toEqual(['ubuntu-latest', 'macos-latest', 'windows-latest']);
  });
});
