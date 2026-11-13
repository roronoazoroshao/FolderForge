# Source-only changes since v3.2.4 — NOT A PUBLISHED RELEASE

This is a **draft for root `CHANGELOG.md`** constrained to `docs/` for Phases 0–4. The package source version is still `3.2.4` (`package.json:2-3`); no npm publish, tag, provenance attestations or production deployment is implied.

## [Unreleased] — source integrated Nov 6–10, 2026
- Web Control: read-only Configuration Hub inventory, bounded signed-owner `shell_exec` quota editor (`src/operator/config-descriptors.ts:18-60`; `src/operator/rate-limit-settings.ts:64-70`).
- Fleet: server-approved workspace preselection, optional Browse, first-run Overview link, owner-authenticated host access maintained (`packages/mission-control/src/screens/Fleet.tsx`; `packages/mission-control/src/screens/Overview.tsx`; `src/dashboard/server.ts:950-1028`).
- Security: registry stale-process checks, symlink/hardlink identity validation, safe discard of unmerged/dirty worktrees, metadata-only reconcile and restore **fail closed unless externally writer-fenced**, and apply/rollback lifecycle locks (`src/isolation/worktree-manager.ts:103-112,1289-1307,1813-1825`; `tests/unit/worktree-manager.test.ts`).
- Dependencies: upgraded Playwright MCP, jose and development dependencies (package and lock state; `package.json:90-112`).
- Quality: exact-source CI 7/7 on `main@8c00b15`; local full suite 1580 pass/34 skip; global coverage statements 76.20%, branches 66.85%, functions 81.82%, lines 79.77% (`.github/workflows/ci.yml:17-83`).

## Not yet released or production-ready
Independent host-writer fence and security review remain missing (`docs/r14-kernel-registry-fence-migration.md:74-83`). D3–D5 Web configuration coverage, global token/cost telemetry and real-model independent agent council are proposals, **not shipped features**. Source merge ≠ deployment/publish.

Do not change immutable published tags/npm version or run publish workflows as part of a documentation PR.
