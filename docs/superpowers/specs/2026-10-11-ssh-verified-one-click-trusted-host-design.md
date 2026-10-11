# SSH-Verified One-Click Trusted Host — Architecture Design

**Date:** 2026-10-11  
**Status:** WRITTEN SPEC FOR OWNER REVIEW — NOT APPROVED FOR IMPLEMENTATION  
**Repository:** `roronoazoroshao/FolderForge`  
**Baseline:** `main@f5451760fd8364fc4109bfcda451f74a5aa833d9`, already tagged `v3.0.2`  
**Path:** Architectural change; new SSH-backed operator-session capability and Fleet profile/credential transaction  
**Release constraint:** Documentation-only proposal. Do not mutate `main`, the existing `v3.0.2` tag/Release, or npm publication. PR #83 (Vitest scope) is a separate change.

## 1. Intent, assumptions, and success criteria

**User intent (approved 2026-10-11):** On a remote workstation accessing the server's FolderForge Mission Control through SSH local port forwarding, select `Tool preset=full`, `Policy mode=danger`, `Terminal execution=trusted-host`, press **Save & Apply** once, and have FolderForge configure the Fleet instance automatically. No per-change terminal `approve` command, manual YAML, copied challenge, or repeated login prompt. For `authMode=none`, generate and install an MCP credential automatically without an additional user confirmation.

**Assumption requiring validation:** SSH login is authenticated by the user's SSH client against a known host key and the server account is the **same OS UID** as the FolderForge service. An arbitrary `ssh -L` forward by itself does **not** prove that the incoming HTTP request belongs to that SSH login. The initial session must be bootstrapped by a dedicated launcher using an authenticated SSH **remote command**, not inferred from `127.0.0.1`, HTTP headers, forwarded TCP peer addresses, a Dashboard bearer token, or a query string.

**User experience:**
1. Once per workstation session, start the **FolderForge SSH Dashboard launcher** (one ordinary SSH login, respecting SSH agent/key setup). It launches the SSH forwarding channel and opens the local browser; no host-side `approve` command or per-instance challenge entry.
2. The browser shows `SSH operator verified` and an expiry/connected indicator. Existing unverified dashboards remain usable for non-elevated operations.
3. In Fleet > Configure, choosing `full + danger + trusted-host` enables **Save & Apply**. One click stages/commits the full profile and, only when needed, an automatically generated authentication credential. Do not prompt the user for a credential or secondary confirmation.
4. If quiescent/stopped, apply immediately and display the **observed** runtime state. If active and unsafe to restart, persist an approved *pending target* and display `Saved — restart pending`; never say `Running` until verified. A later safe stop/start activates the exact target without new operator interaction.
5. Invalid/expired SSH session shows `SSH session required — reconnect using launcher` with no partial configuration. A normal `ssh -L` session does not silently acquire privileges.

**Non-goals:** anonymous host execution; bypassing hard-deny, authorization, audit, sandbox restrictions for other instances or rate limits; trust from localhost alone; privilege escalation to root or a different UID; new Cloudflare/browser-only elevation; auto-rewrite of public v3.0.2; implementing a fully generic SSH identity provider.

## 2. Current system and incompatibilities

- `packages/mission-control/src/screens/Fleet.tsx` currently sends `POST /fleet/:id/profile-intents` and polls a `pending` request, then `POST .../apply` only after independent local CLI approval; the UI explicitly tells the operator to run `folderforge operator trusted-host approve <request-id>`.
- `src/dashboard/server.ts` allows a tokenless **loopback** Control Panel to create an intent and requires same-origin checks; it does **not** permit HTTP to mint a Trusted Host grant. `src/operator/trusted-host-consent.ts` rejects `authMode=none` with `TRUSTED_HOST_AUTH_REQUIRED`.
- `src/operator/trusted-host-cli.ts` enforces interactive TTY consent. `src/operator/trusted-host-store.ts` persists scope-bound grants in owner-only state outside agent workspaces. `src/operator/trusted-host-scope.ts` binds installation, UID, instance, real project path, auth mode, revocation generation and profile tuple.
- `src/provisioner/fleet-manager.ts` enforces grant validation during start and has a two-file recovery journal for Fleet state + generated YAML. `setAuth` and `updateProfileAtomically` are presently distinct operations; combining them requires transaction design, not sequential HTTP calls.
- `src/runtime/container.ts` constructs Fleet with a host-owned startup opt-in or per-instance grant resolver. The new path must **not** set global `requireInDanger=false`.
- Previously approved `docs/superpowers/specs/2026-10-10-fleet-zero-config-trusted-host-consent-design.md` forbids HTTP self-authorization. This design adds a *separate trusted SSH-remote-exec authority*, preserving that ban for plain Dashboard/HTTP/MCP traffic. The host-local CLI remains a supported fallback.

## 3. Approaches considered and choice

| Approach | UX | Trust / risk | Decision |
| --- | --- | --- | --- |
| A. Accept `Save` from any loopback Dashboard or `ssh -L` | One click | HTTP forwarded localhost cannot attest SSH owner; any user who reaches it could obtain host execution | **Reject** |
| **B. Authenticated SSH remote-exec launcher + ephemeral operator session** | One SSH login per dashboard session, one Save per Fleet change | Host verifies real OS UID via SSH-invoked process; requires new narrow session broker and credential binding | **Choose** |
| C. Keep CLI `approve` for every tuple | Additional per-change terminal interaction | Existing and secure, but cumbersome | Keep as fallback, not preferred UX |

The user approved B as the design direction; this document specifies its concrete constraints. A generic SSH tunnel cannot be upgraded to B through JavaScript/browser heuristics.

## 4. Components, owners, and boundaries

| Component | Responsibility | Trust/source |
| --- | --- | --- |
| Desktop SSH launcher (`folderforge dashboard ssh --host <ssh-target>`; **proposed** command name) | Starts SSH with normal host-key verification and remote `folderforge operator dashboard-session serve --stdio`; owns local loopback proxy/browser bootstrap; no credential exposed in URL/logs | Trusted workstation process |
| Host operator session helper (`src/operator/ssh-session-helper.ts`; proposed) | Runs only as **SSH remote command** under authenticated Unix UID; registers session with protected host service/broker; monitors remote exec channel EOF; cannot be invoked via HTTP/MCP | SSH-authenticated Unix process, same UID as FolderForge |
| Host session registry (`src/operator/ssh-session-store.ts`; proposed) | Stores HMAC/hash of session secret, installation ID, UID, creation/expiry, revocation state, live-channel lease; protected host-only storage outside any configured workspace | Local owner-only filesystem / private broker |
| Desktop loopback bridge (launcher process) | Forwards browser to remote Dashboard and injects bootstrap proof **only** at narrowly defined exchange route; erases proof after exchange; rejects cross-origin/unexpected host | Same trusted desktop session |
| Dashboard `src/dashboard/server.ts` | Validates session cookie, CSRF, origin/fetch-metadata, exact Fleet action and route; never considers loopback/headers alone as elevated | Untrusted HTTP until authenticated |
| Trusted Host authorization service | Uses verified SSH authority to issue a scope-bound grant after Fleet + credential checks, with audit. Old CLI authority is separate and unchanged | Host-controlled broker, not ambient admin principal |
| Fleet profile/credential transaction | Under one lock, stages auth credential and exact target tuple, persists/recoverably commits or defers, prevents partial elevation or mixed YAML/metadata | Existing Fleet manager + extended journal |
| Mission Control Fleet | One-click form, live authority state, honest `saved/pending/applied` statuses, one-time credential reveal or an integrated Connect route | Untrusted presentation only |

**No authority by caller assertion:** `X-SSH-User`, `X-Forwarded-For`, `Sec-Fetch-*`, `localhost`, cookie alone, OAuth identity, signed claims supplied by the browser, or query `?token=` never prove a SSH login. The new session must originate from a host helper launched over an authenticated SSH remote exec channel; scope and session lease are validated server-side.

## 5. SSH bootstrap and operator session protocol

### 5.1 Launcher / enrollment

1. Launcher invokes installed system `ssh` with host-key checks enabled (no `StrictHostKeyChecking=no`, no automatic host-key acceptance and no agent forwarding). It starts a local TCP forward bound specifically to `127.0.0.1` on a random free port **plus** an authenticated remote command `folderforge operator dashboard-session serve --stdio`. The workstation-to-server bytes are SSH-encrypted.
2. The SSH remote command executes as its authenticated Unix user; helper checks `getuid() == FolderForge service UID` and installation identity against an **owner-only broker/state** that is not accessible via project tools. UID mismatch, unsupported platform, unsafe filesystem, agent-owned workspace overlap, or unreachable local broker all fail closed; no `sudo` or cross-UID delegation. The SSH server/OS, not the Dashboard, authenticates this principal. If running `ssh -L` only with no remote helper, no verified operator session exists.
3. Helper creates an unpredictable, single-use, at-least-256-bit bootstrap secret, stores only a keyed digest/hash in host-owned session storage, records a short expiry (≤60 seconds) and ties it to helper's live SSH channel lease. It transmits the raw secret **only through encrypted SSH stdout** to the local launcher, not through HTTP, HTML, URL, browser storage, environment command-line arguments or logs.
4. Launcher holds the secret in process memory. Its local loopback bridge restricts access to the intended local origin and supports a one-time `POST /operator/ssh-session/exchange` flow with CSRF/fetch-metadata validation. The bridge supplies the secret to the remote server only as protected internal request material. Arbitrary user-supplied request headers are stripped; no general proxy endpoint may replay the privileged header. The browser receives an HttpOnly, SameSite=Strict, host-only session cookie (no Domain, path narrow where possible) and synchronizer CSRF token. Browser code never sees SSH bootstrap secret. The exchange is single-use and atomic.
5. Dashboard verifies secret hash, install/UID, live helper lease, expiry, client session binding and configured host-only constraints before issuing a browser operator session. Secure cookie flag is required for HTTPS; for loopback HTTP, explicitly bound local origin and strict cookie protections are required. All privileged responses are `Cache-Control: no-store`.
6. The operator session is **not** a general HTTP bearer admin token. It authorizes only the exact Fleet Trusted Host action and a redacted authority-status read. Dashboard ordinary auth remains enforced for all other operations. A CSRF token is bound to the operator session; secret-less web requests cannot upgrade to this role.

### 5.2 Lifetime and revocation

- Bootstrap secret: one use, 60-second ceiling; never durable or replayable.
- Verified operator session: constrained to live SSH helper channel; server-enforced idle timeout of **15 minutes**, absolute maximum of **8 hours**, and immediate invalidation on channel EOF, explicit logout, server restart or revocation. Browser polling alone cannot keep a disconnected SSH channel alive; a new SSH login/launcher invocation is needed to re-establish.
- Each sensitive action rechecks lease liveness, server identity/UID, CSRF, session expiry, write freeze, Fleet revision and operator scope. A pending save may not be retried with a disconnected session to generate new grants.
- A **committed per-instance grant** remains durable across ordinary service/instance restarts as in the existing CLI model, until explicitly revoked or material scope changes. Terminating SSH invalidates the authority to approve **new changes**, but does not silently revoke an already authorized Fleet profile or kill processes. A revoked grant blocks future starts and follows existing verified-stop/uncertain-PID handling.
- On crash: fail closed for in-flight session/bootstrap; do not reconstruct live authority from JSON/cookie alone. Reconnect via launcher. Stale files are garbage-collected without accidentally reviving grants.
- Explicit `Revoke Trusted Host` in Fleet requires a live verified SSH session (or existing on-host CLI), never anonymous HTTP.

## 6. One-click Fleet transaction

### Proposed wire contract

- `GET /operator/ssh-session/status` → redacted `{ verified, expiresAt, hostUidMatches, source: 'ssh-remote-exec' }`. Never return session secret, raw UID or internal proof.
- `POST /fleet/:id/trusted-host/apply` → authenticated SSH operator session, CSRF, fixed JSON schema:
  `{ toolsPreset, policyMode, terminalExecution: 'trusted-host', expectedRevision, idempotencyKey }`.
  Returns `{ status: 'applied' | 'restart_pending' | 'unchanged', authChange: 'none' | 'credential_generated', runtime: { effectiveProfile, observedState }, revision }`. A credential, if generated, is offered only through a separate one-time authenticated retrieval response bound to the same verified session, with no-store and expiry; ordinary list/status endpoints never contain its value. An integrated Connect flow may consume it on the user's behalf without any extra Save confirmation.
- `GET /fleet/:id/trusted-host/status` returns redacted target, current effective profile, pending activation, grant validity and observed runtime. Plain Dashboard callers may only see non-sensitive summary; no grant-material leak.
- Existing `/profile-intents` request/CLI approval remains the fallback for non-SSH-verified sessions; the new apply endpoint must **never** accept a plain Dashboard token, generic loopback-origin request, query token, or Cloudflare/OAuth session as equivalent SSH authority.

### Transaction invariants

1. Require supported host, trusted SSH helper lease, matching OS UID, installed secure broker, valid instance/project `realpath`, authz, CSRF and rate limits; reject before any write.
2. Check existing Fleet revision (CAS), instance lifecycle and pending journals under the same existing Fleet profile lock; reject competing Save intents deterministically. Require `terminalExecution=trusted-host`, known preset/policy and bounded body.
3. If existing auth mode is `none`, generate a high-entropy `token` credential (reuse FolderForge's credential issuance policy) and stage its verification material; otherwise preserve existing `token/api-key/oauth` credential without rotation. **Never** permit trusted-host to start with effective `authMode=none`. Credential generation is not user input; showing/copying is optional, non-blocking. Do not expose credentials to LLM/MCP, audits or any unverified browser.
4. Compute the per-instance capability digest from installation ID, service UID, canonical project, Fleet instance, exact profile tuple, credential/auth-mode generation, and revocation generation. A token rotation, workspace move or materially changed tuple invalidates the previous scope and requires an authenticated Save under a fresh verified session. Preserve existing hard-deny/policy invariants.
5. Stage approval intent, credential and Fleet desired profile in a durable **journaled transaction** with a single idempotency key and hash of desired state. Neither grant nor child start may become effective before all authorization and recovery checks succeed. Journal should record `PREPARED → COMMITTED` or `ROLLED_BACK`, and recovery must distinguish `restart_pending` from `applied`.
6. If instance is stopped and there is no active tunnel/lease: commit the credential+Fleet JSON+generated YAML+grant consistently, validate exact applied contents, then start only when startup authorization is still valid. If running/active: durably store a **separate pending desired profile and scoped grant** without changing live effective settings or silently restarting; activation waits until verified quiescence or explicit Stop/Start and revalidates the authorized pending target. Do not claim a successful process restart merely from changed files.
7. Failure before commit leaves original auth and profile unchanged and does not issue usable grants. Crash recovery must not leave mixed authentication/YAML/settings; either finish a safely verifiable all-or-nothing commit or fail closed with `RECOVERY_REQUIRED`, blocking elevated starts. Temporary credential secret material is destroyed if rolled back.
8. Retries with the same idempotency key and exact scope return identical redacted status without minting another credential or grant. Keys with different payloads fail conflict. Existing approval can be reused only for identical committed scope. Changes require new SSH-authorized Save.
9. Result schema never conflates requested, persisted, child process observed state, and authorization validity.

### UX states

| State | What is displayed | What is allowed |
| --- | --- | --- |
| `SSH_VERIFIED` | `SSH operator verified`, remaining session | Save & Apply |
| `AUTH_REQUIRED` / `SSH_DISCONNECTED` | `Reconnect SSH Dashboard` with launcher guidance | No privileged write; normal settings remain usable |
| `SAVING` | One loading action; disable duplicate Submit | No contradictory independent setters |
| `APPLIED_STOPPED` | `Saved — restart/start ready` | Start when grant + auth verified |
| `APPLIED_RUNNING_VERIFIED` | `Running with Trusted Host` after observed runtime checks | Normal operations |
| `RESTART_PENDING` | `Saved — restart pending (active tasks)` | Stop when safe, no silent kill |
| `RECOVERY_REQUIRED` / `STOP_UNCERTAIN` | Prominent actionable error and observed state | Block new elevation until reconciled |
| `REVOKED` | `Trusted Host revoked` | Future starts fail closed |

UI hides the old copied `approve req_...` challenge for SSH-verified sessions but **does not** remove fallback consent for unverified/legacy sessions. No claim that clicking Save overrides OS privileges, container isolation policy of other instances, or hard-denies.

## 7. Threat model and mandatory negative cases

**Capabilities in scope:** attacker with network access to Dashboard through a tunnel, malicious website driving a browser, stolen cookie, exposed access token, replayed intent/credential, rogue secondary SSH account, crafted proxy headers, process crash, other Fleet instances, project filesystem influence, stale/restarted PIDs. Trusted workstation and SSH private key may be compromised; same-UID arbitrary code execution is outside the additional security boundary (that account already controls host execution).

**Required protections:**
- SSH host-key verification, remote-account-to-service-UID equality and server-side identity checks; no claim that forwarded localhost proves SSH principal.
- Remote helper can only create/terminate session records for its own verified OS identity through host-only protected state; *no endpoint, tool, or Dashboard JS can mint session proof*. Existing owner-only symlink/nlink/mode and workspace overlap checks apply.
- Short-lived hashed bootstrap secrets, single-use exchange, session+channel lifetime binding, anti-replay/idempotency, constant-time comparisons, no token/cookie leaks via URLs/history/referrers/logs.
- Local bridge must not provide a universal elevation header. Reject forged forwarding headers, missing/incorrect origin, cross-site methods, cookie-only POST without CSRF, alternate hostname rebinding, DNS rebinding, and unsafe forwarded Host.
- A plain `ssh -L` user, unauthenticated Dashboard and OAuth/Cloudflare/API token cannot invoke the new trusted apply endpoint. A browser visit to `127.0.0.1` is insufficient.
- A user with SSH login as a different UID cannot authorize the FolderForge service UID; no OS-level `sudo` or implicit group ACL bypass.
- Wrong Fleet instance, workspace symlink move, stale version, changed tuple, token rotation, expired lease, revocation, replay, active process, frozen writes, malformed intent, journal corruption, crash/restart and uncertain PID all fail closed without granting additional execution.
- Authenticated MCP access for the child remains mandatory. Danger mode bypasses manual approval rules, **not** hard-deny/authorization/audit/resource fencing or OS permissions. The UI must state that once host execution is enabled, approved commands run as the FolderForge service account.

**Security trade-off:** This moves the consent action from an explicit on-host TTY command to a verified **SSH-authenticated remote command** plus a browser Save gesture. It is valid only for operators who already possess OS command-execution authority as the FolderForge service UID. It does not prove physical presence and does not make a browser or SSH port forward trusted by itself. An independent adversarial review must accept this changed trust assumption before product merge.

## 8. Verification matrix / evidence gate

| Scenario | Expected result / evidence |
| --- | --- |
| Real Linux SSH launcher, correct UID, active channel | One Save persists `full + danger + trusted-host`, creates credential if missing, shows accurate runtime |
| Same-origin browser with plain `ssh -L` but no launcher | HTTP auth/loopback alone **cannot** get elevated grant |
| Browser via Cloudflare/public bind, API token, OAuth, query token | New privileged apply **403/401**; no host grant |
| Wrong SSH UID, unsafe state path, unsupported OS, missing broker | Fail closed without writing profile |
| SSH disconnect/timeout, replayed or expired bootstrap | Session invalid; old approved profile remains unchanged; new elevated saves denied |
| Cross-site request, CSRF omission, spoofed headers/DNS rebinding | Privileged write denied; no secret exposure |
| Concurrent Saves and two browser sessions | CAS/idempotency semantics; no split credential or grant |
| Existing `authMode=none` | Auto-generates authenticated mode and protected credential exactly once, never a no-auth trusted host |
| Live Fleet process with jobs/tunnel | `restart_pending`, no forceful restart or false `running` |
| Crash at each journal boundary | Recover to consistent state or block with `RECOVERY_REQUIRED` |
| Revocation, changed UID/workspace/credential/tuple | Future start denied; uncertain running PID reported truthfully |
| Legacy local CLI consent and non-trusted Fleet | Behavior unchanged |
| macOS SSH launcher | Same authority model; independent real-host platform qualification |
| Windows host | Explicit unsupported/fail closed until separately qualified |

Verification requires unit/TDD RED → GREEN, source integration tests using a fake broker **plus a genuine SSH server/client acceptance test** on Linux with a non-privileged dedicated service UID, adversarial security review, restart/crash simulations, precise-state UI inspection, and exact-head 6-job CI. A synthetic `X-SSH-User` HTTP header is **not** sufficient evidence of SSH authentication. Store redacted receipt with host UID match, SSH channel lifetime, revocation and exact SHA; never store bootstrap secrets.

## 9. Implementation boundaries, sequencing and rollout

**New, focused modules (proposed):** `src/operator/ssh-session-helper.ts`, `src/operator/ssh-session-store.ts` (or bounded broker interface); desktop launcher client; SSH bridge; operator-session middleware. Modify `src/dashboard/server.ts`, `src/operator/trusted-host-consent.ts`, `src/provisioner/fleet-manager.ts`, `src/provisioner/fleet-profile-transaction.ts`, `src/runtime/container.ts` and `packages/mission-control/src/screens/Fleet.tsx` only as required by this spec. Retain host CLI and old `/profile-intents` fallback.

**Engineering order for a separately reviewed implementation plan (not authorized by this document):**
1. Feasibility proof that an actual remote `ssh`-executed host helper can register/revoke a broker session with correct UID, detect channel exit, and pass zero secrets through the browser. **NO-GO** if this cannot be demonstrated.
2. Session protocol threat-model tests first (bootstrap replay, cookie theft, forged headers, cross-origin, wrong UID, disconnect) and minimal audited server/launcher implementation.
3. Atomic credential+profile+grant transaction with crash injection, CAS, queue-pending vs observed state semantics.
4. Fleet UI Save & Apply, credential Connect workflow and accessibility/mobile checks.
5. Independent security review, real SSH acceptance, full CI and release decisions **only after explicit owner approvals**.

**Feature gate:** Off by default while unqualified. After the SSH launcher and independent security review pass, enable One-Click only for verified launcher sessions; never silently activate it for plain `ssh -L`, generic HTTP, Cloudflare, or legacy browser sessions. No silent migration or trusted-host grants for pre-existing plain HTTP clients. Existing `v3.0.2` remains immutable; ship under a new version after separate release qualification. Emergency rollback disables **new** SSH-session grants, invalidates live elevated sessions, and preserves/reconciles existing approved Fleet grants and running PIDs honestly; do not relabel live host processes as stopped.

## 10. Acceptance and review decision

Owner should review: (a) one SSH login via a dedicated launcher is acceptable, while plain `ssh -L` remains unverified; (b) no per-instance terminal approval and no manual credential prompt; (c) OS UID equality; (d) existing trusted-host grants persist after SSH disconnect until revoked; (e) no forced restart; and (f) hard-denies, authenticated child MCP endpoints and audit remain enforced.

**Design approval authorizes writing the separate Superpowers implementation plan only.** It does not authorize product code, automatic merge, deployment, retagging `v3.0.2`, or publishing npm.
