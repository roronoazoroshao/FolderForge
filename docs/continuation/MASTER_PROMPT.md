# FolderForge — Recursive Roadmap Execution Master Prompt

**PROMPT_ID:** `FF-RECURSIVE-01` (stable)  
**REVISION:** 5 · **UPDATED:** 2026-11-23 Asia/Ho_Chi_Minh  
**ENTRY:** `docs/continuation/MASTER_PROMPT.md`  
**STATE:** `docs/continuation/CURRENT_CONTEXT.md`

You are working on the **real** `roronoazoroshao/FolderForge` repo toward the owner-governed Universal Agent roadmap: **Observe → Act → Verify → Repair**. Complete **one smallest safe, measurable roadmap increment per session**, aiming for **merged `main` + verified branch deletion**, never success theatre.

## Mandatory startup
1. Activate/use available **Superpowers** (using-superpowers, brainstorming/planning as needed, TDD, code review, verification, branch finishing), **agent-skills** (context, source-driven, security, documentation, Git/CI, shipping), **andrej-karpathy-skills** (simple, explicit, surgical changes), **FolderForge** (workspace/capsule/policy/status, code/verification, approved operations), and **GitHub** (PR, reviews, CI, main refs). Discover and invoke actual installed skills/tools; names alone prove no capability or security guarantee.
2. Read `AGENTS.md`, this prompt and `CURRENT_CONTEXT.md`. Then inspect canonical [Goal Map](../strategy/UNIVERSAL_AGENT_GOALMAP_2026-11-15.md), [Roadmap](../strategy/UNIVERSAL_AGENT_ROADMAP_2026-11-15.md), [Spec](../superpowers/specs/2026-11-15-universal-agent-work-environment-design.md), [Implementation Plan](../superpowers/plans/2026-11-15-universal-agent-work-environment-implementation.md), [Task Ledger](../../tasks/universal-agent-todo.md), [UA-002 Handoff](../handoffs/NEXT_SESSION.md), relevant issues/ADRs. Precedence: canonical policy and task owners over rolling snapshots.
3. PR #212 merged into `main` on 2026-11-23; both continuation files now exist there. Never reuse its one-time docs-only exception or treat its historical `BLOCKED_REVIEW` as current. **Refetch reality**: `main` SHA, open PRs, diffs, exact-head CI, authentic reviewer identities/threads, branch policy, workspace/worktrees, capsule and recovery (#118), synthetic-review provenance (#202). Mark inaccessible facts `UNKNOWN`.

## Execution to DONE
4. Reconcile **C0 first**: distinguish merged R11/R16 source fixtures from unverified production writer-epoch fencing, independent #118 review, host crash/restart and off-host recovery, and capacity proof. Disposable UID/lock/CAS tests cannot certify the production OS boundary. Prefer eligible existing PRs or one narrow C0 prerequisite; conditionally continue **UA-002 / M1 / C1 / UA-AC02** only under applicable gates. Keep scope ≤5 files.
5. Work on bounded branch and PR → `main`. Use RED→GREEN→REFACTOR for behavior changes; docs require correct links, focused diff and docs checks. Independently challenge assumptions and verify real system boundaries; no fake provider, browser, security or independent-review claims.
6. **Merge gate:** fresh checks on **final HEAD**, genuine required non-author approval (or a documented explicit, narrow, policy-permitted owner exception), no unresolved blockers, applicable security/recovery authorization. `mergeable=true` or admin rights are not permission. Never mutate production, host isolation registry or recovery worktrees to force green.
7. After authorized merge, fetch and verify actual `main` SHA and ancestry. Delete **only** the integrated remote branch with a supported safe delete operation; never confuse moving a ref with deleting it. Verify branch absence. No deleting active PRs, unique commits or user worktrees.
8. **Overwrite in place** `CURRENT_CONTEXT.md` and `MASTER_PROMPT.md` in the same scoped reviewed work (stable `FF-RECURSIVE-01`; no dated chains). Context ≤500 words; master ≤550. After editing, prior CI is stale. If blocked, preserve PR/branch and record exact evidence + next unblocker, `STATUS=BLOCKED`, not `DONE`. No asynchronous execution.

## End-of-session evidence
Report `GOAL | STATUS | BASE_MAIN_SHA | TASK_ID / MILESTONE / ACCEPTANCE_CRITERIA | FILES_CHANGED | RED_TEST_EVIDENCE | GREEN_TEST_EVIDENCE | FINAL_PR_HEAD | CI_RESULT | REVIEW_PROVENANCE | MERGE_MAIN_SHA | BRANCH_DELETION | SECURITY_GATES | ROADMAP_PROGRESS | NEXT_UNBLOCKER | PROMPT_ID | PROMPT_PATH`; include URLs and distinguish historical from final-head checks. **DONE** only means `MERGED_MAIN + VERIFIED_BRANCH_DELETION`. Next fresh chat receives only this stable prompt ID/path, not a new dated prompt.
