# FolderForge — Rolling Session Context

**CONTEXT_ID:** `FF-RECURSIVE-01/STATE`  
**CHECKED:** 2026-11-28 Asia/Ho_Chi_Minh  
**GOAL:** `CLEAN-003A/UI-first / retire misleading Responses screen`  
**STATUS:** `RED_CI_PENDING`; operational C0 HOLD  
**MASTER:** [MASTER_PROMPT.md](MASTER_PROMPT.md)

## Verified checkpoint
- Main `1045c88564ce2c4ccd70a0e46a4355731320b100` after #228; [post-merge CI](https://github.com/roronoazoroshao/FolderForge/actions/runs/45909284606) SUCCESS 7/7; ancestry/ref absence verified. Only main and active #229 branch. Exceptions for #226–228 never transfer.
- [#229](https://github.com/roronoazoroshao/FolderForge/pull/229) historical API RED `d6773759ffeb11008b311bbdffd8029c7e34ceb3` and functional GREEN `e1f3f44ceb6aa0dae9c3a17c05d32c222af791b0` (1579 tests pass/47 skipped). [Diagnostic CI](https://github.com/roronoazoroshao/FolderForge/actions/runs/45921080321) 6/7; actual pinned screenshot 1280x1003 exposed stale Codex/Agent Loop instructions and not_found. Rejected broken UX baseline. Checkpoint `2a7d16aae73bd2861b07645b62d2e1c521c1593f` restored diagnostic test byte-for-byte; exact-head CI 46130956959 visual fails.
- Re-slice same PR/branch UI-first to stay within five final paths. Restore Dashboard server to exact main blob and remove candidate-only API test from working tree, preserving both commits as ancestors for subsequent API retirement. No API restoration on main or new gateway behavior. New real browser RED asserts zero legacy gateway requests, truthful retirement heading, absent old controls, functional Fleet link. Expected RED legacy GET /responses/status. No production UI change until RED evidence. Planned GREEN static retirement notice using existing UI and link to Fleet, then inspect actual pinned screenshot, replace only Responses baseline, preserve comparator/threshold and all other baselines. Final paths: screen, browser test, Responses baseline, two continuation files.
- #118/#202 OPEN; #218 closed unmerged evidence retained; live host/capsule/recovery UNKNOWN; no host mutation or C0/UA promotion.

## Next actions
1. Verify exact-head RED; minimal UI GREEN, capture actual pinned PNG, inspect notice and Fleet link; final CI and applicable review/exception, merge/ancestry/ref absence.
2. CLEAN-003A/API retire two Dashboard handlers using preserved RED/GREEN commits, retain auth/MCP tunnel/history. CLEAN-003B orphan modules, CLEAN-004 remove retired routes/navigation and visual baselines, CLEAN-005 docs/ledger. One branch at a time, ≤5 final paths unless explicitly extended.
3. SEC-VITE-001 preflight, DX-001, #118 C0 evidence; UA-002 conditional on C0.

**Precedence:** [AGENTS.md](../../AGENTS.md), [Goal Map](../strategy/UNIVERSAL_AGENT_GOALMAP_2026-11-15.md), [Roadmap](../strategy/UNIVERSAL_AGENT_ROADMAP_2026-11-15.md), [Task Ledger](../../tasks/universal-agent-todo.md), [UA-002 Handoff](../handoffs/NEXT_SESSION.md).
