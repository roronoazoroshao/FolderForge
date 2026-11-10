# F14 MVP — independent projects behind one MCP endpoint

**Status:** experimental, opt-in, local-only source feature on feature branch. Existing OpenAI/Cloudflare tunnel commands, default HTTP MCP and VPS services are **not** automatically changed.

## Operator manifest and activation

Create an owner-controlled absolute JSON file with mode 0600:

```json
{
  "parentRoot": "/srv/approved-projects",
  "port": 7339,
  "maxWorkers": 4,
  "maxSessions": 1024,
  "projects": [
    {"id": "frontend", "root": "/srv/approved-projects/frontend"},
    {"id": "backend", "root": "/srv/approved-projects/backend"}
  ]
}
```

The parent directory is a discovery and authorization boundary, **not a root for tools to execute in**. Project roots are independently approved, canonical directories; symlinks and root device/inode replacement are rejected. Merely finding a child folder does not grant permission or start any process.

```bash
chmod 600 /absolute/path/projects.json
# Supply FOLDERFORGE_MULTI_PROJECT_GATEWAY_TOKEN securely in the operator environment
folderforge multi-project serve --config /absolute/path/projects.json
```

The gateway binds loopback 127.0.0.1 at the configured port; requires a bearer token of at least 32 bytes (never provided in CLI argv or logs). An explicit separate owner-approved tunnel configuration change can later forward a public /mcp endpoint to the gateway. **No tunnel migration is automatic.**

## Client routing contract

- Send `Authorization: Bearer <gateway-token>` and `X-FolderForge-Project: frontend` during initial MCP POST `/mcp`, or use `/projects/frontend/mcp` under the same trusted hostname.
- The returned `Mcp-Session-Id` pins follow-up requests to the same project, even when no selection header is supplied. A different project selector with that session yields 409; unknown/expired sessions yield 404.
- With multiple authorized projects, a request lacking project identity and valid session fails closed (400), not routed to the previously selected folder. One-project mode has an explicit backward-compatible default.
- Worker processes are started lazily for individually authorized projects. Each worker has its own fixed `--project` root, scoped tool policy, audit, MCP sessions, task/memory state and rate limiter. Each is authenticated using a fresh private per-worker token over IPC; gateway token/cookies are not forwarded.
- The gateway rejects browser `Origin` headers, unapproved projects, symlinks, changed root identity, public binds, forged session IDs and disallowed methods. Requests have a 1 MiB default size cap; max worker count is bounded.

## Boundaries and future hardening

This MVP terminates **static bearer auth**, not OAuth federation. Existing public tunnel auth/OAuth and URL migration must be reviewed separately. Using separate processes under the **same OS UID does not provide kernel filesystem isolation**: current path/risk approval gates remain mandatory. The worker starts with safe built-in defaults, ignoring project YAML that might weaken allowed directories or approvals. Per-session tool preset isolation *within one project*, per-client role separation, token rotation, worker queue fairness, continuous metrics and production migration are future/other feature gates (including F15). Project workers are not automatically restarted after uncertain writes.

The gateway bounds its session-affinity map to `maxSessions` (default **1,024**, hard cap **4,096**). Expired entries are reclaimed before capacity denial; excess new stateful initializations return **503** `session_capacity` rather than allocating unbounded session state. A worker exit drops its session affinity and frees capacity. Unknown/expired sessions require re-initialization; non-idempotent requests are **not automatically replayed**. Do not prune or delete a project folder as gateway rollback.

Tests:

```bash
npm run build
npx vitest run tests/unit/multiproject-gateway.test.ts tests/unit/multiproject-config.test.ts tests/integration/multiproject-real-worker.test.ts
```

**Rollback:** stop only the gateway started by the operator, then restore any tunnel target via a separately approved action. Do not restart the VPS, alter owner privileges, delete credentials or rewrite the isolation registry under this MVP.

Evidence: `src/multiproject/project-gateway.ts`; `src/multiproject/project-worker.ts`; `src/multiproject/project-worker-child.ts`; `src/multiproject/cli.ts`.
