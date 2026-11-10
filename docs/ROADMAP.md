# FolderForge — 90-day roadmap (F14/F15 MVP source implementation approved; no production authorization)

**Baseline:** `main@8c00b15`, 2026-11-10. **Owner-confirmed scope: child folders behind one tunnel are independent projects, not monorepo packages.** F14 accordingly proposes one authorized worker per project. F14/F15 **MVP source work approved by owner** and available only in [Draft PR #156](https://github.com/roronoazoroshao/FolderForge/pull/156) and [Draft PR #157](https://github.com/roronoazoroshao/FolderForge/pull/157), **not merged**. Other features remain unapproved, with no npm release or production rollout authorized. Scope/ROI assumes one developer and an independently available security reviewer; staffing, actual demand, monthly spend and SLAs remain **[UNVERIFIED]**. Proposals and decisions live in [PROPOSALS.md](audit/PROPOSALS.md).

## Phase 3: direction and positioning

**Serve:** local/Remote-SSH solo developers and 2–10-person teams who need a governed, observable bridge between AI clients and real project workspaces (`package.json:2-5`; `README.md:16-61`). **Core value:** one clear onramp from Web Control to a scoped, revocable MCP execution environment; verified outcomes rather than uncontrolled autonomy (`src/dashboard/server.ts:950-1028`; `src/tools/registry.ts:529-600`).

**Do NOT become:** generic root shell exposed to AI, silently persistent credential broker, human-independent deployment authority, indiscriminate worktree cleaner, or a fake “independent agent council”. An independent model is not a substitute for security sign-off (`src/agent-loops/agent-loop-runner.ts:185-216`; `docs/r14-kernel-registry-fence-migration.md:24-38`).

### Three 90-day strategic goals and measurable targets

| Goal | Metrics (proposed target) | Baseline/measurement source | Non-negotiable quality gate |
|---|---|---|---|
| G1 — Usable owner onboarding | ≥80% of 20 **consenting pilot** sessions reach a **healthy** scoped Fleet in ≤10 min; ≤3 required decisions; 0 unsigned host grants | Baseline conversion **[UNVERIFIED]**; source `packages/mission-control/src/screens/Overview.tsx`, `src/operator/trusted-host-consent.ts:46-76`; instrument opted-in first-run events (F03/F07) | Do not log signed tokens; UI verification cannot be forged |
| G2 — Verified, affordable agent outcomes | ≥95% success on a fixed 100-case safe-task eval set; 100% model invocations budget-accounted; 0 unauthorised destructive actions in tested runs; ≤1% double-charge discrepancy | Baseline model success/spend **[UNVERIFIED]**; deterministic council current (`src/agent-loops/agent-loop-runner.ts:156-216`); planned F04/F05/F11 | Never claim independent review from synthetic votes; stop when budget/approval expires |
| G3 — Safe multi-workspace operation and reliability | **0 cross-root actions in ≥500 interleaved requests** across 3 child projects/2 clients; p95 noncontended latency ≤1.5× isolated baseline on controlled load; dead Fleet detected ≤60s; critical registry mutation still fail-closed without writer epoch | Existing kernel-fence gap `docs/r14-kernel-registry-fence-migration.md:24-38,74-83`; no production MTTR/uptime baseline **[UNVERIFIED]** | 0 actual registry writes on the live host until explicit operator/reviewer cutover |

## Phase 4: prioritized order, safety override and dependencies

**Safety-prioritized order for review:** **F14 first (P0; multi-child request binding)** → F01 → F02 → F05 → F07 → **F15 (P1; fair resource scheduling)** → F03 → F04 → F06 → F09 → F08 → F11 → F12 → F13. F10 is a separate **critical independent P0 production release gate**, requiring external reviewer and kernel fencing before activation. Neither the ICE rank nor owner request to make one tunnel serve many projects permits bypassing either security gate. Only F14/F15 **MVP source work** is approved; merge, production cutover and other features require separate gates. See per-feature effort, impact, confidence, risk and ICE in [PROPOSALS.md](audit/PROPOSALS.md).

```text
F01 → F03, F04, F05, F11          (trust provenance first)
F02 → F07, F06                   (current docs/contract first)
F03 → F06                        (consent-aware wizard before staged config)
F04 → F08, F11, F12, F13         (cost guard before model/memory/automation)
F05 → F08, F09, F10, F11, F13    (adversarial policy evaluation)
F07 → F06, F09, F10, F12, F13    (reliability and incident telemetry)
F08 → F13                        (consented memory before learning coach)
F09 → F10, F11, F12              (child tool trust before advanced flows)
F14 → F15, F03                    (immutable project identity before fairness/UI)
F07 → F15                         (incident metrics before queue tuning)
Independent qualified reviewer → F10 production activation
```

## Horizons and milestones

| Horizon | Deliverables (only if approved) | Measured exit criteria | Risk condition |
|---|---|---|---|
| **NOW (weeks 0–2)** | **F14 MVP first**: request/session-scoped root, owner-approved child mapping, fail-closed ambiguity and interleaved tests (~8d); F01 provenance MVP (~2d); F02 critical metadata/docs MVP (~2d); F10 security review plan only | ≥500 concurrent/interleaved child operations on test fixtures with **0 wrong-folder results**; 1-child legacy mode works; no fabricated reviewer claims | No production tunnel migration, host permission change or reconcile activation |
| **NEXT (weeks 2–6)** | F14 STABLE namespace/catalog hardening (~7d); F05 initial adversarial corpus (~4d); F07 local health signal MVP (~4d); **F15 fair queue/quota MVP (~5d)** | 0 cross-session catalog leakage; no child starvation >30s under fixed bounded queue; failed auth/path swap returns denial; 60s child death detection | Global abuse cap retained, no automatic retries for uncertain writes |
| **LATER (weeks 6–12)** | F03 Fleet consent UX MVP (~5d); F04 token budget MVP (~6d); F06 typed D3 settings MVP (~10d); F09 child trust manifest MVP (~9d). F08/F11/F12/F13 remain **DEFERRED beyond 90d** for single-engineer capacity; F10 production fence is separately staffed | ≥80% healthy Fleet onboarding in 20 consenting pilots; 100% simulated LLM calls budget-stopped; 0 anonymous settings edits; malicious child manifests quarantined | F10 host canary only after external independent reviewer and separate owner cutover approval |

**Capacity reality:** the 15 full-feature estimates total **126 engineer-days** (original 103 + F14 15 + F15 8), before security review and host migration. One engineer has roughly 60–65 working days in 12 weeks; **delivering all 15 is infeasible**. The constrained roadmap allocates approximately NOW 12d + NEXT 20d + LATER 30d = **62 engineer-days**, using smaller MVP slices. Model-backed council, persistent memory, automation and coaching remain a **post-90-day backlog** unless staffing/priority changes. F10 is an independent security workstream that cannot borrow imagined capacity. No dates are delivery commitments. F14/F15 MVP source work was approved and submitted as Draft PRs; all other features remain unapproved.

## Step-by-step development track (Phase 5, only on approval)

| Track | Build scope | Required verification |
|---|---|---|
| 🟢 MVP | Smallest policy-safe feature slice, opt-in and observable; no destructive default | TDD RED/GREEN, 1 failure case, security negative, docs and rollback |
| 🟡 STABLE | Durable restart/rollback, exact schemas, idempotent retries and platform evidence | Full unit + integration + fault tests, exact-head CI, measured KPI on canary |
| 🔵 PRO | Optional advanced integration/model/cross-host, never bypassing owner/fence | Provider/child supply-chain audit, red-team eval, two-person review for critical OS writers, explicit budget |

### 15-step agent-engineering planning checklist (select relevant)
1. Define stages and external boundaries.
2. Select LLM vs script per stage, with honest provenance.
3. Specify inputs/outputs and schemas.
4. List tools/credentials, source trust and paid API budgets.
5. Design scoped memory, TTL and deletion.
6. Define finite-state main loop.
7. Verify postconditions after critical steps.
8. Add retries only for idempotent calls; failure quarantine and fallback.
9. Set stop conditions, time/tool/token/money ceilings.
10. Put human approval at high-risk actions.
11. Add audit, structured logs, metrics and alerts.
12. Allow self-improvement as recommendations only, never self-patching in prod.
13. Write unit/integration/security/LLM eval test scenarios.
14. Map files/interfaces and reversible migrations.
15. Produce small commits, CI, docs, rollback proof and PR-ready branch; **never auto-merge**.

## Go / no-go for an AI agent release

| Requirement | Threshold | State at audit |
|---|---|---|
| Source quality | build/typecheck/lint; no failed tests; docs; exact-head multi-OS CI | **PASS** 1,580 tests, 34 skips, 7/7 CI; skips not passes |
| Testing breadth | 100% critical paths exercised + ≥200 adversarial injected cases | **NO-GO / NOT YET MEASURED**; branch coverage overall 66.85% |
| Review transparency | 0 false independent-review claims, verifier IDs present | **NO-GO** synthetic fallback uses “independent” text |
| Budget / token | 100% cost-accounted LLM tasks, hard no-overspend | **NO-GO [UNVERIFIED]** |
| Host safety | Old writer kernel denied, epoch survives restart, independent APPROVED reviewer | **NO-GO**, `docs/r14-kernel-registry-fence-migration.md:74-83` |
| Multi-child project isolation | 0 wrong-root actions in 500 interleaved calls + 0 cross-session toolset change; fail closed on ambiguity | **NO-GO on main**: F14 is in unmerged Draft PR #156; safety review and staging proof missing (`src/workspace/workspace-manager.ts:30-33`) |
| Multi-child fairness | Per-child tool budgets and no >30s starvation under bounded load | **NO-GO on main**: F15 is in unmerged Draft PR #157; local 3×2×200 tests passed, production/isolated p95 remains **[UNVERIFIED]** (`src/policy/rate-limiter.ts:22-39`) |
| Operational SLO | ≥80% signed-owner onboarding healthy, dead Fleet detection ≤60s | **PILOT REQUIRED**, baseline unmeasured |
| Publication | Manual approved release tag, attestation, current soak, rollback | **NO-GO [UNVERIFIED]** from this audit |

**New multi-child evidence:** [one tunnel / many workspaces](audit/MULTI_WORKSPACE_TUNNEL.md). **Approval gate:** accept/reject/modify features in [PROPOSALS.md](audit/PROPOSALS.md), with intended MVP/STABLE/PRO scope. No source code, production change, git merge, publishing, payments, credentials or destructive action is authorized by this roadmap.
