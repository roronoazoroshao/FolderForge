# FolderForge — Recursive Session Master Prompt

**PROMPT_ID:** `FF-RECURSIVE-01` (stable)  
**REVISION:** 2 · **UPDATED:** 2026-11-23 Asia/Ho_Chi_Minh  
**ENTRY:** `docs/continuation/MASTER_PROMPT.md`  
**STATE:** `docs/continuation/CURRENT_CONTEXT.md`

Work in the **real** repository `roronoazoroshao/FolderForge` under its existing owner/governance permissions. North Star: separately authorized agents **Observe → Act → Verify → Repair** real work. Never infer live readiness from docs, source tests or CI alone.

## Start from evidence
1. Read `AGENTS.md`, this file, `CURRENT_CONTEXT.md`, relevant Goal Map/Roadmap/spec, task ledger and canonical UA-002 handoff. Their explicit safety/owner policies take precedence.
2. Refresh live `main`, PR/ref SHAs and diffs, exact-HEAD CI/check runs, actual reviewer identities/threads, rules/protection, open issues and recovery state with connected trusted tools. Label inaccessible live host/worktrees `UNKNOWN`, not healthy.
3. Choose **one** unblocked short-term goal: state `DONE WHEN`, exact evidence, risk, dependency and authorized scope (≤5 changed files by default).

## Work and integration gates
4. Use a bounded feature branch/PR targeting `main`; no routine direct-to-main edits. Behavior changes require failing test → smallest fix → fresh verification. Documentation edits require scoped diff, valid links and applicable docs CI.
5. Before merge, fetch **final PR HEAD** and verify exact-head CI, genuine eligible **non-author** approval, unresolved threads, branch protections and applicable security/owner gates. A green check, author comment, synthetic reviewer, empty rulesets, inaccessible protection API or `mergeable=true` is **not** review authorization. Do not invent a reviewer account; if none is known, record a scoped request and stay blocked.
6. After any handoff edit/commit, **prior CI is stale**: recheck CI against the new HEAD. Merge only with verified authorization. Then independently check resulting `main` SHA/ancestry before attempting to delete **only** the incorporated feature branch. Ref update is not deletion. If the supported deletion tool is unavailable, preserve the branch and report `BLOCKED_CLEANUP`, not DONE.
7. **Every session overwrite in place** the same two files: `docs/continuation/CURRENT_CONTEXT.md` and `docs/continuation/MASTER_PROMPT.md` on a scoped reviewed branch. Replace obsolete snapshot, never append dated prompt chains. Preserve `PROMPT_ID=FF-RECURSIVE-01`; increment REVISION only for meaningful prompt edits. Aim context ≤500 and prompt ≤550 words. Do not alter `docs/handoffs/NEXT_SESSION.md` or UA-002 ledger outside task scope.
8. Do not manipulate live host privileges, isolation registries, recovery worktrees, C0 status or other PRs to force completion. `DONE` requires **MERGED_MAIN + VERIFIED_BRANCH_DELETION**; missing gate → report exact `BLOCKED` reason and preserve unique work. Never imply background execution.

## End-of-session contract
Report `GOAL | STATUS | BASE_MAIN_SHA | FINAL_PR_HEAD | CI | REVIEW | MERGE_MAIN_SHA | BRANCH_CLEANUP | NEXT_GOAL | PROMPT_ID | PROMPT_PATH`. Cite verifiable GitHub URLs and distinguish checks performed **before** vs **after** the final documentation commit.

The next session starts with the same ID `FF-RECURSIVE-01` and path `docs/continuation/MASTER_PROMPT.md`. If PR #212 remains unmerged, load both continuation files from `docs/stable-session-loop-20261123`, not `main`.
