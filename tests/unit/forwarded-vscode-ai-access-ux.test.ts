import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const fleet = readFileSync(resolve('packages/mission-control/src/screens/Fleet.tsx'), 'utf8');
const server = readFileSync(resolve('src/dashboard/server.ts'), 'utf8');

describe('extension-free one-click AI access', () => {
  it('uses explicitly authenticated Dashboard owner capability, not a VS Code extension', () => {
    expect(fleet).toContain("'/fleet/owner-capability'");
    expect(fleet).toContain('resolveOwnerHeaders');
    expect(fleet).not.toContain('vscode://');
    expect(fleet).not.toContain('VERIFIED_VSIX_URL');
    expect(fleet).toContain('Enable AI access');
  });

  it('never requests owner elevation without authenticating the Control Dashboard', () => {
    expect(server).toContain('authenticatedLoopbackDashboardOwner(req, opts)');
    expect(server).toContain('opts.requireAuth !== true');
    expect(server).toContain('isLoopbackHost(req.socket.remoteAddress');
    expect(server).toContain('service.applyAuthenticatedDashboardProfile');
    expect(fleet).toContain('x-folderforge-operator-csrf');
  });

  it('rechecks authority for lifecycle and revocation, rather than trusting the saved Fleet profile', () => {
    expect(fleet).toContain('const headers = await resolveOwnerHeaders();');
    expect(fleet).toContain('ownerSessionVerified === true');
    expect(fleet).toContain("'trusted-host'");
    expect(fleet).not.toContain('Verify in VS Code to allow AI access');
  });

  it('shows an understandable admin Dashboard recovery rather than a Marketplace install prompt', () => {
    expect(fleet).toContain('folderforge control auth token --project');
    expect(fleet).toContain('signed Dashboard link');
    expect(fleet).not.toContain('Install from VSIX');
  });
});
