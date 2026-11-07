# Mission Control

Mission Control is FolderForge's local operator view for governed agent activity.
It is served by the existing dashboard process and reads the same runtime
`Container`, policy engine, audit log, durable task store, Workspace Capsule
store, process manager, isolation manager, and tool registry used by MCP calls.
It does not create a second execution path.

## What it shows

`GET /mission-control` returns one bounded, redacted snapshot containing:

- active tool calls;
- active Workspace Capsules and their principal/client/session/task binding;
- durable tasks, current step, pause state, and attached Proof Pack count;
- recent durable verification summaries and issue counts;
- pending approvals;
- FolderForge-managed processes;
- managed Git worktree isolations;
- recent governed audit activity; and
- aggregate counts for the dashboard summary.

Active-call records contain only tool metadata and argument **keys**. FolderForge
does not retain raw argument values in the active-call inventory. The inventory
is process-local and disappears when a call completes or the server restarts.

## Worktree health and safe discard in Overview

Both `GET /mission-control` and `GET /isolations` include additive observed health, separate from historical lifecycle state. The UI reports **Available**, **Worktree missing**, **Identity mismatch**, **Unable to verify**, or **Health unavailable** for older/omitted fields. Unknown or unhealthy worktrees never expose a Discard confirmation button.

The server repeats policy, approval, audit and Git identity checks even after an operator has opened a confirmation. Both already-existing `POST /isolations/:id/discard` and `POST /mission-control/isolations/:id/discard` return HTTP 409 with structured health errors on missing worktree. No second execution engine or additional mutation endpoint was introduced. A stale open dialog cannot bypass server-side rejection. See [task isolation safety](task-isolation.md).

## Write freeze

The dashboard can persist a write freeze through:

```http
POST /mission-control/write-freeze
Content-Type: application/json

{ "enabled": true }
```

A write freeze:

1. records the previous policy mode;
2. atomically writes an integrity-checked state file at
   `.folderforge/mission-control.json`;
3. changes the effective policy mode to `readonly`; and
4. restores `readonly` on restart while the persisted freeze remains active.

The state file is denied to native agent file tools. Invalid schema or a SHA-256
integrity mismatch fails startup instead of silently disabling the freeze.
Disabling the freeze restores the policy mode that was active before it was
enabled, including an explicitly selected `readonly` mode.

A write freeze does not pretend to terminate a tool call already executing. It
blocks subsequent mutations and exposes containment actions for ongoing work.

## Containment actions

During write freeze, normal agents remain fully subject to `readonly`. A
server-generated dashboard role may bypass only the baseline readonly check for
these exact actions:

- `workflow_pause`
- `workflow_cancel`
- `process_stop`
- `process_kill`
- `isolation_rollback`
- `isolation_discard`

The exception cannot be requested through tool arguments or an MCP principal.
It is attached inside the authenticated dashboard server. All other policy,
policy-as-code, approval, audit, capsule, rate-limit, and handler checks remain in
force. For example, `process_kill` and destructive isolation operations can still
require a separate approval before execution.

Workspace Capsule revocation is also available directly from the admin plane
because it only reduces authority.

## Control Panel runtime settings

The Settings screen manages an existing FolderForge instance while its dashboard
is running. The selected policy mode is stored in the integrity-checked
`.folderforge/mission-control.json` and restored at the next startup unless a
write freeze is active (which still restores `readonly`).

`GET /runtime/settings` returns the effective terminal timeout, output budget,
environment redaction policy, and sandbox/containment requirement, without
revealing secrets. `POST /runtime/settings` accepts **only**:

```json
{ "defaultTimeoutMs": 30000, "maxOutputBytes": 65536 }
```

Timeout is limited to 1,000–1,800,000 milliseconds and output to
1,024–2,000,000 bytes. Changes apply to new terminal commands and survive
restarts in `.folderforge/runtime-settings.json`, atomically written with 0600
permissions and validated on load. Malformed data fails closed; dashboard
write freeze blocks updates.

The sandbox engine and danger containment requirement are **read-only** in this
web endpoint. Configuring a Docker/Podman image or opting into unsandboxed host
execution remains an explicit local server configuration action followed by a
restart. Dashboard tokens are required on non-loopback deployments; existing
blocked-command, workspace, audit, and rate-limit controls are unchanged.

## Configuration inventory (read-only D1)

The Settings screen also shows a minimal allowlisted **Configuration inventory**.
`GET /operator/config` reports a bounded set of live parent-process
`shell_exec` rate-limit values (`dailyQuota`, `maxCalls`, `windowMs`) and
whether rate limiting is enabled. The response uses the ordinary dashboard
authentication boundary and includes a scope, source status, apply category,
and an explicit editing blocker for each item. It never serializes raw YAML,
workspace roots, tokens, authentication credentials, or host consent data.

All inventory fields are **read-only** in this phase: `POST /operator/config`
does not exist, and the Settings UI cannot change the daily quota. The
source is displayed as **unknown** until configuration precedence can be
proven; `desired` is unset rather than fabricated. Rate-limit counters are
still **in-memory per process**, and restarts do not preserve their usage.
The separate, revisioned quota editor in the
[Configuration Hub implementation plan](superpowers/plans/2026-11-01-mission-control-config-hub.md)
requires additional persistence, authorization, audit, and rollback tests.

## Operator endpoints

| Endpoint | Behavior |
| --- | --- |
| `GET /mission-control` | Read the redacted operator snapshot. |
| `POST /mission-control/write-freeze` | Enable or disable persistent write freeze. |
| `POST /mission-control/tasks/:id/pause` | Pause a non-terminal owned/admin-visible task. |
| `POST /mission-control/tasks/:id/cancel` | Cancel a non-terminal task. |
| `POST /mission-control/processes/:id/stop` | Stop a FolderForge-managed process. |
| `POST /mission-control/processes/:id/kill` | Force-kill a FolderForge-managed process after policy/approval. |
| `POST /mission-control/capsules/:id/revoke` | Revoke an active Workspace Capsule. |
| `POST /mission-control/isolations/:id/rollback` | Roll back an exactly matching applied isolation. |
| `POST /mission-control/isolations/:id/discard` | Remove an eligible recovery worktree and branch. |

Mission Control cannot stop arbitrary operating-system processes. Process actions
are limited to sessions created and tracked by `ProcessManager`. Isolation actions
retain all byte-level drift, patch-integrity, state, symlink, and worktree checks.

## Authentication boundary

The dashboard is an admin control plane:

- loopback binding is trusted as same-machine access;
- non-loopback binding requires a dashboard bearer token;
- the dashboard creates a distinct operator-action principal for governed tool
  calls; and
- agent MCP clients cannot assign the internal Mission Control operator role.

A remote multi-tenant operator console or relay is not implemented by this
feature. Mission Control is locally verified only.

## Reproducible verification

```bash
npx vitest run tests/unit/mission-control.test.ts
npx vitest run tests/unit/tool-control.test.ts
npx vitest run tests/integration/dashboard-admin.test.ts
npm run verify
```

The tests cover restart persistence, prior-mode restoration, state tampering,
exact containment allowlisting, agent denial, active-call value redaction,
write-freeze mutation blocking, and a live dashboard stop-process flow.

## First-run Overview

When no Fleet is provisioned, **Overview** shows a single **Set up AI
access** link to Fleet. This is navigation only: it never starts a process,
grants host execution, selects additional filesystem roots, or creates
credentials. Once Fleet reports at least one instance, the onboarding prompt
disappears. If Fleet cannot load, Overview does not claim that no instance
exists. The signed owner session remains mandatory before enabling AI host
execution; a VS Code extension is not required.

## First-run AI Fleet: one clear action

Open the authenticated (signed) Dashboard link and go to **Fleet**.
For first-time setup, the server selects its already-allowed project folder:
the quick-start panel shows **AI workspace** and the selected folder rather
than asking for a Unix path or a Browse dialog up front. Choose
**Create & Start AI Fleet** to request an authenticated MCP Fleet with its
scoped permissions. Use **Change folder** only when the suggested workspace
is not the intended one; the normal folder input and Browse remain available
then. If the server cannot determine a permitted default, the manual
selector opens automatically. Selecting a path never expands allowed roots.

The signed owner Dashboard link (or a genuinely verified SSH owner session)
is still required for host-enabled Fleet creation. An anonymous localhost
tab forwarded by VS Code does not gain owner authority, even if it can
see the selected project folder. No VS Code extension is required.

## Fleet terminal execution profiles

Fleet > Provision and Fleet > Configure now expose two terminal execution profiles:

- `sandbox-required` — danger-mode shell execution fails closed unless a
  container sandbox is configured for that instance.
- `trusted-host` — the MCP server executes shell commands with its host OS
  user's permissions in danger mode, without a Docker/Podman boundary.

**Host-operator authorization is mandatory.** Two paths are distinct:

- **macOS/Linux per-instance zero-YAML consent (requires host qualification):** in Fleet > Configure select `full`, `danger` and `trusted-host`, then choose **Save changes**. An authenticated Dashboard creates an immutable pending intent, but cannot grant host execution. On the Linux server or Mac running the FolderForge parent, the OS-account owner runs the exact displayed command, e.g. `folderforge operator trusted-host approve req_<request-id>`, then types `APPROVE flt_<instance-id>` into an interactive terminal. The Dashboard polls for the matching grant and applies the exact three-setting tuple through a journaled transaction. Do **not** hand-edit Fleet YAML. A Dashboard Bearer token is required when Dashboard credential authentication is configured; a tokenless loopback-only Control Panel may stage an intent without an extra login, but can never approve or apply it without the independent on-host consent. A `?token=` query parameter alone cannot authenticate an operator on a credential-protected Dashboard. Saved settings on a running child are **not yet the active process profile**; stop/start only when safe.
- **Legacy explicit startup opt-in:** the host owner can still use parent `terminal.sandbox.mode: process` and `terminal.sandbox.requireInDanger: false`; this backward-compatible global setting is not silently changed by the new UI.

The Fleet instance must have authenticated MCP access (`authMode` cannot be `none`). Revoking a scoped grant through `folderforge operator trusted-host revoke req_<request-id>` prevents **future** elevated starts immediately. On macOS and Linux, the running parent periodically reconciles local revocations and initiates supervised termination of matching running children. The process is **not** reported as stopped until its PID is verified absent; if it survives, Fleet shows `REVOKED_EXECUTION_UNCERTAIN` and operator intervention may be required. This is not instantaneous process termination at CLI approval time. The capability's scope hash is never exposed in a Dashboard URL or printed as a bearer secret. Same-UID malicious processes and physical-presence assurance are **outside** this feature's security guarantee; hosted macOS CI primitive tests do not replace real macOS acceptance or APFS crash-durability qualification. Generated 0600 credentials, audit, hard-denies and OS file permissions remain enforced.

This option does **not** remove the command deny list, OS file permissions,
workspace authorization for native tools, audit, or rate limits. It also does
not configure separately launched third-party MCP/plugin runtimes or the
OpenAI Tunnel supervisor. Secure those runtimes independently. Avoid exposing a
trusted-host instance without strong authentication.

#### Fleet Trusted Host recovery, rollback and qualification checklist

To request a per-instance profile change, choose **Fleet → Configure**,
select the intended tool preset, policy mode and Trusted Host execution, and
press **Save changes once**. The Dashboard creates a time-limited intent and
shows `Awaiting local operator`; **the running instance is still unchanged**.
Copy the exact command shown and run it yourself from an interactive terminal
on the Linux or macOS host that runs the FolderForge parent. Verify the instance,
workspace, OS account, installation and exact tuple before typing the
requested confirmation. No YAML editing or global privilege flag is needed.
Never paste the local command into a remote untrusted execution session.

Authenticated operators may inspect the redacted effective profile and grant state via `GET /fleet/:id/execution-authority`; this Bearer-and-Origin-protected route has no mutation or approval capability.

If the intent expires, cancel or create a new request. If authorization
succeeds, the Dashboard persists the exact tuple with a journal and reports
that the **runtime remains unchanged** until a safe stop/start. A running
child with an active tunnel or uncertain task cannot be silently restarted.
After revocation, future elevated starts fail. If termination is not verified
the UI should report `REVOKED_EXECUTION_UNCERTAIN`; stop and inspect the
machine rather than treating the instance as stopped. Rollback to
`sandbox-required` must preserve credentials and keep the runtime contained.

Qualification evidence, before any merge/release of this feature:
- **PASS (native Linux fixtures):** owner/permission/replay tests, multi-file
  journal recovery fault injection, scoped Dashboard auth/CSRF negatives,
  bypass prevention, real Chromium single-intent Save.
- **NOT_RUN until independently documented:** human interactive approval by
  the owner on a real macOS host, actual parent/child launch and revocation
  observation, APFS crash/power-loss recovery test with two-file journal.
  GitHub-hosted macOS directory `fsync` tests establish only primitives.
- **Linux rollout:** the default owner-only state is `/var/tmp/folderforge-operator-consent-<UID>`.
  `/var/tmp` must be a root-owned sticky writable directory; otherwise the feature
  fails closed. The state root is private (0700) and must be outside every agent
  workspace, including deployments governing the user's entire home directory.
  A tmpfiles cleanup that removes the state invalidates prior grants; fresh
  local consent is then required. With `systemd PrivateTmp`, CLI and server may
  see different `/var/tmp` mounts; do not treat a missing intent as approval.
  Real interactive owner verification and Linux filesystem/restart qualification
  remain **NOT_RUN** until documented on the target server.
- **UNSUPPORTED / fail-closed:** Windows operator grants.

These statuses describe verification requirements, **not a claim of release
readiness or of host-level physical-presence authentication**.
