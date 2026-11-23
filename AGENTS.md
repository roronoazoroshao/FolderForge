# FolderForge — Agent Working Agreement

**Source of truth for future implementation sessions (owner-approved strategic direction, 2026-11-15):**

1. [Universal Agent GOAL MAP](docs/strategy/UNIVERSAL_AGENT_GOALMAP_2026-11-15.md) — *why/what*, outcomes, no false claims.
2. [ROADMAP](docs/strategy/UNIVERSAL_AGENT_ROADMAP_2026-11-15.md) — milestone dependency / quality gates.
3. [PRODUCT + ARCHITECTURE SPEC](docs/superpowers/specs/2026-11-15-universal-agent-work-environment-design.md) — interfaces, boundaries, 18 acceptance criteria.
4. [IMPLEMENTATION PLAN](docs/superpowers/plans/2026-11-15-universal-agent-work-environment-implementation.md) — red→green→review steps for each task.
5. [TASK LEDGER](tasks/universal-agent-todo.md) — statuses, dependencies, next unblocked task.
6. [BASELINE STATUS](docs/status/UNIVERSAL_AGENT_STATUS_2026-11-15.md) — observed code/PR/runtime gaps, not proof of current live health.
7. [RECURSIVE MASTER PROMPT](docs/prompts/MASTER_IMPLEMENTATION_RECURSIVE_HANDOFF.md) and [NEXT SESSION](docs/handoffs/NEXT_SESSION.md) — every execution must leave an evidence-based continuation.

## Non-negotiable task loop

Read the current real branch/CI/worktree state. Choose **one** unblocked `UA-###` target, map one user-visible outcome to the exact AC and gate, write failing test first for behavior changes, implement smallest fix, run focused tests and applicable source/real-runtime checks, capture evidence and adversarial review, then open a bounded PR to **main**. After required checks/reviews pass, merge if authorized; verify main HEAD and record actual status. Never assume old PRs were merged or current source is deployed. Conclude with a copy-ready recursive next master prompt and update `docs/handoffs/NEXT_SESSION.md` + task ledger in the same reviewed change when possible.

**Main-only goal** = `main` is canonical. It does NOT permit skipping CI/required reviewers, forced merging, deleting unique commits/active PRs or recovery worktrees, or changing live privileged processes. Keep WIP until safe to merge; only delete a feature branch after verifying its changes are in main and it is not needed for recovery.

## Platform, security and tooling

Maintain compatibility with existing Node/TypeScript/MCP/CLI/React stack. Use installed Superpowers (`using-superpowers`, writing-plans, worktrees, executing-plans, TDD, code review, verification), `agent-skills` (context, security, browser, docs, Git/CI) and Karpathy (surgical code/no extra abstractions). Discover actual connected tools/skills each turn; use GitHub, FolderForge, browser/Playwright, Figma, Adobe, Postman, Cloudflare, Notion or other connectors **only when relevant and available**. Do not fabricate an external provider/independent reviewer run or claim connected ChatGPT plugins are already runtime adapters.

One trusted principal+grant+workspace+capsule for every tool action; no trust in prompt-supplied identity. An arbitrary shell with the same host UID does not provide OS isolation. OpenHands-class coding must be proven by real live Web UI/trace/assertions; design-class work by editable source+preview+revision. Host/root authority requires a separate owner-granted broker, independent OS/security evidence and release gate, never by default.

Preserve owner safety: issue #118 isolation writer fencing and any detached recovery worktrees remain gated; do not restart/provision/force-clean the live host or do broad `git clean` to free space. Fail closed on missing audit, ownership, sandbox or capacity evidence. Use CI/ephemeral isolated workers for resource-heavy tests.

## Stable recursive session continuation (2026-11-23)

Use [`docs/continuation/MASTER_PROMPT.md`](docs/continuation/MASTER_PROMPT.md) (stable `PROMPT_ID: FF-RECURSIVE-01`) and [`docs/continuation/CURRENT_CONTEXT.md`](docs/continuation/CURRENT_CONTEXT.md) as the compact next-session entrypoint. Future scoped reviewed sessions **overwrite these same two files**, not append dated prompt histories. Preserve the Goal Map, task ledger, existing UA-002 handoff and all actual CI/review/owner safety gates. Target merge to `main` plus safe deletion of only the merged branch; `BLOCKED` is mandatory when gates or a safe deletion action are absent. A prompt does not schedule background work.
