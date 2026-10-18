# R15 — Git lifecycle must acquire registry lease before mutations

## Threat model (internal security finding, not independent review)

In PR #117 before R15, the manager called `git worktree add` inside
`create()` before `persist()` acquired the registry lock/checked the SHA256
loaded state. A stale manager could fail the registry CAS yet leave a new
branch and unmanaged worktree behind. More severe: `discard()` removed a
managed Git worktree and deleted the branch ref **before** checking the
registry CAS, so a stale/locked manager could lose the data while returning
an error. The first issue is orphaned Git data; the latter is a data-loss
risk and must be prevented before deploying reconciliation support.

## Fix scope

- `create()` and `discard()` take the existing cooperative `.lock` **before**
  mutating refs, source checkout, or worktrees, and compare the raw registry
  SHA256 against the manager's loaded lease while holding that lock.
- `persistUnderLock()` performs the final lease validation and durable
  replacement without recursively acquiring the same lock.
- No recovery file, Git object, worktree or reference on the live Poker host
  was touched. Tests use disposable Git repositories only.

## TDD evidence

- RED: two stale/lock test cases for `create()` failed; stale writer created
  an extra task branch/worktree, and lock contention left a new worktree.
- GREEN: these two passed after acquiring registry lock before Git add.
- RED: two additional stale/lock test cases for `discard()` failed; the branch
  had already disappeared despite refusal to update the registry.
- GREEN: all four tests passed after moving lock/lease check ahead of the
  deletion and holding it through the final registry replacement.
- Follow-up: full Vitest and GitHub CI must run on exact R15 HEAD. Do not
  infer a successful release from focused unit tests.

## Explicit remaining blockers

**This fix covers only cooperative CAS-aware processes.** A pre-CAS legacy
binary ignores `.lock` and can still rename/replace the registry. The R14
Linux DAC fixture does not prove a deployed host fence. A trusted
supervisor, dedicated nonprivileged writer UID and protected registry path
remain unimplemented on Poker production.

Git refs and the JSON registry are not a single atomic transaction. If a
process dies after a Git operation but before registry replacement, a
preserved orphan or an uncertain lifecycle record may still require manual
recovery. Fail-closed behavior must not attempt destructive automatic
cleanup. Lock files left by interrupted processes require identity-aware
recovery, not automatic unlink based only on file age.

Also pending: deeper `apply()`/`rollback()` lifecycle fencing, staged crash
fault injection, source ownership audit, independent GitHub APPROVED
security review at exact HEAD, production deployment and rollback proof.

**Gate:** PR #117 stays Draft and must NOT be merged or deployed on the Poker
host solely based on this hardening. No live reconciliation or worktree
cleanup is authorized by these tests.
