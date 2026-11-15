# FolderForge — Universal Agent Task Ledger (UA-001…UA-018)

**Decision baseline:** [Goal Map](../docs/strategy/UNIVERSAL_AGENT_GOALMAP_2026-11-15.md) → [Roadmap](../docs/strategy/UNIVERSAL_AGENT_ROADMAP_2026-11-15.md) → [Spec](../docs/superpowers/specs/2026-11-15-universal-agent-work-environment-design.md) → [Executable plan](../docs/superpowers/plans/2026-11-15-universal-agent-work-environment-implementation.md) → this tracker → [Session handoff](../docs/handoffs/NEXT_SESSION.md). **Baseline:** 2026-11-15. **Status:** planning approved; **UA-001 SOURCE_TESTED on `chore/ua-001-compat-baseline-20261115` (latest confirmed CI 7/7 PASS on e1e31d8 (run 43729853827); independent approval, branch policy and merge pending)**; UA-002–UA-018 unverified. This file extends the existing 33 FF issues on `main` / draft expansion to 37 in PR #200; do not bulk-close FF issues.

## Status legend

- `PLANNED` = specification only, not started; `IN_PROGRESS` = work performed, no passed gate yet; `SOURCE_TESTED` = source checks on exact SHA; `E2E_VERIFIED` = actual runtime/browser/creative checks; `MERGED_MAIN` = actual merge and new `main` SHA confirmed; `LIVE_VERIFIED` = explicit operator runtime proof; `BLOCKED` = verified missing prerequisite.
- An unchecked checkbox stays unchecked until ALL acceptance and relevant gate proof exists. `CI success` alone never certifies OS isolation, production or creative design quality.
- **Single target next:** UA-001. All dates are plans, not evidence or deadlines.

## Target matrix and dependencies

| ID / Phase | One focused deliverable | Depends on | Gate / AC | Mapping to existing FF work | State |
| --- | --- | --- | --- | --- | --- |
| UA-001 / M0 | Source+contract baseline, host boundary manifest | — | C0 | FF-001–003 (#162–164) | SOURCE_TESTED (latest CI 7/7 on e1e31d8; independent approval/policy/merge pending) |
| UA-002 / M1 | Immutable context + real stored owner grants | UA-001 | C1 / AC02 | FF-004–006, FF-013 (#165–167, #174) | PLANNED |
| UA-003 / M1 | Authenticated MCP stdio/HTTP request scope | UA-002 | C1/C3 / AC01–03,05 | FF-007/008 (#168/169) | PLANNED |
| UA-004 / M1 | OS-bounded capsule or explicit unavailable state | UA-002 | C2 / AC04,16 | FF-009 (#170) | PLANNED |
| UA-005 / M1 | Two independent agent isolation/revoke negative suite | UA-003, UA-004 | C1/C2 / AC02–04,06 | FF-009/013 (#170/#174) | PLANNED |
| UA-006 / M1 | Connect real client → verified action → status | UA-003, UA-004 | C3 / AC01,08 | FF-010–018 (#171–179) | PLANNED |
| UA-007 / M2 | Per-slot Playwright observe/act/denial proof | UA-003, UA-004, UA-006 | C4 / AC09,11,14 | FF-034/035 (#196/#197 draft) | PLANNED |
| UA-008 / M2 | Start, observe, stop capsule-local live web app | UA-006, UA-007 | C4 / AC09 | FF-029 (#190) | PLANNED |
| UA-009 / M2 | Browser E2E + screenshot/DOM/network + proof | UA-007, UA-008 | C4 / AC09,15 | FF-025/029 (#186/#190) | PLANNED |
| UA-010 / M2 | Seeded live Web bug detected, fixed, retested | UA-009 | C4 / AC10 | FF-029 (#190) | PLANNED |
| UA-011 / M3 | Permissioned creative native/editable adapter | UA-003, UA-004 | C5 / AC12,14 | new vertical slice; existing generic child MCP | PLANNED |
| UA-012 / M3 | Editable source + render + one visual revision | UA-011 | C5 / AC12,13,15 | new vertical slice | PLANNED |
| UA-013 / M3 | Owner Web control, live slots and proof preview | UA-006, UA-009 | C3/C4 / AC08,15 | FF-019–025 (#180–186) | PLANNED |
| UA-014 / M3 | 10 verified slots + quotas + safe admission | UA-003, UA-004, UA-005 | C6 / AC05–07 | FF-031 (#192) partly; new concurrency suite | PLANNED |
| UA-015 / Advanced | Scoped owner host capability broker | UA-004, UA-014 + owner threat-review | C8 / AC16 | FF-036/037 (#198/#199 draft) | PLANNED / ADVANCED |
| UA-016 / M4 | Cross-app / cross-agent artifact handoff | UA-010, UA-012, UA-014 | C7 / AC15 | extend existing workflow / proof | PLANNED |
| UA-017 / M4 | Neutral competitor benchmark and pilot decision | UA-010, UA-012, UA-016 | C7 / AC17 | `benchmarks/` current infra | PLANNED |
| UA-018 / M5 | CI/release attestation, canary & rollback | UA-013, UA-014, UA-017 + operator | C8 / AC18 | FF-033 (#194); #118 conditional | PLANNED |

**Deliberate parallel work:** UA-011/012 may run concurrently with UA-007–010 once UA-003/004 are qualified. UA-013 Web UX does **not** wait for Photoshop/Figma integration; creative pane can show `unavailable` until UA-012 is real. UA-015 is Advanced and **does not block** safe default agent-local coding beta; it blocks host-control claims.

## Exact acceptance criteria → task traceability

| Spec AC | Owner task(s) |
| --- | --- |
| UA-AC01 | UA-003, UA-006 |
| UA-AC02 | UA-002, UA-003, UA-005 |
| UA-AC03 | UA-003, UA-005 |
| UA-AC04 | UA-004, UA-005 |
| UA-AC05 | UA-003, UA-014 |
| UA-AC06 | UA-005, UA-014 |
| UA-AC07 | UA-014 |
| UA-AC08 | UA-006, UA-013 |
| UA-AC09 | UA-007, UA-008, UA-009 |
| UA-AC10 | UA-010 |
| UA-AC11 | UA-007 |
| UA-AC12 | UA-011, UA-012 |
| UA-AC13 | UA-012 |
| UA-AC14 | UA-007, UA-011 |
| UA-AC15 | UA-009, UA-012, UA-013, UA-016 |
| UA-AC16 | UA-004, UA-015 |
| UA-AC17 | UA-017 |
| UA-AC18 | UA-018 |

Every AC must be proven by the spec's observable oracle, not merely by assigned tasks. This table prevents a shorthand range such as `AC01–03` from concealing missing coverage.

## Detailed DONE requirements

Each task is DONE only when its [execution card in the plan](../docs/superpowers/plans/2026-11-15-universal-agent-work-environment-implementation.md) is satisfied: **one red test (where behavior changes), minimal green implementation, exact test output, issue/PR evidence, no unresolved security blocker, reviewed and actually merged main commit if `MERGED_MAIN` is asserted**.

- [ ] **UA-001** — SOURCE_TESTED on [PR #205](https://github.com/roronoazoroshao/FolderForge/pull/205) (source-tested commit `da483dd47b7b8091d891cb591d4a212891f012dd`); **not DONE**: seven checks succeeded at historical `730cce2` (run `43722930816`) **and** at checked `e1e31d84a92facb914628bd3327229b50bef27e5` (run `43729853827`), but qualified independent review and verified merge remain outstanding; any new documentation commit requires fresh exact-head CI. Artifacts: `tests/contracts/legacy-commands.test.ts`, `tests/fixtures/ua-001-cli-baseline.json`, CLI/MCP negative oracle and status evidence. Next remains UA-001 until C0 is passed.
- [ ] **UA-002** — Workspace/grant authority and rename/stale/revoke tests; C1.
- [ ] **UA-003** — stdio/HTTP principal-per-call binding; C1/C3.
- [ ] **UA-004** — Verified capsule OS boundary or capability unavailable; C2.
- [ ] **UA-005** — 2-agent cross-root negative matrix and revoke; C1/C2.
- [ ] **UA-006** — Real first verified action and truthful connection; C3.
- [ ] **UA-007** — Playwright isolated browser observe/act and denied targets; C4.
- [ ] **UA-008** — Live app preview lifecycle and port ownership; C4.
- [ ] **UA-009** — Functional browser E2E plus proof pack; C4.
- [ ] **UA-010** — Actual fix/retest seeded regression; C4.
- [ ] **UA-011** — Real permissioned creative native adapter; C5.
- [ ] **UA-012** — Editable source + render + revision; C5.
- [ ] **UA-013** — Owner UI status and proof parity; C3/C4.
- [ ] **UA-014** — 10-principal isolation/concurrency under sized fixture; C6.
- [ ] **UA-015** — Advanced host broker under owner security gate; C8.
- [ ] **UA-016** — Explicit cross-agent artifact handoff; C7.
- [ ] **UA-017** — Neutral benchmark and go/no-go record; C7.
- [ ] **UA-018** — Safe rollout, restore and attestation; C8.

## Integration policy: main as canonical, not main-at-any-price

- **Target end state:** code reviewed, CI green, task-specific proof, permitted PR merge into `main`; no unnecessary long-lived feature branches.
- **Never:** force merge on failing CI, waive required reviewers, alter branch protections, delete unmerged unique commits, remove archived/detached recovery worktrees, auto-clean disk/restart production to make the graph look tidy.
- **Branch cleanup:** after merged PR confirmed and no unique work against main, delete only that merged feature branch if remote permissions and owner/org policies allow. Dependabot branches, active PRs and detached worktrees are separate subjects; `main`-only must not erase them.
- **Last task deliverable:** write next task handoff in [NEXT_SESSION](../docs/handoffs/NEXT_SESSION.md) and output the recursive master prompt tail. A DONE statement without that handoff is incomplete as a session, even if code passed tests.

## UA-001 C0 exact-head verification checkpoint — 2026-11-15 (Asia/Ho_Chi_Minh)

- GitHub `main@2d3e83f789884094d2805a7f2df061711e151203` matches fetched `origin/main`; PR #205 was OPEN/non-draft/mergeable, branch `chore/ua-001-compat-baseline-20261115@e1e31d84a92facb914628bd3327229b50bef27e5` with clean working tree before this handoff-only edit. Any new documentation commit advances HEAD; check CI again.
- [Exact checked-head CI run 43729853827](https://github.com/roronoazoroshao/FolderForge/actions/runs/43729853827): completed SUCCESS, **7/7 check-runs SUCCESS** on `e1e31d84a92facb914628bd3327229b50bef27e5`. Ubuntu Node 22 job steps include typecheck/lint/architecture/docs, real Docker isolation *fixture*, unit/integration tests, coverage, fuzz/stress, build, package and MCP smokes; none establish deployed host isolation.
- PR diff inspected across five files; CLI tests use `tsx` source entry and pin fixture version `3.2.4`; package smoke runs separately in CI. No new P0/P1 code defect identified and **no runtime source edit** proposed.
- One author `COMMENTED` review, no independent `APPROVED`, no review threads and no named review request. [Request for eligible independent reviewer](https://github.com/roronoazoroshao/FolderForge/pull/205#issuecomment-6896836022) is a comment, not approval. Branch-protection read 403; empty rulesets do not establish a waiver. **No merge; C0 HOLD.**
- Host inspected at disk display 100% (~2.5 GiB available), swap 4085/4095 MiB consumed, 24 managed isolations (some unverifiable), and [issue #118](https://github.com/roronoazoroshao/FolderForge/issues/118) OPEN. Avoid full host suite, registry mutations, worktree cleanup, host/root privilege and production actions. Next target remains UA-001; UA-002/C1/UA-AC02 is conditional on legitimate C0 PASS and verified merged main.
