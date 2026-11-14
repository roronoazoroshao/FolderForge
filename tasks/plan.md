# FolderForge v2 — Task and rollout index

**Status:** Draft / owner review required. **Created:** 2026-11-14. **Baseline:** `b2ad52e1bb20babed2436890841ec622cc6c4a5a`.

## Read in this order
1. [Product North Star / 2027–2030](../docs/strategy/FOLDERFORGE_NORTH_STAR_2027_2030.md): why and what not to build.
2. [Full v2 specification](../docs/superpowers/specs/2026-11-14-folderforge-v2-design.md): user journeys, boundaries, 14 acceptance criteria.
3. [Executable implementation plan](../docs/superpowers/plans/2026-11-14-folderforge-v2-implementation.md): per-task file targets, dependencies, TDD, checks and rollback.
4. [33-task checklist](todo.md): synchronized task IDs and 7 C0–C6 checkpoints.
5. [GitHub issues](https://github.com/roronoazoroshao/FolderForge/issues?q=is%3Aissue+is%3Aopen+FF-) track each `FF-001` to `FF-033`; issue number mapping will be added after creation.

## Phases
| Phase | Tasks | Product outcome | Gate |
|---|---|---|---|
| P00 | FF-001–FF-003 | Safety baseline + backup + isolated tests | C0 |
| P01 | FF-004–FF-009 | Per-request, immutable workspace context | C1 |
| P02 | FF-010–FF-015 | One application service / correct grants | C2 |
| P03 | FF-016–FF-018 | CLI one-command, real connection proof | C3 |
| P04 | FF-019–FF-025 | Folders / Sessions / Activity / Settings | C4 |
| P05 | FF-026–FF-030 | Modular source + parity and E2E evidence | C5 |
| P06 | FF-031–FF-033 | Optional extensions and owner-approved canary | C6 |

## How to run the work
- Pick a single **unblocked** FF issue; obey its Depends and phase gate.
- Use tests first, minimal source change, typecheck/lint/architecture, focused tests; attach exact commit and CI link.
- Keep legacy CLI, Dashboard and MCP compatibility unless the spec approves a migration.
- A checked issue is not proof of deployment: record `SOURCE-TESTED`, `LIVE-VERIFIED` or `NOT-VERIFIED`.
- Gate #118 is required for actual isolation-registry reconcile/restore; it does not automatically block an independently safe basic MCP path.
- Do not restart live processes, mutate isolation recovery, delete detached worktrees or publish npm automatically.
- Full-workspace grants are not evidence of OS confinement. A stdio config is not a connected client.
- Strategic and architectural decisions remain proposals until the owner explicitly approves the design.
