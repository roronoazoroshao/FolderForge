# Mission Control Configuration Hub — security-first design
**Date:** 2026-11-01  
**Status:** DESIGN PROPOSAL / requires maintainer review before runtime changes  
**Context:** [repository status review](../../reviews/2026-11-01-status-and-goals.md); `docs/stability-policy.md`, `docs/security.md`, `docs/mission-control.md`

## Problem and user outcome

An operator encountering `shell_exec`'s 1,000-call rolling-day limit sees a diagnostic but cannot tune that limit through Mission Control. Other fields are spread across parent YAML, Fleet instance configuration, dedicated credential/tunnel flows, and runtime settings. Operators need one discoverable place to **see everything manageable and change only what is safe to change**, with honest effective vs desired values.

The operator must never mistake a saved field for an active child configuration. A browser session must not become a generic high-privilege system configuration editor.

## Chosen architecture: metadata-driven allowlisted settings registry

Three approaches were considered:
1. **Raw YAML editor:** fastest to prototype; rejected because secrets, privilege escalation, path containment and config precedence would be uncontrolled.
2. **One form per config object:** low initial coupling but duplicates validation, restart semantics and audit; poor maintainability.
3. **Typed settings descriptors + dedicated high-risk workflows (recommended):** enumerate safe fields, source/provenance, boundaries, validation, apply mode and support status. Existing Settings/terminal and Fleet dedicated routes remain the source of truth until explicitly migrated.

### Configuration categories

- **LIVE_SAFE:** constrained values that can be updated without resetting security state, e.g. per-tool `shell_exec` quota. Changing a limit never clears existing hits or grants authority.
- **STAGED_RESTART:** low/medium-risk options requiring a controlled service or Fleet restart; use desired vs active rendering and explicit manual restart only.
- **OWNER_ONLY:** bind, transport, auth, filesystem scope, sandbox/trusted host, hard-deny changes; read-only summary with links to existing host consent/credential workflows. The browser alone cannot grant elevated execution.
- **SECRET_EXTERNAL:** token, key, OAuth secret; never return raw values, never accept them in generic config patches; use the existing one-time credential controls.
- **BLOCKED:** unsupported fields or security-sensitive operations under unresolved R14/isolation gates.

Registry output for each approved path: `key`, `scope: parent|fleet`, `category`, `label`, `type`, `constraints`, `editable`, `source`, `effective`, `desired`, `requiresRestart`, `lastChangedAt`, `lastChangedBy`, `blockedReason`. No unknown field passes through to runtime config.

## API and change protocol

1. `GET /operator/config`: redacted and bounded descriptor inventory; parent plus named Fleet scopes; distinguish defaults, config file, env/CLI and runtime operator settings. A field with unresolved precedence must be marked `source: unknown` rather than inferred.
2. `POST /operator/config/validate`: check exact scope, field names, strict data types, integer boundaries, authz, current revision, dependency and security invariants. Returns only diff of allowed nonsecret fields, warning and apply mode; **never** mutates.
3. `POST /operator/config/apply`: require authenticated Dashboard admin, same-origin/CSRF protection and `expectedRevision`; reject unknown keys, writes frozen by Mission Control, stale version, sensitive fields, and unsupported dynamic writes. Audit sanitized before/after and actor, never credentials.
4. `GET /operator/config/history`: bounded redacted actor/timestamp/revision evidence. Explicit rollback of config revision only after repeat validation and host/approval checks (future phase). No auto rollback of active tasks.
5. Operational failure modes: concurrent dashboard tabs (409 conflict), invalid value (400), missing permission (401/403), invalid path / risk policy (403), not hot-reloadable (409 with restart requirement), persistence error (failure with no in-memory mutation).

**First deliverable contract:** `shell_exec` rate limit, with `dailyQuota` 1–10,000 (bounded positive integer), `maxCalls` 1–50 and `windowMs` 1,000–60,000; maintain nonzero default. Preserve rolling timestamps; do not set `rateLimit.enabled=false` via Dashboard. New per-tool editing may follow only after tests and review.

**Persistence:** A versioned, operator-owned 0600 settings record in `.folderforge/`, with integrity checks, atomic write and fail-closed startup validation. Reuse existing runtime-settings semantics only when safe; do not silently rewrite the user's base YAML or ignore config precedence. Persist desired state, apply to running `RateLimiter` without reconstructing its buckets. If a service restarts, previously used in-memory calls are lost: label the metric **per-process**, and keep aggregate enforcement out of MVP claims.

**Durability note:** a plain SHA-256 checksum detects accidental corruption, not malicious edits by another host process; do not present it as cryptographically authenticated storage. The final persistence design must check symlink, owner, parent permissions, fsync and interrupted writes without weakening existing protections.

## Security boundaries

- Only an authenticated privileged operator can update settings. Reuse Dashboard's existing origin/CSRF/auth infrastructure; permissions are checked on **every** API request.
- Agent MCP tools are not a route to self-approve or change host security posture.
- Host-operator trusted execution still requires existing independently verified on-host consent; changing policy `danger` must not turn off hard denies, containment, audit or rate limits.
- No arbitrary config file path, raw YAML editor, secret reveal, tunnel credential exposure, client-provided filesystem roots, global sandbox toggle or production isolation metadata edits.
- Configuration changes do not trigger unapproved restarts, kill work, merge PRs, deploy, publish npm or release.
- Every error is safe and doesn't echo secret-bearing request bodies. If write audit is mandatory and unavailable, reject before mutation.
- No conflict with R14: do not use or alter managed isolation registry as an editor transaction mechanism.

## Dashboard IA (incremental)

**Settings → Configuration**: searchable section list; summary of active vs desired, source, validation/errors, apply mode; owner-only warning. **Quotas & Limits** shows `shell_exec` usage with percent, per-process caveat, window and daily quota, and a bounded validated form. Other groups initially read-only with guidance to their existing dedicated panels. Advanced/raw YAML remains unavailable.

## Verification/acceptance

- Security regression: unauthenticated remote write denied; token-only query credential not privileged; hostile Origin/CSRF blocked; agent endpoint cannot write; write freeze enforced; blocked keys rejected.
- Functional regression: valid quota applies and persists, respects precedence after startup, does not reset usage; rejects negative/fractional/NaN/over-budget values and stale revision.
- Faults: failed persistence does not change live config; corrupted or symlinked stored state fails closed; no leaked credentials in API, audit or errors.
- UI: pending restart distinctly labeled; keyboard, accessible field labels, explicit error, mobile 390px evidence.
- Gates: RED→GREEN tests, typecheck, lint, full Vitest, build, docs, exact PR-head CI. Separate post-merge CI and external host proofs remain separate obligations.

## Scope, rollout and rollback

Phase 1 is **review/documentation only**. Phase 2 may deliver rate-limit editing with tested, feature-specific API and UI; Phase 3 adds read-only full inventory; Phase 4 progressively promotes safe fields and staged restart. Any release/deploy requires separate maintainer decision. Roll back by reverting the feature commit; persisted operator state must be safely ignored/migrated without changing base YAML or weakening operator security.
