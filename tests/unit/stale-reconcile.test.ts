import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { WorktreeManager } from "../../src/isolation/worktree-manager.js";

const roots: string[] = [];
const git = (root: string, ...args: string[]) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" });

function fixture(dirtySource = false) {
  const root = mkdtempSync(join(tmpdir(), "folderforge-stale-reconcile-"));
  roots.push(root);
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Fixture");
  git(root, "config", "user.email", "fixture@example.test");
  writeFileSync(join(root, "tracked.txt"), "old\n");
  git(root, "add", ".");
  git(root, "commit", "-m", "init");
  if (dirtySource) writeFileSync(join(root, "untracked.txt"), "at creation\n");
  const manager = new WorktreeManager([root], root);
  const record = manager.create("stale-reconcile");
  // Only tests deliberately remove a disposable, known-clean fixture worktree.
  git(root, "worktree", "remove", record.worktreeRoot);
  git(root, "branch", "-d", record.branch);
  const statePath = join(root, ".git", "folderforge", "isolations.json");
  const hash = () => createHash("sha256").update(readFileSync(statePath)).digest("hex");
  return { root, manager, record, statePath, hash };
}
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { force: true, recursive: true }); });

describe("metadata-only missing isolation reconciliation", () => {
  it("dry-run returns health and preserves registry bytes, refs and source files", () => {
    const f = fixture();
    const before = readFileSync(f.statePath);
    const refs = git(f.root, "show-ref");
    const preview = f.manager.reconcileMissing(f.record.id, { expectedSha256: f.hash(), dryRun: true });
    expect(preview.status).toBe("DRY_RUN");
    expect(preview.observedHealth).toBe("missing_worktree");
    expect(preview.branchRef).toBe("absent");
    expect(readFileSync(f.statePath)).toEqual(before);
    expect(git(f.root, "show-ref")).toBe(refs);
    expect(readFileSync(join(f.root, "tracked.txt"), "utf8")).toBe("old\n");
  });

  it("requires an explicit acknowledgement and exact SHA-256 lease", () => {
    const f = fixture();
    expect(() => f.manager.reconcileMissing(f.record.id, {
      expectedSha256: f.hash(), dryRun: false,
    })).toThrow(/acknowledge/i);
    expect(() => f.manager.reconcileMissing(f.record.id, {
      expectedSha256: "0".repeat(64), dryRun: true,
    })).toThrow(/digest|sha|lease/i);
    expect(f.manager.get(f.record.id)?.state).toBe("active");
  });

  it("closes metadata only, retains recovery history and can restore it by exact lease", () => {
    const f = fixture();
    const original = readFileSync(f.statePath);
    const refs = git(f.root, "show-ref");
    const result = f.manager.reconcileMissing(f.record.id, {
      expectedSha256: f.hash(),
      dryRun: false,
      acknowledgeUnrecoverableWorktreeBytes: true,
    });
    expect(result.status).toBe("RECONCILED");
    expect(f.manager.get(f.record.id)?.state).toBe("discarded");
    expect(git(f.root, "show-ref")).toBe(refs);
    expect(result.backupPath).toBeTruthy();
    expect(readFileSync(result.backupPath!)).toEqual(original);
    expect(f.manager.restoreMissingReconciliation(f.record.id, {
      expectedSha256: f.hash(), backupPath: result.backupPath!,
    }).status).toBe("RESTORED");
    expect(readFileSync(f.statePath)).toEqual(original);
    expect(f.manager.get(f.record.id)?.state).toBe("active");
  });

  it("refuses reconciliation when source was dirty on creation", () => {
    const f = fixture(true);
    expect(() => f.manager.reconcileMissing(f.record.id, {
      expectedSha256: f.hash(), dryRun: false,
      acknowledgeUnrecoverableWorktreeBytes: true,
    })).toThrow(/sourceDirty|dirty/i);
  });

  it("fails closed if a foreign directory or symlink reappears at the path", () => {
    const f = fixture();
    symlinkSync(f.root, f.record.worktreeRoot);
    expect(() => f.manager.reconcileMissing(f.record.id, {
      expectedSha256: f.hash(), dryRun: false,
      acknowledgeUnrecoverableWorktreeBytes: true,
    })).toThrow(/identity|missing|health/i);
  });

  it("rejects stale in-memory managers rather than clobbering newer registry data", () => {
    const f = fixture();
    const other = new WorktreeManager([f.root], f.root);
    f.manager.reconcileMissing(f.record.id, {
      expectedSha256: f.hash(), dryRun: false,
      acknowledgeUnrecoverableWorktreeBytes: true,
    });
    expect(() => other.reconcileMissing(f.record.id, {
      expectedSha256: f.hash(), dryRun: false,
      acknowledgeUnrecoverableWorktreeBytes: true,
    })).toThrow(/stale|state|changed|discarded/i);
  });

  it("refuses active branch refs even when worktree is missing", () => {
    const f = fixture();
    git(f.root, "branch", f.record.branch, "HEAD");
    expect(() => f.manager.reconcileMissing(f.record.id, {
      expectedSha256: f.hash(), dryRun: false,
      acknowledgeUnrecoverableWorktreeBytes: true,
    })).toThrow(/health|identity|missing/i);
    expect(f.manager.get(f.record.id)?.state).toBe("active");
  });

  it("refuses a concurrent reconciliation lock without modifying registry bytes", () => {
    const f = fixture();
    const before = readFileSync(f.statePath);
    writeFileSync(f.statePath + ".lock", "owned by another process");
    expect(() => f.manager.reconcileMissing(f.record.id, {
      expectedSha256: f.hash(), dryRun: false,
      acknowledgeUnrecoverableWorktreeBytes: true,
    })).toThrow();
    expect(readFileSync(f.statePath)).toEqual(before);
  });

  it("recovers from an abandoned pre-commit backup without overwriting recovery bytes", () => {
    const f = fixture();
    const original = readFileSync(f.statePath);
    const orphan = join(f.root, ".git", "folderforge", "reconciliations",
      f.record.id + "-" + f.hash() + ".registry.json");
    mkdirSync(join(f.root, ".git", "folderforge", "reconciliations"), { recursive: true });
    // Simulate an earlier process crashing after durable backup, before audit/commit.
    writeFileSync(orphan, original, { flag: "wx" });
    const changed = f.manager.reconcileMissing(f.record.id, {
      expectedSha256: f.hash(), dryRun: false,
      acknowledgeUnrecoverableWorktreeBytes: true,
    });
    expect(changed.status).toBe("RECONCILED");
    expect(changed.backupPath).not.toBe(orphan);
    expect(readFileSync(orphan)).toEqual(original);
    expect(readFileSync(changed.backupPath!)).toEqual(original);
    expect(f.manager.restoreMissingReconciliation(f.record.id, {
      expectedSha256: f.hash(), backupPath: changed.backupPath!,
    }).status).toBe("RESTORED");
    expect(readFileSync(f.statePath)).toEqual(original);
  });

  it("rejects stale restore lease", () => {
    const f = fixture();
    const changed = f.manager.reconcileMissing(f.record.id, {
      expectedSha256: f.hash(), dryRun: false,
      acknowledgeUnrecoverableWorktreeBytes: true,
    });
    const before = readFileSync(f.statePath);
    expect(() => f.manager.restoreMissingReconciliation(f.record.id, {
      expectedSha256: "0".repeat(64), backupPath: changed.backupPath!,
    })).toThrow(/lease/i);
    expect(readFileSync(f.statePath)).toEqual(before);
  });

  it("rejects tampered reconciliation audit", () => {
    const f = fixture();
    const changed = f.manager.reconcileMissing(f.record.id, {
      expectedSha256: f.hash(), dryRun: false,
      acknowledgeUnrecoverableWorktreeBytes: true,
    });
    const before = readFileSync(f.statePath);
    writeFileSync(changed.backupPath! + ".audit.json", "{}");
    expect(() => f.manager.restoreMissingReconciliation(f.record.id, {
      expectedSha256: f.hash(), backupPath: changed.backupPath!,
    })).toThrow(/integrity|audit/i);
    expect(readFileSync(f.statePath)).toEqual(before);
  });

});
