# FolderForge — Rolling Session Context

**CONTEXT_ID:** `FF-RECURSIVE-01/STATE`  
**CHECKED:** 2026-11-25 Asia/Ho_Chi_Minh  
**GOAL:** `CLEAN-002A / detach retired Manager`  
**STATUS:** `GREEN_CI_PENDING`; operational C0 HOLD  
**MASTER:** [MASTER_PROMPT.md](MASTER_PROMPT.md)

## Verified checkpoint
- CLEAN-001 #226 merged at main `79a37a9af6f92caea991ae4955ba7e8a6f8437da`, exact-head CI 45630684236 7/7, owner exception [receipt](https://github.com/roronoazoroshao/FolderForge/pull/226#issuecomment-7166322581); ancestry verified and branch ref 404. Runner source and eight obsolete tests removed. [Post-merge main CI](https://github.com/roronoazoroshao/FolderForge/actions/runs/45641492648) 6/7 success, macOS Node24 cancelled; do not claim all green.
- CLEAN-002A [#227](https://github.com/roronoazoroshao/FolderForge/pull/227) RED `6c2819fbecf8744d8e839c41e9f4940dbc4c2112`, [actual Ubuntu Node24 log](https://github.com/roronoazoroshao/FolderForge/actions/runs/45641708650/job/139301815487): exactly two intended failures (Manager property true instead of false), 1585 passed/47 skipped. All four Unix test jobs failed as intended. Two retirement tests seed independent hashed schema-v1 historical running records before startup, retain authenticated MCP/HTTP denial, ordinary file_read/Mission Control, and byte/name equality.
- GREEN candidate removes exactly three Manager import/property/construction lines from Container; five total paths including continuation. Manager source/tests remain orphan until CLEAN-002B. No production data deletion. Fresh final HEAD CI required.
- Owner authorized sequential CLEAN-002–005; no transfer of previous exact-head exceptions. Preserve MCP, Eyes & Hands, Workflows, Proof Packs, grants, historical records and runtime config exclusions. #118/#202 OPEN; closed unmerged #218 evidence retained. No live host mutation, ARB/EBRA expansion, C0/UA promotion.

## Next actions
1. Finish #227 fresh exact-head CI, technical review and applicable authorization; merge, verify ancestry, delete integrated ref. Resolve cancelled main job evidence without concealing cancellation.
2. CLEAN-002B remove orphan Manager and nine subsystem-only tests; CLEAN-003 retire Responses dashboard endpoints/config/modules, retain OpenAI MCP tunnel; CLEAN-004 remove legacy UI and verify pinned Chromium baselines; CLEAN-005 reconcile README/architecture/ledger/handoff. One branch at a time; ≤5 files per increment unless explicitly extended.
3. SEC-VITE-001 read-only preflight then authorized remediation; DX-001 and #118 C0 evidence. UA-002 conditional on C0. Reuse closed PR history selectively, never restore old branches.

**Precedence:** [AGENTS.md](../../AGENTS.md), [Goal Map](../strategy/UNIVERSAL_AGENT_GOALMAP_2026-11-15.md), [Roadmap](../strategy/UNIVERSAL_AGENT_ROADMAP_2026-11-15.md), [Task Ledger](../../tasks/universal-agent-todo.md), [UA-002 Handoff](../handoffs/NEXT_SESSION.md).
