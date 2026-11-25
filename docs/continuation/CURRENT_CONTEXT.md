# FolderForge — Rolling Session Context

**CONTEXT_ID:** `FF-RECURSIVE-01/STATE`  
**CHECKED:** 2026-11-25 Asia/Ho_Chi_Minh  
**GOAL:** `PRODUCT-CLEANUP-001B`  
**STATUS:** `BLOCKED_VERIFY_REVIEW`; operational C0 HOLD  
**MASTER:** [MASTER_PROMPT.md](MASTER_PROMPT.md)

## Verified checkpoint (before context commit)
- Owner authorized PRODUCT-CLEANUP-001 in increments ≤5 files. [#220](https://github.com/roronoazoroshao/FolderForge/pull/220) merged into main `ef6bbe1eefb595f166029dbd9b56161fa0ece850`; ancestry and branch deletion verified. [Final head CI](https://github.com/roronoazoroshao/FolderForge/actions/runs/45522096953) and [main CI](https://github.com/roronoazoroshao/FolderForge/actions/runs/45523791352) both 7/7 SUCCESS. Author-side technical review and [one-time owner exception](https://github.com/roronoazoroshao/FolderForge/pull/220#issuecomment-7149283791), zero independent approval. No exception transfers.
- [#221](https://github.com/roronoazoroshao/FolderForge/pull/221), branch `test/product-cleanup-001b-http-hook`: RED `18a1155ee79d2c2094258a62d0ce2d5078022f83`, [actual macOS Node 24 log](https://github.com/roronoazoroshao/FolderForge/actions/runs/45524846922/job/138905517481): legacy handler dispatched twice, expected zero, one failed test; 1592 others passed, 50 skipped. GREEN candidate `c8e198be3d51ca6c50c26d2e469fdce02f6499da` removes 66 lines (optional hook and dispatch) from HTTP transport. New fixture also asserts authenticated MCP initialize/list. Refetch final HEAD CI; no GREEN result yet.
- Remaining: orphan Responses protocol/store/config, Dashboard API/UI and visual baseline; Agent Loop MCP tools, recovery, Dashboard, Manager/Runner/synthetic council. Preserve historical records; prioritize removal of active synthetic execution surfaces. Keep MCP, Eyes & Hands, workflows, proof packs, permissions.
- #118/#202 OPEN; production writer fence, qualified security review, restart and off-host restore unproven. Preserve #218 containment until equivalent retirement proof and historical evidence reconciliation. No ARB/EBRA expansion, C0 promotion, live host or registry mutation.

## Next unblockers
1. Finish #221 exact-head CI, review and eligible authorization, merge and verify branch deletion. Do not reuse #220 exception.
2. Trace Agent Loop registry/schema/presets/tests and dashboard/recovery closure; retire in bounded increments. Delete orphan Responses modules and obsolete UI with intentional visual verification.
3. Existing #211 browser proposal, #214 governance, #215 recovery fixture, #216 DX/setup/security, #218 containment, #219 Fleet fix remain open. #215/#218/#219 have merge conflicts after #220. Preserve relevant work; no blind merge or discard. Owner wants unnecessary features/branches retired without importing dead code; reconcile evidence and comply with canonical safe deletion rules.
4. SEC-VITE-001 preflight separately. UA-002 conditional on C0; no UA/AC promotion.

**Precedence:** [AGENTS.md](../../AGENTS.md), [Goal Map](../strategy/UNIVERSAL_AGENT_GOALMAP_2026-11-15.md), [Roadmap](../strategy/UNIVERSAL_AGENT_ROADMAP_2026-11-15.md), [Task Ledger](../../tasks/universal-agent-todo.md), [UA-002 Handoff](../handoffs/NEXT_SESSION.md). Refetch, do not extrapolate.
