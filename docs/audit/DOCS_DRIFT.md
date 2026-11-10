# Documentation drift findings and scope

As-of 2026-11-10 `main@8c00b15`. This is a **reviewed drift sample** across current entrypoint, README, status files, mission-control, R13/R14 and release notes. **[UNVERIFIED]** no other mismatch exists across the remaining 117+ docs; older historical files remain history and should not be silently rewritten.

| ID | Mismatch | Current code/ground truth | Docs action (this branch) |
|---|---|---|---|
| D-01 | Root README says Fleet starts via folder selection/Browse (`README.md:46-48,162-170`) | Already-approved folder is preselected, Browse optional (`packages/mission-control/src/screens/Fleet.tsx`; `src/dashboard/server.ts:1254-1299`) | Explicit current flow in `docs/OPERATIONS.md`; root patch deferred |
| D-02 | Root README does not foreground first-run Overview link (`README.md:119-185`) | `packages/mission-control/src/screens/Overview.tsx` shows first-run CTA | Current quickstart in `docs/OPERATIONS.md`; root patch deferred |
| D-03 | `docs/PROJECT_STATUS.md:3-23` claims Oct 9, v3.0.1 and 0 PR/issues | `package.json:2-3` says v3.2.4; source `main@8c00b15` and 5 issues open as of audit; npm registry current version **[UNVERIFIED by this repo-only audit]** | Mark historic snapshot and link current audit |
| D-04 | `docs/CURRENT_FRONTIER.md:3-13` says G59 PRs open and 1263 tests from Oct 9 | Current exact-baseline test 1580 pass; GitHub main all PRs merged at audit time | Mark historic and link current roadmap |
| D-05 | `docs/HANDOFF.md:1-22` cites earlier org name / release v3.0.1 | `package.json:8-14` canonical repo points at new org; v3.2.4 source | Keep historical evidence, add visible dated banner |
| D-06 | `docs/r13-mixed-version-registry-fencing.md:52-56` says PR117 still draft, source merge blocked | PR117 now in `main@cc42feb`; actual prod fence remains unimplemented (`src/isolation/worktree-manager.ts:1289-1294`) | Append source-merge vs production-blocked correction |
| D-07 | `docs/r14-kernel-registry-fence-migration.md:74-84` conflates merge status and activation status | PR117/#124 now source-merged, independent approval and prod cutover absent | Append dated correction; preserve prior fixture evidence |
| D-08 | `CHANGELOG.md:9-15` last release entry Oct 16 and lacks Nov source-only changes | Git commits between Nov 6-10 for Fleet UI, quota, registry safety | `docs/audit/UNRELEASED_CHANGELOG.md`; root change deferred |
| D-09 | `docs/roadmap.md:1-10` has old 2.x work in “Current stable track” | Package `3.2.4`; file itself labelled historical (`docs/roadmap.md:3`) | Keep historical, publish **separate** `docs/ROADMAP.md` |
| D-10 | `docs/mission-control.md:109-182` inventory and quota docs exist but not whole-settings editor | Read allowlist four descriptors (`src/operator/config-descriptors.ts:4-60`), write only shell quota (`src/operator/rate-limit-settings.ts:64-70`) | Truthful constraints in `docs/CONFIGURATION.md` |
| D-11 | Root CONTRIBUTING describes standard PR checks but not explicit R14 host security release gate (`CONTRIBUTING.md:20-65`) | `docs/r14-kernel-registry-fence-migration.md:40-72` requires independent review and prod isolation migration | Root patch deferred, security checklist in audit |
| D-12 | Agent runner text says “Independent ... review” after auto votes (`src/agent-loops/agent-loop-runner.ts:201-213`) | No separate reviewer or LLM model call in the fallback (`src/agent-loops/agent-loop-runner.ts:31-39,156-216`) | Documented as simulated/heuristic; source wording change requires Phase 5 approval |

## Files changed versus deferred
**Created under docs:** `docs/audit/AUDIT_REPORT.md`, `FEATURE_INVENTORY.md`, `TOOL_CATALOG.md`, `HTTP_ROUTE_CATALOG.md`, `ENV_REFERENCE.md`, `PROPOSALS.md`, `DOCS_DRIFT.md`, `ROOT_DOCS_PATCH_PLAN.md`, `UNRELEASED_CHANGELOG.md`, `docs/ARCHITECTURE.md`, `CONFIGURATION.md`, `TOOLS.md`, `OPERATIONS.md`, `ROADMAP.md`.
**Minimal existing-doc edits:** `docs/README.md` index and dated banners on historical status/registry docs.
**Explicitly NOT modified:** root `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md` because Phases 0–4 prohibit tracked edits outside `docs/`. See [root patch plan](ROOT_DOCS_PATCH_PLAN.md). No source/CI/workflow/secret changes.
