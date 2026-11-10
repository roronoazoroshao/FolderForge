# FolderForge — proposed 90-day roadmap (no implementation authorization)

**Baseline:** `main@8c00b15`, 2026-11-10. This roadmap represents recommendations, **not approved delivery, an npm release, or a production rollout**. Scope/ROI assumes 1 developer and an independently available security reviewer; staffing, actual demand, monthly spend and SLAs remain **[UNVERIFIED]**. Proposals and decisions live in [PROPOSALS.md](audit/PROPOSALS.md).

## Phase 3: direction and positioning

**Serve:** local/Remote-SSH solo developers and 2–10-person teams who need a governed, observable bridge between AI clients and real project workspaces (`package.json:2-5`; `README.md:16-61`). **Core value:** one clear onramp from Web Control to a scoped, revocable MCP execution environment; verified outcomes rather than uncontrolled autonomy (`src/dashboard/server.ts:950-1028`; `src/tools/registry.ts:529-600`).

**Do NOT become:** generic root shell exposed to AI, silently persistent credential broker, human-independent deployment authority, indiscriminate worktree cleaner, or a fake “independent agent council”. An independent model is not a substitute for security sign-off (`src/agent-loops/agent-loop-runner.ts:185-216`; `docs/r14-kernel-registry-fence-migration.md:24-38`).

### Three 90-day strategic goals and measurable targets

| Goal | Metrics (proposed target) | Baseline/measurement source | Non-negotiable quality gate |
|---|---|---|---|
| G1 — Usable owner onboarding | ≥80% of 20 **consenting pilot** sessions reach a **healthy** scoped Fleet in ≤10 min; ≤3 required decisions; 0 unsigned host grants | Baseline conversion **[UNVERIFIED]**; source `packages/mission-control/src/screens/Overview.tsx`, `src/operator/trusted-host-consent.ts:46-76`; instrument opted-in first-run events (F03/F07) | Do not log signed tokens; UI verification cannot be forged |
| G2 — Verified, affordable agent outcomes | ≥95% success on a fixed 100-case safe-task eval set; 100% model invocations budget-accounted; 0 unauthorised destructive actions in tested runs; ≤1% double-charge discrepancy | Baseline model success/spend **[UNVERIFIED]**; deterministic council current (`src/agent-loops/agent-loop-runner.ts:156-216`); planned F04/F05/F11 | Never claim independent review from synthetic votes; stop when budget/approval expires |
| G3 — Operable security/reliability | Detect dead Fleet ≤60s in injected tests; alert dedupe ≤1/5min; 100% exercised critical mutation paths fail closed when writer epoch unavailable; host migration **NO-GO until independent APPROVED** | Existing kernel-fence gap `docs/r14-kernel-registry-fence-migration.md:24-38,74-83`; no production MTTR/uptime baseline **[UNVERIFIED]** | 0 actual registry writes on the live host until explicit operator/reviewer cutover |

## Phase 4: prioritized order, safety override and dependencies

**Order for review:** F01 → F02 → F05 → F03 → F04 → F07 → F06 → F08 → F09 → F10 → F11 → F12 → F13. F10 is **critical independent P0 production gate** and must be designed/reviewed early even though deployment follows review and has low ICE. No feature implementation is implied by its position. See per-feature effort, impact, confidence, risk and ICE in [PROPOSALS.md](audit/PROPOSALS.md).

```text
F01 → F03, F04, F05, F11          (trust provenance first)
F02 → F07, F06                   (current docs/contract first)
F03 → F06                        (consent-aware wizard before staged config)
F04 → F08, F11, F12, F13         (cost guard before model/memory/automation)
F05 → F08, F09, F10, F11, F13    (adversarial policy evaluation)
F07 → F06, F09, F10, F12, F13    (reliability and incident telemetry)
F08 → F13                        (consented memory before learning coach)
F09 → F10, F11, F12              (child tool trust before advanced flows)
Independent qualified reviewer → F10 production activation
```

## Horizons and milestones

| Horizon | Deliverables (only if approved) | Measured exit criteria | Risk condition |
|---|---|---|---|
| **NOW (weeks 0–2)** | F01 honest heuristic provenance MVP, F02 docs drift guard MVP, F05 security eval corpus MVP, F03 first-run owner readiness MVP; F10 external reviewer/host threat model **design only** | Baseline instrumented; zero fake reviewer labels; ≥50 adversarial fixtures; owner negative/390px tests pass; root docs changes remain explicitly approved | No rollout of reconcile or host permission change |
| **NEXT (weeks 2–6)** | Capacity-limited MVPs: F04 ledger, F07 local incident view, F06 3 typed settings, F09 prototype schema quarantine; F10 independent reviewer planning only | Usage recorded for 100% synthetic model runs, hard budget stop; 60s Fleet fault detection; 0 anonymous quota/settings changes; malicious child schema quarantine | F10 never activated without kernel DAC proof and reviewer |
| **LATER (weeks 6–12)** | Candidate backlog **select 1–2 only** from F08 memory MVP, F11 optional council MVP, F12 signed event MVP, F13 error coach MVP; F10 controlled **operator-approved canary** only as a separate staffed security track | ≥100 safe-task evals, ≥95% target pass; 20 signed-owner pilots with ≥80% healthy onboarding; no unapproved mutation, cost and rollback evidence attached | External API/credential/payment and host/production approvals separate from implementation |

**Capacity reality:** the 13 full-scope estimates sum to **103 engineer-days**, before reviews and operational qualification. One engineer has only roughly 60–65 working days in 12 weeks, so **all 13 cannot be delivered in 90 days**. NOW proposes at most 10 engineer-days of reduced MVP slices (F01 2d, F02 3d, F05 starter 2d, F03 preflight starter 3d); NEXT at most 20 (F04 MVP 5d, F07 MVP 4d, F06 MVP 7d, F09 design/quarantine prototype 4d). LATER has only about 30–35 remaining: choose **one or two** advanced MVPs (F08/F11/F12/F13) after dependency checks, rather than promising all four. F10 real-host qualification is a **separate external security/release workstream**; it cannot be squeezed into normal feature velocity without dropping other scope. Full scopes/STABLE/PRO are deferred to later cycles unless the owner funds more staffed parallel tracks. Nothing is approved by these indicative allocations.

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
| Operational SLO | ≥80% signed-owner onboarding healthy, dead Fleet detection ≤60s | **PILOT REQUIRED**, baseline unmeasured |
| Publication | Manual approved release tag, attestation, current soak, rollback | **NO-GO [UNVERIFIED]** from this audit |

**Approval gate:** accept/reject/modify features in [PROPOSALS.md](audit/PROPOSALS.md), with intended MVP/STABLE/PRO scope. No source code, production change, git merge, publishing, payments, credentials or destructive action is authorized by this roadmap.
