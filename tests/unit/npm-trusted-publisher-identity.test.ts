import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const json = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const workflow = readFileSync(resolve(root, '.github/workflows/publish-npm.yml'), 'utf8');

describe('npm Trusted Publishing release identity', () => {
  it('binds npm package repository metadata to the current canonical GitHub owner/repo', () => {
    expect(json.repository.url).toBe('git+https://github.com/roronoazoroshao/FolderForge.git');
    expect(json.homepage).toBe('https://github.com/roronoazoroshao/FolderForge#readme');
    expect(json.bugs.url).toBe('https://github.com/roronoazoroshao/FolderForge/issues');
  });

  it('uses trusted OIDC and avoids setup-node generated placeholder npm token', () => {
    expect(workflow).toContain('id-token: write');
    expect(workflow).toContain('npm install --global npm@11.6.2');
    expect(workflow).not.toMatch(/^\s+registry-url:/m);
    expect(workflow).toContain('npm publish "${RUNNER_TEMP}/release-bundle/');
  });
});
