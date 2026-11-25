# FolderForge — Rolling Session Context

**CONTEXT_ID:** `FF-RECURSIVE-01/STATE`  
**CHECKED:** 2026-11-25 Asia/Ho_Chi_Minh  
**GOAL:** `PRODUCT-CLEANUP-001C`  
**STATUS:** `GREEN_CI_PENDING`; operational C0 HOLD  
**MASTER:** [MASTER_PROMPT.md](MASTER_PROMPT.md)

## Verified checkpoint (before context commit)
- Owner authorized PRODUCT-CLEANUP-001 in increments ≤5 files and autonomous routine execution. [#220](https://github.com/roronoazoroshao/FolderForge/pull/220) and [#221](https://github.com/roronoazoroshao/FolderForge/pull/221) merged; both branches deleted, ancestry verified. Main `1f323c2df6a2247687e0fe0708a010e1d97a4d32`; [main CI](https://github.com/roronoazoroshao/FolderForge/actions/runs/45537548386) 7/7 SUCCESS. 239 runtime lines removed. One-time owner exceptions were exact-head, non-transferable; no independent approval fabricated.
- [#222](https://github.com/roronoazoroshao/FolderForge/pull/222), branch `test/product-cleanup-001c-mcp-recovery`: RED `f8c89fce06603687bc79456fcef124a68eb0a43e`, [Ubuntu Node 24 actual log](https://github.com/roronoazoroshao/FolderForge/actions/runs/45540221716/job/138956653887) reports 15 obsolete MCP tools instead of zero, 1 failed test, 1595 passed, 47 skipped. All four Unix test jobs failed. Fixture seeds a disposable historical run, spies on runner start to avoid executing retired logic, checks no exposure/recovery, old call denial, preserved record bytes and file_read.
- GREEN candidates `0dbc327ab4896ac9d16afce8ed8c791e75cb4dbb` and `4c16515ff782d8a5c70150e8c14db37d369f2d40`: unregister all 15 Agent Loop tools, remove startup recover call and corresponding frozen schema entries. Intentional API retirement; retain schema checks and MCP platform resources/prompts/tasks test. Five changed files with continuation. Refetch exact final head CI; no GREEN result yet.
- Remaining: Dashboard Agent Loop API still can start Runner; agent-loop module, runner, manager, synthetic council, orphan Responses modules/config and UI/visual contract. Preserve history and user records. Keep MCP, Eyes & Hands, workflows, proof packs and permissions.
- #118/#202 OPEN; production writer fencing, qualified review, restart and off-host restore unproven. Preserve #218 until equivalent retirement and evidence reconciliation. No ARB/EBRA expansion, C0 promotion, live host or registry mutation.

## Next unblockers
1. Finish #222 exact-head CI and technical review, integrate only under applicable review/authorization gate; verify ancestry and branch deletion. Do not reuse previous exceptions or treat broad delegation as a scoped waiver.
2. Remove Dashboard Agent Loop execution paths and verify denial; then delete orphan modules and UI in bounded slices. Reconcile #218 without importing unnecessary code or losing security evidence.
3. Reconcile #211 browser, #214 governance, #215 recovery fixture, #216 DX/security, #219 Fleet. Preserve unique needed work; discard obsolete branches only under canonical safe deletion policy. SEC-VITE-001 separately; UA-002 conditional on C0, no AC promotion.

**Precedence:** [AGENTS.md](../../AGENTS.md), [Goal Map](../strategy/UNIVERSAL_AGENT_GOALMAP_2026-11-15.md), [Roadmap](../strategy/UNIVERSAL_AGENT_ROADMAP_2026-11-15.md), [Task Ledger](../../tasks/universal-agent-todo.md), [UA-002 Handoff](../handoffs/NEXT_SESSION.md).
