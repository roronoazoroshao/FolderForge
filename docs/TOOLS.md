# Tool, API and MCP surface — permissions and contracts

Audit baseline `main@8c00b15` (2026-11-10). This is a source snapshot, **not a promise that every tool is active or reachable**.

## Full enumerated catalogs

- **[Native MCP Tool Catalog](audit/TOOL_CATALOG.md): 359 individually named tools**, each with actual top-level JSON-schema inputs, required properties, result schema indicator, read/write classification, base risk, agent/admin audience, and exact definition `path:line`. Breakdown: 119 LOW, 117 MEDIUM, 110 HIGH, 13 CRITICAL; 334 agent-facing and 25 admin-only. Counted by evaluating the 28 compiled factory functions under `src/tools/*-tools.ts`, checked against unique names; `src/tools/index.ts:42-83` wires the tool groups. Client presets expose only subsets (`src/tools/index.ts:164-209`).
- **[HTTP Route Catalog](audit/HTTP_ROUTE_CATALOG.md): 49 literal route-condition rows + 22 parameterized match declarations**, linked to the actual `src/dashboard/server.ts:936-3024` handlers. Not an official OpenAPI export: **[UNVERIFIED]** exhaustive runtime route count. Typed per-route request/response schemas should be generated in a future feature.
- **[Source environment catalog](audit/ENV_REFERENCE.md)** and [configuration](CONFIGURATION.md).
- Dynamic child MCP tools are **not** bounded by the 359 tally. Adapter direct/facade schemas are discovered when connected (`src/tools/adapter-tools.ts:38-50,82-118,121-126`); adaptive `tool_manifest` and `call_runtime_tool` are additional gateway tools (`src/tools/adaptive-surface.ts:5-22`).

## MCP and control-plane protocols

| Surface | Path, I/O and visibility | Permissions / risk | Evidence |
|---|---|---|---|
| Stdio MCP | JSON-RPC tool discovery/call, local process stdin/out | Caller process OS privileges; tool policy still applies | `src/main.ts:14-17`; `src/server/mcp-server.ts:122` |
| HTTP MCP | Configured MCP path, JSON-RPC GET/POST/DELETE | Per-mode token, API key or OAuth, safe Origin/CORS, tool policy | `src/server/transports/http.ts:67-149,595-715` |
| OAuth metadata | Protected-resource discovery | Public discovery is not a mutation grant | `src/server/transports/http.ts:636-650` |
| Responses-compatible | `GET /v1/models`, `POST /v1/responses`, `GET /v1/responses/{id}` and handler-specific cancellation | HTTP auth, workflow and response-store controls; no implied model API subscription | `src/openai/responses-http.ts:97-134` |
| Dashboard SPA | `/app/`; UI routes to REST | Signed owner credential/SSH proof for privileged host flows; anonymous forwarding not authority | `src/dashboard/server.ts:950-1028,1240-1249` |
| Fleet and host operator | `/fleet`, `/fleet/quickstart`, `/fleet/:id/one-click-trusted-host`, profile intents, auth/tunnel controls | Explicit signed owner/verified SSH, same-origin checks, scoped grant, audit | `src/dashboard/server.ts:950-1028,1789-1921,2556-2765` |
| Isolation | `/isolations`, `/isolations/:id/{status,diff,apply,rollback,discard,reconcile,...}` depending handler | Governed mutation; reconcile/restore **fail closed** absent external kernel writer fence | `src/dashboard/server.ts:2504-2556`; `src/isolation/worktree-manager.ts:1289-1294` |
| Configuration | `GET /operator/config`, `GET /operator/config/quota`, `POST /operator/config/validate` or `apply` | Read allowlist; write bounded parent `shell_exec` quota only; owner signed auth, freeze, revision and audit | `src/dashboard/server.ts:2899-2972`; `src/operator/rate-limit-settings.ts:184-225` |
| Operational controls | `/status`, `/audit`, `/runtime/settings`, `/policy/mode`, `/mission-control/write-freeze` | Distinct read vs owner mutation handlers, not universally anonymous | `src/dashboard/server.ts:1346-1374,1701-1725,2491,2975-3040` |
| Child integrations | Serena, Playwright, Desktop Commander, Godot | Adapter existence, child schema and bounded risk policy; no auto-trust | `src/runtime/config.ts:274-279`; `src/tools/adapter-tools.ts:38-50` |
| Extension | VS Code Remote-SSH owner verification optional | Verified SSH broker and consent; not required for signed Dashboard owner flow | `src/operator/trusted-host-consent.ts:46-76`; `README.md:53-57` |

## Tool execution invariants

1. Tool metadata: `name`, `group`, `mutates`, `risk`, `audience`, `inputSchema` and optional `outputSchema` (`src/tools/registry.ts:64-101`). Read-only hints are metadata, **not** a permission grant (`src/tools/registry.ts:25-51`).
2. Agent-facing list excludes admin audience even if the internal registry holds admin tools (`src/tools/registry.ts:262-275`).
3. Invocation must pass principal, rate limit, policy decision/approval and audit (`src/tools/registry.ts:529-600`). High/critical tool annotations are not automatically sufficient consent.
4. Adaptive and facade dispatchers must classify **target** sub-operation before governance; avoid bypass by name substitution (`src/tools/adaptive-surface.ts:9-17`; `src/tools/adapter-tools.ts:29-35,121-126`).
5. Request validation is **tool-specific**, not all schemas are complete OpenAPI documents. Use the cited source and tests before issuing high-risk parameters.

## Risk/authorization guidance

| Category | Default policy stance | Human checkpoint |
|---|---|---|
| Read/search/status | Least-privileged scoped read | No new approval for known safe workspace |
| Workspace edits, process/package/DB | Bounded project scope, classified risk, audit | Explicit operator approval for destructive/external |
| Git publish, release, credential change, public tunnel | External side effects and high/critical risk | Human must review exact target, secret scope and irreversible result |
| Agent-generated commands/child MCP tools | Untrusted plan/data; never give arbitrary OS root | Tool-specific policy gate and owner consent |
| Registry reconcile/restore | **Hard disabled in production** absent trusted host writer fence | Qualified reviewer + host migration evidence + explicit activation |

Source for default policy and blocked commands: `src/runtime/config.ts:13-27,216-229`. Actual decisions may differ with project YAML, principal, environment and dynamic classification.
