# R13 — isolation registry mixed-version writer compatibility

Scope: FolderForge PR #117 (`fix/issue14-stale-reconcile`), validated against R12 parent
`fa1a4a91db8ff62f782355a39dccdaa691fe7523`. The Poker Master OS registry
and worktrees are **not** test fixtures and MUST NOT be modified to test this.

## Adversarial finding: P1 / lost isolation metadata

The pre-CAS manager on `main` calls `writeFileSync(temp)` followed by
`renameSync(temp, isolations.json)` in `persist()` without observing the
new `.lock` or a registry SHA lease. The R12 manager reads/compares the SHA
and takes `.lock`, but a still-running legacy process may rename its cached
v1 registry **after** the last digest check or even after R12 returns.
Both snapshots can contain a valid `digest` field: the new reconciliation
can disappear silently, and the old state may be mistaken for authoritative.
An advisory lock, one-time SHA check, audit record, user acknowledgement,
process enumeration, or `version: 2` header alone cannot prevent this.

## R13 evidence, disposable fixtures only

- `tests/unit/stale-reconcile.test.ts`: a simulated legacy atomic rename ignores
  a held `.lock`, while a mutation just before final CAS is detected and refused.
- TDD RED: uncoordinated `reconcileMissing(dryRun: false)` returned successfully
  when the test required fail-closed; 11 existing tests passed, 1 new test failed.
- GREEN: the reconciliation and restoration mutation entry points now require a
  trusted **external writer-epoch fence**; no production fence is installed.
  Both mutations therefore refuse by default. Dry-run remains available.
- Test-only callbacks used with single-writer fixtures are **not** evidence of
  real host-level fencing or safe mixed-version deployment.

## Required implementation before production activation

1. Inventory **all** processes/hosts/users able to write the *specific*
   `isolations.json`, including old already-loaded managers and alternate CLI
   instances. A `ps` snapshot cannot establish future exclusivity.
2. Provide an externally enforced and **durable** writer epoch. Older writers
   must be retired or technically prevented from reopening/replacing the
   registry through the complete migration and afterwards. The trusted
   orchestrator must hold this invariant while invoking the fenced callback;
   a mere application-side callback or cooperative lock is insufficient.
3. Wire `withLegacyWritersFenced` **only** to that trusted coordinator after
   adversarial proof across process restarts and fault injection. Never wire
   an unconditional `action()` or rely on operator-provided booleans in prod.
4. Re-test stale managers, valid but stale digests, post-commit stale rename,
   lock crash leftovers, symlink attacks, short/failed writes, fsync/rename
   failures, ownership and exact-byte archive recovery across Linux/macOS/
   Windows. Record exit codes and artifacts on the new exact HEAD.
5. Obtain genuinely independent security review bound to the exact HEAD,
   review task ownership for every missing record, and require explicit
   release/activation authorization. No automated metadata reconciliation.

## Gate

`MIXED_VERSION_COMPATIBILITY = BLOCKED`, `EXTERNAL_FENCE = NOT_IMPLEMENTED`,
`INDEPENDENT_APPROVAL = PENDING`. PR remains Draft. Do not merge, activate
on Poker Master OS, edit live registry, discard task data, deploy, or release.
