# FolderForge — Rolling Session Context

**CONTEXT_ID:** `FF-RECURSIVE-01/STATE`  
**CHECKED:** 2026-11-25 Asia/Ho_Chi_Minh  
**GOAL:** `PRODUCT-CLEANUP-001A`  
**STATUS:** `BLOCKED_VERIFY_REVIEW` — source change proposed; operational C0 HOLD  
**MASTER:** [MASTER_PROMPT.md](MASTER_PROMPT.md)

## Evidence checkpoint (before this context commit)
- Owner authorized PRODUCT-CLEANUP-001 in increments ≤5 files; retire proprietary orchestration, preserve canonical capabilities. Remote main `5ab250af5ac1cae09d101658aeaae89328430a55` is PR #213 merge. #212/#213 docs-only owner exceptions cannot be reused.
- [PR #220](https://github.com/roronoazoroshao/FolderForge/pull/220), branch `test/product-cleanup-001a-responses-retirement`. RED `24e38defcf5e6811195b9e01431f5143effbd31e`: [actual Ubuntu Node 24 smoke log](https://github.com/roronoazoroshao/FolderForge/actions/runs/45521315480/job/138893596869) reports models=200, responses=200 instead of required 404; exit 1. Test also checks no new Agent Loop run directory and preserves MCP smoke assertions.
- GREEN candidate `3b5df173ec3dd9e9f5705b194042a77ff0e585f3` removes 173 lines from `src/main.ts`: gateway executor, persisted config wiring and HTTP registration. Registry, MCP transports, trusted principal wiring and workflows untouched. No runtime GREEN result yet. This context commit changes HEAD; refetch final exact-head CI and genuine non-author review.
- Remaining Responses UI, dashboard API, protocol modules, docs and tests require bounded retirement; visual fixture and golden image need intentional verification. Agent Loop MCP tools, recovery wiring, dashboard, runner, manager and synthetic council remain. Preserve historical evidence and persisted user records; do not imply #202 resolved.
- [#118](https://github.com/roronoazoroshao/FolderForge/issues/118) OPEN: production writer fencing, independent review, cross-process restart and off-host restoration unproven. [#202](https://github.com/roronoazoroshao/FolderForge/issues/202) OPEN; preserve [#218](https://github.com/roronoazoroshao/FolderForge/pull/218) containment and review evidence. No ARB/EBRA expansion or live-host mutation.

## Next smallest unblocker
1. Finish #220 exact-head CI, technical review, genuine independent approval and authorized integration. Verify main ancestry before deleting only integrated branch. No previous CI or owner exception substitutes for review. Preserve branch when blocked.
2. Next bounded removal slice: retire Responses UI and related route/visual contract; then Agent Loop public API/recovery and internal closure. Reconcile active #218 without losing evidence. Preserve MCP, Eyes & Hands, workflows, proof packs and permissions.
3. SEC-VITE-001 preflight separately; reconcile #216 dependency/security blockers and eligible product PRs #211/#214/#215/#216/#219. Re-fetch all heads and review provenance. UA-002 remains conditional on C0; no UA/AC promotion.

**Precedence:** [AGENTS.md](../../AGENTS.md), [Goal Map](../strategy/UNIVERSAL_AGENT_GOALMAP_2026-11-15.md), [Roadmap](../strategy/UNIVERSAL_AGENT_ROADMAP_2026-11-15.md), [Task Ledger](../../tasks/universal-agent-todo.md), [UA-002 Handoff](../handoffs/NEXT_SESSION.md). Refetch, do not extrapolate.
