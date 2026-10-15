import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const fleet = readFileSync(resolve('packages/mission-control/src/screens/Fleet.tsx'), 'utf8');

describe('forwarded VS Code PORTS tab — accessible AI access recovery', () => {
  it('makes the primary action start VS Code verification instead of disabling it', () => {
    expect(fleet).toContain('const needsOwnerVerification = grantsByInstance[instance.id] === \'unavailable\';');
    expect(fleet).toContain('Verify in VS Code to allow AI access');
    expect(fleet).toContain('needsOwnerVerification ? openVerifiedVSCodeSession() : void enableFullAiAccess(instance)');
    expect(fleet).not.toContain("disabled={quickAccessBusy !== null || grantsByInstance[instance.id] === 'unavailable'}");
  });

  it('does not grant host access until the verified owner and CSRF pass the server gate', () => {
    expect(fleet).toContain("const VERIFIED_VSCODE_LINK = 'vscode://musashishao.folderforge-remote-ssh/verify'");
    expect(fleet).toContain('if (!owner.verified || !owner.csrfToken)');
    expect(fleet).toContain("'x-folderforge-operator-csrf': owner.csrfToken");
    expect(fleet).toContain("terminalExecution: 'trusted-host'");
  });
});
