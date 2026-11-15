import { createHash } from 'node:crypto';
import { statSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { canonicalExistingPath } from '../core/path-identity.js';

/** Stable lookup key, NOT a capability or proof that a caller is authorized. */
export interface WorkspaceIdentity {
  readonly workspaceId: string;
  readonly root: string;
}

/** The owner-facing CLI/API must resolve relative paths before calling this domain function. */
export function resolveWorkspaceIdentity(rootInput: string): WorkspaceIdentity {
  if (!rootInput || !isAbsolute(rootInput)) {
    throw new Error('WORKSPACE_ROOT_MUST_BE_ABSOLUTE');
  }
  const root = canonicalExistingPath(rootInput);
  if (!statSync(root).isDirectory()) {
    throw new Error('WORKSPACE_ROOT_NOT_DIRECTORY');
  }
  const workspaceId = `ws_${createHash('sha256').update(root).digest('hex').slice(0,32)}`;
  return Object.freeze({ workspaceId, root });
}
