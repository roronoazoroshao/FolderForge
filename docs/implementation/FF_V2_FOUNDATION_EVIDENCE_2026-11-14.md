# FF v2 foundation — source implementation evidence (2026-11-14)

**Scope:** development branch `feat/ff-v2-foundation`, based on `main@104f57f4280d288a61ce52168ea4982ddd7432f8`. Tests run in a disposable native Git linked worktree with dependencies/adapters reused from the repository's existing installation, **not** on the live runtime binary. No production restart or recovery mutation.

## Evidence observed

| Workstream | What is actually implemented | Evidence | Remaining gate |
|---|---|---|---|
| FF-001 | CLI legacy help/unknown-command regression tests; existing facade, Dashboard workspace, modern stdio tests verified | Contract and focused Vitest green | Source CI + owner review |
| FF-003 | Disposable tmp folders and deny-outside-root fixture for tests, including symlink negative test | 2 new integration tests, RED before fixture implementation, then GREEN | Fault simulation matrix still incomplete; C0 not signed |
| FF-004 | Deterministic ID per canonical folder, immutable request context with principal/session ID and grant revision | 8 new unit tests, RED when modules missing, then GREEN | MCP stdio/HTTP binding and authorization enforcement **not implemented**; C1 not signed |

### Verification commands

- `./node_modules/.bin/vitest run tests/contracts/legacy-commands.test.ts tests/unit/workspace-identity.test.ts tests/integration/workspace-v2-faults.test.ts tests/unit/onboarding.test.ts tests/integration/facade.test.ts tests/integration/dashboard-workspaces.test.ts tests/integration/mcp-modern-stdio.test.ts --maxWorkers=2 --no-file-parallelism`: **7 suites, 41 tests PASS**.
- `./node_modules/.bin/tsc -p tsconfig.json --noEmit`: **PASS**.
- `npm run lint`: **PASS**.
- `npm run docs:check`: **PASS**, 133 Markdown files.
- `npm run architecture:check`: **PASS**, 167 source files, 390 runtime edges, 0 cycles or violations.

## Accuracy and safety

The `WorkspaceIdentity` SHA-derived ID is a **lookup key only**, never an authorization token. Immutable context creation is not connected to the existing tool registry, does not impose OS confinement, and does not grant/revoke permissions. The test fixture is **not** a production sandbox. GitHub Actions/full matrix and reviewer gates are not inferred from local checks.

Issue [#118](https://github.com/roronoazoroshao/FolderForge/issues/118) still gates host writer-epoch/isolation recovery changes. Off-host backup, capacity planning, Host Operator broker, cross-agent end-to-end and production canary remain **UNVERIFIED**.
