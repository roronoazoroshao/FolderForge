import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const readme = readFileSync(join(process.cwd(), 'README.md'), 'utf8');

describe('operator-owned Fleet onboarding documentation', () => {
  it('uses the current repository badge and describes authenticated extension-free Fleet access', () => {
    expect(readme).toContain('github.com/roronoazoroshao/FolderForge/actions/workflows/ci.yml');
    expect(readme).toContain('folderforge control start --auth token --no-open --project /home/devops');
    expect(readme).toContain('folderforge control auth token --project /home/devops');
    expect(readme).toContain('VSIX is optional');
    expect(readme).toContain('Enable AI access');
    expect(readme).not.toContain('CLI on both ends are currently prerequisites');
  });

  it('does not promise privileged rights through an anonymous forwarded tab', () => {
    expect(readme).toContain('not automatically authorized');
    expect(readme).toContain('authenticated owner');
  });
});
