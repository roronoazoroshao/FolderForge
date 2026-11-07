import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync, constants, existsSync, fstatSync, fsyncSync, lstatSync, mkdirSync,
  openSync, readFileSync, renameSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { FolderForgeConfig, RateLimitRule } from '../core/types.js';
import type { RateLimiter } from '../policy/rate-limiter.js';

type Rule = Required<Pick<RateLimitRule, 'dailyQuota' | 'maxCalls' | 'windowMs'>>;
interface PersistedRule {
  schemaVersion: 1;
  revision: string;
  rule: Rule;
  updatedAt: string;
  updatedBy: string;
  integritySha256: string;
}

export interface RateLimitSettingsView {
  scope: 'parent';
  tool: 'shell_exec';
  revision: string;
  source: 'startup' | 'operator';
  effective: RateLimitRule;
  enabled: boolean;
  usage: { windowCount: number; dailyCount: number };
  /** Usage is process-local and not retained on restart. */
  usageScope: 'current-process';
}

export class RateLimitSettingsError extends Error {
  constructor(public readonly code: 'invalid_quota' | 'stale_revision' | 'quota_locked' | 'corrupt_quota' | 'rate_limit_disabled' | 'commit_uncertain', message: string) {
    super(message);
    this.name = 'RateLimitSettingsError';
  }
}

const RULE_KEYS = 'dailyQuota,maxCalls,windowMs';
const REQUEST_KEYS = 'expectedRevision,key,scope,value';
const STORED_KEYS = 'integritySha256,revision,rule,schemaVersion,updatedAt,updatedBy';
function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
function exactKeys(value: Record<string, unknown>, expected: string): boolean {
  return Object.keys(value).sort().join(',') === expected;
}
function boundedInt(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
}
function validRule(value: unknown): value is Rule {
  if (!isRecord(value) || !exactKeys(value, RULE_KEYS)) return false;
  return boundedInt(value.dailyQuota, 1, 10_000) &&
    boundedInt(value.maxCalls, 1, 50) &&
    boundedInt(value.windowMs, 1_000, 60_000);
}
function checksum(payload: Omit<PersistedRule, 'integritySha256'>): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
function failure(code: RateLimitSettingsError['code'], message: string): never {
  throw new RateLimitSettingsError(code, message);
}

/**
 * Only the parent shell_exec quota is editable. No generic config patching,
 * sandbox/host grant change or rate-limit disable path exists here.
 *
 * Cross-process writers cooperate through an exclusive no-follow lock. Stale
 * locks fail closed rather than silently reclaiming another process's lease.
 * A restart reloads the durable rule but never invents durable hit counters.
 */
export class RateLimitSettings {
  private readonly path: string;
  private readonly lockPath: string;
  private stored: PersistedRule | undefined;

  constructor(
    projectRoot: string,
    private readonly config: FolderForgeConfig,
    private readonly storage: { syncDirectory?: (path: string) => void } = {},
  ) {
    this.path = resolve(projectRoot, '.folderforge', 'rate-limit-settings.json');
    this.lockPath = this.path + '.lock';
    const trustedStorage = this.assertStorageDirectory();
    this.stored = trustedStorage ? this.readStored() : undefined;
    if (this.stored) config.rateLimit.overrides.shell_exec = { ...this.stored.rule };
  }

  /** Never trust a symlinked or group/world-writable operator state directory. */
  private assertStorageDirectory(forWrite = false): boolean {
    let directory;
    try { directory = lstatSync(dirname(this.path)); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
      throw error;
    }
    // An empty legacy project directory is harmless on read-only startup.
    // Loading a saved quota or writing to an unsafe directory is not.
    // existsSync follows symlinks and incorrectly treats a dangling symlink
    // as absent. lstat sees it so an unsafe state directory cannot be skipped.
    let hasRecord = false;
    try { lstatSync(this.path); hasRecord = true; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (!directory.isDirectory() || directory.isSymbolicLink()) {
      return failure('corrupt_quota', 'Invalid or symlinked operator-owned quota directory.');
    }
    const unsafePermissions = process.platform !== 'win32' && (directory.mode & 0o022) !== 0;
    if (unsafePermissions && (forWrite || hasRecord)) {
      return failure('corrupt_quota', 'Invalid operator-owned quota directory permissions.');
    }
    // If a shared directory had no record at inspection time, never race
    // another writer to load a newly inserted one during startup.
    return !unsafePermissions;
  }

  private readStored(): PersistedRule | undefined {
    let st;
    try { st = lstatSync(this.path); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
    if (!st.isFile() || st.isSymbolicLink() ||
        (process.platform !== 'win32' && (st.mode & 0o077) !== 0) ||
        st.size > 32_768) {
      return failure('corrupt_quota', 'Invalid quota storage file or symlink/permissions.');
    }
    const fd = openSync(this.path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    let data: string;
    try {
      const opened = fstatSync(fd);
      if (!opened.isFile() || opened.dev !== st.dev || opened.ino !== st.ino) {
        return failure('corrupt_quota', 'Invalid quota storage identity.');
      }
      data = readFileSync(fd, 'utf8');
    } finally { closeSync(fd); }
    let parsed: unknown;
    try { parsed = JSON.parse(data); }
    catch { return failure('corrupt_quota', 'Invalid quota record JSON.'); }
    if (!isRecord(parsed) || !exactKeys(parsed, STORED_KEYS) ||
        parsed.schemaVersion !== 1 ||
        typeof parsed.revision !== 'string' || !/^[0-9a-f-]{36}$/.test(parsed.revision) ||
        !validRule(parsed.rule) ||
        typeof parsed.updatedAt !== 'string' || !Number.isFinite(Date.parse(parsed.updatedAt)) ||
        typeof parsed.updatedBy !== 'string' || !parsed.updatedBy.trim() ||
        typeof parsed.integritySha256 !== 'string') {
      return failure('corrupt_quota', 'Invalid quota record schema.');
    }
    const dataToHash = {
      schemaVersion: 1 as const,
      revision: parsed.revision,
      rule: parsed.rule,
      updatedAt: parsed.updatedAt,
      updatedBy: parsed.updatedBy,
    };
    if (checksum(dataToHash) !== parsed.integritySha256) {
      return failure('corrupt_quota', 'Quota record integrity validation failed.');
    }
    return parsed as unknown as PersistedRule;
  }

  get revision(): string { return this.stored?.revision ?? 'initial'; }

  describe(limiter?: RateLimiter): RateLimitSettingsView {
    const rule = limiter?.ruleFor('shell_exec') ??
      this.config.rateLimit.overrides.shell_exec ?? this.config.rateLimit.default;
    const usage = limiter?.check('shell_exec') ?? { windowCount: 0, dailyCount: 0 };
    return {
      scope: 'parent', tool: 'shell_exec', revision: this.revision,
      source: this.stored ? 'operator' : 'startup',
      effective: {
        maxCalls: rule.maxCalls,
        windowMs: rule.windowMs,
        ...(rule.dailyQuota !== undefined ? { dailyQuota: rule.dailyQuota } : {}),
      },
      enabled: this.config.rateLimit.enabled,
      usage: { windowCount: usage.windowCount, dailyCount: usage.dailyCount },
      usageScope: 'current-process',
    };
  }

  validate(input: unknown): { expectedRevision: string; effective: Rule } {
    if (!isRecord(input) || !exactKeys(input, REQUEST_KEYS) ||
        input.scope !== 'parent' || input.key !== 'rateLimit.overrides.shell_exec' ||
        typeof input.expectedRevision !== 'string' || !validRule(input.value)) {
      return failure('invalid_quota', 'Only bounded parent shell_exec quota fields are supported.');
    }
    if (!this.config.rateLimit.enabled) {
      return failure('rate_limit_disabled', 'Rate limiting is disabled in this process.');
    }
    if (input.expectedRevision !== this.revision) {
      return failure('stale_revision', 'Stale quota revision; reload the current values.');
    }
    return { expectedRevision: input.expectedRevision, effective: { ...input.value } };
  }

  apply(input: unknown, actor: string, limiter?: RateLimiter): RateLimitSettingsView {
    if (!actor || !actor.trim() || actor.length > 200) {
      return failure('invalid_quota', 'An authenticated quota-change actor is required.');
    }
    const validated = this.validate(input);
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    this.assertStorageDirectory(true);
    let lockFd: number;
    try {
      lockFd = openSync(this.lockPath,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0),
        0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        return failure('quota_locked', 'Quota settings are locked by another writer.');
      }
      throw error;
    }
    const ownedLock = fstatSync(lockFd);
    let temp: string | undefined;
    let result: RateLimitSettingsView | undefined;
    let failureCause: unknown;
    try {
      writeFileSync(lockFd, String(process.pid));
      fsyncSync(lockFd);
      const persisted = this.readStored();
      if ((persisted?.revision ?? 'initial') !== validated.expectedRevision ||
          (persisted?.integritySha256 ?? '') !== (this.stored?.integritySha256 ?? '')) {
        return failure('stale_revision', 'Stale quota revision from another process.');
      }
      const payload = {
        schemaVersion: 1 as const, revision: randomUUID(), rule: validated.effective,
        updatedAt: new Date().toISOString(), updatedBy: actor.trim(),
      };
      const next: PersistedRule = { ...payload, integritySha256: checksum(payload) };
      temp = this.path + '.' + randomUUID() + '.tmp';
      const fd = openSync(temp,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0),
        0o600);
      try {
        writeFileSync(fd, JSON.stringify(next, null, 2) + '\n');
        fsyncSync(fd);
      } finally { closeSync(fd); }
      // Refuse replacing a symlink or an externally modified record, even
      // while the cooperative lock is held.
      const check = this.readStored();
      if ((check?.integritySha256 ?? '') !== (persisted?.integritySha256 ?? '')) {
        return failure('stale_revision', 'Quota record changed before durable write.');
      }
      renameSync(temp, this.path);
      temp = undefined;
      // The atomic rename has now changed the visible on-disk record. Swap
      // live limits immediately so fsync failure cannot leave disk and this
      // process enforcing different quotas. Existing hit buckets stay intact.
      this.stored = next;
      this.config.rateLimit.overrides.shell_exec = { ...next.rule };
      result = this.describe(limiter);
      // POSIX: flush the new directory entry. A failure here is NOT a
      // rollback: power-loss durability is uncertain even though the new
      // record is visible now. Distinguish it from pre-rename failure.
      if (process.platform !== 'win32') {
        try {
          if (this.storage.syncDirectory) {
            this.storage.syncDirectory(dirname(this.path));
          } else {
            const dirFd = openSync(dirname(this.path), constants.O_RDONLY);
            try { fsyncSync(dirFd); } finally { closeSync(dirFd); }
          }
        } catch {
          failure('commit_uncertain',
            'Quota file was replaced and live limits updated, but disk durability is uncertain; reload before retrying.');
        }
      }
    } catch (error) {
      failureCause = error;
    } finally {
      try {
        if (temp && existsSync(temp)) unlinkSync(temp);
        closeSync(lockFd);
        const current = lstatSync(this.lockPath);
        if (current.dev !== ownedLock.dev || current.ino !== ownedLock.ino) {
          // Never remove a lock that another writer may own.
          failureCause = new RateLimitSettingsError(
            'quota_locked', 'Quota lock identity changed during apply.',
          );
        } else {
          unlinkSync(this.lockPath);
        }
      } catch (error) {
        failureCause ??= error;
      }
    }
    if (failureCause) throw failureCause;
    return result!;
  }
}
