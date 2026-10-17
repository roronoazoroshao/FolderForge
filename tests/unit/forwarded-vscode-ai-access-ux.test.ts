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

  it('requires verified owner authority for the Config Modal primary and advanced host actions', () => {
    expect(fleet).toContain('ownerSessionVerified={ownerSessionVerified}');
    expect(fleet).toContain('const ownerProofRequired = props.ownerSessionVerified !== true || needsReverification;');
    expect(fleet).toContain('Verify in VS Code to allow AI access');
    expect(fleet).toContain('Verify in VS Code to save AI access');
    expect(fleet).toContain('ownerProofRequired ? openVerifiedVSCodeSession() : void applyFromVerifiedOwnerSession');
  });

  it('offers recovery instead of leaking an opaque origin/owner-session denial', () => {
    expect(fleet).toContain("message.includes('SSH_OPERATOR_ORIGIN_DENIED')");
    expect(fleet).toContain("message.includes('VERIFIED_OWNER_SESSION_REQUIRED')");
    expect(fleet).toContain('setNeedsReverification(true)');
    expect(fleet).toContain('Open a new verified session in VS Code and retry in the browser tab it opens.');
  });

  it('offers the release VSIX and extension-free SSH CLI instead of a missing Marketplace extension', () => {
    expect(fleet).toContain('const VERIFIED_VSIX_URL =');
    expect(fleet).toContain('releases/download/v3.2.4/folderforge-remote-ssh-0.1.0.vsix');
    expect(fleet).toContain('Install from VSIX');
    expect(fleet).toContain('folderforge dashboard ssh --host YOUR_SSH_ALIAS');
    expect(fleet).toContain('setVerificationHelpOpen(true)');
    expect(fleet).toContain('Open VS Code (extension installed)');
  });

  it('retains server owner proof and session CSRF gating before host privilege changes', () => {
    expect(fleet).toContain("const VERIFIED_VSCODE_LINK = 'vscode://musashishao.folderforge-remote-ssh/verify'");
    expect(fleet).toContain('if (!owner.verified || !owner.csrfToken)');
    expect(fleet).toContain("'x-folderforge-operator-csrf': owner.csrfToken");
    expect(fleet).toContain("terminalExecution: 'trusted-host'");
  });
});
