# FolderForge — Rolling Session Context

**CONTEXT_ID:** `FF-RECURSIVE-01/STATE`  
**CHECKED:** 2026-11-28 Asia/Ho_Chi_Minh  
**GOAL:** `CLEAN-003A / retire Responses Dashboard API`  
**STATUS:** `BLOCKED` (visual, review, scope); operational C0 HOLD  
**MASTER:** [MASTER_PROMPT.md](MASTER_PROMPT.md)

## Verified checkpoint
- Main `1045c88564ce2c4ccd70a0e46a4355731320b100`: #228 merged; remote branch absent. [Post-merge CI](https://github.com/roronoazoroshao/FolderForge/actions/runs/45909284606) SUCCESS 7/7. Only main and #229 branch listed. Exceptions for #226–228 never transfer.
- [#229](https://github.com/roronoazoroshao/FolderForge/pull/229) OPEN/DRAFT. Historical RED `d6773759ffeb11008b311bbdffd8029c7e34ceb3`: [Ubuntu log](https://github.com/roronoazoroshao/FolderForge/actions/runs/45909375682/job/140213757957), intended retirement failure, 1578 passed/47 skipped. Source candidate `e1f3f44ceb6aa0dae9c3a17c05d32c222af791b0` removes two Dashboard handlers and options, preserves MCP tunnel/history.
- Diagnostic HEAD `781f43e3a1c73c744384adf4660b4579a622344b`: [CI](https://github.com/roronoazoroshao/FolderForge/actions/runs/45921080321) FAILURE 6/7; [Ubuntu Node24](https://github.com/roronoazoroshao/FolderForge/actions/runs/45921080321/job/140251751644) 1579 passed/47 skipped, retirement PASS; owner consent visual SUCCESS. [Chromium](https://github.com/roronoazoroshao/FolderForge/actions/runs/45921080321/job/140251751603) recovered 109 indexed PNG chunks, 166684 bytes, 1280x1003 vs 1280x1270 baseline. Actual image inspected: not_found, stale Agent Loop/Codex gateway instructions and obsolete controls. Reject baseline normalization of broken UX. Restore visual test to main blob `c4dd10a7a25b2a5a4f35c48eab1676572c9d7e4e`; no comparator/threshold/baseline changes. This checkpoint invalidates prior exact-head CI; new checks required.
- No submitted reviews, threads or requested reviewers; branch protection read 403, rulesets empty. FolderForge workspace/capsule/policy/status MCP 429: live capacity, worktrees, fence and recovery UNKNOWN. #118/#202 OPEN, #218 closed unmerged evidence retained. No host mutation or C0/UA promotion.

## Next actions
1. Resume #229, not a new branch. Re-slice API/UI retirement within five final paths or obtain explicit scope extension for a paired UI fix plus intentional visual evidence. Test retired route UX and preserve actual MCP tunnel, auth, history. Do not accept misleading legacy UI or skip visual assertions.
2. Fresh final-head CI, genuine non-author review or eligible explicit scoped exception, authorized merge, ancestry and branch absence. Do not waive visual failure.
3. CLEAN-003B orphan modules, CLEAN-004 legacy UI, CLEAN-005 docs/ledger; SEC-VITE-001 preflight, DX-001 and #118 C0 evidence. UA-002 conditional on C0.

**Precedence:** [AGENTS.md](../../AGENTS.md), [Goal Map](../strategy/UNIVERSAL_AGENT_GOALMAP_2026-11-15.md), [Roadmap](../strategy/UNIVERSAL_AGENT_ROADMAP_2026-11-15.md), [Task Ledger](../../tasks/universal-agent-todo.md), [UA-002 Handoff](../handoffs/NEXT_SESSION.md).
