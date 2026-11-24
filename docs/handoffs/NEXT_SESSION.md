# NEXT SESSION — FolderForge Universal Agent | UA-002 conditional launch

**Handoff recorded:** 2026-11-17 (Asia/Ho_Chi_Minh). **Evidence baseline:** GitHub `main@59b1c3d9475a082b7770d60767d7a9e88a32226c` after PR #205. GitHub main and local `origin/main` ancestry checked, `2c3a3f5` is a parent of the merge commit. A post-merge `main` CI run [#44043297477](https://github.com/roronoazoroshao/FolderForge/actions/runs/44043297477) was **in progress when the handoff was prepared**; check its *terminal* result independently before claiming success.

## Current governance prerequisite — 2026-11-24

**ARB-001 / #202 — BLOCKED_REVIEW:** [PR #218](https://github.com/roronoazoroshao/FolderForge/pull/218), branch `fix/202-disable-synthetic-approval`, base `5ab250af5ac1cae09d101658aeaae89328430a55`. [RED run](https://github.com/roronoazoroshao/FolderForge/actions/runs/45364528617) at `209085572e5fc65f03d6f54357332a08a53548d7`: five regression assertions failed as intended (Ubuntu Node 22, exit 1). Containment candidate disables synthetic voting, blocks caller votes and legacy transitions; final-head GREEN/CI and qualified independent review must be fetched before merge. No provider or independent approval, no live host/registry mutation. #202 and #118 stay OPEN; C0 HOLD. Next: verify exact PR HEAD and review before ARB-002; no self-approval or old exception.

## Historical canonical outcome (separate code integration from operational certification)

- [PR #205](https://github.com/roronoazoroshao/FolderForge/pull/205) **MERGED** on 2026-11-17 08:01:54 UTC (15:01:54 local). Merge SHA `59b1c3d9475a082b7770d60767d7a9e88a32226c`, head `2c3a3f5ec4c7b824fc8c95be59d149bd9fa42092`. Five files: source CLI contract, pinned v3.2.4 fixture, task ledger, status, handoff. **No production runtime code edits**.
- Exact PR-head GitHub Actions [#43735493128](https://github.com/roronoazoroshao/FolderForge/actions/runs/43735493128) completed **7/7 jobs SUCCESS** for `2c3a3f5`: Ubuntu/Windows/macOS Node 22/24 and Chromium visual baseline. Per-platform skipped steps do not equal all capabilities tested.
- Fresh focused local Vitest run on `2c3a3f5` at 2026-11-17 15:00 local: **7 suites, 54 tests PASS, exit 0** (22.31 s). CLI/MCP dual-era and negative host-bypass contract tested. `git diff --check origin/main...HEAD` exited 0.
- **Explicit owner-directed low-risk merge exception:** no qualified independent GitHub approval was present (one author `COMMENTED` review only). This exception is stated in the merge commit. **Do NOT change evidence into "independent APPROVED"**. Product C0 still **HOLD** for independent security review, recovery/off-host restore proof and operational capacity. Neither CI nor merge is production attestation.
- On 2026-11-17 host: `/dev/sda2` 457G total, 369G used, ~65G available, 86% used; swap 4.0G/4.0G used, RAM available ~6.8GiB. Managed isolation registry: **24 active records; 22 health-unverifiable, 2 missing-worktree**, not proof 24 live processes. [#118](https://github.com/roronoazoroshao/FolderForge/issues/118) OPEN. No registry recovery, worktree deletion, deployment, root grant or production restart was performed.
- [PR #200](https://github.com/roronoazoroshao/FolderForge/pull/200) workspace identity foundation was then OPEN/DRAFT at `1909dfd`; [PR #203](https://github.com/roronoazoroshao/FolderForge/pull/203) stacked AI reviewer prototype was then OPEN/DRAFT at `898fbab`. #203 has source-level reviewer tests but no genuine provider quorum; [#202](https://github.com/roronoazoroshao/FolderForge/issues/202) synthetic approvals on main remains an OPEN blocker.

## Next roadmap slice — UA-002 / M1 / C1 / AC02

**Target:** authoritative workspace identity and persisted owner-grant contract. **Entry requirement:** reconcile residual C0 operational/security evidence; do not mislabel C0 as passed. Safe source/fixture implementation and independent source review may be prepared in parallel, but don't graduate C1/ship live authority before gate evidence.

**Source/contract:** `AGENTS.md`; `docs/prompts/MASTER_IMPLEMENTATION_RECURSIVE_HANDOFF.md`; `docs/strategy/UNIVERSAL_AGENT_GOALMAP_2026-11-15.md`; `docs/strategy/UNIVERSAL_AGENT_ROADMAP_2026-11-15.md`; `docs/superpowers/specs/2026-11-15-universal-agent-work-environment-design.md`; `docs/superpowers/plans/2026-11-15-universal-agent-work-environment-implementation.md`; `tasks/universal-agent-todo.md` and this handoff.

**RED acceptance oracles before code:** client-supplied root/identity/grant cannot authorize access; expired/revoked/stale revision fails closed; symlink alias/rename/rebind cannot produce unauthorized fresh identity; per-call context never relies on global mutable `WorkspaceManager.current`; registry-issued stable workspace ID and trusted persisted grant ID/revision match the security spec. Prefer reusing existing owner grant store and policy ports; don't introduce a parallel authority.

**Implementation:** review #200 diff, extract only verified primitives after reconciling its spec/source mismatch around `grantId`, `canonicalRoot`, workspace rebind, mutable identity and permission store. Use TDD; bounded branch; focused tests + typecheck/lint/architecture/docs + exact-head GitHub CI and authentic security review. Output exact SHA and negative test evidence; real OS confinement is UA-004, not a UA-002 claim.

**Proceed after this session:** UA-003 MCP stdio/HTTP per-request binding (depends on UA-002), UA-004 OS capsule verification, UA-005 two-agent isolation/revoke, UA-006 first real client action. Ultimately live browser Observe→Act→Verify→Repair, native editable creative adapter, 10 truly distinct principals, and owner-authorized production release; don't skip gates.

## Mandatory recursive continuation

Use the new self-contained [Autonomous Platform MASTER PROMPT](../prompts/MASTER_AUTONOMOUS_PLATFORM_NEXT_UA002.md). Every run must refresh GitHub/host state, define one bounded implementation contract, run evidence-backed RED→GREEN→VERIFY, produce a PR/merge only with validated applicable gates, update tasks/status/handoff, and output the NEXT copy-ready master prompt. Never state that work will continue asynchronously.
