# Browser Capability Backends — Dependency-Ordered Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended if genuine isolated workers exist) or `superpowers:executing-plans`. One small reviewed task per future session; RED → GREEN → VERIFY → HANDOFF. This document is **PROPOSED / NOT EXECUTED**.

**Goal:** preserve FolderForge's existing Playwright browser baseline while adding demonstrable owner-authorized, profile- and network-isolated, auditable browser capability, then consider opt-in alternative runtimes only if benchmark evidence justifies adoption.

**Architecture:** reuse `ToolRegistry`, child-MCP registry, existing Playwright wrappers, capsule/policy/audit/proof services. Prove authorization and OS/network constraints first; introduce the smallest backend-specific seam if necessary. Every optional browser backend is default-disabled and reports truthful capability status.

**Tech stack:** existing Node/TypeScript/Vitest/MCP and locked `@playwright/mcp@0.0.84`, `playwright-core@1.64.1`; an owner-approved disposable isolated worker for real-browser negatives. No new dependencies in BR-001.

**Spec:** `docs/superpowers/specs/2026-11-23-browser-capability-backends-design.md` and `docs/adr-0013-browser-capability-backend-admission.md`.

## Global constraints

- `main` canonical SHA inspected 2026-11-23: `599473dec46bddcabda618223d5ec7636261b5ef`; refresh before **every** task and before any future write.
- Respect `AGENTS.md`, Goal Map/UA Roadmap. M0 C0 operational/security HOLD; M1 `UA-002/003/004/005/006` precedes C4 browser claims. Research and tests in isolated fixtures are permitted only if genuinely authorized; do not silently declare UA prerequisites fulfilled.
- Scope: one BR-### goal per session, no cross-task refactor, no global dependency replacement, no automatic unpinned browser download, no production or recovery-worktree mutation, no cleanup of 24 managed isolation records.
- UI/public `browser_*` tools, existing Playwright regression behavior, audit/risk classifications and child-MCP status semantics must remain backward compatible.
- Trusted operation context must be server-derived: `principalId, workspaceId, capsuleId, grantId, grantRevision, operationId`. Page text, model arguments, user-supplied session IDs and unreviewed child MCP are never authority sources.
- Mandatory deny policy covers file access, unauthorized origins (including local/private/metadata and DNS aliases), redirects, popups, frames, subresources, WS/fetch, downloads, credential/profile spill and revoked/stale grants; an initial navigate URL regex is not sufficient.
- Findings from unit tests must be called SOURCE-TESTED only; full security confinement requires independent disposable OS/network runtime negatives. On missing actual worker, report BLOCKED or UNKNOWN, never PASS.
- Run focused tests and relevant `npm run typecheck`, `npm run lint`, `npm run architecture:check`, `npm run docs:check` **after actual implementation**; record exact exit codes; PR requires exact final-head CI and authenticated independent review/explicit authorized exception.
- `danger` mode never implicitly grants browser egress, credential or host powers; root/privileged broker remains separately gated.

## Review focus: highest-risk cases

| Class | Expected behavior; owning test |
| --- | --- |
| URL → network change | An allowed initial navigation redirecting to denied/private/metadata destination is blocked before network send: BR-002 redirect test. |
| Browser-originated fetch | Denied iframe, popup, service-worker request, WS, subresource and download cannot bypass grant: BR-002 negative matrix. |
| Principal/capsule mixing | Agent B never sees A's cookie/localStorage/profile/files, including after crash or cleanup: BR-002 isolated runtime tests. |
| Stale/in-flight authority | Revoke A or increment `grantRevision` mid-flow → no subsequent action/egress; B unaffected; uncertain in-flight result returns `unknown`: BR-002/003. |
| Unsupported runtime | Backend missing/binary mismatch/unhealthy → `unavailable`/`degraded` with remediation, not `ok=true`: BR-003/004. |

## Delivery map (one per session)

| Task | Depends on | Bounded deliverable | Goal Map / UA acceptance |
| --- | --- | --- | --- |
| BR-001 | M0 inspection; sources | Review + proposed ADR + proposed plan + handoff; independent review outstanding | G2/G3/G4/G5/G7, AC02/03/04/09/11/14/15 |
| **BR-002** | BR-001 review; safe fixture; M1 prerequisites for claims | Browser boundary **negative tests**, no extra backend | G2/G3/G4, AC02/03/04/06/11/15; UA-002/003/004/005/007; C1/C2/C4 |
| BR-003 | BR-002 evidence; trusted context contract | Minimal backend seam **if demonstrated necessary**, truthful status, Playwright preserved | G3/G4/G7, AC09/11/14/15; UA-007; C4 |
| BR-004 | BR-002/003 + owner opt-in | One Patchright vs Playwright compatibility experiment; Rebrowser alternative, not simultaneous | G3/G4/G8, AC09/11/14/15/17; C4/C7 |
| BR-005 | Source/legal/worker authorization | Camoufox separate-browser feasibility, no vendoring | G7/G8, AC11/14/17 |
| BR-006 | BR-002/003 + UA-009/010 basis | Choose one Stagehand or Browser Use pattern for Observe→Act→Verify→Repair | G3/G4/G5/G7, AC09/10/15; C4 |
| BR-007 | Approved backends, complete safe suite | Reproducible functional/resource/security benchmark and release-gate recommendation | G2/G3/G4/G5/G8, AC07/09/10/11/15/17/18; C4/C7/C8 |

## BR-001: source review and docs (this session)

**Files proposed:** `docs/superpowers/specs/2026-11-23-browser-capability-backends-design.md`; `docs/adr-0013-browser-capability-backend-admission.md`; this plan; optional append-only `tasks/universal-agent-todo.md` and `docs/handoffs/NEXT_SESSION.md` only when conflict-free and reviewed. **No source/test modifications.**

- [x] FRESH: fetched GitHub `main` and `AGENTS.md`, canonical six UA references, initial host and policy/risk state read-only.
- [x] FRESH: located browser wrappers, ChildMcpRegistry, emulation/network proxy, setup, test files and existing ADR naming; validated proposed paths absent.
- [x] FRESH: inspected official GitHub SHA/license/package/README for eight upstreams; source-level comparison and risk register recorded.
- [x] FRESH: PR #208 closed/unmerged, issues #118 and #202 open, no open PR search results.
- [ ] Verify complete transitive-license dependency trees, release tarballs, binary signatures/checksums and resource measurements (`UNKNOWN`; not required to install for research but blocks runtime admission).
- [ ] Independent qualified security/architecture review on exact documents; applicable branch policy and review authorization determined.
- [ ] Documentation PR exact-head CI and merge (only if permitted). **Not attempted** because authority/review gates not established; do not overwrite UA-002 handoff.

**Exit:** PARTIAL / C0 HOLD; ADR PROPOSED, not accepted. The next **eligible** technical task is BR-002 only after review and safety prerequisites.

## BR-002: Browser Policy Boundary and Cross-Session Negative Tests (NEXT, conditional)

**Target files (verify presence before change):** new `tests/unit/browser-policy-boundary.test.ts`; new `tests/integration/browser-policy-security.test.ts` or `tests/integration/browser-agent-runtime.test.ts`; existing `src/tools/browser-tools.ts`, `src/browser/network-proxy.ts`, `src/capsule/workspace-capsule-manager.ts`, `src/tools/registry.ts` **read-only initially**. Reuse test fixtures in `tests/fixtures/` and established temporary fixture helpers; do not create broad new infrastructure prematurely.

1. [ ] **START:** fetch `main`, read `AGENTS.md`, compare open PR/issue/ADR/UA task statuses; inspect `git status`, `HEAD`, `origin/main`, worktrees, isolations, host resource envelope and approved isolated test location. If evidence of C0/C1/C2 authorization missing, restrict work to design/source test with `BLOCKED` for live gate.
2. [ ] **RED—tool-level:** write tests showing ungranted `https://example.invalid`, `file:///...`, `http://127.0.0.1`, `http://[::1]`, `http://0.0.0.0`, metadata/private/link-local target refusal, across `safe/dev/danger`. Use only controlled hosts and fake network adapters. Do not send traffic to real metadata/third-party endpoints.
3. [ ] **RED—navigation graph:** isolated loopback fixture sends allowed→denied redirect; clickable popup, iframe, service worker, `fetch`, image, WS and download to a local deny fixture. Assert deny happens at worker/egress, not merely via tool wrapper. Use exact assertions on destination requests; don't rely on screenshot appearance.
4. [ ] **RED—identity:** two distinct authenticated principal/capsule contexts with cookie/localStorage/storage/download sentinels; attempt B→A profile reads and direct reuse of A's session ID; stale grant revision and revoke A during navigation; verify B remains usable and no cross-agent artifact access.
5. [ ] **RED—fault state:** crashed/disabled Playwright adapter, invalid profile path, lost audit sink and cancellation under network waits must yield `denied/unavailable/unknown` as appropriate, not success; no background orphan processes.
6. [ ] **VERIFY RED** by running focused new tests against the unchanged baseline. Record **individual expected failures and exact commands**, and distinguish harness/setup errors from reproduced policy defects. If a test cannot run in a genuinely isolated worker, mark unexecuted and block runtime assertions.
7. [ ] **GREEN** only for a defect isolated by RED and in a bounded, separately authorized code change; keep policy enforcement at common broker/worker layer (not backend-specific bypass). If the session contract is *tests-only*, stop after RED evidence and prepare next repair goal instead of stretching scope.
8. [ ] **VERIFY** tests on real owner-authorized isolated fixture, existing browser suite, typecheck/lint/architecture/docs, exact final HEAD CI and nonauthor review. Capture audit/proof receipt with principal, capsule, version, action, artifact hash, deny outcome, no secret values.
9. [ ] **HANDOFF** result `FAIL/UNKNOWN` explicitly; never claim C2/UA-AC11 verified from only mocks. One PR at most with no production/recovery changes.

**Expected negative-test names (proposed):**

```text
browser-policy-boundary.test.ts:
  rejects_external_origin_without_grant_even_in_danger
  rejects_file_url_without_scoped_file_grant
  rejects_private_and_metadata_destinations_without_network_grant
  rejects_invalid_loopback_and_wildcard_address_as_destination
  refuses_stale_grant_revision_or_forged_run_context

browser-policy-security.test.ts:
  denies_redirect_from_allowed_to_ungranted_origin
  denies_popup_iframe_subresource_fetch_and_websocket_egress
  denies_browser_download_without_scoped_destination
  prevents_agent_b_reading_agent_a_cookies_storage_and_profile
  revokes_agent_a_mid_flow_without_affecting_agent_b
  reports_unknown_after_cancelled_or_crashed_inflight_action
  redacts_secret_canaries_from_traces_console_network_artifacts
```

**Important limitation:** These are *future test identifiers*, not existing tests, not PASS assertions and not proof the browser can intercept all those paths until observed in an isolated runtime.

## BR-003: Minimal Browser Backend Contract

**Possible files:** `src/browser/backend.ts` (new only if needed), `src/tools/browser-tools.ts` (surgical), `src/adapters/child-mcp/registry.ts` (prefer no change), `tests/unit/browser-backend-contract.test.ts`, `tests/unit/browser-tools.test.ts`.

1. [ ] Design adapter seam against existing child MCP and ToolRegistry; demonstrate why current registry cannot already express a second backend.
2. [ ] RED: two fake backends under same trusted context must retain policy denial, audit correlation and result shape; missing backend reports unavailable; wrong-principal session denied.
3. [ ] GREEN: implement minimal `probe/open/call/close` **internal** port, no public tool renames or global dependency switch; all calls reenter common policy and check grant freshness; preserve Playwright default.
4. [ ] VERIFY: existing browser units plus new contracts, source checks, exact-head CI, authorized review; rollback seam if it creates an unchecked code path.

## BR-004: Patchright compatibility experiment

**Possible files:** `tests/integration/browser-backend-compatibility.test.ts` or `benchmarks/browser/` controlled fixture; no default `package.json` change. Pin both umbrella Patchright and actual Node package/release source plus npm integrity; choose one candidate for initial evaluation.

1. [ ] Owner-authorize disposable worker and controlled fixture; independently inspect package scripts, artifact hash, browser binary hash/license and OS support; no unpinned auto-download or runtime on the production host.
2. [ ] Run identical Playwright baseline and one experimental backend on open/snapshot/click/type/screenshots/a11y/console/network, credentials, downloads, revocation and negative egress tests; failures are preserved.
3. [ ] Measure reliability, startup, RAM/CPU/disk, code change size and maintenance overhead; use raw receipts and commit/lock hashes.
4. [ ] Produce `ADOPT/ADAPT/DEFER/REJECT` verdict. A policy/security failure → `REJECT` or `DEFER`, not silent whitelist; no claim of undetectability.

## BR-005: Camoufox feasibility

1. [ ] Reconfront [Camoufox TypeScript peer below 1.63](https://github.com/daijro/camoufox/blob/f24d59ce091bb6a8abdb69a9a1943cba501020e9/typescript/README.md) with FolderForge's 1.64.1 lock; compare separate worker protocol option, not global package override.
2. [ ] Review MPL engine + MIT bindings, extra binary distribution, build signatures, OS/runtime, virtual display permissions and support burden.
3. [ ] If still authorized and compatible in a separately pinned disposable worker, run minimal security/functional fixtures and compare resource overhead; otherwise document `DEFER` with no install.

## BR-006: Agentic Observe→Act→Verify→Repair vertical slice

1. [ ] Source-compare Stagehand v4 local action/structured extraction vs Browser Use v1.0.8 local Python/Pydantic/CDP model under same scoped action/evidence contract; hosted tiers and model bills are separate.
2. [ ] Select **at most one** strictly bounded action pattern (e.g. structured extraction with explicit test oracle) while retaining FolderForge's orchestrator; RED tests for prompt injection, domain denial, secret/cookie leak, incorrect model action and max retry.
3. [ ] Execute controlled seeded UI regression detected→fixed→retest with DOM/screenshot/console/network and source/artifact hashes; unverified repair must be `UNKNOWN/FAILED`.

## BR-007: Reproducible benchmark / release gate

1. [ ] Pin backend package+binary+host+browser versions; define identical fixture set and seeded failures with neutral task scoring.
2. [ ] Measure authorized task completion, DOM/action reliability, evidence completeness, recovery, startup p50/p95, max RSS/CPU/disk and 2-agent identity/network isolation; raw records in `benchmarks/browser/` or existing evidence store.
3. [ ] Demand all negatives PASS and a **measurable** authorized gain versus Playwright baseline before promoting optional backend. Exact-final-head CI + independent review + owner consent required. C8 production requires operational attestation/canary/rollback, never inferred from CI.

## Task-to-Goal Map and existing UA ledger traceability

| BR task | Canonical Goal IDs | UA acceptance IDs | UA/FF issue relationship |
| --- | --- | --- | --- |
| BR-001 | G2/G3/G4/G5/G7 | AC02/03/04/09/11/14/15 | M0 C0; informs UA-007/FF-035 (#197), does not advance implementation status. |
| BR-002 | G2/G3/G4 | AC02/03/04/06/11/15 | Depends on UA-002/003 grants, UA-004/005 isolation, UA-007 boundary tests. |
| BR-003 | G3/G4/G7 | AC09/11/14/15 | UA-007, C4. |
| BR-004 | G3/G4/G8 | AC09/11/14/15/17 | UA-007 and UA-017 measurement, not new C8 authority. |
| BR-005 | G2/G7 | AC11/14 | Future capability feasibility, not a shipped UA task. |
| BR-006 | G3/G4/G5 | AC09/10/15 | UA-009/010 and G5 verification loop. |
| BR-007 | G2/G5/G8 | AC07/09/10/11/15/17/18 | UA-014 quotas, UA-017 comparison; UA-018 C8 remains independent. |

**No status inflation:** BR task completion cannot advance UA task completion without the corresponding exact runtime evidence and independently accepted PR. Existing `tasks/universal-agent-todo.md` and `docs/handoffs/NEXT_SESSION.md` are not edited by the unreviewed BR-001 package.