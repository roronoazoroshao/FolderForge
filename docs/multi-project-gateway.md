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
  "scheduling": {
    "globalConcurrency": 8,
    "perProjectConcurrency": 2,
    "maxQueuedPerProject": 32,
    "maxQueuedBytes": 16777216,
    "queueTimeoutMs": 10000,
    "maxRequestsPerProject": 600,
    "maxRequestsGlobal": 1800,
    "rateWindowMs": 60000
  },
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
- Worker processes are started lazily for individually authorized projects. Each worker uses a fixed project root supplied by private startup IPC (not a CLI `--project` argument), scoped tool policy, audit, MCP sessions, task/memory state and rate limiter. Each is authenticated using a fresh private per-worker token over IPC; gateway token/cookies are not forwarded.
- The gateway rejects browser `Origin` headers, unapproved projects, symlinks, changed root identity, public binds, forged session IDs and disallowed methods. Requests have a 1 MiB default size cap; max worker count is bounded.

## Boundaries and future hardening

This MVP terminates **static bearer auth**, not OAuth federation. Existing public tunnel auth/OAuth and URL migration must be reviewed separately. Using separate processes under the **same OS UID does not provide kernel filesystem isolation**: current path/risk approval gates remain mandatory. The worker starts with safe built-in defaults, ignoring project YAML that might weaken allowed directories or approvals. Per-session tool preset isolation *within one project*, per-client role separation, OAuth termination, token rotation, durable replay and production migration remain outside F14/F15 MVP. F15 adds request admission at the gateway (not per-tool quota inside every worker). Project workers are not automatically restarted after uncertain writes.

## F15 MVP — fair request admission and bounded queues

The optional `scheduling` manifest object (shown above) controls admission **after authentication and project/session binding, before buffering the HTTP body or launching a worker**. Per-project concurrency and call rates are tracked separately, with a retained strict global abuse cap. Every setting is a positive integer with hard upper bounds and unknown keys are denied.

**Queue memory fairness:** each owner-approved project reserves an equal `maxQueuedBytes / projectCount` portion of the queued-body budget. An overactive A cannot consume the memory reserved for B. Only requests waiting in the queue are charged against this reservation; immediately runnable calls are admitted independently. Requests without a known Content-Length reserve the allowed maximum body size while waiting. The byte budget is for **queued requests**, not a total heap/process memory bound.

| Operator field | Default | Hard maximum |
| --- | ---: | ---: |
| `globalConcurrency` | 16 | 64 |
| `perProjectConcurrency` | 4 | 32 (≤ global) |
| `maxQueuedPerProject` | 512 | 1,024 |
| `maxQueuedBytes` | 16 MiB | 64 MiB |
| `queueTimeoutMs` | 15,000 | 60,000 |
| `maxRequestsPerProject` | 1,000 | 100,000 |
| `maxRequestsGlobal` | 10,000 | 100,000 |
| `rateWindowMs` | 60,000 | 3,600,000 |

Project/global quota violations return **429** (`project_rate_limited` / `global_rate_limited`); bounded queue or timeout returns **503** (`queue_full` / `queue_timeout`), with `Retry-After: 1`. The gateway does not replay non-idempotent requests. The in-process snapshot exposes active/queued/accepted/rejected totals to tests, **not** a production observability endpoint. Counters reset on restart; no per-user differentiation within one shared gateway bearer token, no distributed quota and no guaranteed production latency SLO.

**Verification:** `tests/unit/multiproject-fair-scheduler.test.ts` covers scheduling, cancellation, timeout, quotas, hard caps and fair queue bytes; `tests/unit/multiproject-gateway.test.ts` covers actual HTTP scheduling and 20 same-project conflicting calls; `tests/integration/multiproject-fair-load.test.ts` exercises 3 approved projects × 2 clients × 200 loopback calls and records measured local p95. This **does not** benchmark an active public tunnel, and no p95 target is claimed met in production.

**Rollback:** stop only the opt-in multi-project gateway; if the operator separately changed the public tunnel target, explicitly restore it under a separate authorization. Do not delete project state or replay outcome-uncertain writes.

The gateway bounds its session-affinity map to `maxSessions` (default **1,024**, hard cap **4,096**). Expired entries are reclaimed before capacity denial; excess new stateful initializations return **503** `session_capacity` rather than allocating unbounded session state. A worker exit drops its session affinity and frees capacity. Unknown/expired sessions require re-initialization; non-idempotent requests are **not automatically replayed**. Do not prune or delete a project folder as gateway rollback.

Tests:

```bash
npm run build
npx vitest run tests/unit/multiproject-gateway.test.ts tests/unit/multiproject-config.test.ts tests/unit/multiproject-fair-scheduler.test.ts tests/integration/multiproject-real-worker.test.ts tests/integration/multiproject-fair-load.test.ts
```

**Rollback:** stop only the gateway started by the operator, then restore any tunnel target via a separately approved action. Do not restart the VPS, alter owner privileges, delete credentials or rewrite the isolation registry under this MVP.

Evidence: `src/multiproject/project-gateway.ts`; `src/multiproject/project-worker.ts`; `src/multiproject/project-worker-child.ts`; `src/multiproject/cli.ts`.
