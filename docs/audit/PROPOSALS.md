# Proposals — 15 NEW features, no implementation authorization

Baseline `main@8c00b15ff7d34dedfd8f50e46066ad0a3defc23c` (2026-11-10). Not in the shipped scope of [feature inventory](FEATURE_INVENTORY.md). Problem IDs refer to [audit findings](AUDIT_REPORT.md). Estimates assume an engineer; staffing/pricing/paid API spend **[UNVERIFIED]**. ICE = Impact × Confidence × Ease (1–5 each); risk-critical F10 is mandatory for production release despite low score. **F14 is P0 for concurrent multi-child use regardless of ICE rank**; F15 is P1 after F14.

## Priority table

| ID | Feature | Audit | Estimate | Impact | Confidence | Ease | ICE | Depends on | Decision |
|---|---|---|---|---:|---:|---:|---:|---|---|
| F01 | Honest council provenance | H-02 | S/2d | 5 | 5 | 5 | **125** | none | DEFER |
| F02 | Docs drift CI checker | H-04,M-09 | S/3d | 4 | 5 | 5 | **100** | none | DEFER |
| F03 | Fleet owner preflight wizard | H-03,M-09 | M/5d | 5 | 4 | 4 | **80** | F01 | DEFER |
| F04 | Per-run token and cost ledger | M-12 | M/6d | 5 | 4 | 4 | **80** | F01 | DEFER |
| F05 | Prompt-injection policy eval suite | H-02,M-11 | M/7d | 5 | 4 | 4 | **80** | F01 | DEFER |
| F07 | Fleet SLO and incident alerts | M-08,H-06 | M/6d | 4 | 4 | 4 | **64** | F02 | DEFER |
| F06 | D3 staged typed settings | H-03 | L/10d | 5 | 4 | 3 | **60** | F02,F03,F07 | DEFER |
| F14 | Request-scoped workspace affinity behind one tunnel | H-16 | L/15d | 5 | 5 | 2 | **50** | authorized child-project mapping; P0 security | **DEFER / P0 proposed** |
| F15 | Per-workspace fair queues and quotas | M-17 | M/8d | 4 | 4 | 3 | **48** | F14,F07 | **DEFER / P1 proposed** |
| F08 | Consent-bound project memory | M-12 | L/9d | 4 | 4 | 3 | **48** | F04,F05 | DEFER |
| F13 | Review-only error learning coach | M-08,M-12 | M/8d | 4 | 4 | 3 | **48** | F04,F05,F07,F08 | DEFER |
| F09 | Pinned child MCP trust manifest | M-07,M-11 | L/9d | 5 | 3 | 3 | **45** | F05,F07 | DEFER |
| F12 | Signed event-triggered scheduler | M-10,H-06 | L/11d | 4 | 3 | 3 | **36** | F04,F07,F09 | DEFER |
| F11 | Real LLM evidence council | H-02,M-12 | L/12d | 5 | 3 | 2 | **30** | F01,F04,F05,F09 | DEFER |
| F10 | Kernel registry writer epoch | C-01,H-05 | L/15d | 5 | 2 | 1 | **10** | F05,F07,F09; independent reviewer | DEFER |

## Testable feature specifications

### F01 — Honest council provenance (agent trust)

| Field | Specification |
|---|---|
| Value / audit problem | Expose synthetic-vote provenance; never call scripted votes independent reviewers. H-02. |
| LLM vs script | Script for attribution; real LLM deferred to F11. |
| Inputs → outputs | Proposal/vote metadata -> source-tagged decision and UI disclosure. |
| APIs/tools/credentials | Existing loop state and MCP; no secrets. |
| Affected existing/proposed modules | `src/agent-loops/agent-loop-runner.ts:185-216; src/agent-loops/agent-loop-manager.ts:25-55` |
| Human approval & risk | Operator decides if a review is sufficient for security/release. **LOW** (no independent publishing/deletion/payment/secret action). |
| Acceptance | 0 unsupported independent-review claims in 100 fixtures; provenance survives restart. |
| Verification | Unit + contract + fake-reviewer adversary. |
| 🟢 MVP / 🟡 STABLE / 🔵 PRO | MVP labels; STABLE durable provenance; PRO verified signer identity. |
| Effort / dependencies | S/2d; Impact 5/5; confidence 5/5; ICE **125**; depends none. |

### F02 — Docs drift CI checker (DX)

| Field | Specification |
|---|---|
| Value / audit problem | Detect stale version, status and onboarding directions before review. H-04,M-09. |
| LLM vs script | Script only. |
| Inputs → outputs | Source/README/doc snapshot -> drift failures with path:line. |
| APIs/tools/credentials | Git/Node parser, no key. |
| Affected existing/proposed modules | `scripts/check-docs.mjs; docs/PROJECT_STATUS.md:3-23; README.md:46-48` |
| Human approval & risk | Human approves root doc/release edits. **LOW** (no independent publishing/deletion/payment/secret action). |
| Acceptance | 12 seeded drift cases caught; historical snapshot banner exempt. |
| Verification | Fixture unit tests + CI regression. |
| 🟢 MVP / 🟡 STABLE / 🔵 PRO | MVP metadata; STABLE snapshot policy; PRO generated API contract. |
| Effort / dependencies | S/3d; Impact 4/5; confidence 5/5; ICE **100**; depends none. |

### F03 — Fleet owner preflight wizard (UX)

| Field | Specification |
|---|---|
| Value / audit problem | Show a single safe preview of allowed workspace, owner rights and child readiness. H-03,M-09. |
| LLM vs script | Script/rule engine, no model. |
| Inputs → outputs | Signed owner/Fleet/allowed path -> pass/warn/block + explicit Start. |
| APIs/tools/credentials | Existing owner/Fleet/browse APIs; signed session only. |
| Affected existing/proposed modules | `packages/mission-control/src/screens/Fleet.tsx; src/dashboard/server.ts:950-1028` |
| Human approval & risk | Human confirms start and host consent; cannot mint grant from Origin alone. **MEDIUM** (no independent publishing/deletion/payment/secret action). |
| Acceptance | Unsigned tabs cannot start; 80% of 20 pilot owners reach healthy child within 10m. |
| Verification | Mobile/desktop E2E, Origin, invalid path and failure-case tests. |
| 🟢 MVP / 🟡 STABLE / 🔵 PRO | MVP checklist; STABLE guided recovery; PRO safe templates. |
| Effort / dependencies | M/5d; Impact 5/5; confidence 4/5; ICE **80**; depends F01. |

### F04 — Per-run token and cost ledger (cost)

| Field | Specification |
|---|---|
| Value / audit problem | Bound model calls to owner-approved budgets and trace token usage. M-12. |
| LLM vs script | Script metering; LLM only with explicit provider. |
| Inputs → outputs | Model usage + rate card + limits -> durable spend report / stop. |
| APIs/tools/credentials | Optional provider API credential, never handled as public data. |
| Affected existing/proposed modules | `src/agent-loops/agent-loop-manager.ts:67-107; src/agent-loops/agent-loop-runner.ts:107-147` |
| Human approval & risk | Owner authorizes provider/key, data egress and spending ceiling. **MEDIUM** (no independent publishing/deletion/payment/secret action). |
| Acceptance | 100% simulated calls counted, 0 double-charge on retries, strict max budget. |
| Verification | Fake provider + crash/retry + budget-exhaustion eval. |
| 🟢 MVP / 🟡 STABLE / 🔵 PRO | MVP caps; STABLE durable ledger; PRO multi-model cost allocation. |
| Effort / dependencies | M/6d; Impact 5/5; confidence 4/5; ICE **80**; depends F01. |

### F05 — Prompt-injection policy eval suite (security/evals)

| Field | Specification |
|---|---|
| Value / audit problem | Test malicious tool output, web content and log instructions against policy. H-02,M-11. |
| LLM vs script | Script oracle; optional LLM judge, never an approval. |
| Inputs → outputs | Adversarial fixtures + intended task -> allow/deny evidence and metrics. |
| APIs/tools/credentials | Offline mock MCP/pages; no real production credential. |
| Affected existing/proposed modules | `tests/fuzz; tests/acceptance; src/tools/registry.ts:529-600; src/tools/adapter-tools.ts:121-126` |
| Human approval & risk | Live attack simulations need explicit owner scope. **LOW** (no independent publishing/deletion/payment/secret action). |
| Acceptance | >=200 fixtures, 100% seeded unapproved writes/leaks blocked. |
| Verification | Golden replay, policy invariant and model eval regression. |
| 🟢 MVP / 🟡 STABLE / 🔵 PRO | MVP 50 cases; STABLE 200 CI gate; PRO human red-team. |
| Effort / dependencies | M/7d; Impact 5/5; confidence 4/5; ICE **80**; depends F01. |

### F07 — Fleet SLO and incident alerts (observability)

| Field | Specification |
|---|---|
| Value / audit problem | Report dead/stuck child and actionable incidents instead of silent failures. M-08,H-06. |
| LLM vs script | Script heartbeats/thresholds; optional LLM digest in F13. |
| Inputs → outputs | Fleet/process/audit events -> local incident, state and optional alert. |
| APIs/tools/credentials | Existing REST and optional email/Telegram opt-in. |
| Affected existing/proposed modules | `src/provisioner/fleet-manager.ts:402; src/dashboard/server.ts:1789,2491,2500` |
| Human approval & risk | Owner approves outbound recipients and auto-restarts. **MEDIUM** (no independent publishing/deletion/payment/secret action). |
| Acceptance | Dead process detected <=60s; <=1 duplicate alert per 5 min. |
| Verification | Kill/restart fixtures, clock controls, network delivery failure. |
| 🟢 MVP / 🟡 STABLE / 🔵 PRO | MVP local alerts; STABLE opt-in notification; PRO SLO forecasts. |
| Effort / dependencies | M/6d; Impact 4/5; confidence 4/5; ICE **64**; depends F02. |

### F06 — D3 staged typed settings (configuration/UX)

| Field | Specification |
|---|---|
| Value / audit problem | Extend D2 into typed desired/effective values with explicit restart/rollback. H-03. |
| LLM vs script | Script schema validators, no generic AI auto-editor. |
| Inputs → outputs | Owner+key+revision+desired -> validation, diff, restart plan, audit. |
| APIs/tools/credentials | Owner-protected Dashboard config; protected storage. |
| Affected existing/proposed modules | `src/operator/config-descriptors.ts:4-60; src/operator/rate-limit-settings.ts:184-225; src/dashboard/server.ts:2899-2979` |
| Human approval & risk | Human approves restart, network exposure, secrets and host scope. **HIGH** (no independent publishing/deletion/payment/secret action). |
| Acceptance | Only allowlisted keys; stale 409; failed restart restores previous effective state. |
| Verification | TDD revision, audit failure, owner/CSRF, restart rollback. |
| 🟢 MVP / 🟡 STABLE / 🔵 PRO | MVP three safe settings; STABLE staged rollback; PRO per-Fleet templates. |
| Effort / dependencies | L/10d; Impact 5/5; confidence 4/5; ICE **60**; depends F02,F03,F07. |

### F08 — Consent-bound project memory (memory/state)

| Field | Specification |
|---|---|
| Value / audit problem | Control durable memory retention, provenance, TTL, export and deletion. M-12. |
| LLM vs script | Script for consent/TTL; optional LLM summaries. |
| Inputs → outputs | Project/task+consent+TTL -> scoped summary/delete receipt. |
| APIs/tools/credentials | Existing memory tools and local protected store; optional embeddings approved. |
| Affected existing/proposed modules | `src/tools/memory-tools.ts; src/agent-loops/agent-loop-manager.ts:67-107` |
| Human approval & risk | Explicit human opt-in to persistence, deletion and off-host embedding. **HIGH** (no independent publishing/deletion/payment/secret action). |
| Acceptance | Zero cross-project leaks; TTL/deletion and recovery proofs pass. |
| Verification | Multi-tenant ACL, fake clock, forced restart. |
| 🟢 MVP / 🟡 STABLE / 🔵 PRO | MVP consent/TTL; STABLE export and provenance; PRO encrypted semantic retrieval. |
| Effort / dependencies | L/9d; Impact 4/5; confidence 4/5; ICE **48**; depends F04,F05. |

### F13 — Review-only error learning coach (self-improvement)

| Field | Specification |
|---|---|
| Value / audit problem | Cluster proven failures into suggestions without autonomous source or policy edits. M-08,M-12. |
| LLM vs script | Script clustering; opt-in LLM for summaries only. |
| Inputs → outputs | Redacted audit failures/proof -> ranked suggestions and test/rollback plan. |
| APIs/tools/credentials | Existing audit/verification; optional cost-metered provider. |
| Affected existing/proposed modules | `src/audit/audit-log.ts:36; src/verification/verification-manager.ts:166` |
| Human approval & risk | Human approves any suggested source, security, credential or deployment change. **MEDIUM** (no independent publishing/deletion/payment/secret action). |
| Acceptance | >=90% suggestions cite reproducible failures; 0 self-mutating actions. |
| Verification | Offline replay, hallucinated-cause and approval-negative eval. |
| 🟢 MVP / 🟡 STABLE / 🔵 PRO | MVP clustering; STABLE evidence ranking; PRO experiment queue. |
| Effort / dependencies | M/8d; Impact 4/5; confidence 4/5; ICE **48**; depends F04,F05,F07,F08. |

### F09 — Pinned child MCP trust manifest (integrations)

| Field | Specification |
|---|---|
| Value / audit problem | Quarantine changed/untrusted child schemas until owner consent. M-07,M-11. |
| LLM vs script | Script cryptographic hash/risk classification; no model authority. |
| Inputs → outputs | Adapter identity+catalog hash -> allowlist or quarantine/diff. |
| APIs/tools/credentials | Child MCP catalog, package lock, optional signed publisher metadata. |
| Affected existing/proposed modules | `src/tools/adapter-tools.ts:38-50,82-126; src/adapters/child-mcp/risk-map.ts` |
| Human approval & risk | Owner approves new mutating subtool and dependency installation. **HIGH** (no independent publishing/deletion/payment/secret action). |
| Acceptance | 100% seeded changed schemas blocked; facade cannot bypass subop risk. |
| Verification | Malicious catalog, hash replay and OAuth/approval tests. |
| 🟢 MVP / 🟡 STABLE / 🔵 PRO | MVP pin/hash; STABLE signature validation; PRO reputation. |
| Effort / dependencies | L/9d; Impact 5/5; confidence 3/5; ICE **45**; depends F05,F07. |

### F12 — Signed event-triggered scheduler (automation)

| Field | Specification |
|---|---|
| Value / audit problem | Durably dedupe file/CI-triggered governed workflows rather than blind shell loops. M-10,H-06. |
| LLM vs script | Script queue and webhook; LLM optional within approved workflow. |
| Inputs → outputs | Signed event+workflow+dedupe key -> queued run/audit receipt. |
| APIs/tools/credentials | HMAC webhook/local scheduler, existing workflow manager, no public endpoint by default. |
| Affected existing/proposed modules | `src/workflows/workflow-manager.ts:447; src/tools/workflow-tools.ts:219-318` |
| Human approval & risk | Human approves recurring write scope, external webhook and publish. **HIGH** (no independent publishing/deletion/payment/secret action). |
| Acceptance | Exactly-once submission per key; duplicate/restart does not bypass consent. |
| Verification | Invalid signature/replay, queue full, crash/restart tests. |
| 🟢 MVP / 🟡 STABLE / 🔵 PRO | MVP local events; STABLE schedule/replay; PRO multi-worker. |
| Effort / dependencies | L/11d; Impact 4/5; confidence 3/5; ICE **36**; depends F04,F07,F09. |

### F11 — Real LLM evidence council (agent/AI)

| Field | Specification |
|---|---|
| Value / audit problem | Optional true model-backed proposals with identified review sources and citations. H-02,M-12. |
| LLM vs script | LLM required for independent proposals; script verifies identity and budgets. |
| Inputs → outputs | Scoped evidence+goal+budget -> cited proposals, dissent and review trace. |
| APIs/tools/credentials | Owner-provided model provider/API, F04 usage accounting, F05 evals. |
| Affected existing/proposed modules | `src/agent-loops/agent-loop-runner.ts:156-216; src/agent-loops/agent-loop-manager.ts:67-107` |
| Human approval & risk | Owner approves paid model/data egress; human security review remains mandatory. **HIGH** (no independent publishing/deletion/payment/secret action). |
| Acceptance | No synthetic human reviewers; citation checks; hard cost ceiling; >=85/100 eval. |
| Verification | Provider mock, consenting live A/B and injection regression. |
| 🟢 MVP / 🟡 STABLE / 🔵 PRO | MVP one model; STABLE two-provider diversity; PRO calibrated consensus. |
| Effort / dependencies | L/12d; Impact 5/5; confidence 3/5; ICE **30**; depends F01,F04,F05,F09. |

### F10 — Kernel registry writer epoch (critical security)

| Field | Specification |
|---|---|
| Value / audit problem | Block old/mixed-version OS writers with kernel DAC and protected epoch supervisor. C-01,H-05. |
| LLM vs script | Script and OS supervisor only; no LLM decisions about UID/ACL. |
| Inputs → outputs | Registry identity/hash+epoch+backup -> EACCES proof/cutover/rollback. |
| APIs/tools/credentials | Separate least-privilege UID, protected ancestor, trusted supervisor and host admin. |
| Affected existing/proposed modules | `src/isolation/worktree-manager.ts:103-112,1289-1307; docs/r14-kernel-registry-fence-migration.md:40-72` |
| Human approval & risk | Owner + independent qualified security reviewer approve canary and rollback. **CRITICAL** (no independent publishing/deletion/payment/secret action). |
| Acceptance | Legacy UID denied before/during/after and after restart; exact recovery hashes match. |
| Verification | Real host sandbox canary kill/rename/symlink/ACL drift + independent APPROVED review. |
| 🟢 MVP / 🟡 STABLE / 🔵 PRO | MVP fixture-only; STABLE operator canary; PRO multi-host epochs. |
| Effort / dependencies | L/15d; Impact 5/5; confidence 2/5; ICE **10**; depends F05,F07,F09; independent reviewer. |

### F14 — Immutable request-scoped child workspace routing (multi-project/MCP security)

| Field | Specification |
|---|---|
| Value / audit problem | **P0 proposed.** One authenticated tunnel can serve many explicitly authorized child projects without cross-client target drift. H-16 in [the multi-child tunnel audit](MULTI_WORKSPACE_TUNNEL.md). |
| LLM vs script | **Script-only, no LLM needed** for workspace selection, path canonicalization or authorization. Never infer a privileged child from model text. |
| Inputs → outputs | Authenticated principal, MCP session ID, selected `workspaceId`, owner allowlist, immutable path identity, tool name and operationId → bound immutable request context, tool result + scoped audit; ambiguity denied. |
| APIs/tools/credentials | Existing MCP HTTP auth/OAuth, allowed roots and Workspace APIs; optional owner-approved workspace manifest. No new credentials, no extra tunnel required. |
| Affected existing/proposed modules | `src/workspace/workspace-manager.ts:30-33,64-102`; `src/tools/workspace-tools.ts:40-60,149-195`; `src/tools/registry.ts:481-485,623-633`; `src/server/transports/http.ts:337-359`; `src/main.ts:863-870`; `src/runtime/container.ts:85-109,127-162`; `src/tools/memory-tools.ts:4-52`; `src/core/principal.ts:47-60`; `tests/integration/multi-project.test.ts:29-77`. |
| Human approval & risk | **HIGH**, potential wrong-folder writes/data disclosure. Owner explicitly approves child-project allowlist and authority. No silent host changes; all writes/publish/deletions/secret changes still pass current approval gates. |
| Acceptance | 2 principals + 2 sessions + 3 children; **≥500 interleaved pathless operations and zero wrong-root or cross-project memory results**. Session A switch cannot change B. `workspace_route` tool preset is session-scoped. Unknown/removed/symlink-swapped child denied. Single-child legacy default preserved; missing child selection with multiple allowed children fails closed. |
| Verification | TDD concurrent interleaving/replay, multi-session OAuth/owner negatives, symlink/rename and restart tests, full audit correlation `{sessionId, workspaceId, requestId}`; opt-in canary only. |
| 🟢 MVP / 🟡 STABLE / 🔵 PRO | 🟢 Authenticated gateway pins each request/session to an owner-approved child-project identity, initially using separate bounded MCP workers to avoid global state; 🟡 robust worker lifecycle, distinct tool catalogs/task/memory namespaces and single-child backward compatibility; 🔵 optional lower-memory shared-process immutable-context optimization only after exhaustive security tests. |
| Effort / dependencies | **L/15 engineer-days**, high uncertainty; Impact 5/5, Confidence 5/5 in importance, Ease 2/5; **ICE 50**. Requires explicit owner-approved child mapping; F05 eval fixtures recommended, but MVP must ship its own security-negative tests. |

### F15 — Per-workspace fairness and backpressure (performance)

| Field | Specification |
|---|---|
| Value / audit problem | **P1 proposed.** Prevent one noisy child monopolizing shared quota or suppressing another child's tool catalog. M-17 in [multi-child tunnel audit](MULTI_WORKSPACE_TUNNEL.md). |
| LLM vs script | **Script-only**: fair admission queue, cancellation, timeout, immutable keys and latency metrics. No LLM scheduler. |
| Inputs → outputs | Immutable F14 context, tool risk/mutation class, principal/workspace, deadline and queue depth → allowed/queued/rejected result, retry hint and redacted per-workspace p50/p95 metrics. |
| APIs/tools/credentials | Current `RateLimiter`, registry, MCP task/session state and local audit; no external API or paid model. |
| Affected existing/proposed modules | `src/policy/rate-limiter.ts:22-39,56-62`; `src/tools/registry.ts:598-633`; `src/tools/workspace-tools.ts:149-195`; `src/server/transports/http.ts:317-359`; `src/runtime/container.ts:103-105`; `src/server/mcp-task-manager.ts:82-103`; `tests/integration/multi-project.test.ts:29-77`. |
| Human approval & risk | **MEDIUM–HIGH**, changes admission and possible order of mutations. Owner approves limits and any change affecting writes; no automatic retry of outcome-uncertain operations, no privilege widening. |
| Acceptance | Child A saturates 20 tasks while B runs ≥200 safe reads: B has no quota coupling and **no starvation over 30s** within configured capacity; separate global abuse cap remains. On a controlled machine, p95 under noncontending load **≤1.5× measured isolated baseline**; queues/memory bounded. Same-project writes serialize under existing locking and preserve operationId/audit/replay. |
| Verification | 3 children × 2 clients × ≥200 calls load benchmark and p50/p95/p99 metrics; clock, cancellation, timeout, overload 429/503, audit and uncertain-write fault tests. |
| 🟢 MVP / 🟡 STABLE / 🔵 PRO | 🟢 Scoped quota key + bounded per-workspace admission; 🟡 fair scheduling/metrics/overload recovery; 🔵 distributed quotas and priority tiers only if explicitly approved. |
| Effort / dependencies | **M/8 engineer-days**; Impact 4/5; Confidence 4/5; Ease 3/5; **ICE 48**. Depends **F14 first**, F07 metrics coordinated. |

## Owner approval decision table (one choice per row)

| ID | Feature | APPROVE | MODIFY | REJECT | DEFER | Version / requested change |
|---|---|---|---|---|---|---|
| F01 | Honest council provenance | ☐ | ☐ | ☐ | ☑ | pending explicit choice; default MVP-only |
| F02 | Docs drift CI checker | ☐ | ☐ | ☐ | ☑ | pending explicit choice; default MVP-only |
| F03 | Fleet owner preflight wizard | ☐ | ☐ | ☐ | ☑ | pending explicit choice; default MVP-only |
| F04 | Per-run token and cost ledger | ☐ | ☐ | ☐ | ☑ | pending explicit choice; default MVP-only |
| F05 | Prompt-injection policy eval suite | ☐ | ☐ | ☐ | ☑ | pending explicit choice; default MVP-only |
| F07 | Fleet SLO and incident alerts | ☐ | ☐ | ☐ | ☑ | pending explicit choice; default MVP-only |
| F06 | D3 staged typed settings | ☐ | ☐ | ☐ | ☑ | pending explicit choice; default MVP-only |
| F14 | Request-scoped workspace routing | ☐ | ☐ | ☐ | ☑ | P0 proposed; child-mapping/safety MVP |
| F15 | Fair queues and per-workspace quota | ☐ | ☐ | ☐ | ☑ | P1 proposed; F14 dependency |
| F08 | Consent-bound project memory | ☐ | ☐ | ☐ | ☑ | pending explicit choice; default MVP-only |
| F13 | Review-only error learning coach | ☐ | ☐ | ☐ | ☑ | pending explicit choice; default MVP-only |
| F09 | Pinned child MCP trust manifest | ☐ | ☐ | ☐ | ☑ | pending explicit choice; default MVP-only |
| F12 | Signed event-triggered scheduler | ☐ | ☐ | ☐ | ☑ | pending explicit choice; default MVP-only |
| F11 | Real LLM evidence council | ☐ | ☐ | ☐ | ☑ | pending explicit choice; default MVP-only |
| F10 | Kernel registry writer epoch | ☐ | ☐ | ☐ | ☑ | pending explicit choice; default MVP-only |

**Do not treat DEFER as permission.** Reply e.g. `APPROVE F01 F02 (MVP); MODIFY F03: ...; DEFER F10` before any Phase 5 change.

## Owner decisions (safe defaults if you answer “ok”)

1. Target user: solo and 2–10-person local/Remote-SSH teams; hosted enterprise use [UNVERIFIED].
2. Paid models: disabled; $0 spend until provider, budget and data egress specifically approved.
3. Live writer migration: NO production change, preserve old worktrees until reviewer and F10 proof.
4. Alerts: local UI only; external Telegram/email needs recipient authorization.
5. Staffing: one engineer plus a separate qualified security reviewer; dates are not commitments.
6. Root docs: remain unmodified until separately authorized in a later phase.
7. Subfolders behind one tunnel: default **independent approved projects only when they have their own project roots**; treat monorepo packages as one workspace unless you explicitly authorize each child. Clarify whether folders are separate Git repositories or packages in one monorepo before Phase 5 design.

>>> **APPROVAL GATE — STOP HERE.** No source implementation, `feat/*` branch, production deploy, merge, publish, credential or destructive action before owner approval.
