# FOLDERFORGE — NEXT MASTER PROMPT: BR-002 BROWSER-POLICY-BOUNDARY-AND-CROSS-SESSION-NEGATIVE-TESTS

> **STATUS:** Proposed BR-001 handoff written 2026-11-23, Asia/Ho_Chi_Minh. **BR-001 PARTIAL / UNREVIEWED / C0 HOLD.** This prompt is self-contained, but does not authorize a production change or automatically advance to BR-002. If BR-001's source review or required authorization is still missing, the session's single goal is **BR-001 review/closure**, not implementation.

## ROLE AND EXECUTION CONTRACT

Act as Principal Software Architect, Browser Automation Engineer, Security Reviewer, AI-Agent Infrastructure Engineer, Adversarial QA Engineer and Git Integration Engineer. Discover actual connected GitHub/FolderForge/tools/skills at session start; read relevant Superpowers and agent-skills source/TDD/security/verification/review instructions. Do not fabricate tool capability, hidden host access, reviewer independence or product security certification.

**ONE SESSION = ONE SMALL GOAL → VERIFIED EVIDENCE → POLICY-COMPLIANT ACTION → VERIFICATION → SAFE HANDOFF.** In this next session, if gates permit, the only implementation goal is **BR-002: Browser Policy Boundary and Cross-Session Negative Tests**. Do not start BR-003–007. Browser runtime dependency changes are prohibited within BR-002. Use RED first; repair only within clearly authorized narrow scope and no more than one goal.

## REPOSITORY AND LAST VERIFIED STATE (REFRESH ALL)

- Repo: https://github.com/roronoazoroshao/FolderForge; canonical branch `main`.
- **Fresh BR-001 inspected GitHub main SHA:** `599473dec46bddcabda618223d5ec7636261b5ef`; https://github.com/roronoazoroshao/FolderForge/commit/599473dec46bddcabda618223d5ec7636261b5ef
- Host workspace: `/home/devops/FolderForge`; branch `feat/ua002-trusted-context-20261117`; local HEAD `b51334fea35679cc51ea8e2b3ac43c008882a0c8`; working tree CLEAN; `origin/main` matches inspected main, and is an ancestor of local HEAD.
- Worktrees: **40**, of which **39 detached**; isolation records **24 active**, 22 `ISOLATION_HEALTH_UNVERIFIABLE`, 2 `ISOLATION_WORKTREE_MISSING`. Do not delete, prune, reconcile or restore. Host disk available **81 GB**, RAM available approximately 4.9 GiB, swap ~3.5/4 GiB used at last inspection. Capacity is a fresh snapshot, not a multi-agent admission guarantee.
- Host FolderForge policy mode `danger` and capsule enforcement `optional`; connector permissions and `danger` are **NOT** owner grants or an OS security boundary. No production restart, release, tunnel repoint or cleanup authorized.
- GitHub issue [#118](https://github.com/roronoazoroshao/FolderForge/issues/118) OPEN (writer fencing/recovery), issue [#202](https://github.com/roronoazoroshao/FolderForge/issues/202) OPEN (synthetic reviewer authority). [PR #208](https://github.com/roronoazoroshao/FolderForge/pull/208) CLOSED/UNMERGED. No open PRs returned by fresh repo-scoped query; independent policy/review requirement still UNKNOWN. **Do not reopen #208 or reapply its dependency change.**
- The proposed BR-001 documents do not yet exist on main. BR-001 generated a **copy-ready, uncommitted, unreviewed** bundle with `docs/superpowers/specs/2026-11-23-browser-capability-backends-design.md`, `docs/adr-0013-browser-capability-backend-admission.md`, `docs/superpowers/plans/2026-11-23-browser-capability-backends.md`. Their contents are **proposals**, not merged architecture authority. Apply only after real review and conflict checks.
- Canonical `docs/handoffs/NEXT_SESSION.md` currently targets **UA-002**. Do not overwrite its live planning ownership with this conditional BR continuation.

## READ FIRST — CANONICAL AUTHORITY

1. `AGENTS.md`, at the *fresh* main SHA.
2. `docs/strategy/UNIVERSAL_AGENT_GOALMAP_2026-11-15.md` (G1–G8).
3. `docs/strategy/UNIVERSAL_AGENT_ROADMAP_2026-11-15.md` (M0→M1→M2→M3→M4→M5; gates C0/C1/C2/C4/C8).
4. `docs/superpowers/specs/2026-11-15-universal-agent-work-environment-design.md` (UA-AC02,03,04,06,09,10,11,14,15).
5. `docs/superpowers/plans/2026-11-15-universal-agent-work-environment-implementation.md`; `tasks/universal-agent-todo.md` and `docs/handoffs/NEXT_SESSION.md`.
6. BR-001 proposed specification, ADR and implementation plan only if their actual source/approved revision is available; verify SHA and status instead of assuming acceptance.
7. Relevant PRs, issues, branch policy, latest exact commit CI, pending reviews and overlapping work ownership.

## BROWSER FOUNDATION REINSPECTION

At inspected main, `package.json` declares `@playwright/mcp:^0.0.84`, `playwright-core:1.64.1`; lockfile fixes `@playwright/mcp@0.0.84` + `playwright-core@1.64.1`. Do not update just because upstream Playwright MCP source has package v0.0.86.

Relevant paths (verify freshness before editing):

- `src/tools/browser-tools.ts` — `browser_open`, `browser_eval`, click/type/snapshot/screenshot/flow and URL helper.
- `src/browser/network-proxy.ts` — shaping proxy, HTTP(S)/CONNECT forwarding.
- `src/browser/emulation-manager.ts` — modifies child adapter options, shapes network.
- `src/adapters/child-mcp/registry.ts`, `resolve.ts`, `risk-map.ts` — lifecycle, package-local Playwright runtime and risk fallback.
- `src/tools/registry.ts`, `src/core/types.ts`, `src/capsule/workspace-capsule-manager.ts`, `src/policy/`, `src/proof/`, `src/sandbox/` — trust binding and audit/proof/executor boundaries.
- `tests/unit/browser-tools.test.ts`, `tests/unit/browser-flow.test.ts`, `tests/unit/browser-quality.test.ts`, `tests/unit/browser-emulation.test.ts`, `tests/unit/browser-setup.test.ts` — existing regression surfaces.
- Proposed new tests: `tests/unit/browser-policy-boundary.test.ts`, `tests/integration/browser-policy-security.test.ts`. Confirm paths do not collide with active work.

**Known source-level gaps (NOT runtime exploit proofs):**

- [`browser-tools.ts#L174-L183`](https://github.com/roronoazoroshao/FolderForge/blob/599473dec46bddcabda618223d5ec7636261b5ef/src/tools/browser-tools.ts#L174-L183) treats `file:` and loopback targets as allowed at wrapper level.
- [`browser-tools.ts#L277-L290`](https://github.com/roronoazoroshao/FolderForge/blob/599473dec46bddcabda618223d5ec7636261b5ef/src/tools/browser-tools.ts#L277-L290) skips external URL restriction in `danger` mode.
- [`network-proxy.ts#L153-L229`](https://github.com/roronoazoroshao/FolderForge/blob/599473dec46bddcabda618223d5ec7636261b5ef/src/browser/network-proxy.ts#L153-L229) is traffic shaping, not an observed outbound ACL. Some child Playwright MCP defaults may block `file:` separately; do not claim effective exploit until end-to-end reproduction.
- `ToolPrincipal` does not itself contain all grant tuple fields; optional capsule enforcement does not prove OS/profile/network isolation.
- An initial navigate check does not cover redirect/frame/popup/fetch/service worker/WS/network downloads. Missing logs/trace/audit redaction and revocation need real evidence.

**Upstream research receipt — for context, no dependency work in BR-002:**

- Playwright MCP [`2337aff0213d28db41d3e3daf48cee19b3d0bd82`](https://github.com/microsoft/playwright-mcp/commit/2337aff0213d28db41d3e3daf48cee19b3d0bd82) — Apache-2.0; existing default baseline.
- Patchright [`521ad98adbb35e09c135864058428b117bf47be8`](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright/commit/521ad98adbb35e09c135864058428b117bf47be8) — Apache-2.0; Node implementation separate [`a2e746cdea6d29d4ef53176ac979e63fdab6fbbf`](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright-nodejs/commit/a2e746cdea6d29d4ef53176ac979e63fdab6fbbf).
- Camoufox [`f24d59ce091bb6a8abdb69a9a1943cba501020e9`](https://github.com/daijro/camoufox/commit/f24d59ce091bb6a8abdb69a9a1943cba501020e9) — MPL-2.0 engine/MIT bindings; documented TS `playwright-core` peer below 1.63 vs FolderForge 1.64.1, DEFER.
- Browser Use [`753d629d76eb2b670f4cf467f3355bbe750f6845`](https://github.com/browser-use/browser-use/commit/753d629d76eb2b670f4cf467f3355bbe750f6845) — MIT/Python v1.0.8, later observation pattern.
- Rebrowser Playwright [`caecbe312404121e70a4e3f894b21eb9fb645a53`](https://github.com/rebrowser/rebrowser-playwright/commit/caecbe312404121e70a4e3f894b21eb9fb645a53) — Apache-2.0, Patchright alternative.
- Stagehand [`3bedd822f2e31c6716added7743179405985a439`](https://github.com/browserbase/stagehand/commit/3bedd822f2e31c6716added7743179405985a439) — MIT, future one-slice candidate.
- Crawlee [`377c7a4943f1856119e66ff448ffc669f1cd0be2`](https://github.com/apify/crawlee/commit/377c7a4943f1856119e66ff448ffc669f1cd0be2) — Apache-2.0, deferred crawling.
- Lightpanda [`8dae37d688a866f67e3b67e7b14ab33eee35e60d`](https://github.com/lightpanda-io/browser/commit/8dae37d688a866f67e3b67e7b14ab33eee35e60d) — AGPL-3.0, legal/runtime review deferred.

## GATE CHECK BEFORE CHOOSING THIS SESSION'S ONE GOAL

**If BR-001 lacks authentic source/architecture/security review or policy/authority is unknown:** choose **BR-001-REVIEW-CLOSURE** (one documentation/review goal), not BR-002 code changes. Confirm no active reviewer/branch conflict; request or record genuinely independent review, handle findings, run actual documentation checks if a safe branch is permitted, and only then mark BR-001 reviewed. Self-review, synthetic reviewer votes, GitHub push access or mergeability cannot authorize this.

**Only if BR-001 accepted and relevant M1/source/fixture rights are in force:** choose **BR-002** and work on negative tests. C0 and UA-002/003/004/005 must not silently be treated as complete. Source-only test preparation may be permissible while live OS C2 remains unavailable; report no live boundary certification.

## BR-002 SINGLE GOAL — NEGATIVE BROWSER POLICY EVIDENCE

**Outcome:** a bounded suite proving that browser policy denies unauthorized navigation, file/private-network/metadata access, redirects, iframe/popup/subresources/WS, profile/cookie cross-agent reads, downloads, stale grant revisions and revocation; all cases run against **owned, local controlled fixtures** without contacting unrelated external websites or actual host metadata endpoints.

**Exact method:**

1. Read-only refresh: `git status`, HEAD and ancestry, main SHA, open PRs and branch/ruleset policy, `AGENTS.md`, relevant code/tests, host worktrees/isolation/capacity. Prove worker can safely run browser and block egress independent of Playwright. If no verified worker, do not run live browser.
2. Determine a narrow behavior contract around trusted server-derived `principalId, workspaceId, capsuleId, grantId, grantRevision, operationId`; no model input values for these. Verify grant freshness before every action and on session continuation; `danger` must not bypass egress grants.
3. Write and run failing **unit tests first**, including ungranted public/local/file target, danger-mode, forged/stale grant and disabled child MCP states. Record actual RED oracle; an expected fixture setup error is **not** a security failure.
4. In a disposable authorized OS/network-isolated worker, write and run **real browser negative fixtures** for allow→deny redirects, popups, iframes, fetch, subresource, service worker, websocket/CONNECT, download attempts, cookie/localStorage/profile sentinel across two principal identities, agent A revocation mid-action, agent B unaffected. Do not inspect other users' data or network.
5. Correlate every action outcome with audit+source SHA+principal/capsule/grant+artifact hash; no credentials/cookies/screenshots with canary data in public proof. Mark missing observations UNKNOWN.
6. Keep implementation scope explicitly limited: either finish a *tests-only* BR-002 with failing gap evidence and propose BR-002-POLICY-REPAIR, or perform a separately permitted minimal RED→GREEN fix within the one-goal scope. Never install Patchright/Camoufox or alter default Playwright in BR-002.
7. If authorized code changes exist, run focused Vitest and baseline browser suites, `npm run typecheck`, `npm run lint`, `npm run architecture:check`, `npm run docs:check`, and isolated runtime tests. Record commands, exit codes, number of tests, missing matrix cells. Any docs/test commit requires exact final-head GitHub CI and genuine independent review or a documented valid scoped exception.
8. Record PR status (`OPEN/CLOSED/MERGED`), exact SHA, CI, reviews, blocker disposition. Preserve UA-002 unrelated changes and recovery state. Create a next single-goal handoff only when current evidence actually supports it.

**Acceptance:** at least one reproducible negative security oracle; demonstrable refused unauthorized destination at correct network boundary only if a real test proves it; two-agent isolation/revocation proof only if actually executed; Playwright baseline not regressed. **NO inference of complete C2/AC11 from unit tests.** If criteria fail, outcome = `PARTIAL` or `BLOCKED` with exact missing evidence.

## NON-NEGOTIABLE STOP CONDITIONS

Stop mutations if independent review/owner grant is missing, isolation fixture cannot enforce egress/OS policy, branch conflicts with active UA-002, #118 recovery subsystem is in scope, host disk/CPU quotas unsafe, new automatic binary download required, or results would touch production/tunnels/recovery records. Prefer copy-ready tests/spec and `BLOCKED` to unauthorized changes. Do not reopen PR #208. Do not claim deployment, certification, evasion success or independent approval from any AI-generated text.

## REQUIRED REPORT AND HANDOFF

Report in exact order:

`GOAL | MAIN_SHA | BASELINE | UPSTREAM_EVIDENCE | ARCHITECTURE_DECISION | LICENSE | SECURITY | TESTS | PR | CI | REVIEW | BLOCKERS | NEXT_GOAL`

Each field explicitly identifies **fresh, historical, unknown/inaccessible, or not executed** evidence and includes precise source/commit/run links where available. End with the next complete Master Prompt containing updated exact state, one safe goal, remaining gates, recovery constraints and truthfully labeled outcomes. For an unreviewed BR-001, **NEXT_GOAL = BR-001 REVIEW/CLOSURE**; when BR-001 is accepted and all entry gates permit, **NEXT_GOAL = BR-002**. Subsequent goal only after BR-002 review is BR-003 (backend seam if demonstrated needed).

**Definition of done:** no standalone code existence, green CI alone, mergeable flag, synthetic reviewer, Playwright context isolation or self-reported agent success counts as production/live/security completion.