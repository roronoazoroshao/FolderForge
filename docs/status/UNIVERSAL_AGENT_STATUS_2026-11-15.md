# Universal Agent — Source/Plan/Runtime Status Register

**Snapshot date:** 2026-11-15. **Evidence source:** local read-only inspection of `main@104f57f4280d288a61ce52168ea4982ddd7432f8`, origin feature branches `1909dfd` and `898fbab`, GitHub PR #200/#203; do not treat as continuously up-to-date telemetry. **Read [Goal Map](../strategy/UNIVERSAL_AGENT_GOALMAP_2026-11-15.md)** and [Roadmap](../strategy/UNIVERSAL_AGENT_ROADMAP_2026-11-15.md) first.

## 1. Decision/status vocabulary

| Object | Status | Meaning |
| --- | --- | --- |
| Product goal, priorities, scope | **DIRECTION_APPROVED** | Owner approved strategy in conversation on 2026-11-15; this does not assert technical readiness |
| Architecture target/spec | **DESIGN_BASELINE_APPROVED, IMPLEMENTATION_GATED** | Proposed contracts and acceptance criteria accepted as planning baseline; prove each before shipping |
| Old v2 #200 | **DRAFT / NOT_MERGED** | Contains source primitives and expanded v2 FF backlog; treat as upstream proposal |
| AI Board #203 | **DRAFT / NOT_MERGED** | CI success was observed on `898fbab`, but no real provider review proofs; not core-product blocker by itself |
| Main source | **KNOWN_BASELINE** | Main worktree clean on inspected snapshot; not proof current host binary matches source |
| Multi-agent 10 isolation | **NOT_VERIFIED** | Auth/session infrastructure exists but 10-principal OS-level conformance missing |
| Live Web E2E code→browser→repair | **NOT_VERIFIED** | Existing browser adapter/tool names, no observed combined golden test proof |
| Editable Figma/Photoshop/Blender task | **NOT_VERIFIED** | Generic child MCP extension is present; native creative adapter/product deliverable not demonstrated |
| Production / release | **NOT_AUTHORIZED** | No deploy/restart/recovery mutation was approved by this documentation |

## 2. Evidence-based technical inventory

| System piece | Existing evidence | Gap / false claim to avoid | Next task |
| --- | --- | --- | --- |
| Transport principal/session | `src/server/transports/http.ts` has OAuth and scoped HTTP sessions | 10 chats do not imply 10 OAuth principals; modern stateless request binding not verified | UA-003 |
| Workspace selection | `src/workspace/workspace-manager.ts` has `current` mutable workspace | cross-session misrouting is a threat; v2 DTO missing verified grantId | UA-002/UA-003 |
| Policy/tool pipeline | `src/tools/registry.ts`, policy/audit and risk catalog | external adapter/desktop trust and OS boundary still need negative tests | UA-004/UA-007 |
| Capsule support | `src/capsule/workspace-capsule-manager.ts` has direct/worktree/checkpoint modes | worktree or cwd are not OS isolation | UA-004 |
| Sandboxing | `src/sandbox/launcher.ts` supports process/docker/podman paths | no universal host guarantee; verify actual caps/volume/net/UID | UA-004/UA-015 |
| Browser | `src/tools/browser-tools.ts`, `src/adapters/child-mcp/`, Playwright setup and diagnostics | installed adapter ≠ isolated browser + full live test coverage | UA-006/UA-007 |
| Evidence | `src/proof/`, workflow tools, artifact docs | proof of one call ≠ full product test or app render fidelity | UA-008/UA-009 |
| Creative | generic child MCP adapters, `game_screenshot` etc | no verified editable-source Figma/Adobe/Blender integration | UA-011/UA-012 |
| UI | `packages/mission-control/` | 4-section journey/10 capsule status/visual QA overview not demonstrated | UA-013 |
| Host/operations | 2026-11-14 audit and issue [#118](https://github.com/roronoazoroshao/FolderForge/issues/118) | writer fence/recovery review unresolved; disk near full on historical snapshots | UA-001/UA-018 |

## 3. Outstanding gates and relationship to GitHub

- [Roadmap issue #195](https://github.com/roronoazoroshao/FolderForge/issues/195) records earlier FF tasks; task completion may not be inferred from issue creation.
- [PR #200](https://github.com/roronoazoroshao/FolderForge/pull/200) includes v2 workspace primitives and governance docs; separate source review required for contract mismatch `root` vs `canonicalRoot`, `grantId` and workspace ID stability.
- [PR #203](https://github.com/roronoazoroshao/FolderForge/pull/203) is an optional model-review engine; keep draft until scope, auth and role-vote provenance independently reviewed. It is **not** a prerequisite for GOAL MAP review.
- [AI Board issue #202](https://github.com/roronoazoroshao/FolderForge/issues/202) tracks fake council vote P0 on old runner; no positive trust claims until merged code is actually checked.
- `#118` isolation-registry writer fencing and restore evidence remain independent stop gates. Historical broken active records must never be classified as junk or deleted by an agent for disk cleanup.

## 4. Current objective and source truth

**Next plan target:** `UA-001` baseline + compatibility/evidence inventory in a separate branch, then `UA-002` immutable workspace/grant contract; reuse `FF-001/002/003/004` work where sound. **Never mark UA-001 DONE merely because this status document exists.**

New sessions: verify `git status`, `git rev-parse HEAD`, open PR/CI/branch state and host capacity again. This snapshot becomes stale as soon as source or runtime changes. The authoritative implementation sequence is in [the universal-agent plan](../superpowers/plans/2026-11-15-universal-agent-work-environment-implementation.md) and [task tracker](../../tasks/universal-agent-todo.md).
