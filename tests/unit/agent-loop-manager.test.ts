import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AgentLoopManager } from '../../src/agent-loops/agent-loop-manager.js';
import type { ToolPrincipal } from '../../src/core/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const owner: ToolPrincipal = { id: 'agent:test-owner', role: 'agent' };
const other: ToolPrincipal = { id: 'agent:other', role: 'agent' };

function submitAdvisoryVotes(manager: AgentLoopManager, id: string) {
  let run = manager.start(id, owner);
  for (const expert of run.experts) {
    run = manager.submitProposal(id, {
      expertId: expert.id,
      phase: 'council',
      summary: `${expert.role} proposal`,
      plan: ['Inspect', 'Implement', 'Verify'],
      risks: ['Regression risk'],
      evidence: ['Repository context reviewed'],
    }, owner);
  }
  const proposals = manager.view(run).currentIterationProposals;
  const winner = proposals[0]!;
  for (const expert of run.experts.slice(0, run.councilMinVotes)) {
    run = manager.submitVote(id, {
      expertId: expert.id,
      proposalId: winner.id,
      score: 1,
      approve: true,
      rationale: 'Strong evidence and bounded plan.',
    }, owner);
  }
  return run;
}

describe('AgentLoopManager', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'folderforge-agent-loop-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('persists an owner-bound loop and rejects another principal', () => {
    const manager = new AgentLoopManager(root);
    const created = manager.create({
      title: 'Feature loop',
      goal: 'Ship the feature safely.',
      acceptanceCriteria: ['Tests pass'],
    }, owner);

    expect(manager.get(created.id, owner).revision).toBeGreaterThan(0);
    expect(() => manager.get(created.id, other)).toThrow(/access denied/i);

    const restarted = new AgentLoopManager(root);
    expect(restarted.view(restarted.get(created.id, owner))).toMatchObject({
      id: created.id,
      state: 'created',
      phase: 'discovery',
      goalGate: { satisfied: false, totalCriteria: 1 },
    });
  });

  it('accepts one durable run idempotency key and rejects conflicting retries', () => {
    const manager = new AgentLoopManager(root);
    const created = manager.create({
      title: 'Idempotent loop',
      goal: 'Do not launch duplicate background runs.',
      acceptanceCriteria: ['Only one claim is recorded'],
    }, owner);

    const claimed = manager.claimRunInvocation(created.id, 'request-123', owner);
    expect(claimed.runInvocationKeyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(manager.claimRunInvocation(created.id, 'request-123', owner).revision).toBe(claimed.revision);
    expect(() => manager.claimRunInvocation(created.id, 'request-456', owner)).toThrow(/different idempotency key/i);
  });

  it('binds a loop to its creating client, session and task context', () => {
    const manager = new AgentLoopManager(root);
    const bound: ToolPrincipal = {
      id: 'agent:bound-owner',
      role: 'agent',
      oauthClientId: 'client-a',
      sessionId: 'session-a',
      taskId: 'task-a',
    };
    const created = manager.create({
      title: 'Bound loop',
      goal: 'Keep remote execution correlated.',
      acceptanceCriteria: ['Context is preserved'],
    }, bound);

    expect(created).toMatchObject({
      ownerId: bound.id,
      clientId: bound.oauthClientId,
      sessionId: bound.sessionId,
      taskId: bound.taskId,
    });
    expect(() => manager.get(created.id, { ...bound, sessionId: 'session-b' })).toThrow(/session binding/i);
    expect(() => manager.get(created.id, { ...bound, oauthClientId: 'client-b' })).toThrow(/client binding/i);
    expect(() => manager.get(created.id, { ...bound, taskId: 'task-b' })).toThrow(/task binding/i);
    expect(() => manager.get(created.id, { ...bound, taskId: undefined })).toThrow(/task binding/i);
    expect(manager.get(created.id, bound).id).toBe(created.id);
    expect(manager.get(created.id, bound).events[0]?.data).toMatchObject({ taskId: 'task-a' });
  });

  it('retains advisory votes without authorizing implementation', () => {
    const manager = new AgentLoopManager(root);
    const created = manager.create({
      title: 'Blocked loop',
      goal: 'Require verified review.',
      acceptanceCriteria: ['Tests pass'],
      councilMinVotes: 2,
    }, owner);
    const advisory = submitAdvisoryVotes(manager, created.id);
    expect(advisory.votes).toHaveLength(2);
    expect(() => manager.decide(created.id, owner)).toThrow(/BLOCKED_REVIEW/);
    const current = manager.get(created.id, owner);
    expect(current.phase).toBe('council');
    expect(current.decision).toBeUndefined();
    expect(manager.view(current)).toMatchObject({ reviewAuthority: 'NOT_QUORATE', goalGate: { satisfied: false } });
  });

  it('does not permit an admin to bypass reviewer authority', () => {
    const manager = new AgentLoopManager(root);
    const created = manager.create({ title: 'Admin denial', goal: 'No override', acceptanceCriteria: ['Review'] }, owner);
    submitAdvisoryVotes(manager, created.id);
    expect(() => manager.decide(created.id, { id: 'admin:test', role: 'admin' })).toThrow(/BLOCKED_REVIEW/);
  });

  it('persists lifecycle events and supports bounded sequence polling', () => {
    const manager = new AgentLoopManager(root);
    const created = manager.create({
      title: 'Event loop',
      goal: 'Expose durable progress.',
      acceptanceCriteria: ['Events are queryable'],
    }, owner);

    let run = manager.start(created.id, owner);
    run = manager.pause(created.id, owner, 'Operator review.');
    run = manager.start(created.id, owner);
    run = manager.cancel(created.id, owner, 'No longer needed.');

    expect(run.events.map((event) => event.type)).toEqual([
      'created',
      'started',
      'paused',
      'resumed',
      'cancelled',
    ]);
    const page = manager.eventsSince(created.id, 1, 2, owner);
    expect(page.events.map((event) => event.seq)).toEqual([2, 3]);
    expect(page.latestSeq).toBe(5);
    expect(page.hasMore).toBe(true);
    expect(() => manager.eventsSince(created.id, 0, 10, other)).toThrow(/access denied/i);
    });

    it('records advisory events without inventing decision or verification events', () => {
      const manager = new AgentLoopManager(root);
      const created = manager.create({ title: 'Phase events', goal: 'Capture advisory phases.', acceptanceCriteria: ['Review'] }, owner);
      submitAdvisoryVotes(manager, created.id);
      expect(() => manager.decide(created.id, owner)).toThrow(/BLOCKED_REVIEW/);
      const types = manager.get(created.id, owner).events.map(event => event.type);
      expect(types).toEqual(expect.arrayContaining(['created', 'started', 'proposal.submitted', 'vote.submitted']));
      expect(types).not.toContain('council.decided');
      expect(types).not.toContain('implementation.updated');
      expect(types).not.toContain('verification.passed');
    });

    it('bounds event history, payloads, and loads legacy runs without events', () => {
      const manager = new AgentLoopManager(root);
      const created = manager.create({
        title: 'Bounded events',
        goal: 'Keep event storage bounded.',
        acceptanceCriteria: ['Events remain bounded'],
      }, owner);

      let run = manager.start(created.id, owner);
      for (let index = 0; index < 260; index += 1) {
        run = manager.pause(created.id, owner, `Review ${index}`);
        run = manager.start(created.id, owner);
      }
      expect(run.events).toHaveLength(500);
      expect(run.events[0]!.seq).toBeGreaterThan(1);
      const page = manager.eventsSince(created.id, 0, 500);
      expect(page.events).toHaveLength(200);
      expect(page.hasMore).toBe(true);

      const longTaskOwner = { ...owner, taskId: 'x'.repeat(5000) };
      const large = manager.create({ title: 'Bound payload', goal: 'Bound event data', acceptanceCriteria: ['Bounded'] }, longTaskOwner);
      expect(large.events[0]!.data).toMatchObject({ truncated: true });
      expect(JSON.stringify(large.events[0]!.data).length).toBeLessThanOrEqual(4_000);

      const path = join(root, '.folderforge', 'agent-loops', 'runs', `${created.id}.json`);
      const legacy = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
      delete legacy.events;
      const { integritySha256: _oldIntegrity, ...unsigned } = legacy;
      legacy.integritySha256 = createHash('sha256').update(JSON.stringify(unsigned)).digest('hex');
      writeFileSync(path, JSON.stringify(legacy, null, 2));
      const restarted = new AgentLoopManager(root);
      expect(restarted.get(created.id, owner).events).toEqual([]);
    });

    it('fails closed when a persisted run is tampered with', () => {
      const manager = new AgentLoopManager(root);
      const created = manager.create({
        title: 'Tamper loop',
        goal: 'Reject modified durable state.',
        acceptanceCriteria: ['Integrity is enforced'],
      }, owner);
      const path = join(root, '.folderforge', 'agent-loops', 'runs', `${created.id}.json`);
      const persisted = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
      persisted.goal = 'attacker changed the goal';
      writeFileSync(path, JSON.stringify(persisted, null, 2));

      expect(() => manager.get(created.id, owner)).toThrow(/integrity check failed/i);
    });
});
