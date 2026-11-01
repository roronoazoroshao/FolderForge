# FolderForge repository status and goal review — 2026-11-01

> **Status: REVIEW SNAPSHOT, not release approval or an implementation completion claim.**
> Reviewed against GitHub `main@b97ea018bb541c80e197a5148550451d46de47ce` (2026-10-30), the run `41057339528`, current documentation, open issues and open PRs. Recheck all live heads and jobs before taking an action.

## North star and currently active work

FolderForge is a **local-first, governed MCP development control plane** for coding agents: a single auditable workspace with bounded terminal, file, Git, policy/approval, child MCP, Fleet, and recovery capabilities. `docs/production-readiness-action-plan.md` prioritizes safety, trustworthy releases, first-run UX and external proofs over tool-surface expansion; `docs/stability-policy.md` freezes unrelated net-new features. Dashboard configuration UX can qualify as a targeted operator-friction correction only if it preserves all host-operator and security gates.

Current engineering frontier is **safe isolation recovery and release hardening**, not a generic administrative UI:
- [#126](https://github.com/roronoazoroshao/FolderForge/issues/126): in-progress completion ledger; no automatic merge, cleanup, deployment, or release authorization.
- [#118](https://github.com/roronoazoroshao/FolderForge/issues/118): R14 old-writer/epoch-fencing proof and independent security APPROVED review required before [#117](https://github.com/roronoazoroshao/FolderForge/pull/117) or stacked [#124](https://github.com/roronoazoroshao/FolderForge/pull/124) can merge. Do not mutate legacy recovery metadata.
- [#105](https://github.com/roronoazoroshao/FolderForge/issues/105): open npm Trusted Publisher/OIDC ENEEDAUTH investigation for v3.2.3; subsequent GitHub v3.2.4 Release is *not proof* that the npm registry matches it.
- [#70](https://github.com/roronoazoroshao/FolderForge/issues/70): trusted self-hosted CI runner access remains open.
- Current open PRs at review: #117, #124, #138, #140, #141, #142, #143. The isolation series is not evidence of an accepted production fence.

## Observed proof (do not overclaim)

- `main@b97ea018...` passed GitHub Actions CI [run 41057339528](https://github.com/roronoazoroshao/FolderForge/actions/runs/41057339528): seven jobs concluded SUCCESS (including pinned Chromium visual). Platform-specific steps are intentionally SKIPPED, not proven on that platform.
- Most recent GitHub Release in the inspected collection: [v3.2.4](https://github.com/roronoazoroshao/FolderForge/releases/tag/v3.2.4) (2026-10-16). npm publication for v3.2.4 and release provenance were **not independently verified** for this review.
- VPS checkout inspected through FolderForge was `main@d5a4d2c`, reported **15 commits behind** its `origin/main`. Do not modify that checkout or its historical worktrees as a side effect of this plan.
- `docs/PROJECT_STATUS.md`, `docs/CURRENT_FRONTIER.md`, `docs/HANDOFF.md` and `docs/project/PROJECT_STATE.md` still include October 9 release statements and/or superseded repository references. `docs/roadmap.md` explicitly identifies itself as historical. Use GitHub live facts above when they disagree with old snapshots.
- Source-based capability maturity: local governance and MCP are beta/hardened; Mission Control and workflow/isolation paths are beta/local; distributed and marketplace are Labs; external proof, 24-hour exact-commit soak and independent user acceptance remain open. See `docs/maturity-and-proof.md`.

## Dashboard configuration inventory

| Area | Existing interface / evidence | Desired safe management | Gate |
| --- | --- | --- | --- |
| Policy mode | Settings + `/policy/mode` | Effective mode, provenance, guarded edits | owner/admin and audit |
| Terminal timeout, output | Settings + `/runtime/settings` | Preserve bounded live edits | owner/admin and audit |
| Rate limits | `policy_ratelimits` read-only tool; `rateLimit` YAML | Usage + per-tool validated edits | bounded admin; preserve counters |
| Tools and presets | Fleet UI; root YAML `tools` | Config source/effective value, per-scope staged edits | restart / instance scope |
| Adapters, LSP | Startup YAML, plugin UI partially | Health and redacted status, staged enable/disable | restart + sandbox validation |
| Git, workspace roots | CLI/config and Fleet controls | Show effective origin; only explicitly approved mutations | host authority/path enforcement |
| Audit, secret scan, capsule | YAML and runtime security | First expose read-only posture | external security review to weaken |
| Server bind, auth, OAuth | Auth/tunnel-specific flows | Reuse dedicated credential/connection flows, no generic YAML editor | owner-only, no token disclosure |
| Sandbox, trusted host | Fleet host-consent flow | Explain configured vs effective, never silent elevated apply | real OS-owner consent |
| Isolation / recovery | Mission Control actions | **No broad edit path** while R14 gates open | exact-head proof + independent reviewer |

Critical implementation facts:
1. `src/policy/rate-limiter.ts` states its buckets are **in-memory per process**, not durable multi-process quotas. A restart can reset its usage; a Dashboard must not claim cluster-wide strict 24h enforcement.
2. `src/operator/runtime-settings.ts` currently persists terminal limits and mutates in-memory config, but is not a general secure configuration transaction manager.
3. Existing `rateLimit` values default to `shell_exec: 20 per 10s, 1000 per rolling 24h` (source defaults and example YAML). The UI has no edit path as inspected.
4. A web-editable raw YAML/JSON file, arbitrary filesystem roots, sandbox disabling, and credentials reveal are **explicit non-goals**.

## Progress estimation — *not an upstream project percentage*

A single percentage is not an objective fact unless the goal definition and acceptance gates are fixed. For management discussions only, the following **editorial readiness rubric** reports how much of a *production-ready, safe local control plane* is evidenced today, not the fraction of lines of code written.

| Dimension | Weight | Estimated readiness | Why it is not 100% |
| --- | ---: | ---: | --- |
| Core MCP, file/Git/process tool path | 20% | 85% | Beta/local, independent clients/OS proof pending |
| Governance, policy and evidence | 20% | 70% | Human security and real-host fencing evidence missing |
| Dashboard configuration coverage | 15% | 30% | Terminal/policy work; rateLimit, source/provenance and controlled edits absent |
| Isolation and crash-safe recovery | 15% | 45% | R14 blocked, no privileged old-writer fence, external review required |
| CI, provenance, release repeatability | 15% | 60% | CI passes but skips, npm OIDC issue open, soak/evidence gaps |
| Onboarding and adoption evidence | 10% | 30% | Clean-host and independent beta acceptance incomplete |
| Distributed and marketplace (Labs) | 5% | 25% | No accepted multi-host/hosted service qualification |

**Weighted estimate: 55.5%, rounded to approximately 56% production-readiness against this proposed rubric.** This is **not** an official project completion percentage, does not mean 44% of source code remains, and must not be used for release approval. Different goals/weights will give different numbers. The core feature surface is considerably further along than production graduation.

## Goal / near-term sequence

- **G0 Security and truthful status:** Keep #118/#117/#124 blocked; reproduce and qualify live writer fencing; reconcile current status documents with current hashes and release evidence. Preserve worktrees and production records.
- **G1 Config Hub — visibility:** Build a read-only provenance/redaction inventory, per-tool quota usage and scoped safe edit metadata.
- **G2 Config Hub — bounded changes:** Rate-limit `shell_exec` / validated per-tool edits, authorizations, audit, version conflicts, persistence, immediate effective state, and regression proof.
- **G3 Config Hub — planned restart changes:** Tool/adapter/LSP/project-safe fields with dry-run, diff, staged apply and honest pending restart; no arbitrary YAML/privilege edits.
- **G4 Operations and UX:** Health, rollback, active-vs-desired, isolation of parent/Fleet scopes, end-to-end browser tests, accessibility, migration and operator documentation.
- **G5 External release gates:** exact-head PR and post-merge CI, real host regression, independent review, npm OIDC/attestation, exact-commit 24h soak, multi-OS beta acceptance.

## Acceptance bar for a percentage increase

Do not advance a category based on documentation alone. Require (a) merged exact commit, (b) passing relevant CI with explicit skips, (c) reproduced regression / external evidence for the risk class, (d) secure operator UX proof, (e) independently reviewable provenance. This review branch contains no runtime modifications, publication, production deployment, or approval to weaken policy.
