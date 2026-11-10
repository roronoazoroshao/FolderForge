# Operator runbook — non-destructive baseline

Audit baseline: `main@8c00b15`. This document describes commands and evidence, **not** execution or approval of a deployment. Do not paste secret values or signed owner links in logs.

## Start / stop and diagnostic routing

```text
# From the intended project directory, using the exact installed package:
folderforge --version
folderforge --help
folderforge doctor --project /path/to/project
folderforge --project /path/to/project --stdio

# Managed Web Control (local loopback, optional signed owner credential):
folderforge control start --project /path/to/project --auth token --no-open
folderforge control status --project /path/to/project

# Stop only the precisely identified project instance, with human approval:
folderforge control stop --project /path/to/project
```

Evidence `README.md:23-61,64-93,119-149`; CLI dispatch `src/main.ts:98-155` and `src/control/cli.ts:1350`. A live instance may run an older installed binary: `git rev-parse origin/main` is **not proof of a deployment**.

## First-run owner experience

1. Launch token-authenticated loopback Dashboard with explicit `--project`. Signed URL is a credential: keep private (`README.md:23-36`).
2. If using SSH port forwarding, forward 7332 but do not treat a PORTS tab alone as owner evidence; authenticated Dashboard/verified SSH proof is required (`src/dashboard/server.ts:950-1028`).
3. In Overview, choose **Set up AI access** if Fleet inventory is empty; in Fleet, the server-approved workspace is preselected. **Change folder** is optional (`packages/mission-control/src/screens/Overview.tsx`; `packages/mission-control/src/screens/Fleet.tsx`).
4. Start Fleet only after explicit owner consent. Confirm separate child health/status, selected policy, supported tool list, revocation and audit (`src/operator/trusted-host-consent.ts:46-76`; `src/provisioner/fleet-manager.ts:402`).
5. Do not assume authenticated owner UI means blanket OS root access.

## Runtime monitoring

| Signal / check | Why | Evidence |
|---|---|---|
| `control status --project <dir>` and Dashboard `GET /status` | Service PID/address and health | `README.md:124-149`; `src/dashboard/server.ts:1346` |
| `GET /fleet`, `GET /processes`, `GET /tools` | Child state, managed process lifecycle, tool visibility | `src/dashboard/server.ts:1789,1967,2500` |
| `GET /audit` and stored audit evidence | Trace privileged operations, mutations and failures | `src/dashboard/server.ts:2491`; `src/audit/audit-log.ts:36` |
| `GET /operator/config/quota` | Current process quota and revision; **not shared global usage** | `src/dashboard/server.ts:2899`; `src/operator/rate-limit-settings.ts:20-30` |
| `GET /isolations` and read-only health | Active, missing and dirty states | `src/dashboard/server.ts:2504`; `src/isolation/worktree-manager.ts:319` |
| CI, production soak, release provenance | Code gates; independently verify production evidence | `.github/workflows/ci.yml:17-83`; `.github/workflows/production-soak.yml` |

No code-level evidence currently proves a production p95 SLO, uptime, token spending, incident MTTR or 24h current soak: **[UNVERIFIED]**. Proposed dashboards and alerts are not yet available.

## Troubleshooting decision path

| Symptom | Safe diagnosis | Do NOT do |
|---|---|---|
| Wrong project/control service not found | Verify `pwd` and explicit `--project`, then `control status` (`README.md:145-149`) | Blindly stop or restart a different project |
| Forwarded tab lacks host access | Verify owner signed-link session and Origin/SSH proof (`src/dashboard/server.ts:950-1028`) | Disable Origin/auth checks or pass tokens in query to privileged REST |
| Fleet request returns started but not healthy | Inspect child status/logs and port/auth (`src/provisioner/fleet-manager.ts:402`; `src/dashboard/server.ts:2735`) | Claim readiness from a successful HTTP request alone |
| Quota edit rejected | Re-read current revision, bounds, freeze and audit status (`src/operator/rate-limit-settings.ts:51-55,184-225`) | Remove locks, overwrite state file or disable quota |
| Isolation missing worktree/sourceDirty | Read-only inspect registry bytes, git refs, health, owner and backups (`docs/r14-kernel-registry-fence-migration.md:40-72`) | `git worktree prune`, force remove, reconcile write or discard |
| Audit unavailable / commit uncertain | Treat as uncertain state; preserve evidence and perform offline review (`src/operator/rate-limit-settings.ts:32-35`; `src/audit/audit-log.ts:36`) | Replay a non-idempotent mutation blindly |
| CI passes but no production proof | Review exact-run SHA, skipped gates and real host migration status (`.github/workflows/ci.yml:17-83`; `docs/production-readiness.md:8-41`) | Tag/npm publish or claim a deployment |

## Release and rollback safety

**Read-only checklist first:** exact source SHA, clean checkout, branch/review status, CI, audit snapshots, package identity, active services, workspace ownership, credentials and owner approval. Source-merge is not production rollout. For this audit, **no production pull, restart, npm publish, state migration, file deletion or credential change** was performed.

**Production go/no-go:** no-go for isolation registry reconcile/restore until independent reviewer and host-enforced writer epoch are proven (`docs/r14-kernel-registry-fence-migration.md:24-38,40-72,74-83`). Preserve historical worktrees, partial journals, backup hashes and off-path recovery copies. For other changes, create an operator-approved backup/rollback runbook and canary plan; exact rollback implementation is product-specific **[UNVERIFIED]**.

Security alerts, rate-limit breaches, automatic incident notifications and release cadence are proposed for future implementation. Do not claim existing integrations where none were verified.
