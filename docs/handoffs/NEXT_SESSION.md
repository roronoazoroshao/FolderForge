# NEXT SESSION — Universal Agent UA-001 C0 completion

**Generated:** 2026-11-15, Asia/Ho_Chi_Minh. **State:** `SOURCE_TESTED`; **not DONE / not MERGED_MAIN**. **Authoritative instructions:** [AGENTS.md](../../AGENTS.md), [recursive master](../prompts/MASTER_IMPLEMENTATION_RECURSIVE_HANDOFF.md), [template](../prompts/RECURSIVE_HANDOFF_TEMPLATE.md).

## Verified source and operations baseline

- **North Star:** any authorized AI agent has independently governed eyes, hands, workspace, and verification/repair tools for real coding, live Web UI and native-editable creative artifacts.
- **Roadmap/gate:** M0 / C0. **Active task:** UA-001. **Conditional successor:** UA-002 (M1 / C1) **only after UA-001 has C0 proof and a legitimate main merge**.
- **Pre-change GitHub and local main:** `2d3e83f789884094d2805a7f2df061711e151203`, clean, `origin/main` identical. Initial source package `@musashishao/folderforge@3.2.4`, Node `22.23.0`, npm `10.9.8`.
- **Working branch / PR:** `chore/ua-001-compat-baseline-20261115`, [PR #205](https://github.com/roronoazoroshao/FolderForge/pull/205) (open, non-draft, base `main@2d3e83f789884094d2805a7f2df061711e151203`); first source-tested commit `da483dd47b7b8091d891cb591d4a212891f012dd`. At inspection, [seven exact-initial-head checks](https://github.com/roronoazoroshao/FolderForge/actions/runs/43722561742) were **in_progress**, reviews `[]`, and main unmerged. **Re-read final PR head and fresh checks after this handoff-only commit**; this document cannot self-contain its own future commit SHA. No source runtime behavior changed.
- **Initial mainline CI:** [7 of 7 successful checks at baseline SHA](https://github.com/roronoazoroshao/FolderForge/actions/runs/43719795651); these are not evidence for the new branch's PR.
- **Existing drafts:** [PR #200](https://github.com/roronoazoroshao/FolderForge/pull/200), base `main`, head `1909dfdac647acd1cffeb309ce8fb9731174c75e`, Draft; [PR #203](https://github.com/roronoazoroshao/FolderForge/pull/203), stacked on #200, head `898fbabd1e23885f28291545495a8f978a7b2dd5`, Draft. Neither merged into main.
- **Host boundary:** filesystem `/dev/sda2` reports 100% utilized with ~3.2G available; swap ~4,086/4,095MiB used. FolderForge principal policy reports `danger` for this connected session, **not** a grant to modify production, root or recovery. 24 active managed isolations, many `ISOLATION_HEALTH_UNVERIFIABLE`; issue [#118](https://github.com/roronoazoroshao/FolderForge/issues/118) recovery fencing outstanding. No files or processes in those records were cleaned/restarted.

## Actual UA-001 test receipt

Changed paths (bounded, five only): `tests/contracts/legacy-commands.test.ts`, `tests/fixtures/ua-001-cli-baseline.json`, `tasks/universal-agent-todo.md`, `docs/status/UNIVERSAL_AGENT_STATUS_2026-11-15.md`, this file.

1. **RED:** `./node_modules/.bin/vitest run tests/contracts/legacy-commands.test.ts --maxWorkers=1` → 3 FAILED because baseline JSON fixture was deliberately absent (`ENOENT`). Not a production bug.
2. **GREEN:** same focused test after adding fixture → 3 PASS, 16.05s. Exercises source CLI via `node --import tsx src/main.ts`; version/help, malformed/unknown flags and invalid policy fail closed. No source code modification.
3. **Compatibility:** `./node_modules/.bin/vitest run tests/integration/mcp-modern-stdio.test.ts tests/integration/mcp-dual-era-client.test.ts tests/integration/mcp-modern-core.test.ts tests/integration/fleet-host-bypass.test.ts --maxWorkers=1` → 18 PASS in 4 files (9.24s). Exercises legacy+modern MCP stdio clients in temporary readonly fixture, deny tests, OAuth scope and host-bypass prevention.
4. **Platform/control:** `./node_modules/.bin/vitest run tests/integration/mcp-platform.test.ts tests/unit/control-cli.test.ts --maxWorkers=1` → 33 PASS in 2 files (4.69s).
5. **Required static checks:** `npm run typecheck` PASS, `npm run lint` PASS, `npm run architecture:check` PASS (165 files, 0 cycles/violations), `npm run docs:check` PASS (141 Markdown). Rerun after docs update and before PR.
6. **Unperformed:** full local test suite/build, real OS confinement test, host/root privilege and recovery writer test, backup restore, deployed runtime, independent model/provider reviewer, editable native design, Playwright browser E2E. No blanket product certification.

**Total focused tests:** 54 PASS (3+18+33) from this session. This proves only the exercised source fixture contracts, not a live production boundary.

## Pending C0 / next exact actions

1. Inspect existing [PR #205](https://github.com/roronoazoroshao/FolderForge/pull/205) against `main`. Recheck current `main`, PR-head diff, exact commit SHA, five changed files and secret scan. Review for accidentally version-pinning future releases; rebaseline intentionally on releases.
2. Confirm new PR's full required GitHub Actions checks **on its exact current head SHA**; do not reuse the seven earlier main check results. Check review threads and qualified independent review. Branch protection GET returned 403 and rulesets returned empty: **review requirements are unverified, not waived**.
3. If C0 fixture, baseline and host risk record are sufficient and all CI/security/review requirements truly pass, merge via non-force GitHub PR action, then fetch `refs/heads/main` to verify the merged SHA and mark UA-001 `MERGED_MAIN`. Otherwise preserve branch/PR, status `SOURCE_TESTED` or `BLOCKED`, keep UA-001 as next target. Do not advance UA-002 until C0 passes.
4. Independently of the merge outcome, update this handoff, task ledger, status/receipt and output a **new full recursive NEXT MASTER PROMPT** at session exit.

**Do not:** overwrite another task's status, clean worktrees, mutate isolation registry, enable host/root grants, auto-restart/deploy, force push/merge, waive tests, use synthetic multi-agent approval, or claim connected browser/design tools were exercised.

## Copy-ready NEXT MASTER PROMPT

```text
FOLDERFORGE — RECURSIVE IMPLEMENTATION SESSION (next turn)

Act as the implementer and adversarial reviewer for roronoazoroshao/FolderForge. Read AGENTS.md and the ENTIRE docs/prompts/MASTER_IMPLEMENTATION_RECURSIVE_HANDOFF.md first; follow all relevant instructions. Read current GOAL MAP, ROADMAP, SPEC, PLAN, tasks/universal-agent-todo.md, docs/status/UNIVERSAL_AGENT_STATUS_2026-11-15.md and docs/handoffs/NEXT_SESSION.md from current main AND the active UA-001 PR branch. Do not trust historical status without GitHub/source confirmation.

NORTH STAR: any authenticated AI agent gets separately authorized and verifiable eyes, hands, workspace, observe-act-verify-repair execution, live Web UI test tools and native editable creative artifacts.
ROADMAP: M0/C0 (UA-001), then M1/C1 (UA-002 only if C0 genuinely passes).
BASELINE MAIN HINT (REVALIDATE): 2d3e83f789884094d2805a7f2df061711e151203.
ACTIVE UA-001 BRANCH / PR: chore/ua-001-compat-baseline-20261115 / https://github.com/roronoazoroshao/FolderForge/pull/205. First source-tested SHA da483dd47b7b8091d891cb591d4a212891f012dd; later docs-only handoff commit may have advanced the PR HEAD. Fetch exact current SHA, PR diff, approvals, checks and base main SHA.
CURRENT STATE: SOURCE_TESTED, not yet MERGED_MAIN at handoff authoring. 54 focused tests pass on local changed source: 3 CLI fixture, 18 MCP/host denials, 33 MCP/control. npm run typecheck, lint, architecture:check and docs:check passed locally. Main baseline checks were 7/7 green on 2d3e83f, NOT evidence for the PR's head. PR #205 initial-head CI run 43722561742 had 7 in_progress checks, with zero submitted reviews at snapshot; re-fetch on CURRENT PR head SHA after docs update.
CHANGED FILES: tests/contracts/legacy-commands.test.ts; tests/fixtures/ua-001-cli-baseline.json; tasks/universal-agent-todo.md; docs/status/UNIVERSAL_AGENT_STATUS_2026-11-15.md; docs/handoffs/NEXT_SESSION.md.
C0 ORACLE: no silent CLI contract skip without dist, version/help/auth/transport/invalid command denial; modern+legacy stdio initialize/list/call and negative scope/host bypass fixtures; source SHA inventory, safe host-risk receipt and exact-head CI.
RUN: ./node_modules/.bin/vitest run tests/contracts/legacy-commands.test.ts tests/integration/mcp-modern-stdio.test.ts tests/integration/mcp-dual-era-client.test.ts tests/integration/mcp-modern-core.test.ts tests/integration/fleet-host-bypass.test.ts tests/integration/mcp-platform.test.ts tests/unit/control-cli.test.ts --maxWorkers=1; npm run typecheck; npm run lint; npm run architecture:check; npm run docs:check. Full GitHub CI on exact PR HEAD before merging; if host unsuitable use CI, never fake local tests.
BLOCKERS: exact PR-head CI and independently qualified PR review/merge not yet proven, GET branch-protection 403, host filesystem 100% (3.2G available), swap near full; issue #118 writer fencing unresolved, 24 managed isolations with multiple unverifiable records. PR #200/#203 are drafts and not merged; #203 does not supply real review quorum.
SESSION TARGET: finish UA-001/C0, NOT prematurely UA-002. Before code changes, state target, exact files, failure oracle, commands, done gate. Minimal changes only, RED→GREEN→VERIFY, source/CI/adversarial review. Protect all recovery worktree/registry and host operations. No forced merge, fake reviewer, bypassed security, hidden production restart or cleanup.
DONE WHEN: exact PR HEAD passes required CI, diff/security and qualified review, legitimate merge into main, verified new main SHA, ledger and handoff updated. If blocked: retain SOURCE_TESTED/BLOCKED and the UA-001 branch, report missing gate and next safe action; UA-002 stays dependent.
AFTER UA-001: UA-002 — Authoritative Workspace Identity & Grant Contract, M1/C1/AC02, only if C0 passed. Inspect unmerged PR #200, per-request grants/session/capsules, forged root/stale/revoked grant and symlink/rebind invariants. Do not conflate cwd/worktree with OS isolation.
SKILLS & TOOLS: discover actually available Superpowers, agent-skills, Karpathy, FolderForge and GitHub; other providers only when task-related. Never invent model/API review receipts or production runtime evidence.
RECURSION: Before finishing the NEXT session, update tasks/universal-agent-todo.md, dated STATUS and docs/handoffs/NEXT_SESSION.md with exact source SHA, PR/CI/reviews, files, tests and blockers. Output another complete standalone NEXT MASTER PROMPT that references docs/prompts/MASTER_IMPLEMENTATION_RECURSIVE_HANDOFF.md and itself requires yet another prompt/handoff at its own end. Never promise background work.
```
