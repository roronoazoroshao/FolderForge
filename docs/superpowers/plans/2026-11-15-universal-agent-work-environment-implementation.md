# Universal Agent Work Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (if an actual independent worker tool exists) or `superpowers:executing-plans`. Execute task-by-task, TDD first. **Never fabricate subagents, model run receipts, tests or PR review.**

**Goal:** Build an agent-neutral, owner-governed workspace where distinct AI principals can observe, act and verify coding, live Web UI and native creative workflows without crossing other agents' boundaries.

**Architecture:** Keep FolderForge modular monolith control plane, MCP adapters, ToolRegistry, policy/audit, capsule/sandbox, Playwright and proof infrastructure. Bind a verified principal+grant+workspace to an isolated executor, route capability tools through the same policy, attach observation and outcome evidence. No new proprietary agent model loop or VM engine.

**Tech Stack:** existing Node 22+, TypeScript, Vitest, MCP SDK, Mission Control React, Playwright child MCP, Docker/Podman when a verified runtime is available; native Figma/creative API adapters behind opt-in grants. **Spec:** [Architecture and acceptance](../specs/2026-11-15-universal-agent-work-environment-design.md). **Goal Map:** [Product targets](../../strategy/UNIVERSAL_AGENT_GOALMAP_2026-11-15.md). **Roadmap:** [Milestones](../../strategy/UNIVERSAL_AGENT_ROADMAP_2026-11-15.md). **Task tracker:** [UA-001…UA-018](../../../tasks/universal-agent-todo.md).

## Global Constraints

- Source currently inspected at `main@104f57f`; re-read branch, worktree, disk and exact current source SHA each task; unreviewed PR #200/#203 are NOT main by implication.
- One task = one reviewable vertical slice (typically ≤5 edited source/test files), one focused test cycle, one concrete done-or-blocked verdict, one handoff.
- Every mutation through ToolRegistry/policy/audit; identity/grant resolved from authenticated store, never prompt text or mutable `WorkspaceManager.current`.
- Agent full-power toolset only inside verified OS boundary; `worktree` alone is not a sandbox. Host operator access is a separately scoped broker with owner grants and signed operational evidence.
- Never rewrite untouched subsystems, install unsolicited dependencies, bypass failing tests/branch protections, force-delete worktrees, or alter active isolation registry/recovery (#118).
- `npm run typecheck`, `npm run lint`, `npm run architecture:check`, `npm run docs:check`, focused Vitest, full CI on exact SHA before merging production code. Heavy build on CI/isolated runner when host capacity is unsafe.
- Keep git `main` as **one canonical integrated branch**, not as an excuse to discard WIP. Short-lived feature branches allowed. Merge only with current HEAD review/CI/security gates; delete a merged remote branch only after proven ancestry and recovery safety. Archived detached worktrees are not equivalent to branches.
- No automatic deploy, registry cleanup, privileged host access, or credential spend without authorized operator action. Human owner approval remains necessary for host/release effects.

## Review Focus — hazards cross-cutting all tasks

1. **Shared-bearer masquerade:** 10 chat tabs on one OAuth token cannot be counted as 10 independent principals. Test UA-003/UA-014 with impersonation and missing per-slot credential.
2. **OS isolation bypass:** worktree/cwd/container configured, but shared host UID, mounted secrets or Docker socket still accessible. Test UA-004/UA-005 with sibling read/process/network/credentials.
3. **Browser transitive bypass:** arbitrary Chromium download/loopback/internal URL or cookies shared across slots. Test UA-007 with denied origins and cross-profile state.
4. **False visual PASS:** screenshot looks right but console/network/API/functional assertion failed. Test UA-009/UA-010 seeded regressions and `unknown` outcomes.
5. **Native design fake editability:** only generated PNG while user expects editable frame/layer/source. Test UA-011/UA-012 re-open and mutate named layer plus render diff.

## Task DAG / stage gates

```text
UA-001 baseline
  └─ UA-002 context+grants
       ├─ UA-003 MCP binding
       │    └─ UA-006 connect/first action
       └─ UA-004 executor OS proof
            ├─ UA-005 two-agent cross-root negatives
            └─ UA-014 ten-slot quotas
UA-003, UA-004, UA-006 ─► UA-007 browser observe/act ─► UA-008 live app runner
                                             └─► UA-009 evidence + assertions ─► UA-010 repair loop
UA-003, UA-004 ─► UA-011 creative adapter contract ─► UA-012 editable render/revision
UA-006, UA-009 ─► UA-013 owner UI parity (creative preview optional when UA-012 is verified)
UA-014, UA-004 ─► UA-015 host broker (advanced, separate gate)
UA-010, UA-012, UA-014 ─► UA-016 app/agent handoff
UA-010, UA-012, UA-016 ─► UA-017 competitor benchmark
UA-013, UA-014, UA-017 + ops signoff ─► UA-018 release canary
```

**Checkpoints:** C0 after UA-001; C1 after UA-002/003/005; C2 OS boundary after UA-004; C3 after UA-006; C4 after UA-007–010; C5 after UA-011/012; C6 after UA-014; C7 after UA-016/017; C8 only after UA-018 with owner operational signoff. Do not pretend one DAG edge means all cross-cutting tests have passed.

## Execution cards — use with [task tracker](../../../tasks/universal-agent-todo.md)

### Task UA-001: Freeze current baseline and compatibility matrix

**Files:** `docs/status/UNIVERSAL_AGENT_STATUS_2026-11-15.md` (append actual new dated receipt), `tests/contracts/legacy-commands.test.ts` (proposed), existing `tests/integration/mcp-modern-stdio.test.ts` and dashboard contract tests. **Interfaces:** Consumes existing CLI/MCP behavior; produces verified compatibility/oracle inventory for UA-002/003. **Existing mapping:** FF-001/002/003, #118 boundary.

- [ ] RED: add a focused baseline test for client initialize, permissions and CLI command compatibility; run `npx vitest run tests/contracts/legacy-commands.test.ts` and observe intended failure.
- [ ] GREEN: capture or correct exact legacy contract with stable assertions, no source behavior change; run focused tests PASS.
- [ ] VERIFY: record `git rev-parse HEAD`, checked OS/capacity, open PR #200/#203 status, test commands/outcomes and safe fixture; run `npm run docs:check` + C0 CI. No production mutation.
- [ ] COMMIT/REVIEW: one scoped PR, attach evidence; merge only after gate. Handoff next UA-002.

### Task UA-002: Authoritative workspace identity and grant contract

**Files:** `src/workspace/workspace-context.ts` (on #200 proposed source, do not copy blindly), `src/workspace/workspace-identity.ts`, `src/policy/` or existing owner-grant store, `tests/unit/workspace-context.test.ts`, negative grant tests. **Interfaces:** Produces `AuthorizedRunContext` from **trusted** persisted workspace+session+grant; `grantId`, revision and stable registry identity. **Depends:** UA-001; FF-004/005/006/013 contract portions.

- [ ] RED: negative tests for forged source root, stale/revoked grant, symlink/rebind and rename; prove old DTO fails contract.
- [ ] GREEN: implement minimum resolved context and invariant checks; no speculative storage swap.
- [ ] VERIFY: focused tests, typecheck, auth review; prove registry ID stable on allowed rename and explicit failure when unverifiable.
- [ ] COMMIT/REVIEW: architecture+security evidence; handoff UA-003.

### Task UA-003: Pin authenticated principal/slot to MCP stdio and HTTP requests

**Files:** `src/server/transports/stdio.ts`, `src/server/transports/http.ts`, `src/server/protocol/request-context.ts`, `tests/integration/mcp-platform.test.ts`, `tests/integration/mcp-dual-era-client.test.ts`. **Interfaces:** Produces trusted per-call `AuthorizedRunContext` independent of mutable global `current`. **Depends:** UA-002; FF-007/008.

- [ ] RED: two-client forged slot/expired grant and shared-token-10-chat negative cases; modern stateless and legacy tests.
- [ ] GREEN: bind verified principal+workspace/grant per request; never expose owner APIs through MCP bearer.
- [ ] VERIFY: run genuine initialized client and concurrent request tests; never count configured clients as connected.
- [ ] COMMIT/REVIEW: MCP+security gate; handoff UA-004 and UA-006.

### Task UA-004: OS-verifiable executor boundary

**Files:** `src/sandbox/launcher.ts`, `src/capsule/workspace-capsule-manager.ts`, `src/tools/registry.ts` if required, `tests/integration/sandbox-runtime.test.ts`, `tests/integration/capsule-policy.test.ts`. **Interfaces:** Executes a scoped request with platform isolation and explicit capability `unavailable` otherwise. **Depends:** UA-002.

- [ ] RED: prove A cannot inspect sibling files/process/secrets/metadata endpoints or Docker host socket; probe symlinks and mount leaks.
- [ ] GREEN: choose tested Docker/Podman/VM adapter only where real confinement works; preserve safe default and existing runtime behavior.
- [ ] VERIFY: runtime negative tests in isolated CI/host not live recovery; document platform limits; gate C2.
- [ ] COMMIT/REVIEW: security proof and explicit fail-closed status; handoff UA-005.

### Task UA-005: Two independent agents, isolation/revocation conformance

**Files:** `tests/integration/multi-agent-isolation.test.ts` (new), `src/capsule/workspace-capsule-manager.ts` only if defect found, `src/policy/` if necessary. **Interfaces:** two principals/sessions mapped to two capsules with denial oracle. **Depends:** UA-003/004.

- [ ] RED: A reads/writes/kills B, forges slot, shares cookie/secret, owner revokes A while B continues.
- [ ] GREEN: surgical bug fixes; don't hide failure by weakening tests or forbidding normal operations beyond threat model.
- [ ] VERIFY: repeated concurrent runs, per-principal evidence, C1/C2 checks.
- [ ] COMMIT/REVIEW: no '10 agents secure' claim yet; handoff UA-014 when resources allow.

### Task UA-006: Connect one real agent and perform first verified action

**Files:** `src/main.ts` (minimal command facade), `src/onboarding/`, `src/control/`, `tests/integration/mcp-platform.test.ts`, CLI compatibility suite. **Interfaces:** user-friendly connect/up/status/stop with truthful handshake and `ActionReceipt`. **Depends:** UA-003/004 and existing FF-010..018.

- [ ] RED: configured client offline must report CONFIGURED; real initialize/tools/call then CONNECTED + durable authorized result; failure/undo path.
- [ ] GREEN: reuse existing use-cases and client setup; no new parallel control service.
- [ ] VERIFY: real supported client matrix with recorded ID; C3; non-Git folder included.
- [ ] COMMIT/REVIEW: attach one first verified action, handoff UA-007.

### Task UA-007: Browser tools that supply observations and bounded actions

**Files:** `src/tools/browser-tools.ts`, `src/adapters/child-mcp/`, `src/policy/risk.ts` if necessary, `tests/integration/browser-agent-runtime.test.ts` (new), browser setup docs. **Interfaces:** typed `Observe/Act` → DOM, screenshot, console, network and trace references. **Depends:** UA-003/004/006; FF-035 when applicable.

- [ ] RED: isolated browser must deny cross-profile cookies, unapproved origins/downloads/loopback; missing Chromium returns unavailable.
- [ ] GREEN: configure existing Playwright MCP plus trace/log evidence, no duplicate browser engine.
- [ ] VERIFY: real browser session with a bounded local fixture, proof blob IDs and no prompt injection trusted as tool authorization.
- [ ] COMMIT/REVIEW: C4 partial evidence; handoff UA-008.

### Task UA-008: Start real web app and expose safe live preview

**Files:** `src/tools/process-tools.ts` or existing process runner (confirm actual file before edit), `src/workflows/`, `tests/integration/live-web-preview.test.ts` (new), process evidence contract. **Interfaces:** start/health/port binding and stop a capsule-local server. **Depends:** UA-006/007.

- [ ] RED: server fails to start, port conflict, worker dies, URL not reachable, wrong capsule port.
- [ ] GREEN: named preview lifecycle with bounded process, no global shared PID/port trust.
- [ ] VERIFY: real local fixture app and stop/restart evidence; handoff UA-009.

### Task UA-009: Live Web E2E and evidence pack

**Files:** `src/proof/`, existing browser tool runner, `tests/integration/live-web-e2e.test.ts` (new), `docs/artifacts.md` only for actual behavior. **Interfaces:** source SHA, browser assertions, DOM, console/network, screenshot/trace and per-action status. **Depends:** UA-007/008.

- [ ] RED: seed frontend error/network 500, false screenshot PASS, missing trace and stale preview.
- [ ] GREEN: classify outcomes and attach bounded redacted evidence; reuse existing proof pack.
- [ ] VERIFY: browser E2E actual run plus negative cases and hashes, C4; handoff UA-010.

### Task UA-010: Bounded Observe→Act→Verify→Repair coding scenario

**Files:** `src/workflows/` or existing agent loop orchestrator after inspection, `tests/integration/live-repair-loop.test.ts` (new), `docs/ai-coding-runtime.md`. **Interfaces:** `Run` state transitions and retry budgets; agent/tool implementation may be external. **Depends:** UA-009.

- [ ] RED: intentional visual/functional defect, verify FAIL; prevent fake council votes and indefinite loops.
- [ ] GREEN: feed failure proof to agent, execute minimal repair through existing governed tools, rerun same assertions.
- [ ] VERIFY: actual run with source diff, trace, pass/failed notes and resource costs; no synthetic 'review approved'.
- [ ] COMMIT/REVIEW: C4 completed; handoff UA-011.

### Task UA-011: Creative adapter manifest and native editable contract

**Files:** `src/adapters/child-mcp/registry.ts`, `src/tools/` creative capability adapter (new, focused), `tests/integration/creative-capability.test.ts` (new), supported-app docs. **Interfaces:** `createEditableDocument`, `updateLayer`, `renderPreview`, `exportSource` or capability-equivalent native tools; provider-specific names may vary, record real tool schema. **Depends:** UA-003/004.

- [ ] RED: provider absent/denied, unsupported editable function, unauthorized host escape.
- [ ] GREEN: first thin Figma/native design bridge with explicit connection, per-slot grant and typed response; no fake editable source.
- [ ] VERIFY: real manifest/authorization and allowed operations before claiming support.
- [ ] COMMIT/REVIEW: C5 precondition; handoff UA-012.

### Task UA-012: Editable source + render + revision creative proof

**Files:** adapter created by UA-011, `src/proof/`, `tests/integration/creative-revision.test.ts` (new), provider documentation. **Interfaces:** native file/frame/revision receipt and rendered review artifact. **Depends:** UA-011.

- [ ] RED: PNG-only output cannot satisfy editable-source contract; missing native provider must return unavailable.
- [ ] GREEN: create named layer/component, modify in response to visual feedback, export/re-open source, produce render difference evidence.
- [ ] VERIFY: real supported app/platform (or state external integration BLOCKED), C5; handoff UA-013.

### Task UA-013: Owner control UI for connected slots, observation and proof

**Files:** `packages/mission-control/src/` screen/component by feature, typed owner control API, `tests/integration/dashboard-workspaces.test.ts`, browser a11y test. **Interfaces:** connect/status/capsule/preview/artifacts and revoke; owner-only. **Depends:** UA-006/009; UA-012 creative pane optional until supported.

- [ ] RED: status mismatch, false READY, missing keyboard revoke feedback, stale screenshot/permissions.
- [ ] GREEN: present truthful existing backend; don't refactor Fleet while building one page.
- [ ] VERIFY: actual browser keyboard/a11y and CLI-Web parity tests, C4/C5.
- [ ] COMMIT/REVIEW: handoff UA-014.

### Task UA-014: Ten-slot admission with quotas and fair queue

**Files:** `src/capsule/workspace-capsule-manager.ts`, `src/multiproject/project-gateway.ts`, `tests/integration/ten-agent-conformance.test.ts` (new), capacity docs. **Interfaces:** 10 distinct verified principal slots, admission/queue/deny states. **Depends:** UA-003/004/005.

- [ ] RED: duplicate credential claiming ten identities, same-root writable collisions, budget contention and starvation.
- [ ] GREEN: per-slot CPU/memory/disk/process/port controls, fair admission and correct queued/denied status.
- [ ] VERIFY: actual 10-slot matrix on sized isolated runner, no cross-workspace mutation, measured limits; C6.
- [ ] COMMIT/REVIEW: handoff UA-015 or UA-016 as gates permit.

### Task UA-015: Explicit Host Operator broker (Advanced, never default)

**Files:** `src/operator/` authority broker (new focused module or existing), `tests/integration/host-authority.test.ts`, `docs/security/` threat model. **Interfaces:** owner-issued host capability, TTL, allowlisted operation and audit; not bound to mere MCP bearer. **Depends:** UA-004/014 and owner security threat review; maps FF-036/037 on draft PR #200.

- [ ] RED: fake owner, expired bearer, child MCP self-grant, grant replay, kill/revoke uncertain, privilege crossing.
- [ ] GREEN: narrow broker only; never auto-create blanket OS root permission.
- [ ] VERIFY: independent operator/security approval and OS test; C8 separate from default product.
- [ ] COMMIT/REVIEW: do not block basic C4/C5 for incomplete Advanced host mode.

### Task UA-016: Cross-agent and cross-application artifact handoff

**Files:** `src/workflows/`, `src/proof/`, `tests/integration/agent-handoff.test.ts` (new), API docs. **Interfaces:** immutable signed/hashed task artifact references and grant-scope transition, not raw shared filesystem. **Depends:** UA-010/012/014.

- [ ] RED: forged receipt, stale grant, B can access A's secret or bypass owner handoff approval.
- [ ] GREEN: explicit owner-approved artifact transfer with hash and replay guard.
- [ ] VERIFY: coding→design or design→coding fixture, hard security deny tests; C7.
- [ ] COMMIT/REVIEW: handoff UA-017.

### Task UA-017: Neutral product benchmark and user validation

**Files:** `benchmarks/` existing runner/fixtures, `docs/strategy/` measured evidence note, `tests/integration/` if an oracle is missing. **Interfaces:** reproducible scenario scored on setup time, first verified action, functional/visual results, audit, safety and cost. **Depends:** UA-010/012/016.

- [ ] RED: identify a scenario where native OpenHands or Docker Sandbox already beats baseline; record rather than hide.
- [ ] GREEN: run same task/hardware/model/time budget/version where possible; preserve failed runs and disclose any unequal features.
- [ ] VERIFY: publish exact setup, traces, limitations and decision (continue/pivot/integration); C7.
- [ ] COMMIT/REVIEW: handoff UA-018 only if meaningful evidence supports beta.

### Task UA-018: Owner-approved canary and mainline release process

**Files:** `docs/operations/` release protocol and signed receipts, source workflow release config only if explicitly authorized, `tests/integration/` regression check; **do not touch live isolation registry**. **Depends:** UA-013/014/017, owner authorization, and UA-015 only if host privilege shipping.

- [ ] RED: test ENOSPC/audit unavailable/rollback and artifact→process SHA mismatch in isolated env.
- [ ] GREEN: backup/restore drill, canary with a correctly sized host and explicit rollback criteria.
- [ ] VERIFY: CI exact SHA, true independent approvals, operator signoff, runtime proof, #118 gating for any recovery mutation; C8.
- [ ] COMMIT/REVIEW: merge only allowed PRs, preserve evidence; delete remote feature branches only after safe ancestry/backup checks; **never delete detached recovery worktrees merely to show main-only**.

## Per-task DONE/merge protocol

1. **START:** read [master prompt](../../prompts/MASTER_IMPLEMENTATION_RECURSIVE_HANDOFF.md), current status, spec + relevant section only, task card and actual git state. State *one* target and acceptance oracle.
2. **TDD:** failing test → minimal change → passing test, append run proof. Never silently modify adjacent services or reassign open items to DONE.
3. **VERIFY:** focused tests, TypeScript/lint/architecture/docs, CI exact new SHA, applicable security/e2e review. Record `SOURCE_TESTED` vs `E2E_VERIFIED` vs `LIVE_VERIFIED` separately.
4. **INTEGRATE:** open small PR to **main** (or document intentional stacked PR with base/merge order); only merge with green required CI/reviews and no unresolved blocker. Avoid force push/deleting WIP. After merge verify new main HEAD and branch protection, close only completed issue(s).
5. **HANDOFF:** write the next target and new prompt to [handoff template](../../prompts/RECURSIVE_HANDOFF_TEMPLATE.md) using actual observed state; return it in final answer. If blocked, output blocker and next safe task; never report DONE-by-prompt.

**Current first task:** UA-001. **No UA source task has been completed by creating this document.** Historical PR #200 (workspace v2 source) and PR #203 (AI review source) remain independently reviewable and must not be auto-merged as part of this plan.
