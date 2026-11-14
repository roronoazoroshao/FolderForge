import type { WorkspaceIdentity } from './workspace-identity.js';

/** Immutable identity of one requested operation. No OS privilege is conferred by this type. */
export interface WorkspaceContext {
  readonly workspaceId: string;
  readonly root: string;
  readonly principalId: string;
  readonly sessionId: string;
  readonly operationId: string;
  readonly grantRevision: number;
}

export interface WorkspaceContextInput {
  readonly workspace: WorkspaceIdentity;
  readonly sessionWorkspaceId: string;
  readonly principalId: string;
  readonly sessionId: string;
  readonly operationId: string;
  readonly grantRevision: number;
}

/** Only a trusted transport/service may call this after authenticating the principal/session. */
export function createWorkspaceContext(input: WorkspaceContextInput): WorkspaceContext {
  const { workspace, sessionWorkspaceId, principalId, sessionId, operationId, grantRevision } = input;
  if (!workspace.workspaceId || !workspace.root || workspace.workspaceId !== sessionWorkspaceId) {
    throw new Error('WORKSPACE_SESSION_MISMATCH');
  }
  if ([principalId, sessionId, operationId].some(value => !value?.trim())) {
    throw new Error('WORKSPACE_CONTEXT_IDENTITY_REQUIRED');
  }
  if (!Number.isSafeInteger(grantRevision) || grantRevision < 0) {
    throw new Error('WORKSPACE_GRANT_REVISION_INVALID');
  }
  return Object.freeze({
    workspaceId: workspace.workspaceId,
    root: workspace.root,
    principalId,
    sessionId,
    operationId,
    grantRevision,
  });
}
