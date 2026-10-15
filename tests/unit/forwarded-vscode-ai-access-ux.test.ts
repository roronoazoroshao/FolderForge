import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const fleet = readFileSync(resolve('packages/mission-control/src/screens/Fleet.tsx'), 'utf8');

describe('forwarded VS Code PORTS tab — accessible AI access recovery', () => {
  it('routes the primary action to VS Code verification when owner proof is absent', () => {
    expect(fleet).toContain('const needsOwnerVerification = ownerSessionVerified === false;');
    expect(fleet).toContain('Verify in VS Code to allow AI access');
    expect(fleet).toContain('needsOwnerVerification ? openVerifiedVSCodeSession() : void enableFullAiAccess(instance)');
    expect(fleet).toContain('ownerSessionVerified === true');
    expect(fleet).not.toContain("disabled={quickAccessBusy !== null || grantsByInstance[instance.id] === 'unavailable'}");
  });

  it('checks live owner proof independently from the saved Fleet grant status', () => {
    expect(fleet).toContain("api<{ verified: boolean }>('/operator/ssh-session/status', { sensitive: true })");
    expect(fleet).toContain('setOwnerSessionVerified(status.verified === true)');
    expect(fleet).toContain('setInterval(refreshOwnerSession, 15_000)');
  });

  it('retains server owner proof and session CSRF gating before host privilege changes', () => {
    expect(fleet).toContain("const VERIFIED_VSCODE_LINK = 'vscode://musashishao.folderforge-remote-ssh/verify'");
    expect(fleet).toContain('if (!owner.verified || !owner.csrfToken)');
    expect(fleet).toContain("'x-folderforge-operator-csrf': owner.csrfToken");
    expect(fleet).toContain("terminalExecution: 'trusted-host'");
  });
});
