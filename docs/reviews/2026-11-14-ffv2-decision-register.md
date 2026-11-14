# FolderForge v2 — design review decision register (pre-approval)

**Review board:** [#201](https://github.com/roronoazoroshao/FolderForge/issues/201). **PR:** [#200](https://github.com/roronoazoroshao/FolderForge/pull/200). **Status:** `DRAFT / CHANGES REQUESTED`. No synthetic approval.

| ID | Proposed decision | Why | State / actual owner |
|---|---|---|---|
| DR-01 | Modular monolith + single governed ToolRegistry; no rewrite | preserve existing policy/audit/compat | **RECOMMEND**, product/architecture owner to approve |
| DR-02 | WorkspaceId is an **opaque store-assigned ID**; canonical path is a lookup/rebind key, never an auth secret | deterministic path-hash changes upon rename | **OPEN**, architecture owner must approve migration from FF-004 draft primitive |
| DR-03 | Canonical WorkspaceContext includes **verified** workspaceId/canonicalRoot/principal/session/**grantId**/grantRevision/operationId | spec mismatch with PR primitive | **OPEN BLOCKER**, FF-004/007/008/013 |
| DR-04 | Local browser opt-in is part of MVP only if FF-035 E2E finishes before FF-029 RC; remote browser is P06 | align feature promise, task DAG and real test | **RECOMMEND**, product owner approval |
| DR-05 | FF-034 capability readiness is a core MVP contract; Host Operator FF-036/037 remains Advanced C7 | no false 'anything' advertisement | **RECOMMEND**, architecture+PM approval |
| DR-06 | Owner capability grants do **not** imply OS isolation; privileged paths need independently reviewed broker | shell same UID escapes cwd, browser egress needs guards | **NON-NEGOTIABLE**, security owner proof required |
| DR-07 | First user journey targets local stdio then guarded loopback HTTP; record true CONNECTED evidence | avoid false live state, reuse existing CLI | **DEFAULT PROPOSED**, product/MCP owners to confirm |
| DR-08 | AC-01..18 must each map to test+task+reviewer+gate and a failure oracle | prevent silent scope gaps | **NON-NEGOTIABLE**, QA owner |
| DR-09 | Accessibility cannot be certified without manual evidence, task studies not fabricated | wireframe alone insufficient | **NON-NEGOTIABLE**, UX owner |
| DR-10 | PR #200 remains Draft; never self-approve or cut over production | CI ≠ independent review and host near full | **HOLD**, qualified non-author reviewers + owner |

## Proposed revised dependency DAG (no code action from this table)

```text
FF-001 -> FF-003 -> FF-004 -> FF-005 / FF-006
FF-005 + FF-006 -> FF-007 / FF-008 -> FF-009
FF-009 -> FF-010 / FF-013 -> FF-014 -> FF-020
FF-013 + FF-020 -> FF-034 [MVP capability inventory]
FF-020 + FF-034 -> FF-023 [connect UX]
FF-023 + FF-025 + FF-013 -> FF-035 [local browser E2E]
FF-018 + FF-024 + FF-026 + FF-027 + FF-035 -> FF-029 [MVP golden E2E]
FF-029 -> FF-030 [RC]
FF-035 + C5 -> FF-032 [remote/desktop browser Advanced]
FF-013 + FF-034 + C5 + human threat approval -> FF-036 [host broker]
FF-034 + FF-035 + FF-036 -> FF-037 [C7 advanced evidence]
```

**Caution:** The DAG is a review proposal; each other original dependency in the Plan remains in force unless this register explicitly changes it. Verify the expanded graph mechanically before calling it final.

## Release review evidence checklist

- [ ] G-DESIGN owner decisions DR-01..09 recorded (name/date/SHA).
- [ ] G-ARCH actual source contract + authenticated grant resolver tests.
- [ ] G-MCP real stdio/HTTP interop, no cross-workspace switching.
- [ ] G-SEC independent approval of scope/effective OS authority.
- [ ] G-UX human UX/accessibility evidence, no invented participant counts.
- [ ] G-QA AC-01..18 complete and graph acyclic.
- [ ] G-MERGE CI + non-author code review; PR #200 may become ready only when blockers cleared.
- [ ] G-PROD independently signed canary, restore, capacity and applicable #118.
