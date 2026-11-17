import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { canonicalExistingPath, isPathWithin } from '../core/path-identity.js';

interface IdentityRecord {
  workspaceId: string;
  root: string;
  dev: number;
  ino: number;
}
interface IdentityStore {
  version: 1;
  workspaces: IdentityRecord[];
  digest: string;
}

function digest(records: IdentityRecord[]): string {
  return 'sha256:' + createHash('sha256').update(JSON.stringify(records)).digest('hex');
}

/**
 * Registry identity is NOT a bearer capability. Only a trusted owner-facing service
 * may call register/reattach; request handlers must use resolve and a separate grant.
 * Filesystem ACLs on the registry are a deployment prerequisite, not proven here.
 */
export class WorkspaceIdentityRegistry {
  private readonly path: string;
  private readonly allowed: string[];

  constructor(stateRoot: string, allowedDirectories: string[]) {
    this.path = resolve(stateRoot, '.folderforge', 'workspaces.json');
    this.allowed = allowedDirectories.map(canonicalExistingPath);
  }

  private filesystemIdentity(path: string): Omit<IdentityRecord, 'workspaceId'> {
    if (!path || !isAbsolute(path)) throw new Error('WORKSPACE_ROOT_MUST_BE_ABSOLUTE');
    const root = canonicalExistingPath(path);
    const info = statSync(root);
    if (!info.isDirectory()) throw new Error('WORKSPACE_ROOT_NOT_DIRECTORY');
    if (!this.allowed.some((allowed) => isPathWithin(allowed, root))) {
      throw new Error('WORKSPACE_ROOT_NOT_ALLOWED');
    }
    if (!Number.isSafeInteger(info.dev) || !Number.isSafeInteger(info.ino)) {
      throw new Error('WORKSPACE_IDENTITY_UNVERIFIABLE');
    }
    return { root, dev: info.dev, ino: info.ino };
  }

  private read(): IdentityRecord[] {
    let parsed: IdentityStore;
    try {
      parsed = JSON.parse(readFileSync(this.path, 'utf8')) as IdentityStore;
    } catch {
      throw new Error('WORKSPACE_REGISTRY_UNAVAILABLE');
    }
    if (parsed.version !== 1 || !Array.isArray(parsed.workspaces) ||
        parsed.digest !== digest(parsed.workspaces)) {
      throw new Error('WORKSPACE_REGISTRY_INVALID');
    }
    const ids = new Set<string>();
    for (const record of parsed.workspaces) {
      if (!record || !/^ws_[a-f0-9]{32}$/.test(record.workspaceId) ||
          typeof record.root !== 'string' ||
          !Number.isSafeInteger(record.dev) || !Number.isSafeInteger(record.ino) ||
          ids.has(record.workspaceId)) {
        throw new Error('WORKSPACE_REGISTRY_INVALID');
      }
      ids.add(record.workspaceId);
    }
    return parsed.workspaces;
  }

  private write(workspaces: IdentityRecord[]): void {
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    const temp = this.path + '.' + process.pid + '.' + randomUUID() + '.tmp';
    const state: IdentityStore = { version: 1, workspaces, digest: digest(workspaces) };
    writeFileSync(temp, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
    renameSync(temp, this.path);
  }

  /**
   * mkdir is an atomic, cross-process writer exclusion primitive on the state
   * filesystem. A held/abandoned lock denies writes; never auto-remove it.
   * This does not fence older writers that ignore the lock or prove state ACLs.
   */
  private withWriteLock<T>(mutate: () => T): T {
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    const lockPath = this.path + '.lock';
    try {
      mkdirSync(lockPath, { mode: 0o700 });
    } catch {
      throw new Error('WORKSPACE_REGISTRY_WRITER_BUSY');
    }
    try {
      return mutate();
    } finally {
      rmdirSync(lockPath);
    }
  }

  /** Owner-only registry enrollment; a client-supplied ID can never enroll itself. */
  register(path: string): Readonly<{ workspaceId: string; root: string }> {
    return this.withWriteLock(() => {
      const item = this.filesystemIdentity(path);
      let records: IdentityRecord[];
      try {
        records = this.read();
      } catch (error) {
        if ((error as Error).message !== 'WORKSPACE_REGISTRY_UNAVAILABLE' ||
            existsSync(this.path)) throw error;
        records = [];
      }
      const found = records.find((r) => r.dev === item.dev && r.ino === item.ino);
      if (found) {
        if (found.root !== item.root) throw new Error('WORKSPACE_REATTACH_REQUIRED');
        return Object.freeze({ workspaceId: found.workspaceId, root: item.root });
      }
      const entry = { ...item, workspaceId: 'ws_' + randomUUID().replace(/-/g, '') };
      this.write([...records, entry]);
      return Object.freeze({ workspaceId: entry.workspaceId, root: entry.root });
    });
  }

  /** Reattach a moved directory only when its filesystem identity remains unchanged. */
  reattach(workspaceId: string, newPath: string): Readonly<{ workspaceId: string; root: string }> {
    return this.withWriteLock(() => {
      const records = this.read();
      const index = records.findIndex((r) => r.workspaceId === workspaceId);
      if (index < 0) throw new Error('WORKSPACE_UNKNOWN');
      const item = this.filesystemIdentity(newPath);
      const previous = records[index]!;
      if (previous.dev !== item.dev || previous.ino !== item.ino ||
          records.some((r, i) => i !== index && r.root === item.root)) {
        throw new Error('WORKSPACE_REATTACH_IDENTITY_MISMATCH');
      }
      records[index] = { ...previous, root: item.root };
      this.write(records);
      return Object.freeze({ workspaceId, root: item.root });
    });
  }

  /** Always resolves from disk; symlink retargeting/rename/rebind fail closed. */
  resolve(workspaceId: string): Readonly<{ workspaceId: string; root: string }> {
    const record = this.read().find((r) => r.workspaceId === workspaceId);
    if (!record) throw new Error('WORKSPACE_UNKNOWN');
    let current: Omit<IdentityRecord, 'workspaceId'>;
    try {
      current = this.filesystemIdentity(record.root);
      if (realpathSync.native(record.root) !== record.root ||
          current.root !== record.root || current.dev !== record.dev || current.ino !== record.ino) {
        throw new Error('WORKSPACE_IDENTITY_CHANGED');
      }
    } catch {
      throw new Error('WORKSPACE_IDENTITY_CHANGED');
    }
    return Object.freeze({ workspaceId: record.workspaceId, root: record.root });
  }
}
