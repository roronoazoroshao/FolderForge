import { canonicalExistingPath } from '../core/path-identity.js';
import type { RiskLevel, ToolPrincipal } from '../core/types.js';
import type { WorkspaceCapsuleManager } from '../capsule/workspace-capsule-manager.js';
import type { WorkspaceIdentityRegistry } from './workspace-identity.js';

/** Immutable source-level authorization receipt, NOT OS confinement. */
export interface AuthorizedWorkspaceContext {
  readonly workspaceId: string;
  readonly canonicalRoot: string;
  readonly principalId: string;
  readonly sessionId: string;
  readonly capsuleId: string;
  readonly grantId: string;
  readonly grantRevision: number;
  readonly operationId: string;
  readonly effectiveLimits: Readonly<{
    maxCalls: number; maxMutations: number; maxFilesPerCall: number; maxCommandLength: number;
  }>;
}

export interface WorkspaceAuthorizationInput {
  /** Must come from authenticated transport, never a client-supplied principal DTO. */
  readonly principal: ToolPrincipal;
  readonly registry: WorkspaceIdentityRegistry;
  readonly capsules: WorkspaceCapsuleManager;
  readonly workspaceId: string;
  readonly grantId: string;
  readonly grantRevision: number;
  readonly operationId: string;
  /** Optional client assertion, checked only, never used to choose a root. */
  readonly claimedRoot?: string;
  readonly call: {
    readonly name: string;
    readonly group?: string;
    readonly risk: RiskLevel;
    readonly mutates: boolean;
    readonly args: Record<string, unknown>;
  };
}

/**
 * All authority comes from two persisted stores: the owner-enrolled workspace
 * registry and the existing owner-provisioned capsule (grant) store. The caller's
 * IDs are selectors/claims checked against server-derived principal + policy.
 */
export function authorizeWorkspaceOperation(input: WorkspaceAuthorizationInput): AuthorizedWorkspaceContext {
  const { principal, registry, capsules, workspaceId, grantId, grantRevision, operationId } = input;
  if (!principal.id?.trim() || principal.role !== 'agent' ||
      !principal.sessionId?.trim() || !operationId?.trim() ||
      !Number.isSafeInteger(grantRevision) || grantRevision < 1) {
    throw new Error('WORKSPACE_AUTHENTICATED_CONTEXT_REQUIRED');
  }
  const workspace = registry.resolve(workspaceId);
  if (input.claimedRoot !== undefined) {
    let claimed: string;
    try { claimed = canonicalExistingPath(input.claimedRoot); }
    catch { throw new Error('WORKSPACE_ROOT_MISMATCH'); }
    if (claimed !== workspace.root) throw new Error('WORKSPACE_ROOT_MISMATCH');
  }
  const decision = capsules.checkPersisted(principal, workspace.root, input.call);
  if (decision.kind !== 'allow' || !decision.capsule) {
    throw new Error('WORKSPACE_GRANT_DENIED: ' + (decision.reason ?? 'missing active grant'));
  }
  const grant = decision.capsule;
  if (grant.grantedScopes.length === 0) {
    throw new Error('WORKSPACE_GRANT_SCOPES_REQUIRED');
  }
  if (grant.id !== grantId || grant.grantRevision !== grantRevision ||
      grant.principalId !== principal.id ||
      grant.sessionId !== principal.sessionId ||
      canonicalExistingPath(grant.workspaceRoot) !== workspace.root) {
    throw new Error('WORKSPACE_GRANT_BINDING_MISMATCH');
  }
  return Object.freeze({
    workspaceId: workspace.workspaceId,
    canonicalRoot: workspace.root,
    principalId: principal.id,
    sessionId: principal.sessionId,
    capsuleId: grant.id,
    grantId: grant.id,
    grantRevision: grant.grantRevision,
    operationId,
    effectiveLimits: Object.freeze({ ...grant.limits }),
  });
}
