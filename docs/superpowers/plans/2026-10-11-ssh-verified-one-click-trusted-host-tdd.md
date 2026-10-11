# SSH-Verified One-Click Trusted Host Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An operator who starts Mission Control through a verified SSH remote-exec launcher can set a Fleet instance to `full + danger + trusted-host` with one **Save & Apply**, without a second terminal prompt, while preserving authenticated child MCP, host scope, hard-denies, audit, revocation, and crash recovery.

**Architecture:** Build a host-UID-verified SSH remote-exec session broker plus a workstation loopback launcher/bridge; no ordinary forwarded HTTP request can mint a grant. Add a session-scoped privileged Fleet apply boundary and a journaled credential + Fleet profile + consent transaction; keep the current local CLI as fallback and report actual runtime separately from desired profile. The very first task is a real SSH feasibility/NO-GO gate, not a mocked security proof.

**Tech Stack:** Node.js ≥22, TypeScript ESM, existing `src/main.ts` CLI and Dashboard HTTP server, Unix SSH client/server, Node `crypto`/`fs`/`net`/`child_process`, current FleetManager/TrustedHostStore/FleetProfileTransaction, React/Vite Mission Control, Vitest, real Linux sshd acceptance, GitHub Ubuntu/macOS/Windows x Node 22/24 CI.

**Spec:** `docs/superpowers/specs/2026-10-11-ssh-verified-one-click-trusted-host-design.md` (owner approved written spec in PR #84 on 2026-10-11; PR currently open). Review both the spec and this plan before coding. Original host-local consent spec remains valid for the legacy fallback.

**Dependencies:** Execute from a separate product branch only **after this plan is explicitly approved** and the user chooses Native or Subagent-driven execution. PR #84 contains the approved written spec; this plan PR must be stacked on the spec branch and must NOT merge automatically. PR #83 is a separate Vitest issue, not an implementation prerequisite. Do not modify npm tag/Release `v3.0.2` or publish artifacts.

## Global Constraints

- `ssh -L` alone, `127.0.0.1`, `Host`/`Origin`, browser/local-storage/cookies alone, Dashboard Bearer/API key, OAuth, Cloudflare and arbitrary HTTP headers **never prove the SSH operator's identity**. Only an authenticated **SSH remote command** under the service OS UID creates authority.
- No `sudo`, privilege escalation across OS UIDs, forwarding of SSH agent, disabling SSH host-key validation, URL bootstrap tokens, long-lived browser secrets, logging credentials, or host confirmation bypass via ordinary HTTP/MCP.
- One ordinary SSH login through the launcher per session; no per-instance `folderforge operator trusted-host approve` command, no manual YAML or manually typed child token.
- Bootstrap secret ≥256 bits and one use with TTL ≤60 seconds; session idle TTL 15 minutes, absolute TTL 8 hours, and live-channel invalidation on SSH helper EOF, logout, revocation and server restart. Session never grants ambient root/general HTTP admin privileges.
- Authenticated child MCP required. If `authMode=none`, generate high-entropy `token` and stage it in the **same recoverable transaction** as desired Fleet tuple and scoped Trusted Host grant; never serve effective trusted-host with no auth.
- Bind grants to installation ID, service UID, Fleet instance, canonical workspace, child auth mode/credential generation, entire exact profile tuple and revocation generation. Apply/start/auto-restart must recheck scope. Do not globally set `terminal.sandbox.requireInDanger=false`.
- Scope and consent files are host-owned, mode 0700 directories/0600 files, outside configured agent workspaces; handle symlink/hard-link/race/unsafe parent fail-closed. Legacy on-host CLI continues to function.
- No automatic killing/restarting active Fleet child/tunnel/task/orphan. Distinguish desired/persisted and observed runtime; `restart_pending` is not `running`. Corrupt/incomplete journal blocks elevated starts (`RECOVERY_REQUIRED`).
- Maintain existing hard-denies, filesystem boundary, policy authorization, audit, rate limiting, token/CSRF rules, write freeze and PID/revocation fencing.
- On Linux prove with a **real authenticated OpenSSH client+server and separate UID negative test**, not merely mocked transport or fabricated `X-SSH-User`. macOS acceptance requires actual host testing; Windows host remains unsupported/fail-closed.
- Preserve existing synchronous FleetManager APIs unless this specific plan declares a new method; use bounded cross-process locking and durable journal checks. No unrelated refactor or dependency addition unless proven necessary and separately reviewed.
- Every task must run **RED → GREEN** test, relevant regressions, commit exact files, and pass a review gate. End with `npm run verify`, `npm run build`, `npm run docs:check`, HTTP/stdio/package smokes, full 6-job CI, independent security review and a verified real-SSH acceptance transcript. **NOT_RUN** is never reported PASS.

## File and interface map

| Responsibility | Files (new versus existing) | Contract |
| --- | --- | --- |
| Launcher + local bridge (workstation) | Create `src/operator/ssh-dashboard-launcher.ts`, `src/operator/ssh-local-bridge.ts`; modify `src/main.ts` | `executeSshDashboardCli(args: string[], deps: LauncherDeps): Promise<number>`; bind loopback only; start one SSH remote-exec channel and SSH port-forward, never run an unsafe shell command |
| Real remote-exec helper (server) | Create `src/operator/ssh-session-helper.ts`; dispatch in `src/main.ts` | `runSshDashboardHelper(io: SshHelperIO, broker: SshSessionBroker): Promise<void>`; UID match + verified lease + bounded stdout protocol |
| Session broker / storage | Create `src/operator/ssh-session-store.ts`, `src/operator/ssh-session-broker.ts`; modify `src/runtime/container.ts` | `SshSessionBroker.openFromHost(uid, lease): Bootstrap`, `exchange(secret, lease): OperatorSession`, `assertLive(sessionId, csrf): SshOperatorAuthority` and `revokeLease(lease)`; secret not persisted raw |
| Session routes / cookies | Create `src/dashboard/ssh-operator-session.ts`; modify `src/dashboard/server.ts` | `POST /operator/ssh-session/exchange`, `GET /operator/ssh-session/status`, logout; attach authority only after broker+origin+CSRF checks |
| Grant via verified SSH authority | Modify `src/operator/trusted-host-consent.ts`, `src/operator/trusted-host-scope.ts`, `src/operator/trusted-host-store.ts` | `authorizeSshApply(instanceId, tuple, authority): ScopedAuthorization`; no HTTP-mintable token; preserve CLI intents and revocation |
| Fleet apply, credentials and journal | Modify `src/provisioner/fleet-profile-transaction.ts`, `src/provisioner/fleet-manager.ts` | `applyTrustedHostFromSsh(id, input, authorization): TrustedHostApplyResult`; all-or-nothing recovery; idempotent |
| One-click route | Modify `src/dashboard/server.ts` | `POST /fleet/:id/trusted-host/apply`, `GET /fleet/:id/trusted-host/status`; strict revision/idempotency/CSRF; one-time credential retrieval scoped to SSH session |
| React Fleet experience | Modify `packages/mission-control/src/screens/Fleet.tsx` and existing API types where defined | Status banner + one Save & Apply; no copied local CLI request for verified SSH; honest pending/active states |
| Tests and operator docs | Create unit/integration and genuine SSH acceptance tests in `tests/`; update relevant operator docs only after GREEN | Repeatable negative cases and evidence recording; no dangerous test outside disposable sandbox |

## Review Focus

Five easily overlooked user inputs / failures; each must have an explicit failing test in its owning task:

1. **Plain `ssh -L` or forged loopback request**: no verified session, no trusted-host grant. Task 2, Task 5, Task 8.
2. **SSH helper dies after cookie creation, or browser Save races disconnect**: deny new grants immediately, leave already committed grants intact. Task 3, Task 5, Task 8.
3. **`authMode=none` on a running child with active tunnel**: generate a credential **only** as a pending target; don't suddenly change live credentials or kill/restart. Task 7 and Task 9.
4. **Two browser tabs race Save with the same/different idempotency key**: identical key+payload returns stable result; mismatched payload returns conflict, no orphan grant. Task 7 and Task 8.
5. **Crash between credential write, Fleet JSON/YAML write and grant persistence**: on restart either coherent old/new state or `RECOVERY_REQUIRED`; never an unauthenticated Trusted Host child. Task 7 and Task 10.

---

### Task 1: Demonstrate real SSH remote-exec identity/lease — hard NO-GO

**Files:**
- Create: `tests/acceptance/ssh-operator-feasibility.test.ts`
- Create: `scripts/verify-ssh-operator-feasibility.mjs`
- Reference: `src/operator/trusted-host-cli.ts`, `src/operator/trusted-host-platform.ts` and the written spec `5.1`.

**Interfaces:**
- This is an acceptance *fixture*, not durable product authorization. Define result `{ exitCode: number; sshUid: number; serviceUid: number; channelAlive: boolean; channelStoppedOnEof: boolean; forwardedPortLoopbackOnly: boolean }`.
- Driver uses a genuine temporary OpenSSH server/client with a test-only key and isolated non-root OS account; record SSH binary/version, host-key validation, UID and channel-exit evidence.

- [ ] **Step 1 RED:** Write integration acceptance cases: correct known-host public key + same authenticated UID succeeds; a different SSH UID and changed host key are denied; close SSH client and verify remote helper exits; plain `ssh -L` shows no operator proof; forwarded port binds only `127.0.0.1`.
- [ ] **Step 2 verify RED:** Run `node --test tests/acceptance/ssh-operator-feasibility.test.ts` using Node 22+ TypeScript support only if installed/tested; otherwise use `npx vitest run tests/acceptance/ssh-operator-feasibility.test.ts`. Expected FAIL with absent fixture proof. Prefer the repository-standard Vitest command; **do not** claim a fake test proves SSH.
- [ ] **Step 3 probe:** Implement only disposable sshd fixture/runner; run `node scripts/verify-ssh-operator-feasibility.mjs` on a real Linux host; output a redacted JSON receipt in disposable CI artifact path containing verified UID/lease and test results, no keys/secrets.
- [ ] **Step 4 GO/NO-GO:** Require the real SSH success and four negative outcomes plus clean teardown; if host lacks `sshd`/separate UID/host-key validation, status `NOT_RUN` / `BLOCKED` and STOP the plan. Do not create a fake grant or ship session logic. Commit `test(ssh): prove remote-exec identity and disconnection on real sshd` only after evidence.

### Task 2: Bind session proof to an authenticated host helper, not HTTP

**Files:**
- Create: `src/operator/ssh-session-helper.ts` and `tests/integration/ssh-session-helper.test.ts`
- Modify: `src/main.ts` (dispatch `operator dashboard-session serve --stdio` before standard Dashboard startup)

**Interfaces:**
- `interface SshHelperIO { readonly osUid: number; readonly stdin: NodeJS.ReadableStream; readonly stdout: NodeJS.WritableStream; readonly onClose: (fn: () => void) => void }`.
- `runSshDashboardHelper(io: SshHelperIO, broker: SshSessionBroker): Promise<void>`. The helper may call `broker.openFromHost(io.osUid, io.onClose)` but must not accept a caller-supplied UID or lease ID.
- Helper writes a single versioned, length-bounded bootstrap message over SSH stdout, and keeps the helper/channel alive without a shell or inherited unsafe env.

- [ ] **Step 1 RED:** Tests assert CLI dispatch selects helper only on the exact approved argv, not user strings; same UID passes, wrong UID fails before session write; non-SSH remote-login invocation does not receive an automatic trusted operator session merely from localhost. Test EOF maps to `revokeLease`, including malformed/oversized messages and unexpected process exit.
- [ ] **Step 2 verify RED:** `npx vitest run tests/integration/ssh-session-helper.test.ts` → FAIL for missing dispatch/helper.
- [ ] **Step 3 GREEN:** Implement helper and exact CLI parser; enforce a server-owned broker authority check and FD/channel lifetime; no fallback to a guessed browser/request principal.
- [ ] **Step 4 verify GREEN:** Targeted test PASS and rerun Task 1 real-sshd proof with installed built CLI (`npm run build` before end-to-end binary probe); commit `feat(ssh): add authenticated host-local dashboard helper`.

### Task 3: Implement bounded host-only bootstrap/session store and lease revocation

**Files:**
- Create: `src/operator/ssh-session-store.ts`, `src/operator/ssh-session-broker.ts`
- Create: `tests/unit/ssh-session-store.test.ts`, `tests/unit/ssh-session-broker.test.ts`
- Modify: `src/runtime/container.ts` to instantiate broker lazily alongside existing protected Trusted Host storage; no global trusted-host switch.

**Interfaces:**
- `type SshSessionLease = { readonly id: string; readonly serviceUid: number; readonly installationId: string }` produced from helper-owned server context, not HTTP.
- `interface OperatorSession { readonly sessionId: string; readonly expiresAt: number; readonly absoluteExpiresAt: number; readonly leaseId: string }`.
- `class SshSessionBroker`: `openFromHost(uid: number, onClose: (fn: () => void) => void): { bootstrapSecret: string; leaseId: string; expiresAt: number }`; `exchangeBootstrap(secret: string): OperatorSession`; `assertLiveSession(sessionId: string): SshOperatorAuthority`; `revokeLease(leaseId: string): void`; `revokeSession(sessionId: string): void`. Export `SshOperatorAuthority` as an opaque branded server-side type; only the broker may instantiate it.

- [ ] **Step 1 RED:** `openFromHost` requires `uid===serviceUid`; 32+ random bytes, hash only on disk, 60-second bootstrap TTL, one-time exchange, concurrent exchange race (exactly one succeeds), safe 0700/0600 host-only state, symlink/hardlink/wrong-owner refusal, workspace overlap check, expiry and revocation; a forged session ID or JSON record cannot create authority.
- [ ] **Step 2 verify RED:** `npx vitest run tests/unit/ssh-session-store.test.ts tests/unit/ssh-session-broker.test.ts` → expected missing-type/function failures.
- [ ] **Step 3 GREEN:** Use Node `randomBytes`, constant-time digest comparison, bounded leased session records, 15-minute idle / 8-hour absolute TTL, close-event invalidation, memory-only authority objects; restart does **not** revive live sessions from stored data.
- [ ] **Step 4 verify GREEN:** Both tests PASS; test expiry using injected clock, not sleeps. Existing `tests/unit/trusted-host-store.test.ts` remains PASS. Commit `feat(ssh): bind operator bootstrap to UID and live lease`.

### Task 4: Workstation SSH launcher and least-privilege loopback bridge

**Files:**
- Create: `src/operator/ssh-dashboard-launcher.ts`, `src/operator/ssh-local-bridge.ts`
- Create: `tests/integration/ssh-dashboard-launcher.test.ts`, `tests/integration/ssh-local-bridge.test.ts`
- Modify: `src/main.ts` for `folderforge dashboard ssh --host <ssh-target>` dispatcher (launcher runs on user's workstation, not as a separate server service).

**Interfaces:**
- `interface LauncherDeps { spawnSsh(argv: string[]): ChildProcess; listenLoopback(): Promise<{ port: number; close(): Promise<void> }>; openBrowser(url: string): Promise<void> }`.
- `executeSshDashboardCli(args: string[], deps: LauncherDeps): Promise<number>`; `createSshLocalBridge(input: { forwardPort: number; secretProvider: () => string | null }): Promise<{ origin: string; close(): Promise<void> }>`. Exit closes local bridge and SSH process, clears secret.
- Specify remote SSH command argv explicitly in code: `folderforge operator dashboard-session serve --stdio` and local SSH forwarding to remote `127.0.0.1` Dashboard. Use an OS-assigned local port + bounded bind/forward retry; do not rely on a hardcoded port or shell interpolation.

- [ ] **Step 1 RED:** Refuse SSH host-key rejection, attempt to add `-o StrictHostKeyChecking=no` or `-A`, non-loopback binds, port collision without bounded retry, failed remote helper/early EOF. Assert SSH invocation passes an argv vector (no shell), no bootstrap secret in process argv, stdout logs, URL or browser storage. Browser origin must use the separate local bridge.
- [ ] **Step 2 verify RED:** `npx vitest run tests/integration/ssh-dashboard-launcher.test.ts tests/integration/ssh-local-bridge.test.ts` → FAIL for missing exports.
- [ ] **Step 3 GREEN:** Implement launcher/forwarder/bridge. Bridge accepts only the specifically designated exchange request; strips untrusted claimed-SSH headers, checks local Host/Origin/fetch metadata, prevents DNS rebinding/open-proxy behavior, and uses the one-use secret only in a protected internal upstream exchange. `HttpOnly` session cookie stays browser-side, never expose the SSH bootstrap secret to JS.
- [ ] **Step 4 verify GREEN:** Both tests PASS, then test host-key refusal and SSH disconnect with Task 1 real-ssh harness. Commit `feat(cli): open SSH-verified Dashboard through loopback bridge`.

### Task 5: Authenticate browser operator session with cookie, CSRF and channel lease

**Files:**
- Create: `src/dashboard/ssh-operator-session.ts`
- Create: `tests/integration/dashboard-ssh-session.test.ts`
- Modify: `src/dashboard/server.ts` (new routes and **explicit** session middleware only; preserve ordinary Dashboard auth contract)

**Interfaces:**
- `POST /operator/ssh-session/exchange` (single-use secret supplied by launcher bridge; opaque server response + `Set-Cookie`), `GET /operator/ssh-session/status` (redacted `{ verified: boolean; expiresAt?: number; source?: 'ssh-remote-exec' }`), `POST /operator/ssh-session/logout`.
- `requireSshOperatorSession(req: IncomingMessage, broker: SshSessionBroker): SshOperatorAuthority`: checks host-only HttpOnly SameSite Strict cookie, method-specific synchronizer CSRF, origin/fetch metadata, TTL, broker lease liveness. No elevation by `Host`/localhost or standard Dashboard API key.
- Cookie `Secure` on HTTPS; strict loopback origin controls on HTTP. All auth responses `Cache-Control: no-store`; never return bootstrap, UID, credential, lease ID or raw private host status to UI.

- [ ] **Step 1 RED:** Real `startDashboard` HTTP tests: plain `ssh -L` forwarded loopback without helper gets `401/403` for elevated endpoints, even with standard Dashboard token; forged `X-SSH-User` and `?token=` fail, wrong/cross-site origin fail, missing CSRF POST fail, DNS rebinding Host fail; once exchanged, same-origin status verifies while helper lives; helper EOF immediately denies next write; cookie-reuse after server restart/expiry denied.
- [ ] **Step 2 verify RED:** `npx vitest run tests/integration/dashboard-ssh-session.test.ts` → FAIL before routes exist.
- [ ] **Step 3 GREEN:** Integrate broker with `startDashboard` through `Container` injection; use crypto-safe comparison and session-bound synchronizer CSRF. Existing `opts.requireAuth` continues for ordinary Dashboard routes; verified SSH session does not become unrestricted admin Bearer credential.
- [ ] **Step 4 verify GREEN:** New suite + `tests/integration/dashboard-trusted-host-consent.test.ts` + `tests/integration/dashboard-admin.test.ts` PASS. Commit `feat(dashboard): validate SSH operator cookie and CSRF`.

### Task 6: Authorize exact Fleet tuple through SSH authority (keep CLI fallback)

**Files:**
- Modify: `src/operator/trusted-host-consent.ts`, `src/operator/trusted-host-scope.ts`, `src/operator/trusted-host-store.ts`
- Create: `tests/unit/ssh-trusted-host-authorization.test.ts`
- Reference: `tests/unit/trusted-host-consent.test.ts` and `tests/integration/trusted-host-operator-cli.test.ts`.

**Interfaces:**
- Add `TrustedHostConsentService.authorizeSshApply(instanceId: string, tuple: FleetProfileTuple, authority: SshOperatorAuthority, targetAuth: 'token' | 'api-key' | 'oauth'): ScopedAuthorization`. `ScopedAuthorization` is an opaque, single-use, exact tuple/instance/revision capability consumed **under the Fleet lock**, not a signature passed through an API or written in a browser response.
- Preserve `requestProfile(...)` / `applyApprovedProfile(...)` old CLI grant path and `assertAuthorized(...)` at child start. Bind credential rotation/generation identity to scoped grants without leaking credential.

- [ ] **Step 1 RED:** Valid broker authority for same installation/UID/instance/canonical workspace/target auth permits authorization; wrong UID, different instance, workspace symlink change, changed tuple, old credential generation, revoked grant, disconnected/expired session and write freeze deny without persistence. HTTP admin principal, request ID or user-supplied `SshOperatorAuthority` JSON never authorizes; replayed single-use capability denies.
- [ ] **Step 2 verify RED:** `npx vitest run tests/unit/ssh-trusted-host-authorization.test.ts` → expected FAIL on missing method.
- [ ] **Step 3 GREEN:** Add server-only authority mint/consume path integrated with existing `scopeDigest` and revocation store. If this requires changing persistent grant format, version/read-validate/rollback safely; never reinterpret old grants as SSH authority or expose private state to agent workspace.
- [ ] **Step 4 verify GREEN:** New + pre-existing consent, scope, store and operator CLI tests PASS. Commit `feat(fleet): authorize exact host profile from live SSH operator`.

### Task 7: Commit auth + consent + Fleet YAML/state as one recoverable operation

**Files:**
- Modify: `src/provisioner/fleet-profile-transaction.ts`, `src/provisioner/fleet-manager.ts`, `src/operator/trusted-host-consent.ts`
- Create: `tests/unit/fleet-ssh-apply-transaction.test.ts` and `tests/integration/fleet-ssh-host-lifecycle.test.ts`.

**Interfaces:**
- `interface TrustedHostApplyInput { toolsPreset: string; policyMode: string; terminalExecution: 'trusted-host'; expectedRevision: string; idempotencyKey: string }`.
- `type TrustedHostApplyResult = { status: 'applied' | 'restart_pending' | 'unchanged'; authChange: 'none' | 'credential_generated'; runtime: { effectiveProfile: string; observedState: string }; revision: string }`.
- `FleetManager.applyTrustedHostFromSsh(id: string, input: TrustedHostApplyInput, authorization: ScopedAuthorization): TrustedHostApplyResult`. Extend `FleetProfileTransaction` journal to version 2 with credential backup/hash, Fleet JSON, generated YAML, pending activation, grant activation/revocation and one-time retrieval receipt; version 1 recovery remains backward compatible.

- [ ] **Step 1 RED:** Matrix: stopped instance `authMode=none` yields exactly one generated secret and authenticated target; existing token/key/OAuth not rotated; active child/tunnel yields `restart_pending` and **old live auth unchanged**; duplicate idempotency key same payload is stable, changed payload returns `409/CONFLICT`; expectedRevision stale fails. Concurrent manager instances never partially write.
- [ ] **Step 2 verify RED:** `npx vitest run tests/unit/fleet-ssh-apply-transaction.test.ts tests/integration/fleet-ssh-host-lifecycle.test.ts` → FAIL for missing transaction method.
- [ ] **Step 3 GREEN:** Extend lock/journal/recovery to stage all tuple+credential+grant material with audit precommit and safe readback; `PREPARED` rolls back, `COMMITTED` validates/restores fully, corrupted journal ⇒ `RECOVERY_REQUIRED`. Retain a pending *desired* target separately from live settings until safe activation; never force kill or silently change live MCP auth. Zeroize discarded temporary credential material where possible.
- [ ] **Step 4 verify GREEN:** New targeted tests and `tests/unit/fleet-profile-transaction.test.ts` + `tests/integration/fleet-trusted-host-lifecycle.test.ts` PASS. Commit `feat(fleet): transact one-click host profile and credential safely`.

### Task 8: Expose ONE authenticated Fleet Save & Apply API and one-time credential access

**Files:**
- Modify: `src/dashboard/server.ts`
- Create: `tests/integration/dashboard-ssh-fleet-apply.test.ts`
- Reference: new `requireSshOperatorSession`, `FleetManager.applyTrustedHostFromSsh`, existing legacy profile-intents routes.

**Interfaces:**
- `POST /fleet/:id/trusted-host/apply` JSON: `{ toolsPreset, policyMode, terminalExecution: 'trusted-host', expectedRevision, idempotencyKey }` and response `TrustedHostApplyResult`.
- `GET /fleet/:id/trusted-host/status` redacted desired/effective/runtime state; `POST /fleet/:id/trusted-host/credential/consume` authenticated one-use credential handoff (exact session/instance, no-store, short expiry). No other API returns the raw new token.
- Require HTTPS/strict-loopback origin as applicable, verified live SSH session, CSRF, secure JSON/body bounds, authenticated admin permissions for Fleet, rate limits and write-freeze checks. Do not accept plain Dashboard token as substitute.

- [ ] **Step 1 RED:** In real HTTP harness: same-origin verified SSH single Save succeeds, ordinary `ssh -L` with dashboard token fails, foreign origin/CSRF missing/replay/changed body/method confusion/cross-instance credential consume denied. Test SSH disconnect after dispatch but before lock acquisition, credential retrieved once only, duplicate POST idempotence, stale revision and recovery lock conflict. New route cannot mutate a disabled/failed child anonymously.
- [ ] **Step 2 verify RED:** `npx vitest run tests/integration/dashboard-ssh-fleet-apply.test.ts` → FAIL for absent route.
- [ ] **Step 3 GREEN:** Add isolated route/middleware with no manually approved request ID path; use Task 7 transaction boundary, not sequential `setAuth + /preset + /policy + /terminal`. Avoid logging credentials, body secrets or browser session cookies. Retain old `/profile-intents`+CLI fallback unchanged.
- [ ] **Step 4 verify GREEN:** Targeted suite and `tests/integration/dashboard-fleet.test.ts` / `tests/integration/dashboard-trusted-host-consent.test.ts` PASS. Commit `feat(dashboard): apply scoped Fleet host profile in one call`.

### Task 9: One-click Mission Control Fleet UX with truthful runtime feedback

**Files:**
- Modify: `packages/mission-control/src/screens/Fleet.tsx` plus shared request types where existing code defines them.
- Modify: `tests/visual/spa-visual.test.ts` (add Fleet modal case) and any existing Mission Control component test harness.

**Interfaces:**
- GET operator status when Configure opens; visible `SSH operator verified`/expiry; buttons `Save & Apply` or `Reconnect SSH Dashboard`.
- Verified session Save invokes `POST /fleet/:id/trusted-host/apply` exactly once (stable idempotency key per form submission), not legacy `profile-intents`; automatically creates required child auth without extra prompt. Fallback unverified UI preserves old CLI approval path but never labels itself verified.
- UI state `applied`, `restart_pending`, `unchanged`, `recovery_required`, `stop_uncertain`, `revoked` from authoritative server, not optimistic toast.

- [ ] **Step 1 RED:** Browser/UI tests: one click issues exactly one apply API call, no `req_` approve command for verified SSH; `authMode=none` shows secure one-time credential retrieval/Connect rather than extra form; expired session offers reconnect; active task reports `Saved — restart pending`; closed/revoked session cannot Save; success banner never says running without observed process proof; modal keyboard/mobile and error disclosure remain accessible.
- [ ] **Step 2 verify RED:** `npx vitest run tests/visual/spa-visual.test.ts` and the relevant Mission Control component test command; expect the new scenario FAIL before implementation.
- [ ] **Step 3 GREEN:** Implement minimal Fleet modal state machine and one-click request; keep same fields and no new global trusted-host toggles. Preserve visible warning that approved commands run as the FolderForge service OS account and hard-denies remain.
- [ ] **Step 4 verify GREEN:** Visual suite PASS; run `npm run build:mission-control`, examine mobile/desktop browser screenshots and ensure no old pending approval copy appears for SSH verified session. Commit `feat(ui): one-click SSH-verified Trusted Host Save & Apply`.

### Task 10: Prove crash recovery, revocation, auto-restart and bypass denial

**Files:**
- Create: `tests/integration/ssh-fleet-security-conformance.test.ts`
- Modify: existing `tests/unit/fleet-profile-transaction.test.ts` / `tests/integration/fleet-host-bypass.test.ts` / `tests/integration/fleet-trusted-host-lifecycle.test.ts` only for genuine regression assertions.

**Interfaces:**
- Exercise the actual Task 7 transaction and Task 8 server endpoints, not mocks only.
- Use injectable crash phase enum `'before-prepared' | 'after-prepared' | 'after-credential-write' | 'after-yaml-rename' | 'after-state-rename' | 'after-grant-write' | 'after-committed'` inside existing test fault-injection seam; these are test-only switches, never remotely configurable.

- [ ] **Step 1 RED:** Force crash at each phase and reload from disk; assert no mixed credential+YAML+Fleet JSON+grant is observed; pending restart never auto-enables host power; corrupt state ⇒ `RECOVERY_REQUIRED`. Revocation prevents future start/auto-restart; uncertain PID produces truthful state and no blind kill. Alternate `provision_update`, Dashboard ``/fleet/:id/terminal`, global parent opt-in and fake SSH header cannot mint a host grant.
- [ ] **Step 2 verify RED:** `npx vitest run tests/integration/ssh-fleet-security-conformance.test.ts tests/integration/fleet-host-bypass.test.ts` → FAIL until all invariants implemented.
- [ ] **Step 3 GREEN:** Close only the evidenced bypass/recovery holes in relevant components, preserve scope boundaries/legacy CLI and independently authenticated OAuth/token children. No `--ignore-scripts`, auth disable or audit disable workaround.
- [ ] **Step 4 verify GREEN:** All new and existing lifecycle/revocation/recovery tests PASS; run `npm run verify` and record exact counts/failures. Commit `security(ssh): close replay, crash and alternate Fleet host grant paths`.

### Task 11: Real Linux end-to-end acceptance, host-independent regressions, documented rollout

**Files:**
- Create: `tests/acceptance/ssh-one-click-fleet.test.ts`, `scripts/verify-ssh-one-click-acceptance.mjs`
- Update: `docs/superpowers/feasibility/2026-10-10-fleet-macos-local-consent.md` by appending **new separate SSH evidence section only** (do not rewrite historical results); update user-facing SSH Dashboard documentation only with proven commands.
- Modify: `.github/workflows/ci.yml` only if the newly approved self-hosted Linux SSH acceptance job must be added; do not fake success on a GitHub-hosted runner without sshd/UID preconditions.

**Interfaces:**
- Acceptance receipt `{ sha, platform, nodeVersion, sshVersion, serviceUid, sameUidVerified, wrongUidDenied, hostKeyMismatchDenied, plainTunnelDenied, sessionEofRevoked, oneSaveApplied, noAuthAutofixed, restartPendingHonest, replayDenied, auditPresent }`. Secrets, host usernames, private SSH keys, URL tokens and cookies **excluded**.
- Linux OS image must provide OpenSSH client/server, non-root dedicated account, a controlled loopback port, isolation and permission to configure a disposable sshd. If unavailable, explicitly report `BLOCKED / NOT_RUN`, not simulated PASS.

- [ ] **Step 1 RED:** Real end-to-end suite from workstation-style client → SSH launcher remote exec → Dashboard exchange → Fleet Save & Apply → child start with authenticated MCP. Negative cases: same tunnel without helper, wrong Unix UID, forged HTTP/cookie, wrong known host key, SSH abrupt EOF, stale grant, active child/tunnel, explicit revoke.
- [ ] **Step 2 verify RED:** `npx vitest run tests/acceptance/ssh-one-click-fleet.test.ts` with real runner prerequisites → expected FAIL before full implementation; fixtures using mock SSH cannot be substituted for security qualification.
- [ ] **Step 3 GREEN:** Fix only proven integration issues. Run `node scripts/verify-ssh-one-click-acceptance.mjs` and save redacted exact-SHA Linux receipt; separately record real macOS launcher/UID/operator acceptance or `NOT_RUN`. Windows unsupported must fail closed.
- [ ] **Step 4 verify GREEN:** Acceptance PASS on actual Linux sshd with no leaked credentials, production-style service UID and honest in-flight state. All 6 regular CI jobs plus this independent real SSH acceptance (when applicable) must be successful; if missing, block product merge. Commit `test(docs): qualify one-click SSH Trusted Host on real host`.

### Task 12: Exact-final-HEAD qualification, independent review and review-only delivery

**Files:** No additional product files expected; any fixes must have their own RED → GREEN plus commit. Release and tag remain untouched.

**Interfaces:** Review receipt with `headSha`, `ciRunId`, all test gates, real Linux SSH evidence path, macOS acceptance status, security review verdict and required rollout flags.

- [ ] **Step 1:** Validate branch based on approved spec, update/merge dependency branches only after their own approval. Run `npm ci --ignore-scripts`, `npm --prefix packages/mission-control ci --ignore-scripts`, `npm run verify`, `npm run build`, `npm run docs:check`, `npm run smoke:stdio`, `npm run smoke:http` and `npm run smoke:package`; audit output must have zero failures. Container-dependent tests require actual runtime and pinned image, never skip silently if marked required.
- [ ] **Step 2:** Push final product head; verify exact-head GitHub Ubuntu/macOS/Windows x Node 22/24 CI **6/6 SUCCESS**, plus the separate real-Linux-SSH evidence on that exact head. Re-run if head changes after fixes.
- [ ] **Step 3:** Independent adversarial security review: attack plain `ssh -L`, cross-origin, theft/replay, forged helper/session artifacts, UID mismatch, symlink state path, forged `X-SSH-User`, disconnect during transaction, child `authMode=none`, crash recovery, privilege-boundary/port exposure. Track findings as blockers and fix with TDD.
- [ ] **Step 4:** Browser UI review at mobile and desktop sizes, verify no deceptive `Running` claims, copy-paste approval path absent only when a real verified SSH session exists, and Connect handles one-time secret safely. Record operator usage docs and actual observed screenshots.
- [ ] **Step 5:** Open **product PR for review only** with actual evidence and known missing host/platform gates. **Do not merge, deploy, publish, retag v3.0.2 or disable safeguards** unless user separately authorizes release/merge and required gates PASS. Return final product PR URL, SHA, 6 CI conclusions, SSH evidence and unresolved issues.

## Stop/go gates for the execution handoff

- **Gate A — User review:** This written plan itself must be explicitly approved, and execution mode chosen (Native vs Subagent-driven). Until then **no product code**.
- **Gate B — SSH feasibility:** Real Linux SSH channel/UID/known-host/EOF evidence from Task 1 is mandatory before implementing trusted capability.
- **Gate C — RED → GREEN:** Each task's missing feature must be demonstrated failing before its minimal change, passing afterward, with a small commit.
- **Gate D — Security:** Fail-closed on unverified loopback, no-auth child, wrong UID and connected-session replay, plus proven crash/revocation behavior.
- **Gate E — Release eligibility:** Real Linux SSH E2E, exact-head CI 6/6, independent security review and truthful macOS qualification. Missing gate remains **BLOCKED / NOT_RUN**, never reworded PASS.
- **Gate F — Existing release:** main and annotated `v3.0.2` remain immutable during this plan and implementation; next publication requires a separately approved new semver.

**Execution recommendation:** **Subagent-driven** for independent stage-by-stage security review, with the CLI/SSH, session broker and Fleet transaction stages reviewed as distinct trust boundaries. If no true fresh independent agent is available, use **Native** but require a separate independent security review before merging. An implementation agent must not infer permission to merge/release from approval of this plan.

