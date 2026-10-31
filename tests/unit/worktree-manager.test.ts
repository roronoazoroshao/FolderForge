import { afterEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  realpathSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { WorktreeManager } from "../../src/isolation/worktree-manager.js";
import { inspectWorktreeHealth } from "../../src/isolation/worktree-health.js";

const roots: string[] = [];

function git(root: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function repository(): string {
  const root = mkdtempSync(join(tmpdir(), "folderforge-worktree-"));
  roots.push(root);
  git(root, "init", "-b", "main");
  git(root, "config", "user.email", "test@example.com");
  git(root, "config", "user.name", "FolderForge Test");
  // Fixture bytes must not depend on the host Git installation's EOL policy.
  git(root, "config", "core.autocrlf", "false");
  writeFileSync(join(root, "tracked.txt"), "original\n");
  git(root, "add", "tracked.txt");
  git(root, "commit", "-m", "initial");
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("WorktreeManager", () => {
  it("G01: refuses duplicate checked-out branch identities in Git inventory", () => {
    const root = repository();
    const branch = "folderforge/task/ambiguous-1234abcd";
    const firstRoot = join(root, ".git", "folderforge", "worktrees", "iso_aaaaaaaaaaaaaaaaaaaa");
    const secondRoot = join(root, ".git", "folderforge", "worktrees", "iso_bbbbbbbbbbbbbbbbbbbb");
    git(root, "worktree", "add", "-b", branch, firstRoot, "HEAD");
    // Git permits this with --force, so a branch name alone is not a unique worktree identity.
    git(root, "worktree", "add", "--force", secondRoot, branch);
    writeFileSync(join(firstRoot, "precious.txt"), "first worktree bytes\n");
    writeFileSync(join(secondRoot, "precious.txt"), "second worktree bytes\n");
    const refsBefore = git(root, "show-ref");
    const manager = new WorktreeManager([root], root);
    expect(() => manager.discoverUnregisteredWorktrees()).toThrow(/ISOLATION_INVENTORY_INCOMPLETE/);
    expect(() => manager.discoverUnregisteredBranches()).toThrow(/ISOLATION_INVENTORY_INCOMPLETE/);
    expect(git(root, "show-ref")).toBe(refsBefore);
    expect(readFileSync(join(firstRoot, "precious.txt"), "utf8")).toBe("first worktree bytes\n");
    expect(readFileSync(join(secondRoot, "precious.txt"), "utf8")).toBe("second worktree bytes\n");
  });

  it("G01: reports branch-only crash orphans without claiming branch ownership", () => {
    const root = repository();
    const orphanBranch = "folderforge/task/pre-add-crash-aabbccdd";
    const checkedOutBranch = "folderforge/task/checked-out-11223344";
    git(root, "branch", orphanBranch, "HEAD");
    git(root, "branch", "unrelated-foreign", "HEAD");
    const checkedOutRoot = join(root, ".git", "folderforge", "worktrees", "iso_0123456789abcdef0123");
    git(root, "worktree", "add", "-b", checkedOutBranch, checkedOutRoot, "HEAD");
    const refsBefore = git(root, "show-ref");
    const observed = new WorktreeManager([root], root).discoverUnregisteredBranches();
    expect(observed).toEqual([{
      branch: orphanBranch,
      headCommit: git(root, "rev-parse", "HEAD").trim(),
      classification: "branch_only_not_owned",
    }]);
    expect(git(root, "show-ref")).toBe(refsBefore);
    expect(git(root, "branch", "--list", orphanBranch)).toContain(orphanBranch);
  });

  it("G01: rejects a corrupt zero-HEAD Git inventory instead of trusting an ambiguous identity", () => {
    const root = repository();
    const orphanRoot = join(root, ".git", "folderforge", "worktrees", "iso_abcdef0123456789abcd");
    git(root, "worktree", "add", "-b", "folderforge/task/broken-6789abcd", orphanRoot, "HEAD");
    writeFileSync(join(orphanRoot, "precious.txt"), "preserve corrupt-inventory bytes\\n");
    const gitdirLine = readFileSync(join(orphanRoot, ".git"), "utf8").trim();
    expect(gitdirLine.startsWith("gitdir: ")).toBe(true);
    const adminDir = gitdirLine.slice("gitdir: ".length);
    renameSync(join(adminDir, "HEAD"), join(adminDir, "HEAD.broken"));
    expect(git(root, "worktree", "list", "--porcelain")).toMatch(/HEAD 0{40}/);
    const manager = new WorktreeManager([root], root);
    expect(() => manager.discoverUnregisteredWorktrees()).toThrow(/ISOLATION_INVENTORY_INCOMPLETE/);
    expect(readFileSync(join(orphanRoot, "precious.txt"), "utf8")).toBe("preserve corrupt-inventory bytes\\n");
  });

  it("G01: stale discovery refuses to return a registry-inconsistent snapshot", () => {
    const root = repository();
    const stale = new WorktreeManager([root], root);
    const updated = new WorktreeManager([root], root);
    updated.create("concurrent-record");
    expect(() => stale.discoverUnregisteredWorktrees()).toThrow(/ISOLATION_REGISTRY_CHANGED/);
    const refreshed = new WorktreeManager([root], root);
    expect(refreshed.list()).toHaveLength(1);
  });

  it("G01: discovers crash-window worktrees without claiming ownership or mutating Git/registry", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root);
    const persisted = manager.create("persisted");
    const id = "iso_0123456789abcdef0123";
    const branch = "folderforge/task/crash-window-" + id.slice(-8);
    const orphanRoot = join(root, ".git", "folderforge", "worktrees", id);
    git(root, "worktree", "add", "-b", branch, orphanRoot, "HEAD");
    writeFileSync(join(orphanRoot, "crash-user.txt"), "must survive discovery\n");
    const registry = join(root, ".git", "folderforge", "isolations.json");
    const before = readFileSync(registry);
    const branchList = git(root, "branch", "--list");
    const observed = new WorktreeManager([root], root).discoverUnregisteredWorktrees();
    expect(observed).toEqual([
      expect.objectContaining({
        id,
        worktreeRoot: realpathSync.native(orphanRoot),
        branch,
        classification: "candidate_not_owned",
      }),
    ]);
    expect(observed.every((entry) => entry.id !== persisted.id)).toBe(true);
    expect(readFileSync(registry)).toEqual(before);
    expect(git(root, "branch", "--list")).toBe(branchList);
    expect(readFileSync(join(orphanRoot, "crash-user.txt"), "utf8")).toBe("must survive discovery\n");
  });

  it("G01: ambiguous branch identity remains visible, never auto-registered or deleted", () => {
    const root = repository();
    const id = "iso_abcdef0123456789abcd";
    const path = join(root, ".git", "folderforge", "worktrees", id);
    git(root, "worktree", "add", "-b", "foreign-branch", path, "HEAD");
    writeFileSync(join(path, "precious.txt"), "foreign bytes\n");
    const manager = new WorktreeManager([root], root);
    const observed = manager.discoverUnregisteredWorktrees();
    expect(observed).toEqual([
      expect.objectContaining({
        id,
        worktreeRoot: realpathSync.native(path),
        branch: "foreign-branch",
        classification: "ambiguous_not_owned",
      }),
    ]);
    expect(manager.list()).toHaveLength(0);
    expect(readFileSync(join(path, "precious.txt"), "utf8")).toBe("foreign bytes\n");
    expect(git(root, "show-ref", "--verify", "refs/heads/foreign-branch")).toMatch(/^[a-f0-9]{40}/);
  });

  it("G01: a stale process must not erase another process's durable isolation entry", () => {
    const root = repository();
    // The first writer remains alive with a snapshot taken before the second writer commits.
    const stale = new WorktreeManager([root], root);
    const sourceModule = pathToFileURL(
      join(process.cwd(), "src/isolation/worktree-manager.ts"),
    ).href;
    const childScript = [
      'import { WorktreeManager } from "' + sourceModule + '";',
      "const root = process.argv[1];",
      "const manager = new WorktreeManager([root], root);",
      'const created = manager.create("cross-process-writer-b");',
      "console.log(JSON.stringify({ id: created.id, branch: created.branch }));",
    ].join("\n");
    const child = spawnSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", childScript, root],
      { cwd: process.cwd(), encoding: "utf8", timeout: 15000 },
    );
    expect(child.status, child.stderr).toBe(0);
    const other = JSON.parse(child.stdout.trim()) as { id: string; branch: string };
    const registryPath = join(root, ".git", "folderforge", "isolations.json");
    const before = readFileSync(registryPath);
    const branchesBefore = git(root, "branch", "--list");

    // The stale writer must refuse BEFORE creating a task branch/worktree.
    expect(() => stale.create("cross-process-writer-a")).toThrow(
      /ISOLATION_REGISTRY_CHANGED/,
    );
    expect(readFileSync(registryPath)).toEqual(before);
    expect(git(root, "branch", "--list")).toBe(branchesBefore);
    const refreshed = new WorktreeManager([root], root);
    expect(refreshed.get(other.id)?.branch).toBe(other.branch);
  });

  it("G01: stale apply refuses before source mutation and a fresh manager can recover", () => {
    const root = repository();
    const initial = new WorktreeManager([root], root);
    const isolation = initial.create("cross-process-apply");
    writeFileSync(join(isolation.worktreeRoot, "tracked.txt"), "task change\n");
    const stale = new WorktreeManager([root], root);
    const sourceModule = pathToFileURL(
      join(process.cwd(), "src/isolation/worktree-manager.ts"),
    ).href;
    const script = [
      'import { WorktreeManager } from "' + sourceModule + '";',
      "const root = process.argv[1];",
      "const manager = new WorktreeManager([root], root);",
      'manager.create("cross-process-unrelated");',
    ].join("\n");
    const child = spawnSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", script, root],
      { cwd: process.cwd(), encoding: "utf8", timeout: 15000 },
    );
    expect(child.status, child.stderr).toBe(0);
    const statePath = join(root, ".git", "folderforge", "isolations.json");
    const before = readFileSync(statePath);
    expect(() => stale.apply(isolation.id)).toThrow(/ISOLATION_REGISTRY_CHANGED/);
    expect(readFileSync(join(root, "tracked.txt"), "utf8")).toBe("original\n");
    expect(readFileSync(statePath)).toEqual(before);

    const recovered = new WorktreeManager([root], root);
    recovered.apply(isolation.id);
    expect(readFileSync(join(root, "tracked.txt"), "utf8")).toBe("task change\n");
    expect(new WorktreeManager([root], root).list()).toHaveLength(2);
  });

  it("G01: discard preserves a clean task branch with unique unmerged commits", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root);
    const isolation = manager.create("unmerged-discard");
    writeFileSync(join(isolation.worktreeRoot, "tracked.txt"), "unique task commit\n");
    git(isolation.worktreeRoot, "add", "tracked.txt");
    git(isolation.worktreeRoot, "commit", "-m", "unique task commit");
    const ref = "refs/heads/" + isolation.branch;
    const taskHead = git(root, "rev-parse", ref).trim();
    const registry = join(root, ".git", "folderforge", "isolations.json");
    const stateBefore = readFileSync(registry);

    expect(() => manager.discard(isolation.id)).toThrow(/ISOLATION_UNMERGED_COMMITS/);
    expect(git(root, "rev-parse", ref).trim()).toBe(taskHead);
    expect(existsSync(isolation.worktreeRoot)).toBe(true);
    expect(readFileSync(registry)).toEqual(stateBefore);
    expect(manager.get(isolation.id)?.state).toBe("active");
  });

  it("G01: discard preserves dirty and ignored worktree bytes", () => {
    const root = repository();
    writeFileSync(join(root, ".gitignore"), "private-cache.secret\n");
    git(root, "add", ".gitignore");
    git(root, "commit", "-m", "ignore disposable test cache");
    const manager = new WorktreeManager([root], root);
    const isolation = manager.create("dirty-discard");
    const tracked = join(isolation.worktreeRoot, "tracked.txt");
    const ignored = join(isolation.worktreeRoot, "private-cache.secret");
    writeFileSync(tracked, "user uncommitted work\n");
    writeFileSync(ignored, "private ignored bytes\n");
    const registry = join(root, ".git", "folderforge", "isolations.json");
    const stateBefore = readFileSync(registry);

    expect(() => manager.discard(isolation.id)).toThrow(/ISOLATION_TASK_WORKTREE_DIRTY/);
    expect(readFileSync(tracked, "utf8")).toBe("user uncommitted work\n");
    expect(readFileSync(ignored, "utf8")).toBe("private ignored bytes\n");
    expect(readFileSync(registry)).toEqual(stateBefore);
    expect(manager.get(isolation.id)?.state).toBe("active");
  });

  it("G01: discard refuses ignored-only output even when Git status is clean", () => {
    const root = repository();
    writeFileSync(join(root, ".gitignore"), "private-cache.secret\n");
    git(root, "add", ".gitignore");
    git(root, "commit", "-m", "ignore test output");
    const manager = new WorktreeManager([root], root);
    const isolation = manager.create("ignored-only-discard");
    const ignored = join(isolation.worktreeRoot, "private-cache.secret");
    writeFileSync(ignored, "still needed\n");
    const registry = join(root, ".git", "folderforge", "isolations.json");
    const stateBefore = readFileSync(registry);
    expect(git(isolation.worktreeRoot, "status", "--porcelain")).toBe("");

    expect(() => manager.discard(isolation.id)).toThrow(/ISOLATION_TASK_WORKTREE_DIRTY/);
    expect(readFileSync(ignored, "utf8")).toBe("still needed\n");
    expect(readFileSync(registry)).toEqual(stateBefore);
    expect(existsSync(isolation.worktreeRoot)).toBe(true);
  });

  it("G01: discard removes a clean task only after its commit is merged", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root);
    const isolation = manager.create("merged-discard");
    writeFileSync(join(isolation.worktreeRoot, "tracked.txt"), "merged task commit\n");
    git(isolation.worktreeRoot, "add", "tracked.txt");
    git(isolation.worktreeRoot, "commit", "-m", "task merged");
    const mergedHead = git(isolation.worktreeRoot, "rev-parse", "HEAD").trim();
    git(root, "merge", "--ff-only", isolation.branch);
    expect(git(root, "rev-parse", "HEAD").trim()).toBe(mergedHead);

    const discarded = manager.discard(isolation.id);
    expect(discarded.state).toBe("discarded");
    expect(existsSync(isolation.worktreeRoot)).toBe(false);
    expect(() => git(root, "show-ref", "--verify", "refs/heads/" + isolation.branch)).toThrow();
    expect(readFileSync(join(root, "tracked.txt"), "utf8")).toBe("merged task commit\n");
  });

  it("G01: a post-preflight source HEAD rewind must preserve the task ref", () => {
    const root = repository();
    let movedSourceHead = false;
    const manager = new WorktreeManager([root], root, {
      beforeBranchDelete: (record) => {
        movedSourceHead = true;
        // Disposable fixture only: simulate a writer rewinding the source ref.
        git(root, "update-ref", "refs/heads/main", record.baseCommit);
      },
    });
    const isolation = manager.create("source-head-race");
    writeFileSync(join(isolation.worktreeRoot, "tracked.txt"), "task-only history\n");
    git(isolation.worktreeRoot, "add", "tracked.txt");
    git(isolation.worktreeRoot, "commit", "-m", "history should remain referenced");
    const head = git(isolation.worktreeRoot, "rev-parse", "HEAD").trim();
    git(root, "merge", "--ff-only", isolation.branch);
    const registry = join(root, ".git", "folderforge", "isolations.json");
    const stateBefore = readFileSync(registry);

    expect(() => manager.discard(isolation.id)).toThrow(/ISOLATION_SOURCE_HEAD_CHANGED/);
    expect(movedSourceHead).toBe(true);
    expect(git(root, "rev-parse", "refs/heads/" + isolation.branch).trim()).toBe(head);
    expect(readFileSync(registry)).toEqual(stateBefore);
    expect(manager.get(isolation.id)?.state).toBe("active");
  });

  it("discard retains missing worktree branch and metadata", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root);
    const isolation = manager.create("missing-discard");
    writeFileSync(join(isolation.worktreeRoot, "tracked.txt"), "task commit\n");
    git(isolation.worktreeRoot, "add", "tracked.txt");
    git(isolation.worktreeRoot, "commit", "-m", "unmerged task commit");
    const branchHeadBefore = git(root, "rev-parse", `refs/heads/${isolation.branch}`).trim();
    const statePath = join(root, ".git", "folderforge", "isolations.json");
    const stateBytesBefore = readFileSync(statePath);
    git(root, "worktree", "remove", "--force", isolation.worktreeRoot);

    expect(() => manager.discard(isolation.id)).toThrow(/ISOLATION_WORKTREE_MISSING/);
    expect(git(root, "rev-parse", `refs/heads/${isolation.branch}`).trim()).toBe(branchHeadBefore);
    expect(readFileSync(statePath)).toEqual(stateBytesBefore);
  });

  it("status returns explicit missing worktree code", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root);
    const isolation = manager.create("missing-status");
    git(root, "worktree", "remove", "--force", isolation.worktreeRoot);
    expect(() => manager.status(isolation.id)).toThrow(/ISOLATION_WORKTREE_MISSING/);
    expect(() => manager.diff(isolation.id)).toThrow(/ISOLATION_WORKTREE_MISSING/);
  });

  it("rollback refuses mutation when the applied worktree disappeared", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root);
    const isolation = manager.create("missing-rollback");
    writeFileSync(join(isolation.worktreeRoot, "tracked.txt"), "applied change\n");
    manager.apply(isolation.id);
    const sourceBefore = readFileSync(join(root, "tracked.txt"));
    git(root, "worktree", "remove", "--force", isolation.worktreeRoot);
    expect(() => manager.rollback(isolation.id)).toThrow(/ISOLATION_WORKTREE_MISSING/);
    expect(readFileSync(join(root, "tracked.txt"))).toEqual(sourceBefore);
  });

  it("discard repeats identity preflight after a test-only concurrent removal", () => {
    const root = repository();
    let called = 0;
    const manager = new WorktreeManager([root], root, {
      beforeFinalMutationCheck: (isolation) => {
        called++;
        git(root, "worktree", "remove", "--force", isolation.worktreeRoot);
      },
    });
    const isolation = manager.create("race-discard");
    const statePath = join(root, ".git", "folderforge", "isolations.json");
    const stateBefore = readFileSync(statePath);
    const headBefore = git(root, "rev-parse", `refs/heads/${isolation.branch}`).trim();
    expect(() => manager.discard(isolation.id)).toThrow(/ISOLATION_WORKTREE_MISSING/);
    expect(called).toBe(1);
    expect(git(root, "rev-parse", `refs/heads/${isolation.branch}`).trim()).toBe(headBefore);
    expect(readFileSync(statePath)).toEqual(stateBefore);
  });

  it("apply rechecks worktree identity after preflight before applying source patch", () => {
    const root = repository();
    let armed = false;
    const manager = new WorktreeManager([root], root, {
      beforeFinalMutationCheck: (isolation) => {
        if (armed) git(root, "worktree", "remove", "--force", isolation.worktreeRoot);
      },
    });
    const isolation = manager.create("race-apply");
    writeFileSync(join(isolation.worktreeRoot, "tracked.txt"), "task change\n");
    armed = true;
    const sourceBefore = readFileSync(join(root, "tracked.txt"));
    expect(() => manager.apply(isolation.id)).toThrow(/ISOLATION_WORKTREE_MISSING/);
    expect(readFileSync(join(root, "tracked.txt"))).toEqual(sourceBefore);
    expect(manager.list()[0]?.state).toBe("active");
  });

  it("G01: apply refuses tracked source file replacement with byte-identical content", () => {
    const root = repository();
    const source = join(root, "tracked.txt");
    const prior = join(root, ".git", "tracked-original.txt");
    const manager = new WorktreeManager([root], root, {
      beforeFinalMutationCheck: () => {
        renameSync(source, prior);
        writeFileSync(source, "original\n");
      },
    });
    const isolation = manager.create("apply-tracked-identity");
    writeFileSync(join(isolation.worktreeRoot, "tracked.txt"), "task change\n");
    const registry = join(root, ".git", "folderforge", "isolations.json");
    const before = readFileSync(registry);

    expect(() => manager.apply(isolation.id)).toThrow(/APPLY_SOURCE_IDENTITY_CHANGED/);
    expect(readFileSync(source, "utf8")).toBe("original\n");
    expect(readFileSync(prior, "utf8")).toBe("original\n");
    expect(readFileSync(registry)).toEqual(before);
    expect(manager.get(isolation.id)?.state).toBe("active");
  });

  it("rollback rechecks identity if worktree disappears after apply", () => {
    const root = repository();
    let armed = false;
    const manager = new WorktreeManager([root], root, {
      beforeFinalMutationCheck: (isolation) => {
        if (armed) git(root, "worktree", "remove", "--force", isolation.worktreeRoot);
      },
    });
    const isolation = manager.create("race-rollback");
    writeFileSync(join(isolation.worktreeRoot, "tracked.txt"), "task change\n");
    manager.apply(isolation.id);
    const sourceBefore = readFileSync(join(root, "tracked.txt"));
    armed = true;
    expect(() => manager.rollback(isolation.id)).toThrow(/ISOLATION_WORKTREE_MISSING/);
    expect(readFileSync(join(root, "tracked.txt"))).toEqual(sourceBefore);
    expect(manager.list()[0]?.state).toBe("applied");
  });

  it("restores earlier source files if worktree disappears between rollback untracked removals", () => {
    const root = repository();
    let isolationRoot = "";
    const manager = new WorktreeManager([root], root, {
      beforeRollbackUntrackedRemove: (_entry, index) => {
        if (index === 1) git(root, "worktree", "remove", "--force", isolationRoot);
      },
    });
    const isolation = manager.create("multi-untracked-race");
    isolationRoot = isolation.worktreeRoot;
    writeFileSync(join(isolation.worktreeRoot, "a.txt"), "precious bytes a\n");
    writeFileSync(join(isolation.worktreeRoot, "b.txt"), "precious bytes b\n");
    manager.apply(isolation.id);
    const aBefore = readFileSync(join(root, "a.txt"));
    const bBefore = readFileSync(join(root, "b.txt"));
    const statePath = join(root, ".git", "folderforge", "isolations.json");
    const metadataBefore = readFileSync(statePath);
    expect(() => manager.rollback(isolation.id)).toThrow(/ISOLATION_WORKTREE_MISSING/);
    expect(readFileSync(join(root, "a.txt"))).toEqual(aBefore);
    expect(readFileSync(join(root, "b.txt"))).toEqual(bBefore);
    expect(readFileSync(statePath)).toEqual(metadataBefore);
    expect(manager.list()[0]?.state).toBe("applied");
  });

  it("reports incomplete recovery rather than recreate a vanished source repository", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root, {
      beforeRollbackUntrackedRemove: (_entry, index) => {
        if (index === 1) rmSync(root, { recursive: true, force: true });
      },
    });
    const isolation = manager.create("lost-source-rollback");
    writeFileSync(join(isolation.worktreeRoot, "a.txt"), "original applied a\n");
    writeFileSync(join(isolation.worktreeRoot, "b.txt"), "original applied b\n");
    manager.apply(isolation.id);
    expect(() => manager.rollback(isolation.id)).toThrow(/ROLLBACK_RECOVERY_INCOMPLETE/);
    expect(existsSync(root)).toBe(false);
  });

  it("discard refuses a task branch ref replaced after worktree removal", () => {
    const root = repository();
    let replaced = false;
    const manager = new WorktreeManager([root], root, {
      beforeBranchDelete: (isolation) => {
        replaced = true;
        git(root, "update-ref", `refs/heads/${isolation.branch}`, isolation.baseCommit);
      },
    });
    const isolation = manager.create("race-branch-ref");
    writeFileSync(join(isolation.worktreeRoot, "tracked.txt"), "committed independent task\n");
    git(isolation.worktreeRoot, "add", "tracked.txt");
    git(isolation.worktreeRoot, "commit", "-m", "task checkpoint");
    git(root, "merge", "--ff-only", isolation.branch);
    const statePath = join(root, ".git", "folderforge", "isolations.json");
    const stateBefore = readFileSync(statePath);
    expect(() => manager.discard(isolation.id)).toThrow(/ISOLATION_IDENTITY_MISMATCH/);
    expect(replaced).toBe(true);
    expect(readFileSync(statePath)).toEqual(stateBefore);
    expect(git(root, "rev-parse", `refs/heads/${isolation.branch}`).trim()).toBe(isolation.baseCommit);
  });

  it("apply catches worktree removal immediately before an untracked source copy", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root, {
      beforeUntrackedCopy: () => {
        const isolation = manager.list()[0]!;
        git(root, "worktree", "remove", "--force", isolation.worktreeRoot);
      },
    });
    const isolation = manager.create("late-copy-race");
    writeFileSync(join(isolation.worktreeRoot, "untracked.txt"), "task output\n");
    const sourceBefore = readFileSync(join(root, "tracked.txt"));
    expect(() => manager.apply(isolation.id)).toThrow(/ISOLATION_WORKTREE_MISSING/);
    expect(readFileSync(join(root, "tracked.txt"))).toEqual(sourceBefore);
    expect(manager.list()[0]?.state).toBe("active");
  });

  it("refuses a concurrent untracked target without overwriting user bytes or leaking earlier copies", () => {
    const root = repository();
    const userBytes = "user wrote this after preflight\n";
    let injected = false;
    const manager = new WorktreeManager([root], root, {
      beforeUntrackedCopy: ({ target }) => {
        if (target === join(realpathSync.native(root), "z.txt")) {
          injected = true;
          writeFileSync(target, userBytes, { flag: "wx" });
        }
      },
    });
    const isolation = manager.create("concurrent-target");
    writeFileSync(join(isolation.worktreeRoot, "a.txt"), "first output\n");
    writeFileSync(join(isolation.worktreeRoot, "z.txt"), "task output\n");
    const statePath = join(root, ".git", "folderforge", "isolations.json");
    expect(() => manager.apply(isolation.id)).toThrow();
    expect(injected).toBe(true);
    expect(readFileSync(join(root, "z.txt"), "utf8")).toBe(userBytes);
    expect(existsSync(join(root, "a.txt"))).toBe(false);
    expect(readFileSync(join(root, "tracked.txt"), "utf8")).toBe("original\n");
    expect(manager.get(isolation.id)?.state).toBe("active");
    const persisted = JSON.parse(readFileSync(statePath, "utf8"));
    expect(persisted.isolations[0]?.state).toBe("active");
  });

  it("refuses untracked task bytes changed after the recovery journal was recorded", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root, {
      beforeUntrackedCopy: ({ source }) => {
        writeFileSync(source, "changed after journal\n");
      },
    });
    const isolation = manager.create("changed-task-output");
    writeFileSync(join(isolation.worktreeRoot, "new.txt"), "journaled output\n");
    expect(() => manager.apply(isolation.id)).toThrow(/changed after journal/i);
    expect(existsSync(join(root, "new.txt"))).toBe(false);
    expect(readFileSync(join(root, "tracked.txt"), "utf8")).toBe("original\n");
    expect(manager.get(isolation.id)?.state).toBe("active");
  });

  it("preserves a concurrent edit after copy instead of deleting uncertain output", () => {
    const root = repository();
    const userBytes = "user edited the new file after copy\n";
    const manager = new WorktreeManager([root], root, {
      afterUntrackedCopy: ({ target }) => {
        writeFileSync(target, userBytes);
      },
    });
    const isolation = manager.create("copy-output-drift");
    writeFileSync(join(isolation.worktreeRoot, "new.txt"), "task version\n");
    expect(() => manager.apply(isolation.id)).toThrow(/RECOVERY_INCOMPLETE/);
    expect(readFileSync(join(root, "new.txt"), "utf8")).toBe(userBytes);
    expect(manager.get(isolation.id)?.state).toBe("applying");
    expect(() => manager.rollback(isolation.id)).toThrow(/changed after apply/);
    expect(readFileSync(join(root, "new.txt"), "utf8")).toBe(userBytes);
  });

  it("rollback rejects a worktree lost after validating the journal but before mutation", () => {
    const root = repository();
    let armed = false;
    const manager = new WorktreeManager([root], root, {
      beforeRollbackMutation: (isolation) => {
        if (armed) git(root, "worktree", "remove", "--force", isolation.worktreeRoot);
      },
    });
    const isolation = manager.create("late-rollback-race");
    writeFileSync(join(isolation.worktreeRoot, "tracked.txt"), "applied change\n");
    manager.apply(isolation.id);
    const sourceBefore = readFileSync(join(root, "tracked.txt"));
    armed = true;
    expect(() => manager.rollback(isolation.id)).toThrow(/ISOLATION_WORKTREE_MISSING/);
    expect(readFileSync(join(root, "tracked.txt"))).toEqual(sourceBefore);
    expect(manager.list()[0]?.state).toBe("applied");
  });

  it("rollback denies missing journal", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root);
    const isolation = manager.create("missing-journal");
    writeFileSync(join(isolation.worktreeRoot, "tracked.txt"), "applied change\n");
    manager.apply(isolation.id);
    const sourceBefore = readFileSync(join(root, "tracked.txt"));
    rmSync(join(root, ".git", "folderforge", "rollbacks", `${isolation.id}.patch`));
    expect(() => manager.rollback(isolation.id)).toThrow(/rollback patch is missing/i);
    expect(readFileSync(join(root, "tracked.txt"))).toEqual(sourceBefore);
  });

  it("reports an explicit base comparison and clean HEAD-relative state for a fresh task", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root);
    const isolation = manager.create("status-fresh");
    const statePath = join(root, ".git", "folderforge", "isolations.json");
    const stateBefore = readFileSync(statePath);
    const refsBefore = git(root, "show-ref");
    const indexBefore = readFileSync(join(root, ".git", "index"));
    const worktreesBefore = git(root, "worktree", "list", "--porcelain");
    for (let i = 0; i < 3; i++) {
      expect(inspectWorktreeHealth(isolation).observedHealth).toBe("present_consistent");
    }
    expect(readFileSync(statePath)).toEqual(stateBefore);
    expect(git(root, "show-ref")).toBe(refsBefore);
    expect(readFileSync(join(root, ".git", "index"))).toEqual(indexBefore);
    expect(git(root, "worktree", "list", "--porcelain")).toBe(worktreesBefore);
    expect(manager.status(isolation.id)).toMatchObject({
      clean: true,
      changed: [],
      untracked: [],
      conflicts: [],
      comparison: { target: "worktree", baseCommit: isolation.baseCommit },
      workingTree: {
        headCommit: isolation.baseCommit,
        clean: true,
        staged: [],
        unstaged: [],
        untracked: [],
        conflicts: [],
      },
    });
  });

  it("listObserved preserves persisted lifecycle and marks missing worktree", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root);
    const isolation = manager.create("observed-missing");
    const statePath = join(root, ".git", "folderforge", "isolations.json");
    const stateBefore = readFileSync(statePath, "utf8");
    const legacyBefore = JSON.stringify(manager.list());

    git(root, "worktree", "remove", "--force", isolation.worktreeRoot);

    expect(manager.list()[0]?.state).toBe("active");
    expect(JSON.stringify(manager.list())).toBe(legacyBefore);
    expect(manager.listObserved()[0]).toMatchObject({
      observedHealth: "missing_worktree",
      branchRef: "present",
    });
    expect(manager.inspect(isolation.id)).toMatchObject({
      observedHealth: "missing_worktree",
      branchRef: "present",
    });
    expect(readFileSync(statePath, "utf8")).toBe(stateBefore);

    const restarted = new WorktreeManager([root], root);
    expect(restarted.listObserved()[0]?.observedHealth).toBe("missing_worktree");
    expect(readFileSync(statePath, "utf8")).toBe(stateBefore);
  });

  it("starts from a linked Git worktree without loading the primary repository state", () => {
    const root = repository();
    const linkedRoot = mkdtempSync(
      join(tmpdir(), "folderforge-linked-worktree-"),
    );
    rmSync(linkedRoot, { recursive: true, force: true });
    git(root, "worktree", "add", "--detach", linkedRoot, "HEAD");
    try {
      const canonicalLinkedRoot = realpathSync.native(linkedRoot);
      const manager = new WorktreeManager([linkedRoot], linkedRoot);
      expect(manager.available).toBe(true);
      const isolation = manager.create("linked-worktree");
      expect(isolation.sourceRoot).toBe(canonicalLinkedRoot);
      expect(manager.get(isolation.id)).toMatchObject({
        sourceRoot: canonicalLinkedRoot,
        state: "active",
      });
      manager.discard(isolation.id);
    } finally {
      git(root, "worktree", "remove", "--force", linkedRoot);
      rmSync(linkedRoot, { recursive: true, force: true });
    }
  });

  it("keeps committed task delta distinct from dirty state even after merge into source", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root);
    const isolation = manager.create("status-committed");
    writeFileSync(
      join(isolation.worktreeRoot, "tracked.txt"),
      "committed task\n",
    );
    git(isolation.worktreeRoot, "add", "tracked.txt");
    git(isolation.worktreeRoot, "commit", "-m", "task change");
    const head = git(isolation.worktreeRoot, "rev-parse", "HEAD").trim();
    const indexPath = git(
      isolation.worktreeRoot,
      "rev-parse",
      "--git-path",
      "index",
    ).trim();
    const indexBefore = readFileSync(indexPath);
    const statePath = join(root, ".git", "folderforge", "isolations.json");
    const stateBefore = readFileSync(statePath);
    const expected = {
      clean: false,
      changed: ["tracked.txt"],
      comparison: { target: "worktree", baseCommit: isolation.baseCommit },
      workingTree: {
        headCommit: head,
        clean: true,
        staged: [],
        unstaged: [],
        untracked: [],
        conflicts: [],
      },
    };
    expect(manager.status(isolation.id)).toMatchObject(expected);
    git(root, "merge", "--ff-only", isolation.branch);
    expect(manager.status(isolation.id)).toMatchObject(expected);
    expect(manager.get(isolation.id)?.state).toBe("active");
    expect(readFileSync(indexPath)).toEqual(indexBefore);
    expect(readFileSync(statePath)).toEqual(stateBefore);
  });

  it("detects cancelling staged and unstaged changes even when the net HEAD diff is empty", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root);
    const isolation = manager.create("status-cancelling");
    writeFileSync(
      join(isolation.worktreeRoot, "tracked.txt"),
      "staged content\n",
    );
    git(isolation.worktreeRoot, "add", "tracked.txt");
    writeFileSync(join(isolation.worktreeRoot, "tracked.txt"), "original\n");
    expect(git(isolation.worktreeRoot, "diff", "HEAD", "--")).toBe("");
    expect(manager.status(isolation.id)).toMatchObject({
      clean: true,
      changed: [],
      workingTree: {
        clean: false,
        staged: ["tracked.txt"],
        unstaged: ["tracked.txt"],
        untracked: [],
        conflicts: [],
      },
    });
  });

  it("reports unstaged, untracked, renamed and deleted paths without losing spaces or Unicode", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root);
    const isolation = manager.create("status-paths");
    writeFileSync(join(isolation.worktreeRoot, "tracked.txt"), "unstaged\n");
    writeFileSync(join(isolation.worktreeRoot, "ghi chú.txt"), "untracked\n");
    expect(manager.status(isolation.id).workingTree).toMatchObject({
      clean: false,
      staged: [],
      unstaged: ["tracked.txt"],
      untracked: ["ghi chú.txt"],
      conflicts: [],
    });
    writeFileSync(join(isolation.worktreeRoot, "tracked.txt"), "original\n");
    git(isolation.worktreeRoot, "mv", "tracked.txt", "renamed file.txt");
    const renamed = manager.status(isolation.id).workingTree;
    expect(renamed.staged).toContain("renamed file.txt");
    rmSync(join(isolation.worktreeRoot, "renamed file.txt"));
    expect(manager.status(isolation.id).workingTree.unstaged).toContain(
      "renamed file.txt",
    );
  });

  it("reports real unresolved merge conflicts instead of treating the worktree as clean", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root);
    const isolation = manager.create("status-conflict");
    writeFileSync(join(isolation.worktreeRoot, "tracked.txt"), "task side\n");
    git(isolation.worktreeRoot, "add", "tracked.txt");
    git(isolation.worktreeRoot, "commit", "-m", "task side");
    writeFileSync(join(root, "tracked.txt"), "source side\n");
    git(root, "add", "tracked.txt");
    git(root, "commit", "-m", "source side");
    expect(() => git(isolation.worktreeRoot, "merge", "main")).toThrow();
    expect(manager.status(isolation.id)).toMatchObject({
      clean: false,
      conflicts: ["tracked.txt"],
      workingTree: { clean: false, conflicts: ["tracked.txt"] },
    });
  });

  it("labels source snapshots returned after apply and rollback without changing legacy semantics", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root);
    const isolation = manager.create("status-source");
    writeFileSync(join(isolation.worktreeRoot, "tracked.txt"), "task change\n");
    expect(manager.apply(isolation.id)).toMatchObject({
      clean: false,
      changed: ["tracked.txt"],
      comparison: { target: "source", baseCommit: isolation.sourceHead },
      workingTree: {
        headCommit: isolation.sourceHead,
        clean: false,
        staged: [],
        unstaged: ["tracked.txt"],
        untracked: [],
        conflicts: [],
      },
    });
    expect(manager.rollback(isolation.id)).toMatchObject({
      clean: true,
      comparison: { target: "source", baseCommit: isolation.sourceHead },
      workingTree: {
        headCommit: isolation.sourceHead,
        clean: true,
        staged: [],
        unstaged: [],
        untracked: [],
        conflicts: [],
      },
    });
  });

  it("creates an isolated branch without touching a dirty source workspace", () => {
    const root = repository();
    writeFileSync(join(root, "tracked.txt"), "user work\n");
    const manager = new WorktreeManager([root], root);
    const isolation = manager.create("task-dirty");

    expect(isolation.sourceDirty).toBe(true);
    expect(readFileSync(join(root, "tracked.txt"), "utf8")).toBe("user work\n");
    expect(
      readFileSync(join(isolation.worktreeRoot, "tracked.txt"), "utf8"),
    ).toBe("original\n");
    expect(git(root, "status", "--short")).toContain("tracked.txt");

    writeFileSync(join(isolation.worktreeRoot, "tracked.txt"), "agent work\n");
    expect(() => manager.apply(isolation.id)).toThrow(/dirty at creation/);
  });

  it("applies, rolls back tracked and bounded untracked changes, then discards cleanly", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root);
    const isolation = manager.create("task-apply");
    writeFileSync(join(isolation.worktreeRoot, "tracked.txt"), "changed\n");
    writeFileSync(join(isolation.worktreeRoot, "new.txt"), "new file\n");

    const review = manager.diff(isolation.id);
    expect(review.diff).toContain("changed");
    expect(review.untracked).toEqual(["new.txt"]);

    const applied = manager.apply(isolation.id);
    expect(applied.isolation.state).toBe("applied");
    expect(readFileSync(join(root, "tracked.txt"), "utf8")).toBe("changed\n");
    expect(readFileSync(join(root, "new.txt"), "utf8")).toBe("new file\n");

    expect(() => manager.discard(isolation.id)).toThrow(
      /Rollback applied isolation/,
    );
    const rolledBack = manager.rollback(isolation.id);
    expect(rolledBack.isolation.state).toBe("rolled_back");
    expect(rolledBack.clean).toBe(true);
    expect(readFileSync(join(root, "tracked.txt"), "utf8")).toBe("original\n");
    expect(existsSync(join(root, "new.txt"))).toBe(false);

    // Rollback restores source, not the task's uncommitted files.
    // Explicitly clean the disposable task fixture before discarding it.
    git(isolation.worktreeRoot, "checkout", "--", "tracked.txt");
    rmSync(join(isolation.worktreeRoot, "new.txt"));
    const discarded = manager.discard(isolation.id);
    expect(discarded.state).toBe("discarded");
    expect(existsSync(isolation.worktreeRoot)).toBe(false);
    expect(git(root, "worktree", "list", "--porcelain")).not.toContain(
      isolation.worktreeRoot,
    );
    expect(() =>
      git(root, "show-ref", "--verify", `refs/heads/${isolation.branch}`),
    ).toThrow();
  });

  it("refuses apply after source drift and rejects untracked symlinks", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root);
    const drift = manager.create("task-drift");
    writeFileSync(join(drift.worktreeRoot, "tracked.txt"), "task change\n");
    writeFileSync(join(root, "tracked.txt"), "new user change\n");
    expect(() => manager.apply(drift.id)).toThrow(
      /changed after isolation creation/,
    );

    writeFileSync(join(root, "tracked.txt"), "original\n");
    const clean = sourceClean(root);
    expect(clean).toBe(true);
    const outside = mkdtempSync(
      join(tmpdir(), "folderforge-worktree-link-target-"),
    );
    roots.push(outside);
    const outsideFile = join(outside, "outside.txt");
    writeFileSync(outsideFile, "outside\n");

    const symlink = manager.create("task-symlink");
    symlinkSync(outsideFile, join(symlink.worktreeRoot, "escape-link"), "file");
    expect(() => manager.apply(symlink.id)).toThrow(
      /regular file|outside managed root/,
    );

    const trackedSymlink = manager.create("task-tracked-symlink");
    symlinkSync(
      outsideFile,
      join(trackedSymlink.worktreeRoot, "tracked-link"),
      "file",
    );
    git(trackedSymlink.worktreeRoot, "add", "tracked-link");
    expect(() => manager.apply(trackedSymlink.id)).toThrow(
      /regular file or deletion|outside managed root/,
    );
  });

  it("persists managed identity and rejects traversal-like task identifiers", () => {
    const root = repository();
    const first = new WorktreeManager([root], root);
    expect(() => first.create("../escape")).toThrow(/taskId/);
    const isolation = first.create("task-reload");

    const second = new WorktreeManager([root], root);
    expect(second.isManagedRoot(isolation.worktreeRoot)).toBe(true);
    expect(second.get(isolation.id)).toMatchObject({
      id: isolation.id,
      state: "active",
    });
  });

  it("reports an unavailable fallback instead of crashing for a non-Git folder", () => {
    const root = mkdtempSync(join(tmpdir(), "folderforge-no-git-"));
    roots.push(root);
    const manager = new WorktreeManager([root], root);
    expect(manager.describe()).toMatchObject({
      available: false,
      total: 0,
      active: 0,
    });
    expect(() => manager.create("task")).toThrow(/Git command failed/);
  });
  it("fails closed when persisted isolation state is corrupted", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root);
    manager.create("task-integrity");
    const statePath = join(root, ".git", "folderforge", "isolations.json");
    const state = JSON.parse(readFileSync(statePath, "utf8")) as {
      isolations: Array<{ taskId: string }>;
      digest: string;
    };
    state.isolations[0]!.taskId = "tampered-task";
    writeFileSync(statePath, `${JSON.stringify(state)}\n`);
    expect(() => new WorktreeManager([root], root)).toThrow(/integrity/);
  });

  it("refuses rollback after post-apply user drift and preserves the recovery worktree", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root);
    const isolation = manager.create("task-rollback-drift");
    writeFileSync(join(isolation.worktreeRoot, "tracked.txt"), "task change\n");
    manager.apply(isolation.id);
    writeFileSync(join(root, "tracked.txt"), "user changed after apply\n");

    expect(() => manager.rollback(isolation.id)).toThrow(
      /changed after isolation apply/,
    );
    expect(manager.get(isolation.id)).toMatchObject({ state: "applied" });
    expect(existsSync(isolation.worktreeRoot)).toBe(true);
  });

  it("refuses to certify an applying rollback while an ignored source artifact remains", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root);
    const isolation = manager.create("ignored-recovery-artifact");
    writeFileSync(join(isolation.worktreeRoot, "artifact.tmp"), "task artifact bytes\n");
    manager.apply(isolation.id);

    const artifact = join(root, "artifact.tmp");
    expect(readFileSync(artifact, "utf8")).toBe("task artifact bytes\n");
    // A crash/restart can leave an applying journal. Git ignore rules may
    // conceal copied source artifacts from the ordinary source fingerprint.
    writeFileSync(join(root, ".git", "info", "exclude"), "\nartifact.tmp\n", { flag: "a" });
    const statePath = join(root, ".git", "folderforge", "isolations.json");
    const state = JSON.parse(readFileSync(statePath, "utf8")) as {
      isolations: Array<Record<string, unknown>>;
      digest: string;
    };
    const record = state.isolations[0]!;
    record.state = "applying";
    delete record.appliedAt;
    delete record.appliedSourceFingerprint;
    state.digest = "sha256:" + createHash("sha256")
      .update(JSON.stringify(state.isolations)).digest("hex");
    writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");

    const restarted = new WorktreeManager([root], root);
    expect(() => restarted.rollback(isolation.id)).toThrow(/source artifact|uncertain/i);
    expect(readFileSync(artifact, "utf8")).toBe("task artifact bytes\n");
    expect(restarted.get(isolation.id)).toMatchObject({ state: "applying" });
  });

  it("recovers an uncertain applying journal after restart without replaying apply", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root);
    const isolation = manager.create("task-uncertain");
    writeFileSync(
      join(isolation.worktreeRoot, "tracked.txt"),
      "uncertain change\n",
    );
    manager.apply(isolation.id);

    const statePath = join(root, ".git", "folderforge", "isolations.json");
    const state = JSON.parse(readFileSync(statePath, "utf8")) as {
      isolations: Array<Record<string, unknown>>;
      digest: string;
    };
    const record = state.isolations[0]!;
    record.state = "applying";
    delete record.appliedAt;
    delete record.appliedSourceFingerprint;
    state.digest = `sha256:${createHash("sha256")
      .update(JSON.stringify(state.isolations))
      .digest("hex")}`;
    writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);

    const restarted = new WorktreeManager([root], root);
    expect(restarted.get(isolation.id)).toMatchObject({ state: "applying" });
    const rolledBack = restarted.rollback(isolation.id);
    expect(rolledBack).toMatchObject({
      clean: true,
      isolation: { state: "rolled_back" },
    });
    expect(readFileSync(join(root, "tracked.txt"), "utf8")).toBe("original\n");
  });

  it("rejects a tampered rollback patch without touching applied source changes", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root);
    const isolation = manager.create("task-patch-integrity");
    writeFileSync(
      join(isolation.worktreeRoot, "tracked.txt"),
      "applied change\n",
    );
    manager.apply(isolation.id);
    const patchPath = join(
      root,
      ".git",
      "folderforge",
      "rollbacks",
      `${isolation.id}.patch`,
    );
    writeFileSync(patchPath, "tampered patch\n");

    expect(() => manager.rollback(isolation.id)).toThrow(/patch integrity/);
    expect(readFileSync(join(root, "tracked.txt"), "utf8")).toBe(
      "applied change\n",
    );
    expect(manager.get(isolation.id)).toMatchObject({ state: "applied" });
  });

  it("revalidates an untracked target after preflight and blocks a symlink or junction swap", () => {
    const root = repository();
    const canonicalRoot = realpathSync.native(root);
    const outside = mkdtempSync(
      join(tmpdir(), "folderforge-worktree-outside-"),
    );
    roots.push(outside);
    let swapped = false;
    const manager = new WorktreeManager([root], root, {
      beforeUntrackedCopy: ({ target }) => {
        if (swapped) return;
        swapped = true;
        const parent = join(canonicalRoot, "nested");
        expect(target).toBe(join(parent, "new.txt"));
        symlinkSync(
          outside,
          parent,
          process.platform === "win32" ? "junction" : "dir",
        );
      },
    });
    const isolation = manager.create("task-target-swap");
    mkdirSync(join(isolation.worktreeRoot, "nested"));
    writeFileSync(
      join(isolation.worktreeRoot, "nested", "new.txt"),
      "must stay inside\n",
    );

    expect(() => manager.apply(isolation.id)).toThrow(
      /resolves outside managed root/,
    );
    expect(existsSync(join(outside, "new.txt"))).toBe(false);
    expect(manager.get(isolation.id)).toMatchObject({ state: "active" });
  });
});

function sourceClean(root: string): boolean {
  git(root, "checkout", "--", "tracked.txt");
  return git(root, "status", "--porcelain").trim() === "";
}
