# FolderForge — Rolling Session Context

**CONTEXT_ID:** `FF-RECURSIVE-01/STATE`  
**CHECKED:** 2026-11-25 Asia/Ho_Chi_Minh  
**GOAL:** `CLEAN-001 / PRODUCT-CLEANUP-001F`  
**STATUS:** `SOURCE_DELETION_CI_PENDING`; operational C0 HOLD  
**MASTER:** [MASTER_PROMPT.md](MASTER_PROMPT.md)

## Verified checkpoint
- Owner manually removed all remote branches except main and closed seven unmerged PRs (#211/#214/#215/#216/#218/#219/#225). Main `7a2de8aca1ec45d03bde4dc09090e13aeee3474b`, [post-merge CI](https://github.com/roronoazoroshao/FolderForge/actions/runs/45627792005) terminal 7/7 SUCCESS. #220–224 merged; integrated refs absent. Owner exceptions apply only to their specified HEADs.
- Owner explicitly authorized CLEAN-001 from this main, without restoring old branches. Reapply #225 deletion of orphan Runner (585 lines) and eight obsolete runner tests (286 lines); [historical #225 exact-head CI](https://github.com/roronoazoroshao/FolderForge/actions/runs/45628014599) 7/7 at `245736125036bf282f9b29ec2430534150e06641` is NOT current-head proof. Four paths including continuation; no new runtime behavior, prior RED/GREEN established detachment. Preserve MCP/Dashboard retirement regressions, workflow/proof tests and persisted historical bytes. Require fresh exact-head CI and applicable review.
- [Roadmap audit](https://github.com/roronoazoroshao/FolderForge/pull/222#issuecomment-7156155214): retain MCP, Eyes & Hands, workflows, proof packs, grants. #118/#202 OPEN; #218 closed unmerged, retain its PR/commit/CI evidence. No live host mutation or ARB/EBRA expansion. No C0 or UA promotion.

## Next actions
1. Finish CLEAN-001 exact-head CI/review/merge/ancestry/branch absence. One implementation branch at a time.
2. CLEAN-002: detach Manager and seed historical fixtures independently, then delete orphan Manager/tests. CLEAN-003: retire Responses backend/config/modules. CLEAN-004: remove legacy UI and verify actual Chromium baselines. CLEAN-005: reconcile current README/architecture/ledger/handoff; preserve historical audits and security evidence. Each bounded increment ≤5 files unless explicitly extended.
3. SEC-VITE-001 read-only preflight, then authorized remediation; DX-001 recovery of needed source setup; #118 C0 recovery/security evidence. Reuse only verified relevant portions of closed PR history, not old branches. UA-002 conditional on C0; no implicit approval.

**Precedence:** [AGENTS.md](../../AGENTS.md), [Goal Map](../strategy/UNIVERSAL_AGENT_GOALMAP_2026-11-15.md), [Roadmap](../strategy/UNIVERSAL_AGENT_ROADMAP_2026-11-15.md), [Task Ledger](../../tasks/universal-agent-todo.md), [UA-002 Handoff](../handoffs/NEXT_SESSION.md).
