import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AgentLoopManager } from "../../src/agent-loops/agent-loop-manager.js";
import { AgentLoopRunner } from "../../src/agent-loops/agent-loop-runner.js";
import type { ToolPrincipal, ToolResult } from "../../src/core/types.js";

const owner: ToolPrincipal = { id: "agent:runner-test", role: "agent" };

function ok(data: unknown): ToolResult {
  return { ok: true, data };
}

async function waitForTerminal(
  manager: AgentLoopManager,
  id: string,
): Promise<ReturnType<AgentLoopManager["get"]>> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const run = manager.get(id, owner);
    if (run.state !== "running" && run.state !== "created") return run;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("runner did not reach a terminal or paused state in time");
}

describe("AgentLoopRunner", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "folderforge-agent-loop-runner-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("discovers and pauses at the unverified council boundary", async () => {
    const manager = new AgentLoopManager(root);
    const calls: string[] = [];
    const runner = new AgentLoopRunner(manager, async (name) => {
      calls.push(name);
      if (name === "project_analyze")
        return ok({ projectRoot: root, commands: {} });
      if (name === "code_context")
        return ok({ results: [{ path: "src/example.ts" }] });
      throw new Error(`unexpected tool call: ${name}`);
    });
    const created = manager.create(
      {
        title: "Safe runner",
        goal: "Inspect and plan the change.",
        acceptanceCriteria: ["The goal is verified"],
      },
      owner,
    );

    runner.start(created.id, owner);
    const paused = await waitForTerminal(manager, created.id);

    expect(paused).toMatchObject({ state: "paused", phase: "paused" });
    expect(paused.pauseReason).toMatch(/BLOCKED_REVIEW/);
    expect(paused.votes).toHaveLength(0);
    expect(paused.decision).toBeUndefined();
    expect(paused.implementation).toBeUndefined();
    expect(calls).toContain("project_analyze");
    expect(calls).toContain("code_context");
    expect(runner.status(created.id)?.state).toBe("finished");
  });

  it("records a runner exception as a durable error event and pauses safely", async () => {
    const manager = new AgentLoopManager(root);
    const runner = new AgentLoopRunner(manager, async (name) => {
      throw new Error(`simulated ${name} failure`);
    });
    const created = manager.create(
      {
        title: "Failing runner",
        goal: "Record orchestration failures.",
        acceptanceCriteria: ["Failure is visible"],
      },
      owner,
    );

    runner.start(created.id, owner);
    const paused = await waitForTerminal(manager, created.id);

    expect(paused).toMatchObject({ state: "paused", phase: "paused" });
    expect(paused.pauseReason).toMatch(/simulated project_analyze failure/);
    expect(paused.events.at(-1)).toMatchObject({ type: "runner.error" });
    expect(runner.status(created.id)).toMatchObject({
      state: "failed",
      error: "simulated project_analyze failure",
    });
  });

  it("does not dispatch even a configured implementation workflow", async () => {
    const manager = new AgentLoopManager(root);
    const calls: string[] = [];
    const runner = new AgentLoopRunner(manager, async name => {
      calls.push(name);
      return ok({});
    });
    const created = manager.create({ title: "Blocked runner", goal: "Require review", acceptanceCriteria: ["No writes"] }, owner);
    runner.start(created.id, owner, { workflowId: "workflow_test" });
    const paused = await waitForTerminal(manager, created.id);
    expect(paused.pauseReason).toMatch(/BLOCKED_REVIEW/);
    expect(paused.implementation).toBeUndefined();
    expect(calls).toEqual(["project_analyze", "code_context"]);
  });

  it("pauses before work when the runner signal is already cancelled", async () => {
    const manager = new AgentLoopManager(root);
    const runner = new AgentLoopRunner(manager, async () => ok({}));
    const created = manager.create(
      {
        title: "Cancelled runner",
        goal: "Stop without starting work.",
        acceptanceCriteria: ["Cancellation is durable"],
      },
      owner,
    );
    const controller = new AbortController();
    controller.abort();

    runner.start(created.id, owner, {}, { signal: controller.signal });
    const paused = await waitForTerminal(manager, created.id);
    expect(paused).toMatchObject({ state: "paused", phase: "paused" });
    expect(paused.pauseReason).toMatch(/cancelled by client/i);
  });

  it("coalesces duplicate starts for the same loop", async () => {
    const manager = new AgentLoopManager(root);
    const calls: string[] = [];
    const runner = new AgentLoopRunner(manager, async (name) => {
      calls.push(name);
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (name === "project_analyze") return ok({ projectRoot: root });
      if (name === "code_context") return ok({ results: [] });
      throw new Error(`unexpected tool call: ${name}`);
    });
    const created = manager.create(
      {
        title: "Duplicate start",
        goal: "Only one execution may run.",
        acceptanceCriteria: ["Duplicate starts are coalesced"],
      },
      owner,
    );

    const first = runner.start(created.id, owner);
    const second = runner.start(created.id, owner);
    expect(second).toEqual(first);
    await waitForTerminal(manager, created.id);
    expect(calls.filter((name) => name === "project_analyze")).toHaveLength(1);
  });

  it("does not produce a proof pack from unverified council approval", async () => {
    const manager = new AgentLoopManager(root);
    const calls: string[] = [];
    const runner = new AgentLoopRunner(manager, async name => { calls.push(name); return ok({}); });
    const created = manager.create({ title: "Proof gate", goal: "No fabricated proof", acceptanceCriteria: ["Verified authority"] }, owner);
    runner.start(created.id, owner, { workflowId: "workflow-proof" });
    const paused = await waitForTerminal(manager, created.id);
    expect(paused.verification).toBeUndefined();
    expect(calls).not.toContain("workflow_proof_pack");
    expect(calls).not.toContain("project_verify");
  });
});
