# One tunnel, many child workspaces — concurrency and isolation audit

**Snapshot:** `main@8c00b15ff7d34dedfd8f50e46066ad0a3defc23c`, source audit 2026-11-10. No real public tunnel, production traffic, credentials, request payloads, or live process were inspected. This is a **design-level confirmed shared-state weakness** plus **[UNVERIFIED]** real-world impact/performance. The 11 existing targeted multi-project/MCP protocol tests passed; they are not a concurrent different-workspace guarantee.

## User scenario and boundary

```text
Public tunnel / MCP endpoint
    └── ONE local MCP process (OpenAI secure tunnel spawns one --project root
         and forwards to a single http://127.0.0.1:<port>/mcp origin)
          ├── client A: root/services/frontend
          ├── client B: root/services/backend
          └── client C: root/tools/worker
                      |
          shared Container, WorkspaceManager.current, ToolRegistry.activeSet,
          RateLimiter tool bucket, defaultProject-backed workflow/task storage
```

**Evidence:** `src/chatgpt/openai-tunnel.ts:1245-1304,1719-1739,1829-1837,1888-1895`; `src/runtime/container.ts:85-109,127-162`. Cloudflare's independently supervised named tunnel is also a **transport**, not automatic per-child request routing (`src/control/tunnel.ts:48-54,103-113`). This concern applies to either public tunnel provider when both forward to the same local MCP process.

**Confirmed product input (owner, 2026-11-10): these child folders are independent projects, not monorepo packages.** This does **not** prove each project has its own `.git` or `package.json`. Markers are non-authoritative hints (`src/workspace/project-detector.ts:49-83`). Only individually owner-approved canonical roots are valid; the router must not grant all scanned subfolders.

## Confirmed source mechanisms

| ID | Source-level mechanism | Consequence / evidence threshold |
|---|---|---|
| TW-01 | `WorkspaceManager` maintains a single mutable `current: string` and both `activate`/`setCurrent` overwrite it (`src/workspace/workspace-manager.ts:30-33,64-88,91-102`). The agent-facing `workspace_switch` mutates that shared pointer (`src/tools/workspace-tools.ts:40-60`). | Interleaved *multi-step* A→B→A sequences can run A's later **pathless** command against B's current workspace. This is a logical consequence of shared state; no production miswrite has been observed. |
| TW-02 | `runPipeline` reads `container.projectRoot()` for capsule check / active-call display, then again for handler context (`src/tools/registry.ts:481-485,509-518,623-633`). `git_status` and `shell_exec` use `ctx.projectRoot` (`src/tools/git-tools.ts:6-7,13-20`; `src/tools/terminal-tools.ts:27-46`). | One call receives a captured root at handler invocation; **a series of calls within one user request is not pinned to a workspace**. Do not claim an automatic intra-handler race for every tool. |
| TW-03 | HTTP MCP sessions store `principalId`, `sessionId`, transport, request count, TTL; no immutable workspace ID (`src/server/transports/http.ts:317-359,435-445`). Server principal `projectId` derives from whatever was active when its MCP server was created (`src/main.ts:863-870,980-987`; `src/core/principal.ts:47-60`). | Session identity is not the same as workspace identity; traces/approval scope can become inconsistent with dynamically selected workspaces. Further end-to-end security testing needed. |
| TW-04 | `ToolRegistry.activeSet` is a process-global set (`src/tools/registry.ts:147-153,227-231`); `workspace_route` calls `registry.setActive` (`src/tools/workspace-tools.ts:149-195`). Its name means **tool preset selection**, *not child-folder routing*. | One client can change visible tool catalog for another (`src/server/mcp-server.ts:251-270`). Need session-specific catalog view and backward-compatible deprecation plan. |
| TW-05 | `RateLimiter` buckets are keyed solely by tool name and allocated per process (`src/policy/rate-limiter.ts:22-39,56-62`); tool registry invokes `hit(name)` (`src/tools/registry.ts:598-620`). | Heavy traffic to child A consumes child B's shared quota. **Measured p95 slowdown is [UNVERIFIED]**, but cross-workspace quota coupling is source-confirmed. |
| TW-06 | Managers including agent loops, workflows, artifacts, Fleet and task records are constructed from `config.workspace.defaultProject` (`src/runtime/container.ts:89-109,127-162`; `src/server/mcp-task-manager.ts:82-92`). Memory stores themselves are per activated root, but read/write tools select the shared *current* one (`src/workspace/workspace-manager.ts:144-155`; `src/tools/memory-tools.ts:4-52`). | Do not assume every piece of state is per-child; explicitly classify shared host metadata versus project-local state, and bind authorization/namespace accordingly. |
| TW-07 | Existing `tests/integration/multi-project.test.ts:29-77` verifies sequential activation, switch, rejection and separate memory instances. `docs/mcp-session-reliability.md:8-17` verifies session ownership, not per-child routing. | **No existing dedicated interleaved multi-session, multi-child race test was located** by targeted `rg`; [UNVERIFIED] whether an unsearched test covers every path. |
| TW-08 | Activating a new child creates a new `MemoryStore` (`src/workspace/workspace-manager.ts:72-78`), and its constructor creates `.folderforge/memory` and may write `.folderforge/.gitignore` (`src/workspace/memory-store.ts:12-20,29-36`). | Naively pre-activating every child folder creates persistent state and filesystem work. A future router must distinguish **read-only child discovery** from approved activation and bound worker lifecycle. |

### Reproduced baseline evidence

```text
npx vitest run tests/integration/multi-project.test.ts \
  tests/integration/mcp-modern-core.test.ts --maxWorkers=2
Test Files: 2 passed; Tests: 11 passed / 0 failed
```

These tests validate current behavior; they do **not** measure tunnel throughput or prove tenant isolation. The source uses mutable process state, but this audit **did not perform an unsafe request-swap or write test against the running host**.

A **non-mutating in-memory quota probe** invoked the built `RateLimiter` directly with a one-call/60-second rule and two simulated child requests to the same `file_read` tool: **first allowed = true, second allowed = false**, reason `Rate limit: file_read allows 1 calls per 60000ms.`. This verifies the one-bucket code path (`src/policy/rate-limiter.ts:34-35,56-62,75-82`), **not** a measured production slowdown or a multi-child HTTP benchmark.

## Target: one public endpoint, isolated per-request context (F14)

```text
Tunnel (unchanged URL / credential contract)
  -> MCP authentication and session identity
    -> ProjectRouter: explicit, ACL-authorized workspaceId -> canonical root
       (no path inferred from natural language; no arbitrary folder discovery grant)
       -> immutable RequestContext:
          principalId + sessionId + workspaceId + rootIdentity +
          policy/capsule scope + rate-limit identity + deadline/operationId
          -> policy + quota + audit against SAME immutable context
          -> governed tool handler / per-project memory and task namespace
             -> result and audit linked to stable workspace identity
```

**Failure semantics:** Missing workspace ID with multiple eligible children -> **ambiguous target / fail closed**; an authenticated client may deliberately select/pin a workspace in a governed session, but another client must not change that binding. Validate canonical realpath/allowed roots and symlink/ancestor identity, owner scope, read/write OAuth grants, restart/session expiry, unauthorized/removed child and session replay.

Design choices and trade-offs:
- **Preferred initial safety boundary for independent projects:** one authenticated public tunnel → trusted workspace/session router → **one bounded MCP worker lazily started per explicitly owner-approved project**. The common parent is for discovery/configuration, **not** execution. Each child worker has a fixed `--project`, task/workflow/memory storage, tool catalog and rate counters. Costs: RAM, private ports/sockets, worker health/restart logic. **Same-UID processes separate in-memory state but do not constitute OS-level filesystem isolation**; path-policy, scopes and optionally distinct UIDs/sandbox still matter. Current tunnel command does not provide this dispatcher.
- **Optional lower-memory optimization:** one shared MCP process with immutable per-request `workspaceId` and per-project state namespaces. Requires refactoring every pathless tool, memory/task service and global tool catalog before it is security-equivalent; do not ship a quick `current` toggle as a replacement.
- **Temporary operating policy:** avoid concurrent clients using `workspace_switch` or `workspace_route` against the **same** server; dedicate MCP processes to distinct child projects for writes. Explicit absolute file paths reduce ambiguity only for certain tools and **do not** fix pathless git/memory calls or global quotas. Do not restart a live tunnel/host without owner approval.

## Target: fair throughput and bounded scheduling (F15)

- Global backpressure limits requests and memory footprint, plus per-workspace/principal/token **fair queuing**. Reads may be parallel within policy; conflicting writes to the same canonical project/resource are serialized with locks/epochs; different projects need not block one another unnecessarily.
- Move from **tool-only** rate counters to composite keys including authenticated principal + workspace ID + tool, retaining a separate strict global abuse cap.
- Per-request deadline, cancellation, idempotency/operationId and disconnection lifecycle; avoid unbounded queueing or automatic retry on uncertain writes (`src/server/mcp-server.ts:397-468`; `docs/mcp-session-reliability.md:28-55`).
- Redacted metrics: active/inflight/queued/rejected per workspace, p50/p95/p99, fairness, queue wait and timeouts. No raw secrets, child folder contents or owner tokens in traces.
- Compare before/after with fixed machines/workloads, e.g. 3 independent child projects × 2 clients × 200 read/tool calls, plus 20 same-project write conflicts. **Proposed** targets (not observed): 0 cross-root operations, 0 starvation within 30s under declared SLO, >=99% admitted safe reads terminate in time budget, p95 ≤1.5× isolated baseline for noncontending operations; fixed global/per-project queue capacities.

## Acceptance / QA matrix for F14 and F15

| Case | Expected |
|---|---|
| A pinned to childA, B selects childB; interleave 100+ pathless read/status calls | A always sees childA and B childB; no global `current` mutation influencing other session |
| Two clients request different `workspace_route` presets | Each gets own visible catalog; unauthorized tool remains governed/denied |
| Two clients use per-project memory tools | Zero cross-project read/write; no unconsented memory persistence; state remains after restart |
| Root symlink or child rename between authorization/execution | Fail closed on identity mismatch, no wrong-folder write |
| A floods `shell_exec` and B performs allowed safe reads | Per-principal/child quota and fairness; B not starved; global abuse limit retained |
| Same-project concurrent write, HTTP disconnect, replay | No duplicate mutation; locking, audit and outcome-uncertain semantics preserved |
| Independent child roots discovered but not individually owner-authorized | No automatic exposure, no automatic `.folderforge` directory creation and no ability to switch |
| HTTP session IDs for two principals, restart, TTL expiry | Workspace binding/auth revalidated; no stale session cross-project handoff |
| Child count 1, existing clients use legacy pathless tooling | Explicit documented backward-compatible default without broadening permissions |
| Child count >1, pathless target unspecified | Clear ambiguous target error; not silent fallback to last globally selected folder |

**Rollout:** feature-flagged shadow routing with read-only traces; explicit owner approval before data migrations/host restart; staged canary; no real registry writer activation without separate F10 security gate. Only after tests pass can product/UX promise “one tunnel for many independent child projects”.

## Business/cost considerations
- Do not multiply tunnels for every folder until need is established; process-per-project is a security fallback, not necessarily the cheapest approach.
- Additional per-project containers and sessions increase memory/FDs. Bound the cache and task lifetimes. Control-plane scheduler fairness may be more important than raw HTTP concurrency.
- User-provided sample request IDs, desired workspace mapping and latency trace are needed to **quantify** the reported poor performance, but they are not required to identify the architecture gap.
