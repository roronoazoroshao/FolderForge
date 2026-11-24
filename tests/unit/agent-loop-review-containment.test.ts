import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AgentLoopManager, type AgentLoopRun } from '../../src/agent-loops/agent-loop-manager.js';
import { AgentLoopRunner } from '../../src/agent-loops/agent-loop-runner.js';
import type { ToolPrincipal } from '../../src/core/types.js';

const author: ToolPrincipal = { id: 'agent:review-containment-test', role: 'agent' };

function createLoop(manager: AgentLoopManager) {
  return manager.create({ title: 'Review containment', goal: 'Require independent review', acceptanceCriteria: ['No unverified authorization'] }, author);
}

function submitUnverifiedVotes(manager: AgentLoopManager, id: string) {
  let run = manager.start(id, author);
  run = manager.submitProposal(id, { expertId: run.experts[0]!.id, summary: 'Unverified proposal' }, author);
  const proposalId = run.proposals[0]!.id;
  for (const expert of run.experts) {
    run = manager.submitVote(id, { expertId: expert.id, proposalId, score: 1, approve: true, rationale: 'Caller assertion only' }, author);
  }
  return run;
}

// A disposable historical schema-v1 record with a valid legacy checksum.
// It is intentionally NOT a verified review or authorization.
function legacyState(root: string, run: AgentLoopRun, phase: 'implementation' | 'verification') {
  const path = join(root, '.folderforge', 'agent-loops', 'runs', run.id + '.json');
  const persisted = JSON.parse(readFileSync(path, 'utf8')) as AgentLoopRun;
  persisted.state = 'running';
  persisted.phase = phase;
  const proposalId = persisted.proposals[0]!.id;
  persisted.decision = { proposalId, consensus: 1, approvalRate: 1, voteCount: 4, decidedAt: 1, ranked: [] };
  const { integritySha256: _oldIntegrity, ...unsigned } = persisted;
  persisted.integritySha256 = createHash('sha256').update(JSON.stringify(unsigned)).digest('hex');
  writeFileSync(path, JSON.stringify(persisted, null, 2));
}

async function settled(manager: AgentLoopManager, id: string) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const run = manager.get(id, author);
    if (run.state !== 'running' && run.state !== 'created') return run;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error('Agent loop did not settle');
}

describe('ARB-001 unverified council containment', () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'ff-arb001-')); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it('pauses before any implementation tool call without independent review', async () => {
    const manager = new AgentLoopManager(root);
    const calls: string[] = [];
    const runner = new AgentLoopRunner(manager, async name => {
      calls.push(name);
      if (name === 'project_analyze' || name === 'code_context') return { ok: true, data: {} };
      return { ok: false, error: 'Unexpected privileged progression' };
    });
    const run = createLoop(manager);
    runner.start(run.id, author, { workflowId: 'workflow_test' });
    const paused = await settled(manager, run.id);
    expect(paused.state).toBe('paused');
    expect(paused.votes).toHaveLength(0);
    expect(paused.decision).toBeUndefined();
    expect(paused.implementation).toBeUndefined();
    expect(calls).toEqual(['project_analyze', 'code_context']);
  });

  it('never accepts caller-asserted votes as an independent decision', () => {
    const manager = new AgentLoopManager(root);
    const run = createLoop(manager);
    submitUnverifiedVotes(manager, run.id);
    expect(() => manager.decide(run.id, author)).toThrow(/review|provenance|authority/i);
    const current = manager.get(run.id, author);
    expect(current.decision).toBeUndefined();
    expect(current.phase).not.toBe('implementation');
  });

  it('rejects implementation and verification updates based on legacy approval', () => {
    const manager = new AgentLoopManager(root);
    const run = submitUnverifiedVotes(manager, createLoop(manager).id);
    legacyState(root, run, 'implementation');
    const restarted = new AgentLoopManager(root);
    expect(() => restarted.recordImplementation(run.id, { status: 'completed', summary: 'Unverified change' }, author)).toThrow(/review|provenance|authority/i);
    legacyState(root, run, 'verification');
    expect(() => restarted.recordVerification(run.id, { passed: true, criteria: [{ name: 'No unverified authorization', passed: true }] }, author)).toThrow(/review|provenance|authority/i);
    expect(restarted.get(run.id, author).state).not.toBe('completed');
  });

  it('does not run an implementation workflow from a persisted legacy decision', async () => {
    const manager = new AgentLoopManager(root);
    const run = submitUnverifiedVotes(manager, createLoop(manager).id);
    legacyState(root, run, 'implementation');
    const restarted = new AgentLoopManager(root);
    const calls: string[] = [];
    const runner = new AgentLoopRunner(restarted, async name => {
      calls.push(name);
      return { ok: false, error: 'Unexpected privileged progression' };
    });
    runner.start(run.id, author, { workflowId: 'workflow_test' });
    const paused = await settled(restarted, run.id);
    expect(paused.state).toBe('paused');
    expect(calls).toEqual([]);
  });

  it('does not run verification from a persisted legacy decision during recovery', async () => {
    const manager = new AgentLoopManager(root);
    const run = submitUnverifiedVotes(manager, createLoop(manager).id);
    legacyState(root, run, 'verification');
    const restarted = new AgentLoopManager(root);
    const calls: string[] = [];
    const runner = new AgentLoopRunner(restarted, async name => {
      calls.push(name);
      return { ok: false, error: 'Unexpected privileged progression' };
    });
    expect(runner.recover()).toBe(1);
    const paused = await settled(restarted, run.id);
    expect(paused.state).toBe('paused');
    expect(calls).toEqual([]);
  });
});
