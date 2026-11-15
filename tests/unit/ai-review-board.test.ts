import { describe, expect, it } from 'vitest';
import { runAiReviewBoard } from '../../src/ai-board/board.js';
import { REVIEW_ROLES } from '../../src/ai-board/roles.js';
import type { ReviewerProvider, ReviewerRequest, ReviewerResponse } from '../../src/ai-board/board.js';

const sourceSha = 'a'.repeat(40);
const evidence = [{ path: 'docs/goal.md', content: 'GOAL: Trustworthy agent execution within an owner-controlled workspace.' }];

function makeProvider(
  change?: (request: ReviewerRequest, result: ReviewerResponse) => ReviewerResponse,
) {
  const calls: ReviewerRequest[] = [];
  let index = 0;
  const provider: ReviewerProvider = {
    async review(request) {
      calls.push(request);
      const result: ReviewerResponse = {
        provider: 'test-provider', model: 'test-model',
        responseId: `response-${++index}`, inputDigest: request.inputDigest,
        vote: 'APPROVE', rationale: `Reviewed ${request.role.id} against goal evidence`,
        dissent: 'This proposal could hide operations without OS confinement.', findings: [],
      };
      return change?.(request, result) ?? result;
    },
  };
  return { provider, calls };
}

describe('evidence-backed AI review board', () => {
  it('runs 8 role agents in distinct blind and cross-examination calls, then grants GOAL approval', async () => {
    const { provider, calls } = makeProvider();
    const report = await runAiReviewBoard({ stage: 'GOAL', sourceSha, evidence, provider });
    expect(REVIEW_ROLES).toHaveLength(8);
    expect(report.state).toBe('APPROVED');
    expect(report.quorum).toBe(8);
    expect(report.votes).toHaveLength(8);
    expect(calls).toHaveLength(16);
    expect(calls.filter(x => x.round === 'BLIND')).toHaveLength(8);
    expect(calls.filter(x => x.round === 'BLIND').every(x => x.peerFindings.length === 0)).toBe(true);
    expect(calls.filter(x => x.round === 'CHALLENGE').every(x => x.peerFindings.length > 0)).toBe(true);
    expect(new Set(report.receipts.map(x => x.responseId)).size).toBe(16);
    expect(report.inputDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(report.decisionDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('refuses to invent reviewer votes if no provider is configured', async () => {
    const report = await runAiReviewBoard({ stage: 'GOAL', sourceSha, evidence });
    expect(report.state).toBe('NOT_QUORATE');
    expect(report.votes).toHaveLength(0);
    expect(report.receipts).toHaveLength(0);
  });

  it('rejects duplicated provider response identifiers across roles', async () => {
    const { provider } = makeProvider((_request, result) => ({ ...result, responseId: 'same-provider-id' }));
    const report = await runAiReviewBoard({ stage: 'GOAL', sourceSha, evidence, provider });
    expect(report.state).toBe('NOT_QUORATE');
    expect(report.quorum).toBe(0);
  });

  it('refuses stale provider input digests and excludes those votes', async () => {
    const { provider } = makeProvider((_request, result) => ({ ...result, inputDigest: 'b'.repeat(64) }));
    const report = await runAiReviewBoard({ stage: 'GOAL', sourceSha, evidence, provider });
    expect(report.state).toBe('NOT_QUORATE');
    expect(report.votes).toHaveLength(0);
  });

  it('a security reviewer can veto an otherwise unanimous approval', async () => {
    const { provider } = makeProvider((request, result) => request.role.id === 'A-SEC' && request.round === 'CHALLENGE'
      ? { ...result, vote: 'REQUEST_CHANGES', findings: [{ kind: 'OBSERVED', severity: 'BLOCKER', claim: 'No verified OS isolation', evidence: 'No sandbox implementation in repo', counterexample: 'shell reads outside cwd', fix: 'Add OS-bound confinement test', owner: 'FF-009' }] }
      : result);
    const report = await runAiReviewBoard({ stage: 'GOAL', sourceSha, evidence, provider });
    expect(report.state).toBe('CHANGES_REQUESTED');
    expect(report.blockers).toContain('A-SEC');
  });

  it('cannot approve a BLOCKER even when a model incorrectly votes APPROVE', async () => {
    const { provider } = makeProvider((request, result) => request.role.id === 'A-QA' && request.round === 'CHALLENGE'
      ? { ...result, findings: [{ kind: 'OBSERVED', severity: 'BLOCKER', claim: 'Missing test', evidence: 'AC is untraced', counterexample: 'counterexample', fix: 'Add regression', owner: 'FF-029' }] }
      : result);
    const report = await runAiReviewBoard({ stage: 'GOAL', sourceSha, evidence, provider });
    expect(report.state).toBe('CHANGES_REQUESTED');
  });

  it('refuses malformed model findings instead of crashing the whole board run', async () => {
    const { provider } = makeProvider((request, result) => request.role.id === 'A-SEC'
      ? { ...result, findings: [null] as unknown as ReviewerResponse['findings'] }
      : result);
    const report = await runAiReviewBoard({ stage: 'GOAL', sourceSha, evidence, provider });
    expect(report.state).toBe('NOT_QUORATE');
    expect(report.errors.some(e => e.includes('A-SEC'))).toBe(true);
  });

  it('does not count conditional approvals without a concrete issue and owner', async () => {
    const { provider } = makeProvider((request, result) => request.role.id === 'A-ARCH'
      ? { ...result, vote: 'APPROVE_WITH_CONDITIONS' }
      : result);
    const report = await runAiReviewBoard({ stage: 'GOAL', sourceSha, evidence, provider });
    expect(report.state).toBe('NOT_QUORATE');
  });

  it('requires a successful preceding gate before ROADMAP, SPEC, PLAN, TASK and PR', async () => {
    const { provider } = makeProvider();
    await expect(runAiReviewBoard({ stage: 'ROADMAP', sourceSha, evidence, provider })).rejects.toThrow(/GOAL/);
    let previous = await runAiReviewBoard({ stage: 'GOAL', sourceSha, evidence, provider });
    for (const stage of ['ROADMAP', 'SPEC', 'PLAN', 'TASK', 'PR'] as const) {
      const current = await runAiReviewBoard({ stage, sourceSha, evidence, provider, previous });
      expect(current.state).toBe('APPROVED');
      expect(current.previousDecisionDigest).toBe(previous.decisionDigest);
      previous = current;
    }
  });

  it('invalidates previous stage decisions when the reviewed source SHA changes', async () => {
    const { provider } = makeProvider();
    const previous = await runAiReviewBoard({ stage: 'GOAL', sourceSha, evidence, provider });
    await expect(runAiReviewBoard({ stage: 'ROADMAP', sourceSha: 'b'.repeat(40),
      evidence, previous, provider })).rejects.toThrow(/source sha/i);
  });

  it('fails closed if a provider invocation errors, without elevating to majority approval', async () => {
    const { provider } = makeProvider();
    const failing: ReviewerProvider = { review: async (request) => {
      if (request.role.id === 'A-SEC') throw new Error('Provider unavailable');
      return provider.review(request);
    } };
    const report = await runAiReviewBoard({ stage: 'GOAL', sourceSha, evidence, provider: failing });
    expect(report.state).toBe('NOT_QUORATE');
    expect(report.errors.some(x => x.includes('A-SEC'))).toBe(true);
  });

  it('rejects invalid source hashes or evidence and never silently truncates input', async () => {
    const { provider } = makeProvider();
    await expect(runAiReviewBoard({ stage: 'GOAL', sourceSha: 'main', evidence, provider })).rejects.toThrow(/sha/i);
    await expect(runAiReviewBoard({ stage: 'GOAL', sourceSha, evidence: [], provider })).rejects.toThrow(/evidence/i);
    await expect(runAiReviewBoard({ stage: 'GOAL', sourceSha, evidence: [{path:'a',content:'x'.repeat(260_000)}], provider })).rejects.toThrow(/size/i);
  });
});
