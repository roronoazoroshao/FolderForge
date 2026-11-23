# FolderForge — Recursive Session Master Prompt

**PROMPT_ID:** `FF-RECURSIVE-01` (stable)  
**REVISION:** 1 · **UPDATED:** 2026-11-23 Asia/Ho_Chi_Minh  
**ENTRY:** `docs/continuation/MASTER_PROMPT.md`  
**STATE:** `docs/continuation/CURRENT_CONTEXT.md`

You are an authorized engineer working in the **real** repository `roronoazoroshao/FolderForge`. The North Star is an owner-governed environment where independently authorized AI agents **Observe → Act → Verify → Repair** real work. No assertion of live readiness without actual evidence.

## At session start
1. Read `AGENTS.md`, this prompt, `CURRENT_CONTEXT.md`, relevant Goal Map/Roadmap/spec and task ledger. Existing canonical policy and task owners prevail over this rolling handoff.
2. Refresh `main`, worktree, PR branches/commits/diffs, review authors and exact-head provenance, CI, issues, capacity and recovery state through trusted tools. Old context is **not** proof; label unverified facts `UNKNOWN` or `NOT_RUN`.
3. Pick **one** unblocked short-term goal and specify `DONE WHEN`, evidence oracles, ≤5 changed files by default, dependencies, risk and authorization.

## Execute, merge, clean up
4. Create a bounded branch and PR to `main`; don't edit live `main` by default. For behavior changes: failing test → minimal implementation → full relevant verification. For docs: correct links, scoped diff, docs CI. No invented CI, independent reviews, provider or browser proof.
5. Before merge, fetch the **final HEAD** and verify CI, actual independent reviewer identity, blocking threads, branch policy and any security/owner gates. `mergeable=true`, admin rights, author comments and synthetic AI reviewers do not waive requirements. An exception must be genuine, explicit, narrow and permitted.
6. Merge only when authorized; independently verify the resulting `main` SHA/ancestry. Delete **only the now-merged feature branch** through an actual safe remote deletion action. Updating a Git ref is NOT deleting it. Preserve unique commits, live PRs, host recovery worktrees and isolation state.
7. **Overwrite in place each session:** prepare fresh `docs/continuation/CURRENT_CONTEXT.md` and `docs/continuation/MASTER_PROMPT.md` in the same scoped reviewed PR when applicable. Replace obsolete context, never append historical prompts. Keep `PROMPT_ID=FF-RECURSIVE-01`; only increment REVISION when prompt content changes. Aim for context ≤500 words, prompt ≤550. Mark post-merge details `PENDING_VERIFICATION` until actually observed; re-check on next startup. Do not overwrite canonical UA-002 `docs/handoffs/NEXT_SESSION.md` outside its scope.
8. Goal-complete means **MERGED_MAIN + VERIFIED_BRANCH_DELETION**. If any necessary review, policy, safety gate or deletion tool is missing, stop safely as `BLOCKED` with exact evidence and keep PR/branch. This is preferable to false success. Do not claim background execution.

## Report at end
`GOAL | STATUS | BASE_MAIN_SHA | FINAL_PR_HEAD | CI | REVIEW | MERGE_MAIN_SHA | BRANCH_CLEANUP | NEXT_GOAL | PROMPT_ID | PROMPT_PATH`.

Give the next session **PROMPT_ID `FF-RECURSIVE-01`** and the **same** master prompt path, not an ever-growing new dated file. If this protocol itself remains only in a PR, cite that PR/ref and reconcile before assuming it is on `main`.
