import { createHash, randomUUID } from "node:crypto";
import {
  copyFileSync,
  closeSync,
  fsyncSync,
  openSync,
  unlinkSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import {
  canonicalCandidatePath,
  isPathWithin,
  samePath,
} from "../core/path-identity.js";
import {
  inspectWorktreeHealth,
  IsolationHealthError,
  type IsolationHealthObservation,
} from "./worktree-health.js";

export type IsolationState =
  "active" | "applying" | "applied" | "rolled_back" | "discarded";

export interface AppliedUntrackedFile {
  path: string;
  sha256: string;
}

export interface WorktreeIsolation {
  id: string;
  taskId: string;
  sourceRoot: string;
  worktreeRoot: string;
  branch: string;
  baseCommit: string;
  sourceHead: string;
  sourceFingerprint: string;
  sourceDirty: boolean;
  createdAt: string;
  state: IsolationState;
  appliedAt?: string;
  appliedSourceFingerprint?: string;
  appliedTracked?: string[];
  appliedUntracked?: AppliedUntrackedFile[];
  rollbackPatchSha256?: string;
  rolledBackAt?: string;
  discardedAt?: string;
}

export interface WorkingTreeStatus {
  headCommit: string;
  clean: boolean;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  conflicts: string[];
}

export interface ObservedIsolation
  extends WorktreeIsolation, IsolationHealthObservation {}

export interface WorktreeStatus {
  isolation: WorktreeIsolation;
  /** Legacy task/source delta against comparison.baseCommit, NOT HEAD dirtiness. */
  clean: boolean;
  changed: string[];
  untracked: string[];
  conflicts: string[];
  comparison: { target: "worktree" | "source"; baseCommit: string };
  /** Observational only; never a replacement for mutation-time revalidation. */
  workingTree: WorkingTreeStatus;
}

export interface WorktreeManagerHooks {
  /**
   * Externally ENFORCED writer-epoch fence. The trusted host coordinator must
   * retire/block every pre-CAS writer for this registry, including after the
   * callback returns. An advisory .lock, process scan, or user acknowledgement
   * does NOT satisfy this contract. No production coordinator is wired yet:
   * metadata reconciliation therefore fails closed by default.
   *
   * Disposable single-writer tests may supply an explicitly scoped stub.
   */
  withLegacyWritersFenced?: <T>(registryPath: string, action: () => T) => T;
  /** Test/fault-injection hook invoked immediately before an untracked copy. */
  beforeUntrackedCopy?: (entry: { source: string; target: string }) => void;
  /** Test-only interleaving point; health is checked after this hook. */
  beforeFinalMutationCheck?: (isolation: WorktreeIsolation) => void;
  /** Test-only interleaving point after worktree removal, before branch deletion. */
  beforeBranchDelete?: (isolation: WorktreeIsolation) => void;
  /** Test-only interleaving immediately before rollback mutates the source. */
  beforeRollbackMutation?: (isolation: WorktreeIsolation) => void;
  /** Test-only removal race after a prior untracked source file is removed. */
  beforeRollbackUntrackedRemove?: (entry: AppliedUntrackedFile, index: number) => void;
}

interface PersistedState {
  version: 1;
  isolations: WorktreeIsolation[];
  digest: string;
}

const TASK_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const MAX_UNTRACKED_FILES = 100;
const MAX_UNTRACKED_BYTES = 10 * 1024 * 1024;

function git(cwd: string, args: string[], input?: string): string {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    input,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.status !== 0) {
    const message = (
      result.stderr ||
      result.stdout ||
      `git exited ${result.status}`
    ).trim();
    throw new Error(`Git command failed (${args.join(" ")}): ${message}`);
  }
  return result.stdout;
}

function canonicalRoot(path: string): string {
  return canonicalCandidatePath(path);
}

function cloneIsolation(value: WorktreeIsolation): WorktreeIsolation {
  return structuredClone(value);
}

function splitNul(value: string): string[] {
  return value.split("\0").filter(Boolean);
}

/** Read-only diagnostic snapshot; separate index and worktree deltas cannot cancel. */
function workingTreeStatus(root: string): WorkingTreeStatus {
  const read = (args: string[]): string =>
    git(root, ["--no-optional-locks", ...args]);
  const headCommit = read(["rev-parse", "HEAD"]).trim();
  const diffArgs = [
    "diff",
    "--no-ext-diff",
    "--no-textconv",
    "--ignore-submodules=none",
  ];
  const staged = splitNul(
    read([...diffArgs, "--cached", "--name-only", "-z", headCommit, "--"]),
  );
  const unstaged = splitNul(read([...diffArgs, "--name-only", "-z", "--"]));
  const untracked = splitNul(
    read(["ls-files", "--others", "--exclude-standard", "-z"]),
  );
  const conflicts = splitNul(
    read([...diffArgs, "--name-only", "--diff-filter=U", "-z", "--"]),
  );
  return {
    headCommit,
    clean:
      staged.length === 0 &&
      unstaged.length === 0 &&
      untracked.length === 0 &&
      conflicts.length === 0,
    staged,
    unstaged,
    untracked,
    conflicts,
  };
}

function isolationDigest(isolations: WorktreeIsolation[]): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(isolations)).digest("hex")}`;
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function samePaths(left: string[], right: string[]): boolean {
  return [...left].sort().join("\0") === [...right].sort().join("\0");
}

function sourceSnapshot(root: string): {
  head: string;
  status: string;
  fingerprint: string;
  dirty: boolean;
} {
  const head = git(root, ["rev-parse", "HEAD"]).trim();
  const status = git(root, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
  ]);
  const digest = createHash("sha256").update(head).update("\0").update(status);
  if (status.length > 0) {
    digest
      .update("\0tracked\0")
      .update(git(root, ["diff", "--binary", "--full-index", "HEAD", "--"]));
    const untracked = splitNul(
      git(root, ["ls-files", "--others", "--exclude-standard", "-z"]),
    );
    for (const path of untracked.sort()) {
      const target = resolve(root, assertRelativePath(path));
      digest.update("\0untracked\0").update(path).update("\0");
      if (!existsSync(target)) {
        digest.update("missing");
        continue;
      }
      const stats = lstatSync(target);
      if (!stats.isFile() || stats.isSymbolicLink()) {
        digest.update(`unsafe:${stats.mode}:${stats.size}`);
        continue;
      }
      digest.update(readFileSync(target));
    }
  }
  return {
    head,
    status,
    fingerprint: digest.digest("hex"),
    dirty: status.length > 0,
  };
}

function assertRelativePath(value: string): string {
  if (!value || isAbsolute(value))
    throw new Error(`Unsafe worktree path: ${value}`);
  const normalized = value.split("/").join(sep);
  if (normalized === ".." || normalized.startsWith(`..${sep}`)) {
    throw new Error(`Worktree path escapes its root: ${value}`);
  }
  return normalized;
}

export class WorktreeManager {
  private readonly isolations = new Map<string, WorktreeIsolation>();
  private readonly statePath: string;
  private readonly worktreesRoot: string;
  private readonly rollbacksRoot: string;
  private readonly projectRoot: string;
  private loadedRegistrySha256: string | null = null;
  readonly available: boolean;
  readonly unavailableReason?: string;

  constructor(
    private readonly allowedDirectories: string[],
    projectRoot: string,
    private readonly hooks: WorktreeManagerHooks = {},
  ) {
    this.projectRoot = canonicalRoot(projectRoot);
    this.assertAllowed(this.projectRoot);
    let topLevel: string;
    let commonDir: string;
    try {
      topLevel = canonicalRoot(
        git(this.projectRoot, ["rev-parse", "--show-toplevel"]).trim(),
      );
      const commonDirRaw = git(this.projectRoot, [
        "rev-parse",
        "--git-common-dir",
      ]).trim();
      commonDir = canonicalRoot(
        isAbsolute(commonDirRaw)
          ? commonDirRaw
          : resolve(this.projectRoot, commonDirRaw),
      );
    } catch (error) {
      this.available = false;
      this.unavailableReason =
        error instanceof Error ? error.message : String(error);
      this.statePath = resolve(
        this.projectRoot,
        ".folderforge",
        "isolations-unavailable.json",
      );
      this.worktreesRoot = resolve(
        this.projectRoot,
        ".folderforge",
        "worktrees",
      );
      this.rollbacksRoot = resolve(
        this.projectRoot,
        ".folderforge",
        "rollbacks",
      );
      return;
    }
    if (!samePath(topLevel, this.projectRoot)) {
      this.available = false;
      this.unavailableReason = `Worktree isolation requires the activated workspace to be a Git repository root (repo root: ${topLevel}).`;
      this.statePath = resolve(
        this.projectRoot,
        ".folderforge",
        "isolations-unavailable.json",
      );
      this.worktreesRoot = resolve(
        this.projectRoot,
        ".folderforge",
        "worktrees",
      );
      this.rollbacksRoot = resolve(
        this.projectRoot,
        ".folderforge",
        "rollbacks",
      );
      return;
    }
    // Linked worktrees share the Git common dir, but their isolation state must
    // remain source-repository specific. Otherwise a worktree would load the
    // primary repository's isolation records and fail closed as a foreign repo.
    const commonRepoRoot = canonicalRoot(dirname(commonDir));
    const linkedWorktree = !samePath(commonRepoRoot, this.projectRoot);
    this.statePath = linkedWorktree
      ? resolve(this.projectRoot, ".folderforge", "isolations.json")
      : resolve(commonDir, "folderforge", "isolations.json");
    this.worktreesRoot = resolve(commonDir, "folderforge", "worktrees");
    this.rollbacksRoot = resolve(commonDir, "folderforge", "rollbacks");
    if (linkedWorktree) this.assertInside(this.statePath, this.projectRoot);
    else this.assertInside(this.statePath, commonDir);
    this.assertInside(this.worktreesRoot, commonDir);
    this.assertInside(this.rollbacksRoot, commonDir);
    this.available = true;
    this.load();
  }

  create(taskId: string, baseRef = "HEAD"): WorktreeIsolation {
    this.requireAvailable();
    // Acquire the cooperative lock BEFORE creating a Git ref/worktree.
    // Without this, a stale manager can create an orphan worktree before
    // persist() notices its stale registry lease.
    return this.withRegistryLock(() => {
      this.assertLoadedRegistryCurrent();
      if (!TASK_ID.test(taskId)) {
        throw new Error("taskId must match [A-Za-z0-9][A-Za-z0-9._-]{0,63}.");
      }
      if (
        [...this.isolations.values()].some(
          (item) => item.taskId === taskId && item.state !== "discarded",
        )
      ) {
        throw new Error(
          `An active isolation already exists for taskId=${taskId}.`,
        );
      }
      const snapshot = sourceSnapshot(this.projectRoot);
      const baseCommit = git(this.projectRoot, [
        "rev-parse",
        "--verify",
        `${baseRef}^{commit}`,
      ]).trim();
      const id = `iso_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
      const suffix = id.slice(-8);
      const branch = `folderforge/task/${taskId}-${suffix}`;
      const worktreeRoot = resolve(this.worktreesRoot, id);
      mkdirSync(dirname(worktreeRoot), { recursive: true, mode: 0o700 });
      this.assertInside(worktreeRoot, this.worktreesRoot);
      git(this.projectRoot, [
        "worktree",
        "add",
        "-b",
        branch,
        worktreeRoot,
        baseCommit,
      ]);

      const isolation: WorktreeIsolation = {
        id,
        taskId,
        sourceRoot: this.projectRoot,
        worktreeRoot,
        branch,
        baseCommit,
        sourceHead: snapshot.head,
        sourceFingerprint: snapshot.fingerprint,
        sourceDirty: snapshot.dirty,
        createdAt: new Date().toISOString(),
        state: "active",
      };
      this.isolations.set(id, isolation);
      this.persistUnderLock();
      return cloneIsolation(isolation);
    });
  }

  list(): WorktreeIsolation[] {
    return [...this.isolations.values()]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(cloneIsolation);
  }

  inspect(id: string): IsolationHealthObservation {
    const isolation = this.requireExisting(id);
    return inspectWorktreeHealth(isolation);
  }

  listObserved(): ObservedIsolation[] {
    return this.list().map((isolation) => ({
      ...isolation,
      ...this.inspect(isolation.id),
    }));
  }

  get(id: string): WorktreeIsolation | undefined {
    const value = this.isolations.get(id);
    return value ? cloneIsolation(value) : undefined;
  }

  isManagedRoot(root: string): boolean {
    const target = canonicalRoot(root);
    return [...this.isolations.values()].some(
      (item) =>
        item.state !== "discarded" &&
        samePath(canonicalRoot(item.worktreeRoot), target),
    );
  }

  managedRootForPath(path: string): string | undefined {
    const target = canonicalRoot(path);
    return [...this.isolations.values()]
      .filter((item) => item.state !== "discarded")
      .map((item) => canonicalRoot(item.worktreeRoot))
      .sort((left, right) => right.length - left.length)
      .find((root) => isPathWithin(root, target));
  }

  status(id: string): WorktreeStatus {
    const isolation = this.requireExisting(id);
    this.assertWorktreePresent(isolation);
    const changed = splitNul(
      git(isolation.worktreeRoot, [
        "diff",
        "--name-only",
        "-z",
        isolation.baseCommit,
        "--",
      ]),
    );
    const untracked = splitNul(
      git(isolation.worktreeRoot, [
        "ls-files",
        "--others",
        "--exclude-standard",
        "-z",
      ]),
    );
    const conflicts = splitNul(
      git(isolation.worktreeRoot, [
        "diff",
        "--name-only",
        "--diff-filter=U",
        "-z",
      ]),
    );
    return {
      isolation: cloneIsolation(isolation),
      clean:
        changed.length === 0 &&
        untracked.length === 0 &&
        conflicts.length === 0,
      changed,
      untracked,
      conflicts,
      comparison: { target: "worktree", baseCommit: isolation.baseCommit },
      workingTree: workingTreeStatus(isolation.worktreeRoot),
    };
  }

  diff(id: string): {
    isolation: WorktreeIsolation;
    diff: string;
    untracked: string[];
  } {
    const status = this.status(id);
    const patch = git(status.isolation.worktreeRoot, [
      "diff",
      "--binary",
      "--full-index",
      status.isolation.baseCommit,
      "--",
    ]);
    return {
      isolation: status.isolation,
      diff: patch,
      untracked: status.untracked,
    };
  }

  apply(id: string): WorktreeStatus {
    const isolation = this.requireState(id, "active");
    if (isolation.sourceDirty) {
      throw new Error(
        "Cannot apply isolation onto a source workspace that was dirty at creation.",
      );
    }
    const current = sourceSnapshot(isolation.sourceRoot);
    if (current.fingerprint !== isolation.sourceFingerprint) {
      throw new Error(
        "Source workspace changed after isolation creation; refusing to overwrite user work.",
      );
    }
    const status = this.status(id);
    if (status.conflicts.length > 0) {
      throw new Error(
        `Isolation contains unresolved conflicts: ${status.conflicts.join(", ")}`,
      );
    }
    this.preflightTracked(isolation, status.changed);
    const patch = git(isolation.worktreeRoot, [
      "diff",
      "--binary",
      "--full-index",
      isolation.baseCommit,
      "--",
    ]);
    const untracked = this.preflightUntracked(isolation, status.untracked);
    this.hooks.beforeFinalMutationCheck?.(cloneIsolation(isolation));
    this.assertWorktreePresent(isolation);
    if (patch)
      git(isolation.sourceRoot, ["apply", "--check", "--binary", "-"], patch);

    const patchPath = this.rollbackPatchPath(isolation.id);
    mkdirSync(dirname(patchPath), { recursive: true, mode: 0o700 });
    const patchTemp = `${patchPath}.${process.pid}.${randomUUID()}.tmp`;
    writeFileSync(patchTemp, patch, { mode: 0o600 });
    renameSync(patchTemp, patchPath);
    isolation.state = "applying";
    isolation.appliedTracked = [...status.changed];
    isolation.appliedUntracked = untracked.map((entry) => ({
      path: relative(isolation.sourceRoot, entry.target).split(sep).join("/"),
      sha256: sha256(readFileSync(entry.source)),
    }));
    isolation.rollbackPatchSha256 = sha256(patch);
    delete isolation.appliedAt;
    delete isolation.appliedSourceFingerprint;
    delete isolation.rolledBackAt;
    this.persist();

    const copied: string[] = [];
    let patchApplied = false;
    try {
      // The journal was persisted after the earlier preflight. Recheck at
      // the actual source mutation boundary; an uncertain outcome remains
      // visible if this check cannot be completed.
      this.assertWorktreePresent(isolation);
      if (sourceSnapshot(isolation.sourceRoot).fingerprint !== isolation.sourceFingerprint) {
        throw new Error("Source workspace changed after isolation creation; refusing to overwrite user work.");
      }
      if (patch) {
        git(isolation.sourceRoot, ["apply", "--binary", "-"], patch);
        patchApplied = true;
      }
      for (const entry of untracked) {
        this.hooks.beforeUntrackedCopy?.(entry);
        this.assertWorktreePresent(isolation);
        const source = this.validatedInside(
          entry.source,
          isolation.worktreeRoot,
        );
        let target = this.validatedInside(entry.target, isolation.sourceRoot);
        mkdirSync(dirname(target), { recursive: true });
        target = this.validatedInside(entry.target, isolation.sourceRoot);
        copyFileSync(source, target);
        copied.push(target);
      }
      isolation.state = "applied";
      isolation.appliedAt = new Date().toISOString();
      isolation.appliedSourceFingerprint = sourceSnapshot(
        isolation.sourceRoot,
      ).fingerprint;
      this.persist();
      return this.statusSource(isolation);
    } catch (error) {
      let rollbackError: unknown;
      try {
        for (const target of copied.reverse()) {
          rmSync(this.validatedInside(target, isolation.sourceRoot), {
            force: true,
          });
        }
        if (patchApplied)
          git(
            isolation.sourceRoot,
            ["apply", "--reverse", "--binary", "-"],
            patch,
          );
        isolation.state = "active";
        delete isolation.appliedTracked;
        delete isolation.appliedUntracked;
        delete isolation.rollbackPatchSha256;
        rmSync(patchPath, { force: true });
        this.persist();
      } catch (rollbackFailure) {
        rollbackError = rollbackFailure;
        this.persist();
      }
      if (rollbackError) {
        throw new Error(
          `Apply failed and automatic rollback also failed: ${error instanceof Error ? error.message : String(error)}; rollback=${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
        );
      }
      throw error;
    }
  }

  rollback(id: string): WorktreeStatus {
    const isolation = this.requireExisting(id);
    if (isolation.state !== "applied" && isolation.state !== "applying") {
      throw new Error(
        `Isolation rollback requires applied or applying state; current=${isolation.state}.`,
      );
    }
    this.hooks.beforeFinalMutationCheck?.(cloneIsolation(isolation));
    this.assertWorktreePresent(isolation);
    const patchPath = this.rollbackPatchPath(isolation.id);
    if (!existsSync(patchPath))
      throw new Error("Isolation rollback patch is missing.");
    const patch = readFileSync(patchPath, "utf8");
    if (sha256(patch) !== isolation.rollbackPatchSha256) {
      throw new Error("Isolation rollback patch integrity check failed.");
    }
    const current = sourceSnapshot(isolation.sourceRoot);
    if (current.fingerprint === isolation.sourceFingerprint) {
      // Git's source fingerprint omits ignored files. A crashed 'applying'
      // operation may have copied an artifact that later became ignored;
      // never certify recovery while any journaled source artifact exists.
      for (const entry of isolation.appliedUntracked ?? []) {
        const target = this.validatedInside(
          resolve(isolation.sourceRoot, assertRelativePath(entry.path)),
          isolation.sourceRoot,
        );
        try {
          lstatSync(target);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
          throw error;
        }
        throw new Error(
          `Rollback recovery uncertain: source artifact remains: ${entry.path}`,
        );
      }
      isolation.state = "rolled_back";
      isolation.rolledBackAt = new Date().toISOString();
      delete isolation.appliedSourceFingerprint;
      this.persist();
      return this.statusSource(isolation);
    }
    if (
      isolation.state === "applied" &&
      current.fingerprint !== isolation.appliedSourceFingerprint
    ) {
      throw new Error(
        "Source workspace changed after isolation apply; refusing rollback over user work.",
      );
    }
    const expectedTracked = isolation.appliedTracked ?? [];
    const expectedUntracked = isolation.appliedUntracked ?? [];
    const actualTracked = splitNul(
      git(isolation.sourceRoot, [
        "diff",
        "--name-only",
        "-z",
        isolation.sourceHead,
        "--",
      ]),
    );
    const actualUntracked = splitNul(
      git(isolation.sourceRoot, [
        "ls-files",
        "--others",
        "--exclude-standard",
        "-z",
      ]),
    );
    if (
      !samePaths(actualTracked, expectedTracked) ||
      !samePaths(
        actualUntracked,
        expectedUntracked.map((item) => item.path),
      )
    ) {
      throw new Error(
        "Source workspace does not exactly match the recorded applied change set.",
      );
    }
    // Preserve bounded verified source bytes before the first rollback deletion.
    // A task worktree might disappear while later files are being removed.
    const sourceBackups = new Map<string, { bytes: Buffer; mode: number }>();
    let totalBackupBytes = 0;
    for (const entry of expectedUntracked) {
      const target = resolve(
        isolation.sourceRoot,
        assertRelativePath(entry.path),
      );
      this.assertInside(target, isolation.sourceRoot);
      if (
        !existsSync(target) ||
        !lstatSync(target).isFile() ||
        lstatSync(target).isSymbolicLink()
      ) {
        throw new Error(
          `Applied untracked file is missing or unsafe: ${entry.path}`,
        );
      }
      const bytes = readFileSync(target);
      if (sha256(bytes) !== entry.sha256) {
        throw new Error(
          `Applied untracked file changed after apply: ${entry.path}`,
        );
      }
      totalBackupBytes += bytes.length;
      if (totalBackupBytes > MAX_UNTRACKED_BYTES) {
        throw new Error("Rollback untracked file backup exceeds allowed limit.");
      }
      sourceBackups.set(entry.path, { bytes, mode: lstatSync(target).mode & 0o777 });
    }
    if (patch)
      git(
        isolation.sourceRoot,
        ["apply", "--reverse", "--check", "--binary", "-"],
        patch,
      );

    this.hooks.beforeRollbackMutation?.(cloneIsolation(isolation));
    this.assertWorktreePresent(isolation);
    const removed: AppliedUntrackedFile[] = [];
    try {
      for (const [index, entry] of expectedUntracked.entries()) {
        this.hooks.beforeRollbackUntrackedRemove?.(entry, index);
        this.assertWorktreePresent(isolation);
        const target = this.validatedInside(
          resolve(isolation.sourceRoot, assertRelativePath(entry.path)),
          isolation.sourceRoot,
        );
        rmSync(target);
        removed.push(entry);
      }
      if (patch) {
        this.assertWorktreePresent(isolation);
        git(
          isolation.sourceRoot,
          ["apply", "--reverse", "--binary", "-"],
          patch,
        );
      }
    } catch (error) {
      try {
        // Never recreate a vanished repository or restore into a different
        // checkout. External deletion cannot be made atomically recoverable.
        if (!existsSync(isolation.sourceRoot) ||
            !lstatSync(isolation.sourceRoot).isDirectory() ||
            git(isolation.sourceRoot, ["rev-parse", "--verify", "HEAD"]).trim() !== isolation.sourceHead) {
          throw new Error("Original source repository is unavailable or changed.");
        }
        for (const entry of removed) {
          const backup = sourceBackups.get(entry.path);
        if (!backup) throw new Error("Rollback recovery bytes unavailable.");
        let target = this.validatedInside(
          resolve(isolation.sourceRoot, assertRelativePath(entry.path)),
          isolation.sourceRoot,
        );
        mkdirSync(dirname(target), { recursive: true });
        target = this.validatedInside(target, isolation.sourceRoot);
          // Exclusive create: never overwrite a concurrent user's replacement.
          writeFileSync(target, backup.bytes, { flag: "wx", mode: backup.mode });
        }
      } catch (recoveryError) {
        throw new Error(
          "ROLLBACK_RECOVERY_INCOMPLETE: source files may be missing; manual recovery is required. " +
          (recoveryError instanceof Error ? recoveryError.message : String(recoveryError)),
        );
      }
      throw error;
    }
    isolation.state = "rolled_back";
    isolation.rolledBackAt = new Date().toISOString();
    delete isolation.appliedSourceFingerprint;
    this.persist();
    return this.statusSource(isolation);
  }

  /** Metadata-only reconciliation: never delete Git refs, worktrees, or source bytes. */
  reconcileMissing(id: string, options: {
    expectedSha256: string; dryRun?: boolean; acknowledgeUnrecoverableWorktreeBytes?: boolean;
  }): {
    status: "DRY_RUN" | "RECONCILED"; observedHealth: "missing_worktree";
    branchRef: "absent"; beforeSha256: string; afterSha256?: string; backupPath?: string;
  } {
    this.requireAvailable();
    if (!/^[a-f0-9]{64}$/.test(options.expectedSha256))
      throw new Error("Invalid expected registry SHA-256 lease.");
    // A legacy binary can rename over the registry while ignoring .lock/CAS.
    // Do not make irreversible metadata changes unless an external coordinator
    // enforces a durable writer epoch across all legacy processes.
    const withFence = options.dryRun === false
      ? (action: () => ReturnType<WorktreeManager["reconcileMissing"]>) => this.withLegacyWriterFence(action)
      : (action: () => ReturnType<WorktreeManager["reconcileMissing"]>) => action();
    return withFence(() => this.withRegistryLock(() => {
      const original = this.readRegistryBytes();
      const beforeSha256 = sha256(original);
      if (beforeSha256 !== options.expectedSha256)
        throw new Error("Registry digest lease changed.");
      if (this.loadedRegistrySha256 !== beforeSha256)
        throw new Error("Stale manager registry state.");
      const record = this.requireState(id, "active");
      const health = inspectWorktreeHealth(record);
      if (health.observedHealth !== "missing_worktree" || health.branchRef !== "absent")
        throw new Error("Missing worktree identity/health precondition failed.");
      git(record.sourceRoot, ["cat-file", "-e", record.baseCommit + "^{commit}"]);
      git(record.sourceRoot, ["cat-file", "-e", record.sourceHead + "^{commit}"]);
      git(record.sourceRoot, ["merge-base", "--is-ancestor", record.sourceHead, "HEAD"]);
      const preview = {
        status: "DRY_RUN" as "DRY_RUN" | "RECONCILED",
        observedHealth: "missing_worktree" as const,
        branchRef: "absent" as const, beforeSha256,
      };
      if (options.dryRun !== false) return preview;
      if (!options.acknowledgeUnrecoverableWorktreeBytes)
        throw new Error("Explicit acknowledgement of unrecoverable worktree bytes required.");
      if (record.sourceDirty)
        throw new Error("sourceDirty record requires separate investigation.");
      this.hooks.beforeFinalMutationCheck?.(cloneIsolation(record));
      const healthAgain = inspectWorktreeHealth(record);
      if (healthAgain.observedHealth !== "missing_worktree" || healthAgain.branchRef !== "absent")
        throw new Error("Missing worktree identity changed before commit.");
      if (sha256(this.readRegistryBytes()) !== beforeSha256)
        throw new Error("Registry digest lease changed before commit.");
      const replacement: WorktreeIsolation = {
        ...record, state: "discarded", discardedAt: new Date().toISOString(),
      };
      const isolations = this.list().map(entry => entry.id === id ? replacement : entry);
      const next: PersistedState = { version: 1, isolations, digest: isolationDigest(isolations) };
      const afterBytes = Buffer.from(JSON.stringify(next, null, 2) + "\n");
      const afterSha256 = sha256(afterBytes);
      const historyRoot = resolve(dirname(this.statePath), "reconciliations");
      this.assertInside(historyRoot, dirname(this.statePath));
      mkdirSync(historyRoot, { recursive: true, mode: 0o700 });
      // Unique create-once transaction preimage: a crash before registry commit
      // must not make a later, independently validated retry impossible.
      // Never replace or remove an earlier incomplete recovery artifact.
      const backupPath = resolve(historyRoot, id + "-" + beforeSha256 + "-" + randomUUID() + ".registry.json");
      this.writeDurableNewFile(backupPath, original);
      this.writeDurableNewFile(backupPath + ".audit.json", JSON.stringify({
        type: "METADATA_ONLY_MISSING_WORKTREE", id, beforeSha256, afterSha256,
        sourceHead: record.sourceHead, sourceDirty: record.sourceDirty,
        acknowledged: true, recordedAt: replacement.discardedAt,
      }, null, 2) + "\n");
      if (sha256(this.readRegistryBytes()) !== beforeSha256)
        throw new Error("Registry changed before atomic replacement.");
      this.atomicWriteRegistry(afterBytes);
      this.loadedRegistrySha256 = afterSha256;
      this.isolations.set(id, replacement);
      return { ...preview, status: "RECONCILED", afterSha256, backupPath };
    }));
  }

  restoreMissingReconciliation(id: string, options: {
    expectedSha256: string; backupPath: string;
  }): { status: "RESTORED"; sha256: string } {
    this.requireAvailable();
    return this.withLegacyWriterFence(() => this.withRegistryLock(() => {
      const current = this.readRegistryBytes();
      const hash = sha256(current);
      if (hash !== options.expectedSha256 || hash !== this.loadedRegistrySha256)
        throw new Error("Restore registry SHA-256 lease mismatch or stale manager.");
      const record = this.isolations.get(id);
      if (!record || record.state !== "discarded")
        throw new Error("Only discarded metadata record can be restored.");
      const root = resolve(dirname(this.statePath), "reconciliations");
      this.assertInside(root, dirname(this.statePath));
      const path = resolve(options.backupPath);
      if (!path.startsWith(root + sep) || !path.endsWith(".registry.json"))
        throw new Error("Backup path escapes reconciliation archive.");
      this.assertInside(path, root);
      this.assertInside(path + ".audit.json", root);
      const backupStat = lstatSync(path);
      const auditStat = lstatSync(path + ".audit.json");
      if (!backupStat.isFile() || backupStat.isSymbolicLink() ||
          !auditStat.isFile() || auditStat.isSymbolicLink())
        throw new Error("Reconciliation backup is unsafe.");
      const original = readFileSync(path);
      const audit = JSON.parse(readFileSync(path + ".audit.json", "utf8")) as {
        type: string; id: string; beforeSha256: string; afterSha256: string;
      };
      if (audit.type !== "METADATA_ONLY_MISSING_WORKTREE" ||
          audit.id !== id || audit.beforeSha256 !== sha256(original) ||
          audit.afterSha256 !== hash)
        throw new Error("Reconciliation audit integrity/lease mismatch.");
      const old = JSON.parse(original.toString("utf8")) as PersistedState;
      if (old.digest !== isolationDigest(old.isolations))
        throw new Error("Reconciliation backup state digest invalid.");
      const prior = old.isolations.find(entry => entry.id === id);
      if (!prior || prior.state !== "active") throw new Error("Invalid restoration target.");
      this.validatePersistedIsolation(prior);
      if (sha256(this.readRegistryBytes()) !== hash)
        throw new Error("Registry changed before restore.");
      this.atomicWriteRegistry(original);
      this.loadedRegistrySha256 = sha256(original);
      this.isolations.set(id, prior);
      return { status: "RESTORED", sha256: sha256(original) };
    }));
  }

  private withLegacyWriterFence<T>(action: () => T): T {
    const coordinator = this.hooks.withLegacyWritersFenced;
    if (!coordinator)
      throw new Error("Legacy writer fencing is not available; registry mutation blocked.");
    return coordinator(this.statePath, action);
  }

  private readRegistryBytes(): Buffer {
    const stat = lstatSync(this.statePath);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error("Isolation registry must be a regular non-symlink file.");
    return readFileSync(this.statePath);
  }

  private withRegistryLock<T>(action: () => T): T {
    mkdirSync(dirname(this.statePath), { recursive: true, mode: 0o700 });
    this.assertInside(this.statePath, dirname(this.statePath));
    const path = this.statePath + ".lock";
    const fd = openSync(path, "wx", 0o600);
    try { return action(); }
    finally { closeSync(fd); unlinkSync(path); }
  }

  private syncDirectory(path: string): void {
    if (process.platform === "win32") return;
    const dir = openSync(dirname(path), "r");
    try { fsyncSync(dir); }
    finally { closeSync(dir); }
  }

  private writeDurableNewFile(path: string, bytes: Buffer | string): void {
    const fd = openSync(path, "wx", 0o600);
    try { writeFileSync(fd, bytes); fsyncSync(fd); }
    finally { closeSync(fd); }
    this.syncDirectory(path);
  }

  private atomicWriteRegistry(bytes: Buffer): void {
    const temp = this.statePath + "." + process.pid + "." + randomUUID() + ".tmp";
    const fd = openSync(temp, "wx", 0o600);
    try { writeFileSync(fd, bytes); fsyncSync(fd); }
    finally { closeSync(fd); }
    renameSync(temp, this.statePath);
    this.syncDirectory(this.statePath);
  }

  discard(id: string): WorktreeIsolation {
    // A stale process must never remove the native worktree/ref and only then
    // discover its registry CAS failed. Hold the lock across the Git lifecycle.
    return this.withRegistryLock(() => {
      this.assertLoadedRegistryCurrent();
      const isolation = this.isolations.get(id);
      if (!isolation) throw new Error(`Isolation not found: ${id}`);
      if (isolation.state === "discarded") return cloneIsolation(isolation);
      if (isolation.state === "applied" || isolation.state === "applying") {
        throw new Error(
          "Rollback applied isolation changes before discarding the recovery worktree.",
        );
      }
      // A missing or foreign worktree does not mean its branch is disposable.
      this.hooks.beforeFinalMutationCheck?.(cloneIsolation(isolation));
      this.assertWorktreePresent(isolation);
      const taskRef = `refs/heads/${isolation.branch}`;
      const priorTaskHead = git(isolation.sourceRoot, ["rev-parse", "--verify", taskRef]).trim();
      const observedWorktreeHead = git(isolation.worktreeRoot, ["rev-parse", "--verify", "HEAD"]).trim();
      if (observedWorktreeHead !== priorTaskHead) {
        throw new IsolationHealthError("ISOLATION_IDENTITY_MISMATCH", "identity_mismatch");
      }
      git(isolation.sourceRoot, [
        "worktree",
        "remove",
        "--force",
        isolation.worktreeRoot,
      ]);
      const currentTaskHead = git(isolation.sourceRoot, ["rev-parse", "--verify", taskRef]).trim();
      if (currentTaskHead !== priorTaskHead) {
        throw new IsolationHealthError("ISOLATION_IDENTITY_MISMATCH", "identity_mismatch");
      }
      // Ref deletion is compare-and-swap: Git refuses to delete if another
      // actor replaced the task branch after our latest SHA observation.
      this.hooks.beforeBranchDelete?.(cloneIsolation(isolation));
      try {
        git(isolation.sourceRoot, ["update-ref", "-d", taskRef, priorTaskHead]);
      } catch {
        throw new IsolationHealthError("ISOLATION_IDENTITY_MISMATCH", "identity_mismatch");
      }
      rmSync(this.rollbackPatchPath(isolation.id), { force: true });
      isolation.state = "discarded";
      isolation.discardedAt = new Date().toISOString();
      this.persistUnderLock();
      return cloneIsolation(isolation);
    });
  }

  private statusSource(isolation: WorktreeIsolation): WorktreeStatus {
    const changed = splitNul(
      git(isolation.sourceRoot, [
        "diff",
        "--name-only",
        "-z",
        isolation.sourceHead,
        "--",
      ]),
    );
    const untracked = splitNul(
      git(isolation.sourceRoot, [
        "ls-files",
        "--others",
        "--exclude-standard",
        "-z",
      ]),
    );
    return {
      isolation: cloneIsolation(isolation),
      clean: changed.length === 0 && untracked.length === 0,
      changed,
      untracked,
      conflicts: [],
      comparison: { target: "source", baseCommit: isolation.sourceHead },
      workingTree: workingTreeStatus(isolation.sourceRoot),
    };
  }

  private preflightTracked(
    isolation: WorktreeIsolation,
    paths: string[],
  ): void {
    for (const path of paths) {
      const rel = assertRelativePath(path);
      const source = resolve(isolation.worktreeRoot, rel);
      this.assertInside(source, isolation.worktreeRoot);
      if (!existsSync(source)) continue; // deletion
      const stats = lstatSync(source);
      if (stats.isSymbolicLink() || !stats.isFile()) {
        throw new Error(
          `Tracked task output must be a regular file or deletion: ${path}`,
        );
      }
    }
  }

  private preflightUntracked(
    isolation: WorktreeIsolation,
    paths: string[],
  ): Array<{ source: string; target: string }> {
    if (paths.length > MAX_UNTRACKED_FILES) {
      throw new Error(
        `Isolation has ${paths.length} untracked files; limit is ${MAX_UNTRACKED_FILES}.`,
      );
    }
    let totalBytes = 0;
    return paths.map((path) => {
      const rel = assertRelativePath(path);
      const source = resolve(isolation.worktreeRoot, rel);
      const target = resolve(isolation.sourceRoot, rel);
      this.assertInside(source, isolation.worktreeRoot);
      this.assertInside(target, isolation.sourceRoot);
      const stats = lstatSync(source);
      if (!stats.isFile() || stats.isSymbolicLink()) {
        throw new Error(`Untracked entry must be a regular file: ${path}`);
      }
      totalBytes += statSync(source).size;
      if (totalBytes > MAX_UNTRACKED_BYTES) {
        throw new Error(
          `Untracked file payload exceeds ${MAX_UNTRACKED_BYTES} bytes.`,
        );
      }
      if (existsSync(target))
        throw new Error(`Untracked target already exists in source: ${path}`);
      return { source, target };
    });
  }

  private rollbackPatchPath(id: string): string {
    const path = resolve(this.rollbacksRoot, `${id}.patch`);
    this.assertInside(path, dirname(this.rollbacksRoot));
    return path;
  }

  describe(): {
    available: boolean;
    reason?: string;
    total: number;
    active: number;
  } {
    return {
      available: this.available,
      ...(this.unavailableReason ? { reason: this.unavailableReason } : {}),
      total: this.isolations.size,
      active: [...this.isolations.values()].filter(
        (item) => item.state !== "discarded",
      ).length,
    };
  }

  private requireAvailable(): void {
    if (!this.available) {
      throw new Error(
        this.unavailableReason ?? "Worktree isolation is unavailable.",
      );
    }
  }

  private requireExisting(id: string): WorktreeIsolation {
    this.requireAvailable();
    const isolation = this.isolations.get(id);
    if (!isolation) throw new Error(`Isolation not found: ${id}`);
    if (isolation.state === "discarded")
      throw new Error(`Isolation has been discarded: ${id}`);
    return isolation;
  }

  private requireState(id: string, state: IsolationState): WorktreeIsolation {
    const isolation = this.requireExisting(id);
    if (isolation.state !== state) {
      throw new Error(
        `Isolation ${id} requires state=${state}; current=${isolation.state}.`,
      );
    }
    return isolation;
  }

  private assertWorktreePresent(isolation: WorktreeIsolation): void {
    const health = inspectWorktreeHealth(isolation);
    if (health.observedHealth !== "present_consistent") {
      throw new IsolationHealthError(
        health.diagnosticCode ?? "ISOLATION_HEALTH_UNVERIFIABLE",
        health.observedHealth,
      );
    }
  }

  private assertAllowed(path: string): void {
    const target = canonicalRoot(path);
    const allowed = this.allowedDirectories.some((directory) => {
      const root = canonicalRoot(directory);
      return target === root || target.startsWith(`${root}${sep}`);
    });
    if (!allowed)
      throw new Error(`Isolation path is outside allowed directories: ${path}`);
  }

  private assertInsideProject(path: string): void {
    this.assertInside(path, this.projectRoot);
  }

  private assertInside(path: string, root: string): void {
    this.validatedInside(path, root);
  }

  private validatedInside(path: string, root: string): string {
    const canonical = canonicalRoot(root);
    const resolved = resolve(path);
    const lexical = relative(canonical, resolved);
    if (lexical.startsWith("..") || isAbsolute(lexical)) {
      throw new Error(`Isolation path escapes managed root: ${path}`);
    }

    let existing = resolved;
    while (!existsSync(existing)) {
      const parent = dirname(existing);
      if (parent === existing) break;
      existing = parent;
    }
    const canonicalExisting = realpathSync.native(existing);
    const canonicalRelative = relative(canonical, canonicalExisting);
    if (canonicalRelative.startsWith("..") || isAbsolute(canonicalRelative)) {
      throw new Error(`Isolation path resolves outside managed root: ${path}`);
    }
    return resolved;
  }

  private validatePersistedIsolation(value: unknown): WorktreeIsolation {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Isolation state contains an invalid entry.");
    }
    const isolation = value as WorktreeIsolation;
    if (!/^iso_[a-f0-9]{20}$/.test(isolation.id))
      throw new Error("Isolation id is invalid.");
    if (!TASK_ID.test(isolation.taskId))
      throw new Error("Isolation taskId is invalid.");
    if (canonicalRoot(isolation.sourceRoot) !== this.projectRoot) {
      throw new Error(
        "Isolation state belongs to a different source repository.",
      );
    }
    const expectedRoot = canonicalRoot(
      resolve(this.worktreesRoot, isolation.id),
    );
    if (canonicalRoot(isolation.worktreeRoot) !== expectedRoot) {
      throw new Error("Isolation worktree path does not match its identity.");
    }
    this.assertInside(isolation.worktreeRoot, this.worktreesRoot);
    const suffix = isolation.id.slice(-8);
    if (isolation.branch !== `folderforge/task/${isolation.taskId}-${suffix}`) {
      throw new Error("Isolation branch does not match its identity.");
    }
    if (
      !/^[a-f0-9]{40,64}$/.test(isolation.baseCommit) ||
      !/^[a-f0-9]{40,64}$/.test(isolation.sourceHead)
    ) {
      throw new Error("Isolation commit identity is invalid.");
    }
    if (!/^[a-f0-9]{64}$/.test(isolation.sourceFingerprint)) {
      throw new Error("Isolation source fingerprint is invalid.");
    }
    if (
      typeof isolation.sourceDirty !== "boolean" ||
      !validTimestamp(isolation.createdAt)
    ) {
      throw new Error(
        "Isolation source state or creation timestamp is invalid.",
      );
    }
    if (
      !["active", "applying", "applied", "rolled_back", "discarded"].includes(
        isolation.state,
      )
    ) {
      throw new Error("Isolation lifecycle state is invalid.");
    }
    if (
      isolation.appliedAt !== undefined &&
      !validTimestamp(isolation.appliedAt)
    ) {
      throw new Error("Isolation applied timestamp is invalid.");
    }
    if (
      isolation.rolledBackAt !== undefined &&
      !validTimestamp(isolation.rolledBackAt)
    ) {
      throw new Error("Isolation rolled-back timestamp is invalid.");
    }
    if (
      isolation.appliedSourceFingerprint !== undefined &&
      !/^[a-f0-9]{64}$/.test(isolation.appliedSourceFingerprint)
    ) {
      throw new Error("Isolation applied source fingerprint is invalid.");
    }
    if (
      isolation.appliedTracked !== undefined &&
      (!Array.isArray(isolation.appliedTracked) ||
        isolation.appliedTracked.some((path) => typeof path !== "string"))
    ) {
      throw new Error("Isolation applied tracked paths are invalid.");
    }
    if (
      isolation.appliedUntracked !== undefined &&
      (!Array.isArray(isolation.appliedUntracked) ||
        isolation.appliedUntracked.some(
          (entry) =>
            !entry ||
            typeof entry.path !== "string" ||
            !/^[a-f0-9]{64}$/.test(entry.sha256),
        ))
    ) {
      throw new Error("Isolation applied untracked journal is invalid.");
    }
    if (
      isolation.rollbackPatchSha256 !== undefined &&
      !/^[a-f0-9]{64}$/.test(isolation.rollbackPatchSha256)
    ) {
      throw new Error("Isolation rollback patch digest is invalid.");
    }
    if (
      isolation.discardedAt !== undefined &&
      !validTimestamp(isolation.discardedAt)
    ) {
      throw new Error("Isolation discarded timestamp is invalid.");
    }
    if (
      isolation.state === "applied" &&
      (!isolation.appliedAt || !isolation.appliedSourceFingerprint)
    ) {
      throw new Error("Applied isolation is missing apply evidence.");
    }
    if (
      ["applying", "applied", "rolled_back"].includes(isolation.state) &&
      (!isolation.appliedTracked ||
        !isolation.appliedUntracked ||
        !isolation.rollbackPatchSha256)
    ) {
      throw new Error("Isolation recovery journal is incomplete.");
    }
    if (isolation.state === "rolled_back" && !isolation.rolledBackAt) {
      throw new Error("Rolled-back isolation is missing rolledBackAt.");
    }
    if (isolation.state === "discarded" && !isolation.discardedAt) {
      throw new Error("Discarded isolation is missing discardedAt.");
    }
    return isolation;
  }

  private load(): void {
    if (!existsSync(this.statePath)) return;
    const original = this.readRegistryBytes();
    const parsed = JSON.parse(original.toString("utf8")) as PersistedState;
    if (
      parsed.version !== 1 ||
      !Array.isArray(parsed.isolations) ||
      typeof parsed.digest !== "string"
    ) {
      throw new Error("Unsupported or invalid isolation state file.");
    }
    if (parsed.digest !== isolationDigest(parsed.isolations)) {
      throw new Error("Isolation state integrity check failed.");
    }
    const seen = new Set<string>();
    for (const value of parsed.isolations) {
      const isolation = this.validatePersistedIsolation(value);
      if (seen.has(isolation.id))
        throw new Error(`Duplicate isolation id: ${isolation.id}`);
      seen.add(isolation.id);
      this.isolations.set(isolation.id, isolation);
    }
    this.loadedRegistrySha256 = sha256(original);
  }

  private assertLoadedRegistryCurrent(): void {
    const actual = existsSync(this.statePath)
      ? sha256(this.readRegistryBytes()) : null;
    if (actual !== this.loadedRegistrySha256)
      throw new Error("Stale manager: isolation registry changed since load.");
  }

  /** Caller already holds the same cooperative registry lock. */
  private persistUnderLock(): void {
    this.assertLoadedRegistryCurrent();
    const isolations = this.list();
    const state: PersistedState = { version: 1, isolations, digest: isolationDigest(isolations) };
    const bytes = Buffer.from(JSON.stringify(state, null, 2) + "\n");
    this.atomicWriteRegistry(bytes);
    this.loadedRegistrySha256 = sha256(bytes);
  }

  private persist(): void {
    this.withRegistryLock(() => this.persistUnderLock());
  }
}
