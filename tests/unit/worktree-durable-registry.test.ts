import { afterEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const trace = vi.hoisted(() => ({
  enabled: false,
  events: [] as string[],
  failDirectorySync: false,
  failFileSync: false,
}));

vi.mock("node:fs", async (importOriginal) => {
  const fs = await importOriginal<typeof import("node:fs")>();
  return {
    ...fs,
    fsyncSync(fd: number) {
      const directory = fs.fstatSync(fd).isDirectory();
      if (trace.enabled) {
        trace.events.push(directory ? "sync-directory" : "sync-file");
        if (!directory && trace.failFileSync) {
          trace.failFileSync = false;
          throw new Error("INJECTED_FILE_SYNC_FAILURE");
        }
        if (directory && trace.failDirectorySync) {
          trace.failDirectorySync = false;
          throw new Error("INJECTED_DIRECTORY_SYNC_FAILURE");
        }
      }
      return fs.fsyncSync(fd);
    },
    renameSync(oldPath: string, newPath: string) {
      if (trace.enabled && newPath.endsWith("isolations.json")) {
        trace.events.push("rename-registry");
      }
      if (trace.enabled && newPath.endsWith(".patch")) {
        trace.events.push("rename-patch");
      }
      return fs.renameSync(oldPath, newPath);
    },
  };
});

import { WorktreeManager } from "../../src/isolation/worktree-manager.js";

const roots: string[] = [];
function git(root: string, ...args: string[]): void {
  execFileSync("git", args, { cwd: root, encoding: "utf8" });
}
function repository(): string {
  const root = mkdtempSync(join(tmpdir(), "folderforge-durable-registry-"));
  roots.push(root);
  git(root, "init", "-b", "main");
  git(root, "config", "user.email", "test@example.com");
  git(root, "config", "user.name", "FolderForge Test");
  git(root, "config", "core.autocrlf", "false");
  writeFileSync(join(root, "tracked.txt"), "original\\n");
  git(root, "add", "tracked.txt");
  git(root, "commit", "-m", "initial");
  return root;
}
afterEach(() => {
  trace.enabled = false;
  trace.failDirectorySync = false;
  trace.failFileSync = false;
  trace.events = [];
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("G01 registry durability protocol", () => {
  it("preserves externally owned registry metadata across restart and subsequent writes", () => {
    const root = repository();
    const first = new WorktreeManager([root], root);
    first.create("owned-first");
    const registryPath = join(root, ".git", "folderforge", "isolations.json");
    const state = JSON.parse(readFileSync(registryPath, "utf8")) as Record<string, unknown>;
    const external = {
      owner: "external-coordinator",
      writerEpoch: 17,
      unknownRecords: [{ id: "foreign-record", bytes: "preserve-exactly" }],
    };
    state.externalMetadata = external;
    writeFileSync(registryPath, JSON.stringify(state, null, 2) + "\n");

    const reloaded = new WorktreeManager([root], root);
    expect(reloaded.list()).toHaveLength(1);
    reloaded.create("owned-second");

    const after = JSON.parse(readFileSync(registryPath, "utf8")) as Record<string, unknown>;
    expect(after.externalMetadata).toEqual(external);
    expect(after.isolations).toHaveLength(2);
    const reloadedAgain = new WorktreeManager([root], root);
    expect(reloadedAgain.list()).toHaveLength(2);
    expect(JSON.parse(readFileSync(registryPath, "utf8")).externalMetadata).toEqual(external);
  });

  it("fsyncs the new registry inode before rename and its parent directory after rename", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root);
    trace.events = [];
    trace.enabled = true;
    manager.create("durable-create");
    trace.enabled = false;

    expect(trace.events).toEqual(process.platform === "win32"
      ? ["sync-file", "rename-registry"]
      : ["sync-file", "rename-registry", "sync-directory"]);
    const statePath = join(root, ".git", "folderforge", "isolations.json");
    expect(JSON.parse(readFileSync(statePath, "utf8")).isolations).toHaveLength(1);
  });

  it("does not publish a registry write when temporary file fsync fails", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root);
    manager.create("existing-record");
    const dir = join(root, ".git", "folderforge");
    const statePath = join(dir, "isolations.json");
    const durableBefore = readFileSync(statePath);

    trace.enabled = true;
    trace.failFileSync = true;
    expect(() => manager.create("fsync-refused")).toThrow(/INJECTED_FILE_SYNC_FAILURE/);
    trace.enabled = false;

    expect(readFileSync(statePath)).toEqual(durableBefore);
    expect(readdirSync(dir).filter((entry) => entry.endsWith(".tmp"))).toEqual([]);
    expect(new WorktreeManager([root], root).list()).toHaveLength(1);
    expect(readFileSync(join(root, "tracked.txt"), "utf8")).toBe("original\\n");
    // The Git worktree made before registry persistence is intentionally
    // preserved as unknown/orphan evidence, never silently deleted.
  });

  it.skipIf(process.platform === "win32")(
    "fails closed after an injected post-rename directory sync failure", () => {
      const root = repository();
      const manager = new WorktreeManager([root], root);
      trace.enabled = true;
      trace.failDirectorySync = true;
      expect(() => manager.create("injected-uncertain")).toThrow(/ISOLATION_DURABILITY_UNCERTAIN/);
      trace.enabled = false;

      const statePath = join(root, ".git", "folderforge", "isolations.json");
      expect(JSON.parse(readFileSync(statePath, "utf8")).isolations).toHaveLength(1);
      expect(() => manager.create("must-refuse-reuse")).toThrow(/ISOLATION_DURABILITY_UNCERTAIN/);
      expect(new WorktreeManager([root], root).list()).toHaveLength(1);
      expect(readFileSync(join(root, "tracked.txt"), "utf8")).toBe("original\\n");
    },
  );

  it.skipIf(process.platform === "win32")(
    "blocks later mutations when rollback patch directory sync is uncertain", () => {
      const root = repository();
      const manager = new WorktreeManager([root], root);
      const isolation = manager.create("patch-uncertain");
      writeFileSync(join(isolation.worktreeRoot, "tracked.txt"), "changed\\n");
      const registryPath = join(root, ".git", "folderforge", "isolations.json");
      const before = readFileSync(registryPath);

      trace.enabled = true;
      trace.failDirectorySync = true;
      expect(() => manager.apply(isolation.id)).toThrow(/ISOLATION_DURABILITY_UNCERTAIN/);
      trace.enabled = false;

      expect(readFileSync(registryPath)).toEqual(before);
      expect(readFileSync(join(root, "tracked.txt"), "utf8")).toBe("original\\n");
      expect(() => manager.create("must-block-after-uncertain-patch")).toThrow(
        /ISOLATION_DURABILITY_UNCERTAIN/,
      );
    },
  );

  it("makes rollback patch durable before the applying registry journal is renamed", () => {
    const root = repository();
    const manager = new WorktreeManager([root], root);
    const isolation = manager.create("durable-apply");
    writeFileSync(join(isolation.worktreeRoot, "tracked.txt"), "updated\\n");

    trace.events = [];
    trace.enabled = true;
    manager.apply(isolation.id);
    trace.enabled = false;

    const expected = process.platform === "win32"
      ? ["sync-file", "rename-patch", "sync-file", "rename-registry"]
      : ["sync-file", "rename-patch", "sync-directory", "sync-file", "rename-registry", "sync-directory"];
    expect(trace.events.slice(0, expected.length)).toEqual(expected);
    expect(readFileSync(join(root, "tracked.txt"), "utf8")).toBe("updated\\n");
  });
});
