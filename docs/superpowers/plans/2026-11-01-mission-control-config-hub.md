# Mission Control Configuration Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give an authenticated FolderForge operator a discoverable Dashboard view of configuration, beginning with a safe, auditable `shell_exec` quota editor, without enabling browser privilege escalation.

**Architecture:** Extend the existing Mission Control Settings and Dashboard authorization path with typed, allowlisted configuration descriptors and a dedicated bounded hot quota update. Persist owner-controlled values separately from handwritten startup YAML; retain rate-limiter process buckets on live change. Keep high-risk paths read-only and preserve dedicated host-consent/Fleet workflows.

**Tech Stack:** Node.js 22/24, TypeScript, Vitest, React/Vite Mission Control SPA, native HTTP Dashboard, YAML for startup configuration.

**Spec:** `docs/superpowers/specs/2026-11-01-mission-control-config-hub-design.md`

## Global Constraints

- Stabilization freeze: this is a focused operator-UX/security bugfix, not a license to expose all arbitrary config.
- No public deployment, npm publish, tag, PR merge, production isolation edits, host grant changes or worktree cleanup.
- Safe parent/Fleet scopes; avoid editing another running instance implicitly.
- Protect all writes with Dashboard admin authentication, existing Origin/CSRF checks and Mission Control write-freeze.
- Redact secrets, respect provenance and distinguish saved vs effective; no `rateLimit.enabled=false` UI.
- `shell_exec` `dailyQuota` integer 1..10000, `maxCalls` 1..50, `windowMs` 1000..60000; no silent coercion; other tools are read-only for MVP.
- Approval-required host privilege and security gates stay intact, especially R14 #118.
- Rate-limit counters remain per-process, not cluster-wide and not durable across restart.

## Review Focus: user-visible failure modes

1. Two browser tabs update the same quota: the second receives 409 `stale_revision`; no last-writer-wins.
2. Persist fails or storage is corrupt: API reports failure and *runtime quota remains unchanged*; restart fails closed if a previously persisted record is untrusted.
3. Quota is lowered under current usage: accepted old hits remain; the next call is correctly rate-limited. Increasing limits never erases history.
4. Untrusted client POSTs `rateLimit.enabled=false`, auth/bind secrets, negative/fractional quota, unknown tool: return 400/403 and no side effects or leaked content.
5. Config source is overridden by startup env/CLI or another scoped Fleet instance: no ambiguous “saved successfully and active” claim; visibly show authoritative effective state.

---

### Task 1: Establish configuration provenance and scope (read-only)

**Files:**
- Create: `src/operator/config-descriptors.ts`
- Modify: `src/dashboard/server.ts`
- Modify: `packages/mission-control/src/screens/Settings.tsx`
- Test: `tests/integration/dashboard-config.test.ts`
- Test: `tests/unit/config-descriptors.test.ts`

**Interfaces:**
- Produces `describeConfig(container: Container): ConfigDescriptor[]` and `GET /operator/config` redacted response.
- Fields: `key, scope, type, effective, source, editable, category, requiresRestart, blockedReason`.

- [ ] **Step 1:** Write RED tests for a bounded allowlist, no token/secret values, explicit parent scope, `shell_exec` current/default/window and unsupported security keys marked blocked.
- [ ] **Step 2:** Run `npx vitest run tests/unit/config-descriptors.test.ts tests/integration/dashboard-config.test.ts`; confirm expected missing endpoint/function failures.
- [ ] **Step 3:** Implement descriptors + a read-only Dashboard API using existing authorization. Keep provenance `unknown` when it cannot be proven.
- [ ] **Step 4:** Repeat focused suite; require PASS. Inspect response for redaction and HTTP auth origin guard.
- [ ] **Step 5:** Add a compact read-only Configuration card in Settings with scope and restart labels; run Mission Control build.
- [ ] **Step 6:** Commit focused change; include failure/success evidence in commit or PR notes.

### Task 2: Durable, bounded per-process quota update

**Files:**
- Create: `src/operator/rate-limit-settings.ts`
- Modify: `src/policy/rate-limiter.ts` (only if safe hot-reload interface is needed)
- Modify: `src/runtime/container.ts`
- Modify: `src/dashboard/server.ts`
- Test: `tests/unit/rate-limit-settings.test.ts`
- Test: `tests/unit/rate-limiter.test.ts`
- Test: `tests/integration/dashboard-config.test.ts`

**Interfaces:**
- `RateLimitSettings.describe(): {revision:string; effective: RateLimitRule; usage:{windowCount:number; dailyCount:number}}`
- `RateLimitSettings.validate(input: unknown, expectedRevision: string): ValidatedChange`
- `RateLimitSettings.apply(change: ValidatedChange, actor: string): RateLimitSettingsView`
- `POST /operator/config/validate`, `POST /operator/config/apply` with strict `scope='parent'` and `key='rateLimit.overrides.shell_exec'` only.

- [ ] **Step 1:** RED unit tests: 1..10000 daily quota; 1..50 short-window calls; 1000..60000 ms; safe integers only; unsupported keys rejected; actor required; preexisting hits survive quota changes.
- [ ] **Step 2:** Run `npx vitest run tests/unit/rate-limit-settings.test.ts tests/unit/rate-limiter.test.ts` and capture expected RED failures.
- [ ] **Step 3:** Implement revisioned versioned 0600 owner record, atomic temp-to-rename, corruption checks and fail-closed restart read. Ensure disk write succeeds before in-memory swap, no whole `RateLimiter` replacement. Supply clear per-process caveat.
- [ ] **Step 4:** GREEN unit tests including injected failed file write, wrong-revision 409, parallel caller race, symlink/corruption safety; validate all limits.
- [ ] **Step 5:** RED integration tests for unauthenticated write, origin/CSRF denial, write freeze, actor audit, stale revision, invalid/unknown fields, success then GET effective, restart loaded value.
- [ ] **Step 6:** Add narrowly scoped Dashboard routes through the existing security and audit pipeline; reject on required-audit unavailability before mutation.
- [ ] **Step 7:** GREEN integration tests and rerun all affected regression suites; commit.

### Task 3: Usable configuration editor and non-misleading status

**Files:**
- Modify: `packages/mission-control/src/screens/Settings.tsx` (extract section if complexity grows)
- Optional create: `packages/mission-control/src/components/RateLimitSettings.tsx`
- Test: choose existing Mission Control component/browser suite; add to pinned visual baseline as needed
- Modify: `docs/mission-control.md` and `README.md`

- [ ] **Step 1:** RED UI/integration tests for safe numeric editing, validation errors, stale revision, admin denial, loading, error and save outcome, 390px responsive layout, keyboard navigation.
- [ ] **Step 2:** Implement read-only metrics, effective/desired/source, safe explicit Save+validate, bounded `shell_exec` editor; display per-process metric and no restart on hot edit.
- [ ] **Step 3:** Run focused UI tests and `npm run build:mission-control`; collect visual and accessibility evidence, including mobile.
- [ ] **Step 4:** Document YAML/startup precedence, durability caveats, limits, rollback and difference between parent and Fleet scopes; commit.

### Task 4: Guardrails and complete verification

**Files:** Relevant tests, documentation, security test fixtures; no generic config-mutation endpoint beyond the allowlist.

- [ ] **Step 1:** Threat review against `docs/security.md`, `docs/stability-policy.md`, source-directory sandbox controls and R14. Confirm no secret exposure or host authority bypass.
- [ ] **Step 2:** Run `npm ci --ignore-scripts` on a **separate clean worktree** (do not touch the live VPS checkout or legacy isolation metadata).
- [ ] **Step 3:** Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run docs:check`, `npm run architecture:check`, `git diff --check` and relevant HTTP smoke. Record exact pass/fail/skipped counts; never infer pass from absent evidence.
- [ ] **Step 4:** Push a separate product PR only after scope review; check exact-head GitHub CI, security reviewer feedback, and post-merge exact-main CI. No auto-merge or release operation.

### Task 5: Follow-on phases (separate PRs and review gates)

- [ ] **Read-only full inventory:** enumerate every supported `FolderForgeConfig` field with source, effective state, owner and pending restart metadata; integration test redaction, config precedence, Fleet scope separation.
- [ ] **Staged restart fields:** tested planner/apply and explicit manual restart for safe tools/adapters/LSP options; no host execution before consent; support revision conflict and rollback.
- [ ] **Existing dedicated flows:** link Credentials, Fleet, Tunnels, Workspaces, Mission Control; only promote fields to editable if an independently reviewed security contract exists.
- [ ] **Operations observability:** history, bounded change diff, audit, per-instance runtime/capacity, validation error telemetry, no per-process quota presented as distributed quota.
- [ ] **Production eligibility:** externally qualified real host writer-fencing proof, independent review, confirmed npm OIDC publication, 24-hour soak and beta acceptance. These **cannot** be checked off by code changes alone.

## Delivery milestones and honest percentage

- **D0**: Review/design/plan only; no Dashboard runtime behavior delivered.
- **D1**: Live redacted inventory with verified security boundary.
- **D2**: Safe `shell_exec` quota editor with persistence and regression/CI proof.
- **D3**: Staged safe field coverage plus rollback/history; no arbitrary secrets or privileged fields.
- **D4**: External production evidence and release qualification (separate from UI completeness).

Dashboard progress must be measured against the signed-off descriptor allowlist and tested acceptance items; do not count screens, code lines, or unreviewed PRs as percentage complete. See `docs/reviews/2026-11-01-status-and-goals.md` for a **subjective** broader product-readiness rubric.

## Integration discipline

When D0 is reviewed, execute one independently testable task at a time on a new clean worktree based on current remote main. Do not reuse unmanaged stale task isolation records; do not change 0600 credentials, live server config, legacy recovery metadata, production npm, tags, or release workflows. Keep new changes Draft until exact-head CI and review gates are actually met.
