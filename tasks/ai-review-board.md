# AI Review Board — 7 implementation tasks

**Owner intent:** AI agents independently advise and decide GOAL → ROADMAP → SPEC → PLAN → TASK → PR. [Spec](../docs/superpowers/specs/2026-11-15-ai-board-execution-design.md), [Plan](../docs/superpowers/plans/2026-11-15-ai-board-implementation-plan.md), [P0 issue #202](https://github.com/roronoazoroshao/FolderForge/issues/202). **Current completion states are local source progress, not production qualification.**

- [x] **ARB-001: Define 8 expert role prompts** — `src/ai-board/roles.ts`; test role ID and count. *SOURCE-TESTED*.
- [x] **ARB-002: Two-round adversarial review engine** — `src/ai-board/board.ts`; test 8 blind/8 challenge, no provider/no vote, duplicate/stale receipt, veto, stage chain. *SOURCE-TESTED*.
- [x] **ARB-003: OpenAI Responses API reviewer adapter** — `src/ai-board/openai-provider.ts`; structured JSON, store false, no tools, timeout, refusal/429 fail-closed. *SOURCE-TESTED WITH FAKE FETCH; no actual model executions yet*.
- [x] **ARB-004: Explicit CLI + audit JSON** — `src/ai-board/cli.ts`, package command; tests for no network, out-of-repo file, missing model/key. *SOURCE-TESTED*.
- [x] **ARB-005: Disable synthetic council approvals in legacy runner** — `src/agent-loops/agent-loop-runner.ts`; negative regression. *SOURCE-TESTED*.
- [ ] **ARB-006: Real multi-reviewer API run** — approved model credentials, clean checkout, real 16 provider IDs, verify inputs/outputs, usage budget, publish redacted evidence. **NOT RUN / needs explicit operator provider configuration**.
- [ ] **ARB-007: Full chain and product integration** — 6 decisions with valid predecessor, authenticated/signed trust store, dashboard API, true provider diversity, fact verification and re-review on SHA changes. **NOT IMPLEMENTED**.

**Gate ARB-C0** remains unchecked until full required source checks and CI exact commit green. **ARB-C1** requires actual model run receipts; **ARB-C2** requires verified multi-stage run; **ARB-C3** requires UI/integration and security review.
