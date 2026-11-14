# FolderForge v2 — Task and rollout index

**Status:** Draft / owner review required. **Created:** 2026-11-14. **Baseline:** `b2ad52e1bb20babed2436890841ec622cc6c4a5a`.

## Read in this order
1. [Product North Star / 2027–2030](../docs/strategy/FOLDERFORGE_NORTH_STAR_2027_2030.md): why and what not to build.
2. [Full v2 specification](../docs/superpowers/specs/2026-11-14-folderforge-v2-design.md): user journeys, boundaries, 14 acceptance criteria.
3. [Executable implementation plan](../docs/superpowers/plans/2026-11-14-folderforge-v2-implementation.md): per-task file targets, dependencies, TDD, checks and rollback.
4. [33-task checklist](todo.md): synchronized task IDs and 7 C0–C6 checkpoints.
5. [GitHub master roadmap #195](https://github.com/roronoazoroshao/FolderForge/issues/195), with all individual task issue links below.

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

## GitHub execution issues (synchronized 2026-11-14)

**Master tracking issue:** [#195 — Roadmap and 7 gates](https://github.com/roronoazoroshao/FolderForge/issues/195). The issues are **Draft/Unstarted**; an open issue does not authorize execution.

### P00
- [FF-001 — #162](https://github.com/roronoazoroshao/FolderForge/issues/162): Chốt baseline và compatibility contract (P0)
- [FF-002 — #163](https://github.com/roronoazoroshao/FolderForge/issues/163): Tạo operational safety manifest và recovery boundary (P0)
- [FF-003 — #164](https://github.com/roronoazoroshao/FolderForge/issues/164): Isolated fixture/test harness + fault injection (P0)

### P01
- [FF-004 — #165](https://github.com/roronoazoroshao/FolderForge/issues/165): Workspace identity / immutable context types (P0)
- [FF-005 — #166](https://github.com/roronoazoroshao/FolderForge/issues/166): Verify root & path identity with adversarial cases (P0)
- [FF-006 — #167](https://github.com/roronoazoroshao/FolderForge/issues/167): Durable registry + CAS + idempotency port (P0)
- [FF-007 — #168](https://github.com/roronoazoroshao/FolderForge/issues/168): Bind workspace context at MCP entry (stdio) (P0)
- [FF-008 — #169](https://github.com/roronoazoroshao/FolderForge/issues/169): Bind workspace context at MCP entry (HTTP) (P0)
- [FF-009 — #170](https://github.com/roronoazoroshao/FolderForge/issues/170): Tool kernel context enforcement and two-root matrix (P0)

### P02
- [FF-010 — #171](https://github.com/roronoazoroshao/FolderForge/issues/171): Add/list/status usecases (P1)
- [FF-011 — #172](https://github.com/roronoazoroshao/FolderForge/issues/172): Managed start/stop/health supervisor (P1)
- [FF-012 — #173](https://github.com/roronoazoroshao/FolderForge/issues/173): ConnectionReceipt + client config preview/undo (P1)
- [FF-013 — #174](https://github.com/roronoazoroshao/FolderForge/issues/174): Owner grants, revocation and enforcement lifecycle (P0)
- [FF-014 — #175](https://github.com/roronoazoroshao/FolderForge/issues/175): Versioned local Control API for add/status/health (P1)
- [FF-015 — #176](https://github.com/roronoazoroshao/FolderForge/issues/176): Connection/grants/session/activity endpoints (P1)

### P03
- [FF-016 — #177](https://github.com/roronoazoroshao/FolderForge/issues/177): New command router for `up` (P1)
- [FF-017 — #178](https://github.com/roronoazoroshao/FolderForge/issues/178): CLI `status`, `ui`, `stop`, scoped access controls (P1)
- [FF-018 — #179](https://github.com/roronoazoroshao/FolderForge/issues/179): CLI compatibility & connect client protocol matrix (P0)

### P04
- [FF-019 — #180](https://github.com/roronoazoroshao/FolderForge/issues/180): Semantic tokens and UI primitives (P1)
- [FF-020 — #181](https://github.com/roronoazoroshao/FolderForge/issues/181): Typed API client + hooks (P1)
- [FF-021 — #182](https://github.com/roronoazoroshao/FolderForge/issues/182): Navigation and legacy deep-link preservation (P1)
- [FF-022 — #183](https://github.com/roronoazoroshao/FolderForge/issues/183): Add Folder wizard, typed permissions (P1)
- [FF-023 — #184](https://github.com/roronoazoroshao/FolderForge/issues/184): Connect Agent + accurate health receipt (P1)
- [FF-024 — #185](https://github.com/roronoazoroshao/FolderForge/issues/185): Folder details, Sessions and Activity (P1)
- [FF-025 — #186](https://github.com/roronoazoroshao/FolderForge/issues/186): Web visual + accessibility acceptance suite (P1)

### P05
- [FF-026 — #187](https://github.com/roronoazoroshao/FolderForge/issues/187): Extract Dashboard workspace/owner routes by domain (P2)
- [FF-027 — #188](https://github.com/roronoazoroshao/FolderForge/issues/188): Simplify `src/main.ts` dispatch without changing options (P2)
- [FF-028 — #189](https://github.com/roronoazoroshao/FolderForge/issues/189): Break up Fleet UI & formalize Advanced navigation (P2)
- [FF-029 — #190](https://github.com/roronoazoroshao/FolderForge/issues/190): Golden end-to-end scenario + parity proof (P0)
- [FF-030 — #191](https://github.com/roronoazoroshao/FolderForge/issues/191): Documentation, migration, release candidate (P2)

### P06
- [FF-031 — #192](https://github.com/roronoazoroshao/FolderForge/issues/192): Multi-project gateway eligibility (P3)
- [FF-032 — #193](https://github.com/roronoazoroshao/FolderForge/issues/193): Browser control scope (P3; chỉ sau user quyết định)
- [FF-033 — #194](https://github.com/roronoazoroshao/FolderForge/issues/194): Production attestation, canary, rollback (P0 production-only)

## How to run the work
- Pick a single **unblocked** FF issue; obey its Depends and phase gate.
- Use tests first, minimal source change, typecheck/lint/architecture, focused tests; attach exact commit and CI link.
- Keep legacy CLI, Dashboard and MCP compatibility unless the spec approves a migration.
- A checked issue is not proof of deployment: record `SOURCE-TESTED`, `LIVE-VERIFIED` or `NOT-VERIFIED`.
- Gate #118 is required for actual isolation-registry reconcile/restore; it does not automatically block an independently safe basic MCP path.
- Do not restart live processes, mutate isolation recovery, delete detached worktrees or publish npm automatically.
- Full-workspace grants are not evidence of OS confinement. A stdio config is not a connected client.
- Strategic and architectural decisions remain proposals until the owner explicitly approves the design.
