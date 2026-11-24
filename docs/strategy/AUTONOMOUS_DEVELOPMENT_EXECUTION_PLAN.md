# Autonomous Development Execution Plan — FF-RECURSIVE-01

Status: PROPOSED governance change; not an authorization or production certification. Existing policy and PR-specific requirements remain applicable until this proposal is legitimately adopted. This proposal cannot approve itself. No repository visibility, credentials, branch-protection, or production changes are authorized.

## Outcome and scope

Keep the Universal Agent North Star, G1–G7, UA-AC01–18 and milestone M0–M5. Optimize for one observable, reversible, mergeable slice per interactive session, with cumulative project audit. Separate source integration, disposable dev preview, and operational certification. Keep main canonical; short-lived branches only. Do not equate dev publication with public credentials/data or deployment.

Options: (A) retain a global stop on all C0 gaps (too much idle time); (B) permanent develop branch (integration debt); (C) risk-tiered main integration, disabled/unavailable capabilities and owned fixtures (recommended). Existing security boundaries stay fail-closed. Do not create a second grant authority or weaken tests to pass.

## Project rules after legitimate adoption

- D0 routine documentation, isolated test fixtures, non-authority source/UI changes without new exposure: scoped diff, self-review explicitly labeled, exact-head applicable CI, rollback path and policy-compliant integration. Independent human review may be optional only when the approved rule and platform/PR conditions explicitly allow it; never fabricate approval.
- D1 security/authority, authentication, grants, isolation, untrusted browser/egress, deployment controls, recovery, sensitive data, or governance changes: qualified independent review and applicable negative tests remain required. An exception must be explicit, narrowly scoped, authorized and permitted; no self-exemption. When useful, develop a separate disabled/unavailable or pure fixture slice that does not change the protected boundary.
- D2 live host, registry, recovery, privilege, production deployment or public exposure of private assets: explicit operational authorization, verified capacity, recovery/rollback and applicable C0–C8 gates. Dev previews use owned synthetic data and isolated runners; no unrestricted live authority.
- Classify by effects, not file extension. Mixed scope inherits highest tier; split only if genuinely independent and safe. No bypass of enforced GitHub requirements; existing PR-specific requirements are not retroactively removed by this plan.
- Autonomous repair: reproduce, inspect source/logs/policy, change hypothesis and tool, use authorized alternatives (GitHub, disposable local/CI runner), repair or rollback; after two equivalent no-delta attempts switch route. If genuine authority/provider dependency remains, park the affected slice and select the highest-priority independent eligible roadmap slice. No repeated polling, synthetic reviewer, privilege escalation or new branch solely to restate blocker.
- All behavior changes: RED -> minimal GREEN -> refactor -> targeted and applicable static/integration checks; distinguish mocked, source-tested, runtime-tested. Review actual diff for regressions. Use available tools honestly; unavailable tools are not automatic global blockers.
- Merge only after applicable policy and exact final-head checks; verify main contains the change (ancestry or documented equivalent squash mapping), delete only its safe integrated branch, verify absence. Never delete unique work, active PRs, stashes or recovery worktrees. If CI is pending, retain branch and report PENDING_CI, never DONE.
- One session = one delivered outcome, not one arbitrary commit. Typically <=5 implementation/test files plus rolling documentation; use a scoped exception when needed. No repeated meta-only sessions while a functional eligible task exists.

## Delivery sequence

| Increment | Output | Verification / exit | Risk / dependency |
| --- | --- | --- | --- |
| GOV-01 | Adopt this rules/goal/roadmap plan | Docs checks, explicit eligible governance review, merge and branch cleanup | D1; not self-authorizing |
| INT-213 | Reconcile continuation state | Exact HEAD CI, existing required review or scoped authorized exception; ancestry and deletion | Existing PR #213 |
| INT-211 | Reconcile BR-001 on current main | Review ADR-0013 and actual browser trust assumptions; new exact-head CI | Existing PR #211 D1 |
| DEV-C0-01 | Inspect crash lifecycle coverage; if missing add one disposable child-process interruption/restart/rollback oracle | RED/GREEN with isolated fixture, no live registry; verify crash boundary and persisted state | D0 if test-only and isolated; operational C0 still HOLD |
| DEV-UA002-01 | One trusted persisted grant lookup denial contract in owned fixture | Forged/stale/revoked/expired/cross-principal negative assertions; no live authority | D1 for actual authority changes; fixture-only slice may be D0 |
| DEV-UA002-02 | Registry-issued workspace identity and symlink/rebind denial | Reuse existing authority, focused tests and exact-head CI | D1 |
| DEV-UA003/004/005 | Request binding, unavailable-by-default capsule, two-principal negative matrix | Real verified identities and boundary tests; C1/C2 only when all required evidence exists | D1 |
| DEV-UA006–010 | First real authorized action; browser live demo and seeded repair | Trace, DOM, assertion, screenshots, negative target checks | Dependencies in original plan; disposable preview first |
| DEV-UA011–018 | Editable design, workbench, ten-agent scale, workflows, release | Existing AC and milestone evidence; no premature production claim | Original dependency gates |

Ordering is a priority queue, not a global mutex: park gated integration, choose a genuinely independent eligible slice. Keep the canonical implementation plan and task ledger; break each original task into measurable slices without renumbering acceptance criteria. Record actual evidence before changing task completion.

## End-of-session project audit (every session)

Audit full UA-001..018 ledger, AC01..18 matrix and M0..M5/C0..C8; count source-integrated tasks separately from source-tested, runtime-verified and production-certified. Unknown is not pass. Report delta from last canonical checkpoint and blockers by scope, not invented project percentages. Track open PRs, ahead/behind, current HEAD/CI/review, merged SHA and branch inventory; record changed files, commands/results, rollback path, security limits, next runnable goal and alternative. Evidence is anchored to exact SHA/URL. Snapshot may precede its own commit; final post-merge receipt belongs in PR and next session refresh, not an infinite commit loop.

Update the existing `docs/continuation/MASTER_PROMPT.md` (<=550 words) and `CURRENT_CONTEXT.md` (<=500 words), task ledger and existing `docs/handoffs/NEXT_SESSION.md` as relevant in the same scoped change. No new dated handoff chain. Increment master revision only in a real commit; main revision changes only after integration. Preserve PR #213 green HEAD; apply the following templates after reconciliation, not by overwriting an active PR silently.

## Master prompt template (FF-RECURSIVE-01)

You are FolderForge's autonomous development agent. Read AGENTS.md, both continuation files, canonical Goal Map, Roadmap, Universal Agent spec/plan, task ledger, NEXT_SESSION and adopted execution policy. Discover/invoke available Superpowers, DevExpert, agent-skills, Karpathy, GitHub and FolderForge. Re-fetch main, PRs, CI, policies, worktrees/capsules and recovery; mark unknowns. Distinguish source and live evidence.

Select one smallest eligible user-visible slice mapped to goal, UA task, milestone, AC, risk tier and executable oracle. Prefer ready PRs; if one is gated, park it and pick an independent eligible goal. No routine questions; use reasonable documented assumptions. Reproduce blockers, inspect evidence, switch authorized route or isolate a fixture. Do not circumvent policy or claim fabricated provider execution.

For behavior changes run RED, minimal GREEN, refactor, focused checks and applicable typecheck/lint/architecture/docs/CI. For docs verify links and consistency. Use owned isolated dev previews, synthetic data and unavailable-by-default sensitive features. Keep production, real host authority, data, recovery and security review gates distinct.

Prepare a bounded PR; merge to main only after applicable gates and exact-head CI; verify main integration and delete only its safe integrated branch, verify absence. Preserve unique work. If unable, retain branch and choose safe independent work where feasible; report actual partial/pending status.

Audit all UA tasks, ACs, milestones, CI, open PRs, blockers and branch inventory. Update stable master/context and relevant ledger/handoff. Report evidence, delta, rollback, next goal, fallback goal and complete next prompt. DONE = authorized merged increment + verified branch deletion. Never claim background execution.

## Rolling context template

- ID FF-RECURSIVE-01/STATE; checked date; canonical main SHA; master revision; session goal; status.
- Goal/task/milestone/AC/risk tier; observed behavior; files and RED/GREEN or docs oracle; exact CI URL and conclusion; review provenance.
- Merge SHA/ancestry or squash mapping; deleted branch verification; remaining branches/PRs with HEADs.
- Global audit: UA-001..018 status by tier, AC01..18 covered/unknown, M0..M5/C0..C8 status; delta and explicit nonclaims.
- Blockers: scope, changed evidence, repair routes, next dependency, safe independent fallback.
- Next session: one primary and one fallback eligible slice; inputs, acceptance oracle and rollback. No secrets or live host data.
- Precedence: approved AGENTS/policy, canonical spec and roadmap over snapshots.

## Verification and rollback

For this docs-only proposal: compare exact base/HEAD, inspect four paths, validate new relative links, run repository docs checks and applicable exact-head CI. RED/GREEN behavior N/A. No live system touched. Governance adoption requires existing eligible review/authorization. Rollback via normal reviewed revert; do not force refs. No claim of a completed UA task or C0 pass.
