# Proposed append-only UA Task Ledger entry — NOT APPLIED

**Proposed date:** 2026-11-23; **inspected main:** `599473dec46bddcabda618223d5ec7636261b5ef`; **status:** `BR-001 PARTIAL / UNREVIEWED / C0 HOLD`. This text is **not** a replacement for `tasks/universal-agent-todo.md` and must not change UA-001 through UA-018 statuses.

| Browser research task | State as of proposed entry | Depends on | Canonical trace |
| --- | --- | --- | --- |
| BR-001 Browser upstream review + ADR + plan | `PARTIAL / UNREVIEWED`; source SHA/licenses reviewed; independent approval/PR CI absent | M0 evidence/ADR review | G2/3/4/5/7; UA-AC02/03/04/09/11/14/15; UA-007, FF-035 (#197) |
| BR-002 Browser policy negative tests | `PLANNED / BLOCKED until BR-001 review and safe isolated fixture`; scope must not bypass UA-002/003/004/005 | BR-001; C1/C2 prerequisites for security claims | G2/3/4; AC02/03/04/06/11/15; UA-002/003/004/005/007 |
| BR-003 Backend contract if required | `PLANNED` | BR-002 | G3/4/7; AC09/11/14/15; UA-007 |
| BR-004 Patchright vs baseline experiment | `PLANNED / CONDITIONAL` | BR-002/003, owner opt-in | G3/4/8; AC09/11/14/15/17 |
| BR-005 Camoufox feasibility | `DEFERRED` | Legal/version/runtime review | G7; AC11/14 |
| BR-006 Agentic workflow slice | `PLANNED / CONDITIONAL` | BR-002/003 plus UA-009/010 evidence | G3/4/5; AC09/10/15 |
| BR-007 Conformance benchmark | `PLANNED` | Verified optional backend(s) and negative matrix | G2/5/8; AC07/09/10/11/15/17/18 |

**Review instruction:** If the canonical ledger has changed or another session owns active task planning, create a minimal separate follow-up rather than overwriting or silently adding contradictory rows. Never count this proposed append as a merged task update.