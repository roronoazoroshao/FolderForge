# R14 — Host-enforced writer fencing: Linux DAC, migration, and release gates

Scope: `roronoazoroshao/FolderForge` PR #117; dependent system:
`roronoazoroshao/poker-master-os`. This is an **operational design and
sandbox evidence**, NOT authorization for a Poker production migration.

## Demonstrated in a disposable live-host fixture

`node scripts/security/host-registry-fence-smoke.mjs` verifies with Docker:

- A process running as the legacy UID can perform a blind temp-file/rename
  before ownership migration (positive control).
- Changing the fixture directory AND registry file owner to a separate UID
  makes the kernel deny writes and `chmod` from the legacy UID during and
  after migration, even if the legacy code ignores application locks.
- A process launched as the dedicated writer UID can atomically replace the
  registry. A pre-rename process failure leaves the original registry bytes
  intact. A late legacy writer remains denied.
- No Docker network, no image pull, no production mount. The sandbox uses a
  preinstalled image addressed by its exact SHA-256 image ID, drops all caps
  except CHOWN/FOWNER during disposable fixture ownership transitions, uses
  read-only container root, and removes the fixture afterwards.

### Threat-model limits

DAC protects against **processes running with an unprivileged old identity**.
It does not stop host root, CAP_DAC_OVERRIDE, or Docker administrators. On
this host, `devops` belongs to the `docker` group (effective host-root power).
A genuine security boundary requires a separate least-privileged identity
without such privileges, and a privileged supervisor with a fixed allowlist.
A same-UID service, `chmod` under a directory the old UID owns, a cooperating
`.lock`, a PID scan, or a merely asserted callback is NOT a hard fence.

The current Poker service still runs as `devops`; its registry is under
`/home/devops/Poker Master OS/.git/folderforge/isolations.json`, and the Git
repository directory is owned by `devops`. Production DAC has **not** been
configured. The R13 `withLegacyWritersFenced` callback is deliberately
unwired; mutation remains unavailable by default.

## Safe migration contract (requires a qualified operator and reviewer)

1. Snapshot and checksum the exact registry, Git refs, all worktree paths,
   symlink targets, ownership, active service units and process start times.
   Backups and rollback copies must be stored off the mutable registry path.
2. Inventory all legacy *writer entry points*, including tunnels, systemd
   services, schedules, manual CLI, old binaries and restart policies. Disable
   launch paths, quiesce and verify old processes have **exited**; do not
   delete worktrees or assume missing records are safe to discard.
3. The host administrator must provision an isolated writer principal **not
   in privileged or container administration groups**, and a protected stable
   ancestor directory managed by another trusted principal. The old UID must
   have neither write access to the registry nor ability to replace any
   ancestor or restart a privileged writer. The new service needs minimum
   safe Git permissions, not broad access to the host.
4. The externally enforced fence must bind to the expected *repository
   identity, canonical registry path, immutable baseline digest and epoch*.
   Enforce epoch across service restarts; never accept operator-provided
   booleans or test stubs as fence proofs. Until a trusted implementation is
   wired and reviewed, `reconcileMissing`/restore MUST refuse writes.
5. Within this protected boundary, run adversarial legacy writer/rename
   attempts **before, during and after** cutover; simulate parent directory
   replacement, symlink swap, stale lock, fsync error, truncated writes,
   process kill before/after rename, restore rollback, and restart of a
   previously loaded legacy manager. Require old writes to return EACCES or
   equivalent kernel denial after cutover and verify exact registry hashes.
6. Run exact-HEAD CI on all supported platforms; independently review
   identity/fence/ownership, rollback, failure handling, and all P0/P1. Only
   after APPROVED independent review, stable backup/audit and deployment
   qualification may the PR be considered for merge or Poker activation.
7. Before any real reconcile, audit each active Poker task's owner and dirty
   state. SourceDirty and unowned records remain unresolved; never interpret
   absence of a physical worktree as permission to close metadata.

## R14 status

- Kernel DAC experiment in disposable container fixtures: PASS.
- Effective isolation of production Poker registry: NOT IMPLEMENTED.
- Durable external writer-epoch coordinator on production: NOT IMPLEMENTED.
- Independent security reviewer: NOT ASSIGNED; only the PR author is currently
  listed as a repository collaborator, and no organization reviewer teams
  were enumerated in the authenticated API at the R14 checkpoint.
- CI for this R14 commit: PENDING exact-head qualification.
- Merge / production deploy / live reconcile / cleanup of recovery records:
  **BLOCKED**. Running the fixture script is not a production deploy.
