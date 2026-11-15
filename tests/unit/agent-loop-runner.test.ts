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

/** Existing legacy manager supports manual votes; this is test setup, never AI-board approval. */
function enterLegacyManualImplementation(manager: AgentLoopManager, id: string): void {
  manager.start(id, owner);
  let run = manager.submitProposal(id, {
    expertId: 'architect', summary: 'TEST-ONLY manual approval for workflow tests',
  }, owner);
  const proposal = run.proposals.at(-1)!;
  for (const expert of run.experts.slice(0, run.councilMinVotes)) {
    run = manager.submitVote(id, {
      expertId: expert.id, proposalId: proposal.id,
      score: 1, approve: true, rationale: 'Legacy test-only manual vote; not an AI model invocation',
    }, owner);
  }
  manager.decide(id, owner);
}

describe("AgentLoopRunner", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "folderforge-agent-loop-runner-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("refuses synthetic expert voting and pauses before any implementation", async () => {
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
    expect(paused.pauseReason).toMatch(/independent|reviewer|model/i);
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

  it("runs governed implementation and verification to completion", async () => {
    const manager = new AgentLoopManager(root);
    const calls: string[] = [];
    const runner = new AgentLoopRunner(manager, async (name) => {
      calls.push(name);
      if (name === "project_analyze") return ok({ projectRoot: root });
      if (name === "code_context") return ok({ results: [] });
      if (name === "workflow_run")
        return ok({ state: "completed", files: [{ path: "src/example.ts" }] });
      if (name === "project_verify")
        return ok({
          overall: "passed",
          passed: true,
          results: [{ check: "test", status: "passed" }],
        });
      throw new Error(`unexpected tool call: ${name}`);
    });
    const created = manager.create(
      {
        title: "Complete runner",
        goal: "Implement and verify the change.",
        acceptanceCriteria: ["All checks pass"],
      },
      owner,
    );

    enterLegacyManualImplementation(manager, created.id);
    runner.start(created.id, owner, { workflowId: "workflow_test" });
    const completed = await waitForTerminal(manager, created.id);

    expect(completed).toMatchObject({ state: "completed", phase: "completed" });
    expect(completed.implementation?.changedPaths).toEqual(["src/example.ts"]);
    expect(completed.verification?.passed).toBe(true);
    expect(calls).toEqual(
      expect.arrayContaining([
        "workflow_run",
        "project_verify",
      ]),
    );
  });

  it("extracts changed paths from nested workflow step evidence", async () => {
    const manager = new AgentLoopManager(root);
    const runner = new AgentLoopRunner(manager, async (name) => {
      if (name === "project_analyze") return ok({ projectRoot: root });
      if (name === "code_context") return ok({ results: [] });
      if (name === "workflow_run")
        return ok({
          state: "completed",
          steps: [
            {
              id: "implement",
              evidence: {
                data: {
                  files: [{ path: "src/nested-change.ts" }],
                },
              },
            },
          ],
        });
      if (name === "project_verify")
        return ok({ overall: "passed", passed: true, results: [] });
      throw new Error(`unexpected tool call: ${name}`);
    });
    const created = manager.create(
      {
        title: "Nested evidence runner",
        goal: "Read changed paths from governed workflow evidence.",
        acceptanceCriteria: ["Nested changes are recognized"],
      },
      owner,
    );

    enterLegacyManualImplementation(manager, created.id);
    runner.start(created.id, owner, { workflowId: "workflow-nested-evidence" });
    const completed = await waitForTerminal(manager, created.id);

    expect(completed).toMatchObject({ state: "completed", phase: "completed" });
    expect(completed.implementation?.changedPaths).toEqual(["src/nested-change.ts"]);
  });

  it("pauses when the implementation workflow is awaiting approval", async () => {
    const manager = new AgentLoopManager(root);
    const runner = new AgentLoopRunner(manager, async (name) => {
      if (name === "project_analyze") return ok({ projectRoot: root });
      if (name === "code_context") return ok({ results: [] });
      if (name === "workflow_run")
        return ok({ state: "paused", reason: "approval required" });
      throw new Error(`unexpected tool call: ${name}`);
    });
    const created = manager.create(
      {
        title: "Approval pause",
        goal: "Wait for implementation approval.",
        acceptanceCriteria: ["Approval is preserved"],
      },
      owner,
    );

    enterLegacyManualImplementation(manager, created.id);
    runner.start(created.id, owner, { workflowId: "workflow-needs-approval" });
    const paused = await waitForTerminal(manager, created.id);
    expect(paused).toMatchObject({ state: "paused", phase: "paused" });
    expect(paused.implementation?.summary).toMatch(/awaiting approval/i);
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

  it("attaches and verifies a Proof Pack after successful verification", async () => {
    const manager = new AgentLoopManager(root);
    const calls: string[] = [];
    const runner = new AgentLoopRunner(manager, async (name) => {
      calls.push(name);
      if (name === "project_analyze") return ok({ projectRoot: root });
      if (name === "code_context") return ok({ results: [] });
      if (name === "workflow_run")
        return ok({ state: "completed", files: [{ path: "src/example.ts" }] });
      if (name === "project_verify")
        return ok({ overall: "passed", passed: true, results: [] });
      if (name === "workflow_proof_pack")
        return ok({
          proofPack: { id: "proof_123", manifestSha256: "a".repeat(64) },
        });
      if (name === "workflow_proof_verify") return ok({ verified: true });
      throw new Error(`unexpected tool call: ${name}`);
    });
    const created = manager.create(
      {
        title: "Proof-backed runner",
        goal: "Verify and preserve evidence.",
        acceptanceCriteria: ["Evidence is preserved"],
      },
      owner,
    );

    enterLegacyManualImplementation(manager, created.id);
    runner.start(created.id, owner, { workflowId: "workflow-proof" });
    const completed = await waitForTerminal(manager, created.id);

    expect(completed.state).toBe("completed");
    expect(completed.verification?.proofPack).toEqual({
      id: "proof_123",
      manifestSha256: "a".repeat(64),
      verified: true,
    });
    expect(calls).toEqual(
      expect.arrayContaining(["workflow_proof_pack", "workflow_proof_verify"]),
    );
  });
});
