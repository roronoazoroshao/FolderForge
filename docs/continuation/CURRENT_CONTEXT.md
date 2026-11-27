# FolderForge — Rolling Session Context

**CONTEXT_ID:** `FF-RECURSIVE-01/STATE`  
**CHECKED:** 2026-11-27 Asia/Ho_Chi_Minh  
**GOAL:** `CLEAN-003A / retire Responses Dashboard API`  
**STATUS:** `GREEN_CI_PENDING`; operational C0 HOLD  
**MASTER:** [MASTER_PROMPT.md](MASTER_PROMPT.md)

## Verified checkpoint
- CLEAN-001 #226 and CLEAN-002A #227 merged; branches absent; post-merge CI 7/7. CLEAN-002B #228 merged at main `1045c88564ce2c4ccd70a0e46a4355731320b100`, [exact-head CI](https://github.com/roronoazoroshao/FolderForge/actions/runs/45829563797) SUCCESS 7/7, Ubuntu 1578 passed/47 skipped, Chromium 25/25, authenticated MCP smoke and retirement tests pass. [Owner exception](https://github.com/roronoazoroshao/FolderForge/pull/228#issuecomment-7205309841), ancestry and ref 404 verified. [Post-merge CI](https://github.com/roronoazoroshao/FolderForge/actions/runs/45909284606) SUCCESS 7/7. No src/agent-loops source remains on main; historical records/exclusions retained. Exceptions never transfer.
- CLEAN-003A [#229](https://github.com/roronoazoroshao/FolderForge/pull/229) RED `d6773759ffeb11008b311bbdffd8029c7e34ceb3`: [Ubuntu Node24 log](https://github.com/roronoazoroshao/FolderForge/actions/runs/45909375682/job/140213757957), one intended failure (GET /responses/status 200, POST /responses/config 409 instead of 404), 1578 passed/47 skipped. All four Unix test jobs fail as intended. Auth 401, Mission Control and OpenAI MCP tunnel status 200, historical config byte equality pass before final assertion.
- GREEN removes only two retired Dashboard handlers and unused responsesGateway option; four final paths including independent regression and continuation. Real OpenAI MCP tunnel untouched. Fresh exact-head CI and applicable review required; orphan backend modules and legacy UI still remain for later increments.
- #118/#202 OPEN; #218 closed unmerged historical evidence preserved. No live host mutation, ARB/EBRA expansion or C0/UA promotion.

## Next actions
1. Finish #229 fresh exact-head CI/review/authorized merge/ancestry/branch absence.
2. CLEAN-003B remove orphan Responses HTTP/store/compat/config modules and their subsystem-only tests in dependency order, retain historical data and actual MCP tunnel. CLEAN-004 retire legacy UI, verify pinned Chromium baselines; CLEAN-005 reconcile README/architecture/ledger/handoff, retain historical audits. One implementation branch at a time, ≤5 paths per increment unless explicitly extended.
3. SEC-VITE-001 read-only preflight then authorized remediation; DX-001 and #118 C0 recovery evidence. UA-002 conditional on C0. Reuse closed PR history selectively, no restored old branches.

**Precedence:** [AGENTS.md](../../AGENTS.md), [Goal Map](../strategy/UNIVERSAL_AGENT_GOALMAP_2026-11-15.md), [Roadmap](../strategy/UNIVERSAL_AGENT_ROADMAP_2026-11-15.md), [Task Ledger](../../tasks/universal-agent-todo.md), [UA-002 Handoff](../handoffs/NEXT_SESSION.md).
