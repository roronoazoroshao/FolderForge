import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import YAML from 'yaml';

const WORKFLOWS = {
  soak: resolve('.github/workflows/production-soak.yml'),
  release: resolve('.github/workflows/release.yml'),
  publish: resolve('.github/workflows/publish-npm.yml'),
  vscode: resolve('.github/workflows/vscode-remote-ssh.yml'),
};

function text(name: keyof typeof WORKFLOWS): string {
  return readFileSync(WORKFLOWS[name], 'utf8');
}

function parsed(name: keyof typeof WORKFLOWS): Record<string, unknown> {
  return YAML.parse(text(name)) as Record<string, unknown>;
}

describe('production release workflow contracts', () => {
  it('defines an exact-commit resumable 24-hour soak with pinned actions', () => {
    const source = text('soak');
    const workflow = parsed('soak') as {
      env: Record<string, string>;
      jobs: Record<string, { 'timeout-minutes'?: number }>;
    };

    expect(workflow.env).toMatchObject({
      SOAK_DURATION_MS: '86400000',
      SOAK_INTERVAL_MS: '1000',
      SOAK_FAULT_EVERY: '300',
    });
    expect(Object.keys(workflow.jobs)).toEqual([
      'prepare',
      'segment-1',
      'segment-2',
      'segment-3',
      'segment-4',
      'complete',
    ]);
    for (const name of ['segment-1', 'segment-2', 'segment-3', 'segment-4', 'complete']) {
      expect(workflow.jobs[name]?.['timeout-minutes']).toBe(350);
    }
    expect(source.match(/--resume/g)).toHaveLength(4);
    expect(source.match(/test "\$\{code\}" -eq 143/g)).toHaveLength(4);
    expect(source).toContain('test "${code}" -eq 0');
    expect(source).toContain('--commit "${{ needs.prepare.outputs.commit }}"');
    expect(source).toContain('production-soak-${{ needs.prepare.outputs.commit }}');
    expect(source).toContain('production-soak-receipt.json');

    const actionRefs = [...source.matchAll(/uses:\s+[^@\s]+@([^\s]+)/g)].map((match) => match[1]);
    expect(actionRefs.length).toBeGreaterThan(0);
    expect(actionRefs.every((ref) => /^[0-9a-f]{40}$/i.test(ref))).toBe(true);
  });

  it.each(['release', 'publish'] as const)(
    '%s uses exact tagged commit CI without a mandatory soak receipt',
    (name) => {
      const source = text(name);
      const workflow = parsed(name) as { permissions: Record<string, string> };
      expect(workflow.permissions.actions).toBe('read');
      expect(source).toContain('release_sha="$(git rev-parse HEAD)"');
      expect(source).toContain('actions/workflows/ci.yml/runs');
      expect(source).toContain('-f head_sha="${release_sha}"');
      expect(source).toContain('-f status=success');
      expect(source).not.toContain('actions/artifacts');
      expect(source).not.toContain('verify-production-soak.mjs');
      expect(source).not.toContain('production-soak-verification.json');
      expect(source).not.toContain('production-soak-');
    },
  );

  it('builds npm release evidence from checked-out annotated tag commit, not workflow_dispatch GITHUB_SHA', () => {
    const source = text('publish');
    const start = source.indexOf('- name: Create and verify immutable release bundle');
    const end = source.indexOf('- name: Attest tarball build provenance', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const bundleStep = source.slice(start, end);
    expect(bundleStep).toContain('release_sha="$(git rev-parse HEAD)"');
    expect(bundleStep).toContain('--commit "${release_sha}"');
    expect(bundleStep).not.toContain('--commit "${GITHUB_SHA}"');
  });

  it('bundles a verified installable local VSIX with the exact-tag GitHub Release', () => {
    const source = text('release');
    expect(source).toContain('vsce package --no-dependencies');
    expect(source).toContain('folderforge-remote-ssh-0.1.0.vsix');
    expect(source).toContain('VSIX_VERIFY_PASS');
    expect(source).toContain('--verify-tag');
    expect(source).toContain('"${RUNNER_TEMP}/folderforge-remote-ssh-0.1.0.vsix"');
  });

  it('builds verified VSIX artifacts on integrated main commits, not only draft PRs', () => {
    const workflow = parsed('vscode') as {
      on: { push?: { branches: string[] }; pull_request?: object };
    };
    expect(workflow.on.push?.branches).toEqual(['main']);
    expect(workflow.on.pull_request).toBeDefined();
  });

  it('still attests and publishes the immutable npm tarball, SBOM and manifest', () => {
    const source = text('publish');
    expect(source).toContain('Attest tarball build provenance');
    expect(source).toContain('Attest tarball SBOM');
    expect(source).toContain('Attest release manifest');
    expect(source).toContain('npm publish');
    expect(source).toContain('Verify registry package bytes and source metadata');
  });
});
