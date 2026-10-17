import { randomBytes, createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import type { FleetInstance, FleetManager } from '../provisioner/fleet-manager.js';
import { FLEET_POLICY_MODES, FLEET_TOOLS_PRESETS } from '../provisioner/fleet-manager.js';
import { TrustedHostStore } from './trusted-host-store.js';
import type { SshSessionBroker, SshOperatorAuthority } from './ssh-session-broker.js';
import { scopeDigest, type ConsentIdentity, type FleetProfileTuple } from './trusted-host-scope.js';

export interface OperatorPrincipal {
  id: string;
  role: string;
}

export interface PendingView {
  status: 'pending' | 'approved';
  requestId: string;
  expiresAt: number;
  instanceId: string;
}

export interface RedactedConsentView {
  status: 'pending' | 'approved' | 'expired' | 'not_requested';
  instanceId: string;
  requestId?: string;
  expiresAt?: number;
}

export interface TrustedHostConsentOptions {
  fleet: Pick<FleetManager, 'get'>;
  store: TrustedHostStore;
  installationId: string;
  serviceUid: number;
  now: () => number;
  isWriteFrozen: () => boolean;
  recordAudit: (event: string) => void;
}

function fleetRevision(record: FleetInstance): string {
  // CAS identity is intentionally distinct from the durable capability digest.
  return createHash('sha256').update(JSON.stringify([
    record.id, record.toolsPreset, record.policyMode, record.terminalExecution,
    record.authMode, record.updatedAt,
  ])).digest('hex');
}

/**
 * Only a host-local CLI, verified SSH/OS owner, or explicitly authenticated
 * loopback Control Dashboard may approve a grant. This class never modifies
 * the process-global sandbox configuration.
 */
export class TrustedHostConsentService {
  constructor(private readonly deps: TrustedHostConsentOptions) {}

  private identityFor(instanceId: string, tokenUpgrade = false): ConsentIdentity {
    const record = this.deps.fleet.get(instanceId);
    if (record.authMode === 'none' && !tokenUpgrade) throw new Error('TRUSTED_HOST_AUTH_REQUIRED');
    if (tokenUpgrade && record.authMode !== 'none') throw new Error('INVALID_TOKEN_UPGRADE');
    const identity: ConsentIdentity = {
      installationId: this.deps.installationId,
      serviceUid: this.deps.serviceUid,
      instanceId: record.id,
      workspaceRealpath: realpathSync(record.projectPath),
      authMode: tokenUpgrade ? 'token' : record.authMode,
      revocationGeneration: 0,
    };
    identity.revocationGeneration = this.deps.store.currentRevocationGeneration(identity);
    return identity;
  }

  private checkOperator(principal: OperatorPrincipal): void {
    // The tokenless loopback Control Panel uses this exact local identity;
    // only the Dashboard HTTP boundary can assign it to an incoming request.
    // An intent is not a host-execution grant: local CLI approval remains required.
    if (principal.role !== 'admin' ||
        (principal.id !== 'local:dashboard-admin' && !principal.id.startsWith('credential:'))) {
      throw new Error('HOST_OPERATOR_AUTH_REQUIRED');
    }
  }

  private assertWritable(): void {
    if (this.deps.isWriteFrozen()) throw new Error('WRITE_FREEZE_ACTIVE');
  }

  requestProfile(instanceId: string, tuple: FleetProfileTuple, principal: OperatorPrincipal, tokenUpgrade = false): PendingView {
    this.checkOperator(principal);
    this.assertWritable();
    if (!(FLEET_TOOLS_PRESETS as readonly string[]).includes(tuple.toolsPreset) ||
        !(FLEET_POLICY_MODES as readonly string[]).includes(tuple.policyMode) ||
        tuple.terminalExecution !== 'trusted-host') {
      throw new Error('INVALID_TRUSTED_HOST_PROFILE');
    }
    const record = this.deps.fleet.get(instanceId);
    const identity = this.identityFor(instanceId, tokenUpgrade);
    const digest = scopeDigest(tuple, identity);
    const approved = this.deps.store.readGrantByScope(digest);
    if (approved && this.deps.store.validateGrant(identity, tuple) &&
        record.toolsPreset === tuple.toolsPreset && record.policyMode === tuple.policyMode &&
        record.terminalExecution === tuple.terminalExecution) {
      return { status: 'approved', requestId: approved.requestId, expiresAt: 0, instanceId };
    }
    const existing = this.deps.store.findPendingByInstance(instanceId);
    if (existing) {
      if (existing.scopeHash !== digest || existing.requestedBy !== principal.id) {
        throw new Error('CONSENT_INTENT_CONFLICT');
      }
      return { status: 'pending', requestId: existing.requestId, expiresAt: existing.expiresAt, instanceId };
    }
    const createdAt = this.deps.now();
    const requestId = `req_${randomBytes(24).toString('base64url')}`;
    this.deps.recordAudit('trusted_host_intent_requested');
    this.deps.store.createPending({
      schemaVersion: 1,
      requestId, instanceId,
      tuple, identity, scopeHash: digest,
      expectedInstanceRevision: fleetRevision(record),
      requestedBy: principal.id,
      createdAt, expiresAt: createdAt + 600_000,
    });
    return { status: 'pending', requestId, expiresAt: createdAt + 600_000, instanceId };
  }

  status(instanceId: string, requestId?: string): RedactedConsentView {
    const record = this.deps.fleet.get(instanceId);
    if (record.authMode === 'none' && !requestId) {
      // "No auth" is a supported one-click onboarding state, never a grant.
      return { status: 'not_requested', instanceId };
    }
    const identity = this.identityFor(instanceId);
    const requested = requestId
      ? this.deps.store.readIntentRecord(requestId)
      : this.deps.store.findPendingByInstance(instanceId);
    if (requestId && !requested) throw new Error('CONSENT_REQUEST_UNAVAILABLE');
    if (requested && requested.instanceId !== instanceId) throw new Error('CONSENT_SCOPE_MISMATCH');
    if (requested && this.deps.store.validateGrant(identity, requested.tuple)) {
      return { status: 'approved', instanceId, requestId: requested.requestId };
    }
    if (requested && !requested.consumedAt && requested.expiresAt > this.deps.now()) {
      return { status: 'pending', instanceId, requestId: requested.requestId, expiresAt: requested.expiresAt };
    }
    if (requested && requested.expiresAt <= this.deps.now()) {
      return { status: 'expired', instanceId, requestId: requested.requestId };
    }
    // A saved tuple is NOT authority. Check the actual scope-bound operator
    // grant after an earlier intent was consumed; this also allows the UI to
    // distinguish a revoked permission from one that is genuinely enabled.
    if (!requested && record.terminalExecution === 'trusted-host' &&
        this.deps.store.validateGrant(identity, {
          toolsPreset: record.toolsPreset,
          policyMode: record.policyMode,
          terminalExecution: 'trusted-host',
        })) {
      return { status: 'approved', instanceId };
    }
    return { status: 'not_requested', instanceId };
  }

  cancelPending(instanceId: string, requestId: string, principal: OperatorPrincipal): void {
    this.checkOperator(principal);
    this.assertWritable();
    const pending = this.deps.store.readPending(requestId);
    if (!pending || pending.instanceId !== instanceId || pending.requestedBy !== principal.id) {
      throw new Error('CONSENT_REQUEST_UNAVAILABLE');
    }
    this.deps.recordAudit('trusted_host_intent_cancelled');
    this.deps.store.cancelPending(requestId);
  }

  assertAuthorized(instanceId: string, tuple: FleetProfileTuple): void {
    const identity = this.identityFor(instanceId);
    if (!this.deps.store.validateGrant(identity, tuple)) throw new Error('TRUSTED_HOST_CONSENT_REQUIRED');
  }

  assertAuthorizedForIntent(instanceId: string, tuple: FleetProfileTuple, requestId: string): void {
    this.assertWritable();
    const intent = this.deps.store.readIntentRecord(requestId);
    const instance = this.deps.fleet.get(instanceId);
    // An owner-verified no-auth upgrade stages a prospective token identity;
    // after commit the same identity becomes the real instance identity.
    const tokenUpgrade = instance.authMode === 'none' && intent?.identity.authMode === 'token';
    const identity = this.identityFor(instanceId, tokenUpgrade);
    if (!this.deps.store.validateGrant(identity, tuple)) {
      throw new Error('TRUSTED_HOST_CONSENT_REQUIRED');
    }
    if (!intent || intent.instanceId !== instanceId || intent.scopeHash !== scopeDigest(tuple, identity)) {
      throw new Error('CONSENT_SCOPE_MISMATCH');
    }
    if (intent.expectedInstanceRevision !== fleetRevision(instance)) {
      throw new Error('CONSENT_STALE_REVISION');
    }
  }

  authorizationDigest(instanceId: string, tuple: FleetProfileTuple, tokenUpgrade = false): string {
    return scopeDigest(tuple, this.identityFor(instanceId, tokenUpgrade));
  }

  /** Apply gate: the approved digest must also bind an unchanged pending-intent CAS revision. */
  assertAuthorizedForDigest(instanceId: string, tuple: FleetProfileTuple, digest: string): void {
    const grant = this.deps.store.readGrantByScope(digest);
    if (!grant) throw new Error('TRUSTED_HOST_CONSENT_REQUIRED');
    const record = this.deps.fleet.get(instanceId);
    const tokenUpgrade = record.authMode === 'none' && grant.identity.authMode === 'token';
    const identity = this.identityFor(instanceId, tokenUpgrade);
    if (scopeDigest(tuple, identity) !== digest) throw new Error('CONSENT_SCOPE_MISMATCH');
    this.assertAuthorizedForIntent(instanceId, tuple, grant.requestId);
  }

  /**
   * SSH sessions and explicitly credential-authenticated loopback Control
   * Dashboard sessions enter through separate HTTP authorization gates.
   * Neither caller may mint a grant from an unauthenticated forwarded tab.
   *
   * The common operation retains exact-instance, workspace realpath, auth,
   * CAS revision, PID-fencing, audit and revocation guarantees.
   */
  private applyOwnerAuthorizedProfile(
    instanceId: string,
    tuple: FleetProfileTuple,
    principal: OperatorPrincipal,
    assertProofLive: () => void,
    auditEvent: string,
    commit: (tuple: FleetProfileTuple, upgradeAuth: boolean) => void,
  ): { newlyApproved: boolean } {
    assertProofLive();
    this.checkOperator(principal);
    this.assertWritable();
    const record = this.deps.fleet.get(instanceId);
    if (record.authMode !== 'none' &&
        record.toolsPreset === tuple.toolsPreset &&
        record.policyMode === tuple.policyMode &&
        record.terminalExecution === tuple.terminalExecution) {
      try {
        if (this.deps.store.validateGrant(this.identityFor(instanceId), tuple)) {
          return { newlyApproved: false };
        }
      } catch { /* Never interpret stale/revoked metadata as authority. */ }
    }
    const requiresTokenUpgrade = record.authMode === 'none';
    if (record.pid !== undefined || record.sessionId !== undefined ||
        record.lastError?.startsWith('FLEET_PROFILE_STOP_UNVERIFIED')) {
      throw new Error('FLEET_CHILD_TERMINATION_UNVERIFIED');
    }
    if (['running', 'starting', 'stopping'].includes(record.state) ||
        record.openAiTunnel?.state === 'running' ||
        record.openAiTunnel?.state === 'starting') {
      throw new Error('FLEET_INSTANCE_ACTIVE');
    }
    const requested = this.requestProfile(instanceId, tuple, principal, requiresTokenUpgrade);
    if (requested.status === 'approved') return { newlyApproved: false };
    const pending = this.deps.store.readPending(requested.requestId);
    if (!pending || pending.instanceId !== instanceId) {
      throw new Error('CONSENT_REQUEST_UNAVAILABLE');
    }
    // Revalidate immediately before issuing a durable capability.
    assertProofLive();
    this.deps.store.consumeLocalApproval(pending.requestId, pending.scopeHash);
    try {
      this.applyApprovedProfile(instanceId, pending.requestId, approved =>
        commit(approved, requiresTokenUpgrade));
    } catch (error) {
      this.deps.store.revoke(pending.identity);
      this.deps.recordAudit('trusted_host_owner_apply_failed_revoked');
      throw error;
    }
    this.deps.recordAudit(auditEvent);
    return { newlyApproved: true };
  }

  applyVerifiedSshProfile(
    instanceId: string,
    tuple: FleetProfileTuple,
    principal: OperatorPrincipal,
    broker: SshSessionBroker,
    authority: SshOperatorAuthority,
    commit: (tuple: FleetProfileTuple, upgradeAuth: boolean) => void,
  ): { newlyApproved: boolean } {
    const assertProofLive = () => {
      broker.assertAuthorityLive(authority);
      if (!['ssh-remote-exec', 'local-operator-launch'].includes(authority.source) ||
          authority.installationId !== this.deps.installationId ||
          authority.serviceUid !== this.deps.serviceUid) {
        throw new Error('SSH_OPERATOR_INSTALLATION_MISMATCH');
      }
    };
    return this.applyOwnerAuthorizedProfile(
      instanceId, tuple, principal, assertProofLive,
      'trusted_host_verified_ssh_one_click_approved', commit,
    );
  }

  /**
   * Call ONLY after the Control Dashboard's HTTP gate has checked a real
   * header bearer credential, explicit requireAuth=true, and local loopback
   * bind/peer. A Dashboard with auth=none MUST NOT reach this method.
   *
   * This is intentional delegated host authority, not OS/SSH identity proof.
   * Anyone holding the Control Dashboard admin credential can authorize
   * full/danger/trusted-host; keep its file 0600 and never expose externally.
   */
  applyAuthenticatedDashboardProfile(
    instanceId: string,
    tuple: FleetProfileTuple,
    principal: OperatorPrincipal,
    commit: (tuple: FleetProfileTuple, upgradeAuth: boolean) => void,
  ): { newlyApproved: boolean } {
    return this.applyOwnerAuthorizedProfile(
      instanceId, tuple, principal, () => {},
      'trusted_host_authenticated_dashboard_one_click_approved', commit,
    );
  }

  /** A network caller may request application only AFTER separate local approval. */
  applyApprovedProfile<T>(instanceId: string, requestId: string, commit: (tuple: FleetProfileTuple) => T): T {
    const intent = this.deps.store.readIntentRecord(requestId);
    if (!intent || intent.instanceId !== instanceId) throw new Error('CONSENT_SCOPE_MISMATCH');
    this.assertAuthorizedForIntent(instanceId, intent.tuple, requestId);
    return commit(intent.tuple);
  }

  revokeFromLocal(instanceId: string): void {
    this.deps.recordAudit('trusted_host_grant_revoked');
    this.deps.store.revoke(this.identityFor(instanceId));
  }
}
