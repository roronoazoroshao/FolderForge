# FolderForge v2 — Detailed Implementation Plan

**North Star:** [Vision 2027–2030](../../strategy/FOLDERFORGE_NORTH_STAR_2027_2030.md) · **GitHub task tracker:** [Tasks index](../../../tasks/plan.md) · **Source-of-truth:** this plan for implementation details.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (nếu có) hoặc `superpowers:executing-plans` để thực hiện từng task. Mỗi task: test đỏ → code tối thiểu → test xanh → review → commit nhỏ. **Không tự triển khai chỉ vì plan tồn tại.**

**Ngày:** 14/11/2026 · **Trạng thái:** DRAFT CHỜ OWNER DUYỆT  
**Goal:** chọn một folder → cấp quyền → MCP connected → điều khiển đồng nhất bằng CLI và Web; giữ security/audit/compatibility.  
**Architecture:** modular monolith + strangler; domain/usecases duy nhất, CLI/Web là adapter, ToolRegistry giữ execution kernel; immutable request context.  
**Tech stack:** Node `>=22`, TypeScript, Vitest, ESLint, React 18, Vite 6, Tailwind 4, stdio + HTTP MCP.  
**Spec:** [FolderForge_v2_Spec_2026-11-14.md](../specs/2026-11-14-folderforge-v2-design.md) · **Baseline:** `main@b2ad52e` · **Checklist:** [FolderForge_v2_Tasks_2026-11-14.md](../../../tasks/todo.md).

## 0. Hướng dẫn đọc và phạm vi

**Spec = "làm ra sản phẩm gì, thế nào là đúng". Plan = "ai triển khai trước việc nào, sửa file gì, kiểm thử thế nào".**

- **P0:** chặn rủi ro dữ liệu/bảo mật; **P1:** MVP người dùng hoàn chỉnh; **P2:** tinh gọn UI và source; **P3:** nâng cao có điều kiện.
- Một task thường đụng **1–5 file**; tên file mới phía dưới là **đề xuất**, có thể điều chỉnh nếu repo hiện có abstraction tương đương. Tuyệt đối không tạo abstraction chỉ vì sơ đồ.
- **Không code/commit/deploy ở đợt lập plan.** Đây là tài liệu thực thi sau khi duyệt; các checkbox chưa tích.
- Không dùng tính "nhỏ gọn" theo số LOC làm KPI duy nhất; đúng scope, đúng owner, test và API compatibility quan trọng hơn.

### Definition of Done chung cho MỌI task

1. Có acceptance criteria và test trước implement (hoặc chứng minh task chỉ là docs/ops).
2. Giữ public API/CLI contract trừ khi task chỉ rõ migration + regression check.
3. Typed error, no raw secrets, no swallowed failure, no unapproved `danger` bypass.
4. `npm run typecheck`, `npm run lint`, `npm run architecture:check` qua ở CI/isolated checkout; focused Vitest tests PASS. Full `npm run verify` ở checkpoint; các `smoke` chạy sau `npm run build`.
5. Đã review security boundary và dán nhãn `SOURCE-TESTED` / `LIVE-VERIFIED` chính xác; mutation non-idempotent không auto retry nếu outcome uncertain.
6. Update docs với exact file names, cleanup code do chính task tạo, một commit nhỏ/revert được; không xóa test để đạt xanh.

**Ranh giới vận hành:** Dev source và tests trên fixture/test runner; không restart live/tunnel, không chạm real isolation registry hoặc xóa 39 detached worktrees. Host hiện gần hết disk; không chạy bulk build trên host live nếu chưa có dung lượng và backup phù hợp.

## 1. Bức tranh tổng thể, thứ tự và gate

```text
[ P00 / Gate: Evidence, backup, baseline ] ─────────────────────────┐
                            │                                     │
                            ▼                                     ▼
       [ P01 Immutable workspace identity & state ]      [ Ops/security approval ]
                            │                                     │
                            ▼                                     │
       [ P02 Shared app usecases & control adapters ]               │
                       ┌────┴──────┐                              │
                       ▼           ▼                              │
                [ P03 CLI ]   [ P04 Web + Design System ]          │
                       └────┬──────┘                              │
                            ▼                                     │
            [ P05 Source consolidation + MVP E2E ]                 │
                            └───────── review & canary ────────────┘
                                        │
                                        ▼
                [ P06 Advanced / production only after gates ]
```

### Các checkpoint phát hành

| Checkpoint | Chỉ được coi là đạt khi | Cách chứng minh | Không đồng nghĩa |
|---|---|---|---|
| **C0 — Source safe** | snapshot + baseline + dedicated test sandbox; host không bị mutation | CI exact SHA, backup manifest, checks | Production đã an toàn |
| **C1 — Workspace bound** | root/principal pinned per request, adversarial tests xanh | concurrency/security tests | OS sandbox đã chứng nhận |
| **C2 — Backend parity** | cùng usecases ở CLI/Web, owner auth chính xác | contract/API parity tests | Agent MCP online |
| **C3 — First folder** | add → connect config → handshake → run → revoke | CLI+Web end-to-end, connection receipt | Remote gateway an toàn |
| **C4 — Web UX** | 4 menu, advanced reachable, no broken old routes, accessibility | visual/keyboard/e2e | Tất cả feature live-enabled |
| **C5 — Source modular** | hot spots tách và API behavior không đổi | snapshots, architecture, full suite | Code "hoàn hảo" |
| **C6 — Production rollout** | capacity, artifact SHA, owner security approval, canary/rollback; **#118 nếu dùng isolation registry/recovery** | signed evidence + soak theo policy | Chỉ cần CI xanh |

## 2. Các điều kiện không thể bỏ qua (trước bất kỳ production cutover nào)

**GATE-SEC-118 (khi động đến isolation registry):** GitHub issue [#118](https://github.com/roronoazoroshao/FolderForge/issues/118) phải có host writer epoch fencing có proof thật và independent security approval. Các unit test hiện có chỉ chứng minh source, không thay host kernel boundary. **MVP local MCP tách rời hoàn toàn isolation registry có thể triển khai sau owner security/canary approval riêng; không được dùng hoặc mutate các isolation records legacy cho đến khi #118 được giải quyết.**

**GATE-RECOVERY (khi xử lý isolation):** 24 active isolation metadata (22 unverifiable, 2 missing_worktree) được owner phân loại; backup có restore drill off-host; không gọi reconciliation mutation. Việc xóa local branches trước đó **không có nghĩa worktree là rác**.

**GATE-CAPACITY:** host `df` gần 100%, cần được giảm rủi ro ENOSPC bằng thao tác kiểm kê/backup do owner duyệt; không chạy `git clean -fdx` hoặc force worktree cleanup.

**GATE-RUNTIME:** quy chiếu version/digest của live `dist/main.js` và binary đang chạy; source main mới hơn runtime. Rollout dùng canary riêng, không blind restart.

**GATE-AUTH:** trên live host có `dangerBypassesApprovals=true`, một số process dùng `danger`; cần audit principal scope, OS confinement và owner consent trước khi dùng live full-workspace. MVP local chỉ được rollout riêng nếu không dựa vào registry isolation chưa đủ bằng chứng.

**Được phép tiến hành:** viết test, refactor, build fixture/local isolated runner, tạo docs, UI preview; **không được** tự coi chúng là phép cấp quyền deploy.

## 3. Phân chia phase — lý do và kết quả

| Phase | Mục tiêu dễ hiểu | Deliverable độc lập | Chỉ được qua nếu |
|---|---|---|---|
| **P00 / Safety baseline** | Có đường quay lại, biết trạng thái hiện tại | backup manifest, contracts snapshot, test fixture | C0 |
| **P01 / Workspace context** | AI biết đúng folder, không bị session khác đổi | identity, store, context binding, session tests | C1 |
| **P02 / One control service** | CLI và Web thao tác cùng một logic | usecases, v2 API, grants, lifecycle | C2 |
| **P03 / One-command CLI** | `folderforge up <dir>` có consent/status/receipt | CLI commands, compatibility tests | C3 CLI |
| **P04 / Web console** | Add folder và kiểm soát qua 4 khu vực | design system, wizard, sessions/activity | C4 |
| **P05 / Consolidation** | Tách backend file lớn an toàn, không phá cũ | route handlers, slim CLI, old-link aliases, E2E | C5 + MVP RC |
| **P06 / Advanced & rollout** | web browser agent, tunnel, Fleet nếu cần | gated optional extensions, manual production acceptance | C6 |

## 4. Task-by-task executable plan

### P00 — Evidence, baseline, non-production readiness

#### FF-001 — Chốt baseline và compatibility contract (P0)

**Ý nghĩa:** trước refactor phải biết behavior nào không được phá. Không thay production.

- **Depends:** không.
- **Files chính:** `tests/integration/facade.test.ts`, `tests/integration/dashboard-workspaces.test.ts`, `tests/integration/mcp-modern-stdio.test.ts`, `docs/audit/REPO_FULL_FLOW_ISSUES_AUDIT_2026-11-14.md` (tham chiếu; không sửa trừ khi phát hiện mới), đề xuất `tests/contracts/legacy-commands.test.ts`.
- **TDD:** viết snapshot có chủ đích của `folderforge --help`, `init`, `connect cursor`, `/workspaces`, stdio/HTTP initialize; xác nhận fixture hiện xanh. Xử lý output có nondeterministic timestamps bằng matcher, không snapshot secrets.
- **PASS:** baseline SHA và list public contracts được khóa; 0 unexpected change; test tập trung có lệnh tái hiện.
- **Verify:** `npx vitest run tests/integration/facade.test.ts tests/integration/dashboard-workspaces.test.ts tests/integration/mcp-modern-stdio.test.ts` trong isolated runner; `npm run docs:check`.
- **Rollback:** chỉ tests/docs; revert commit nếu assertion sai.

#### FF-002 — Tạo operational safety manifest và recovery boundary (P0)

**Ý nghĩa:** ghi rõ dữ liệu nào không được đụng và khôi phục từ đâu.

- **Depends:** FF-001.
- **Files:** đề xuất `docs/operations/workspace-v2-safety-gate.md`, `docs/operations/workspace-v2-backup-manifest.md`, `docs/operations/workspace-v2-rollout-checklist.md`.
- **Steps:** đọc-only audit disk/process/isolation metadata; xác nhận bundle `.git/branch-cleanup-backups/2026-11-14-main-only/`; chỉ định quy trình off-host encrypted backup/restore drill, owner cho phép thủ công.
- **PASS:** manifest liệt kê exact paths + sha/digest (không lộ token), 24 registry identities và hướng xử lý; không thay registry/worktrees.
- **Verify:** owner-signed snapshot comparison; file checksum và restore drill **trên host khác**, không dùng live registry.
- **Rollback:** N/A docs; không xóa dữ liệu.

#### FF-003 — Isolated fixture/test harness + fault injection (P0)

**Ý nghĩa:** mọi demo/security regression chạy trên tmp root riêng, không ở host live.

- **Depends:** FF-001.
- **Files:** `tests/runtime-isolation.ts`, đề xuất `tests/fixtures/workspace-v2-fixtures.ts`, `tests/integration/workspace-v2-faults.test.ts`.
- **TDD:** tạo folder A, B, symlink/rename, non-Git, Git, audit unwritable, duplicate start, crash simulation. Canary "real owner path" phải bị deny trong harness.
- **PASS:** temp directories auto cleanup theo ownership; không target `~/.folderforge` thật; every destructive case isolated.
- **Verify:** `npx vitest run tests/integration/workspace-v2-faults.test.ts` (sau khi tạo).
- **Rollback:** chỉ test files.

**Checkpoint C0:** baseline tests green + tài liệu backup + fixture có chứng minh không chạm live. Nếu thiếu off-host backup hoặc host capacity, **source development vẫn được** nhưng rollout blocked.

### P01 — WorkspaceId, root binding và session context

#### FF-004 — Workspace identity / immutable context types (P0)

- **Depends:** FF-001, FF-003.
- **Files:** đề xuất `src/workspace/workspace-identity.ts`, `src/workspace/workspace-context.ts`, `tests/unit/workspace-identity.test.ts`.
- **TDD:** canonical path same root → same identity trong store, khác root khác identity; validate required `workspaceId/principalId/sessionId/grantRevision/operationId`; invalid context rejection.
- **Implementation:** type `WorkspaceRecord`, `WorkspaceContext`, deterministic/opaque ID generation, immutable constructor. Không cho domain gọi `process.cwd()`.
- **PASS:** tests rejects missing principal, ambiguous root, reused session across root; no mutable global in new API.
- **Verify:** `npx vitest run tests/unit/workspace-identity.test.ts`; `npm run typecheck`.
- **Rollback:** types mới chưa được wired, xóa module được.

#### FF-005 — Verify root & path identity with adversarial cases (P0)

- **Depends:** FF-004.
- **Files:** đề xuất `src/workspace/workspace-root.ts`, `tests/unit/workspace-root.test.ts`, `tests/integration/workspace-root-adversarial.test.ts`.
- **TDD:** realpath/symlink traversal, `..`, moved directory, deleted root, Windows case behavior nếu platform support; race giữa check và write (nếu OS API hỗ trợ).
- **Implementation:** owner-selected root identity được lưu, revalidate trước mọi mutation; policy giải thích `UNVERIFIED_ROOT`; tách trust boundary của shell.
- **PASS:** mọi path escape deterministic bị deny; không claim OS confinement chỉ bằng string checks; test Windows/macOS/Linux theo CI.
- **Verify:** focused Vitest + cross-OS matrix; `npm run architecture:check`.
- **Rollback:** new module only.

#### FF-006 — Durable registry + CAS + idempotency port (P0)

- **Depends:** FF-004, FF-003.
- **Files:** đề xuất `src/application/workspace-repository.ts`, `src/application/workspace-store.ts`, `tests/integration/workspace-store.test.ts`.
- **TDD:** concurrent add same root, process restart, update stale revision 409, same op key same request replay, same key different body reject, crash/ENOSPC leave prior valid state intact.
- **Implementation:** reuse durable atomic write/locking primitives; owner-scoped app state outside source folder, file permissions secure, schema version; store port mockable.
- **PASS:** zero duplicate record for same root, no truncated JSON after fault tests, deterministic error codes; no new database dependency.
- **Verify:** focused tests + `npm run typecheck`, fault harness.
- **Rollback:** schema new, no destructive migration of legacy store.

#### FF-007 — Bind workspace context at MCP entry (stdio) (P0)

- **Depends:** FF-004, FF-005, FF-006.
- **Files:** `src/server/transports/stdio.ts`, `src/server/mcp-server.ts`, đề xuất `tests/integration/mcp-stdio-workspace-bound.test.ts`.
- **TDD:** two separate stdio clients sessions pinned to different roots; no switch steals workspace; invalid context rejected. Protocol initialize still passes.
- **Implementation:** freeze per stdio process/session context, pass through tool invocation, map legacy single project to one pinned context.
- **PASS:** 0 cross-project wrong-root; backward compatible request/response wire format.
- **Verify:** focused tests, `npm run smoke:stdio` after build.
- **Rollback:** feature flag/adapter branch can fall back to single-project behavior (không mutable for multi-client).

#### FF-008 — Bind workspace context at MCP entry (HTTP) (P0)

- **Depends:** FF-004, FF-005, FF-006.
- **Files:** `src/server/transports/http.ts`, `src/server/protocol/request-context.ts`, `tests/integration/http-session-lifecycle.test.ts`, đề xuất `tests/integration/http-workspace-binding.test.ts`.
- **TDD:** token principal identity, session root mapping, new session/reconnect/logout, forged project header/ID, cross-session replay. HTTP 401/403/404 không leak root.
- **Implementation:** freeze validated session identity+grant before tool call; gateway opt-in path follows worker identity; forbid ambiguous selection.
- **PASS:** switching folder in legacy UI never changes existing HTTP session execution root; no principal escalation.
- **Verify:** integration tests + `npm run smoke:http` after build.
- **Rollback:** isolate gateway opt-in; do not disable HTTP auth.

#### FF-009 — Tool kernel context enforcement and two-root matrix (P0)

- **Depends:** FF-007, FF-008.
- **Files:** `src/tools/registry.ts`, `src/policy/policy-engine.ts`, đề xuất `tests/integration/workspace-tool-governance.test.ts`.
- **TDD:** file/Git/shell/child-adapter calls with 2 agents×2 folders, revoked grant, escape args, audit write fails; verify no alternate bypass path. Fail on ambiguous root.
- **Implementation:** one validated context passed to existing policy approval/quota/audit pipeline; no second "full power" route.
- **PASS:** all tool families tested with 0 wrong-root; no bypass through adaptive tools. Shell OS confinement evidence separated from logical checks.
- **Verify:** focused tests, `npm run architecture:check`, security negative tests.
- **Rollback:** revert context wiring only after owner/security assessment; do not allow insecure default.

**Checkpoint C1:** immutable context verified for stdio+HTTP; store CAS; cross-root tests. A green result **không** xác nhận kernel OS sandbox đầy đủ.

### P02 — One Application Service: CLI + Web same actions

#### FF-010 — Add/list/status usecases (P1)

- **Depends:** FF-006, FF-009.
- **Files:** đề xuất `src/application/workspace-control.ts`, `src/application/workspace-queries.ts`, `tests/unit/workspace-control.test.ts`.
- **TDD:** add existing vs new root; non-Git/empty root; status on missing root; same result code for callers; store revision and auditable owner operation.
- **Implementation:** adapter-independent service interfaces, no HTTP/CLI imports. Distinguish `REGISTERED`, `CONFIGURED`, `READY`, `CONNECTED`.
- **PASS:** parity result DTO for same input; no network open during add.
- **Verify:** focused tests + typecheck.
- **Rollback:** new service unused by legacy until adapter wiring.

#### FF-011 — Managed start/stop/health supervisor (P1)

- **Depends:** FF-010.
- **Files:** đề xuất `src/application/workspace-lifecycle.ts`, `src/application/workspace-supervisor.ts`, `tests/integration/workspace-lifecycle.test.ts`.
- **TDD:** start twice, stop twice, port conflict, orphan PID, stale process SHA, worker crash, HTTP handshake rejected, stdio configured but no session.
- **Implementation:** supervise **only** processes this service owns; record runtime identity/version; `READY` after verified HTTP protocol handshake, stdio `CONFIGURED` until live session evidence.
- **PASS:** no duplicate daemon, no arbitrary process kill, reason-coded degraded state, no false connected.
- **Verify:** focused tests + local isolated smoke.
- **Rollback:** disable new supervisor; old control process management remains.

#### FF-012 — ConnectionReceipt + client config preview/undo (P1)

- **Depends:** FF-010, FF-011.
- **Files:** `src/onboarding/cli.ts` (reuse helpers), đề xuất `src/application/workspace-connections.ts`, `tests/integration/workspace-client-connection.test.ts`.
- **TDD:** Cursor/Claude/VS Code/generic options; invalid client config; permission denied; existing config merged not overwritten; consent required for outside-workspace write; undo restores previous exact bytes.
- **Implementation:** preview file delta, owner approval, safe write/backup, redact tokens, return DTO `{client,transport,configChanged,probeResult,undoReference}`.
- **PASS:** stdio configured correctly, no token in console/audit, existing user settings preserved.
- **Verify:** focused + `npm run smoke:onboarding` in test environment.
- **Rollback:** undo receipt per change; no blanket deletion.

#### FF-013 — Owner grants, revocation and enforcement lifecycle (P0)

- **Depends:** FF-006, FF-009, FF-010.
- **Files:** đề xuất `src/application/workspace-grants.ts`, `src/policy/workspace-capabilities.ts`, `tests/integration/workspace-grants.test.ts`.
- **TDD:** token MCP trying to issue grant must deny; expired/revoked grant; in-flight request; full-workspace/host access distinction; `danger` approval bypass must not imply owner authority.
- **Implementation:** owner consent, grant revision/expiry, denial reason, revocation state machine with worker acknowledgment and audit.
- **PASS:** new requests fail on revoked grant, existing long-running request status truthful, no host elevation from local token.
- **Verify:** focused tests + threat cases.
- **Rollback:** owner can revoke; pre-existing policy unaffected by new UI.

#### FF-014 — Versioned local Control API for add/status/health (P1)

- **Depends:** FF-010, FF-011, FF-013.
- **Files:** đề xuất `src/dashboard/routes/workspaces-read.ts`, `src/dashboard/routes/workspaces-write.ts`, `tests/integration/dashboard-workspaces-v2.test.ts`, `src/dashboard/server.ts` (registration only).
- **TDD:** GET/POST with owner vs MCP principal, malformed path, CSRF/Origin, stale revision, idempotency key collision; v1 routes unchanged.
- **Implementation:** `/api/v2/workspaces` and health/start/stop routes via shared usecases; thin transport adapter; typed DTO/errors.
- **PASS:** owner-only mutation enforced server-side; same service output as CLI service; legacy dashboard integration still green.
- **Verify:** focused tests + `tests/integration/dashboard-admin.test.ts`.
- **Rollback:** v2 routes can be disabled/removed without v1 schema mutation.

#### FF-015 — Connection/grants/session/activity endpoints (P1)

- **Depends:** FF-012, FF-013, FF-014.
- **Files:** đề xuất `src/dashboard/routes/workspace-connections.ts`, `src/dashboard/routes/workspace-activity.ts`, `tests/integration/dashboard-workspace-controls.test.ts`, `src/dashboard/server.ts` (registration).
- **TDD:** owner-only create/revoke, missing auth, pagination cursors, redact token, stale session, mis-scoped session ID, same-origin failure.
- **Implementation:** reuse existing audit and session stores through ports; no client-specific business logic in route.
- **PASS:** Web can list real connections, create receipt, review grant/approval and revoke; no owner claim from tunnel.
- **Verify:** focused tests, `npm run architecture:check`.
- **Rollback:** restore route map, old dashboard unaffected.

**Checkpoint C2:** usecases tested as pure application service, v2 Web contract available, v1 preserved. CLI/UI can now implement independently from shared contract.

### P03 — A one-command CLI without breaking existing clients

#### FF-016 — New command router for `up` (P1)

- **Depends:** FF-010, FF-012, FF-014.
- **Files:** `src/main.ts` (dispatch), đề xuất `src/onboarding/workspace-up.ts`, `tests/integration/workspace-up-cli.test.ts`.
- **TDD:** `up .`, `up /abs/path --client cursor --profile develop`, non-Git, invalid profile, two concurrent invocations, no TTY/consent, `--json`; verify old `connect cursor` unaffected.
- **Implementation:** parse minimally; delegate to add/connection/start usecase; render terminal summary in plain language.
- **PASS:** one-command produces stable receipt; exit statuses and error explanations are deterministic.
- **Verify:** `npx vitest run tests/integration/workspace-up-cli.test.ts`; `npm run smoke:onboarding` (built fixture).
- **Rollback:** remove dispatch, existing CLI remains.

#### FF-017 — CLI `status`, `ui`, `stop`, scoped access controls (P1)

- **Depends:** FF-011, FF-013, FF-016.
- **Files:** đề xuất `src/control/workspace-commands.ts`, `src/main.ts`, `tests/integration/workspace-cli-control.test.ts`.
- **TDD:** status before/after connect, stop owned daemon vs unknown PID, UI open local only, owner access/revoke audit, stale profile/grant revision.
- **Implementation:** usecase invocations and terminal rendering only; `workspace connect` does not collide legacy `connect <client>`.
- **PASS:** CLI and Web share operation ID, status enums, validation; no new insecure shortcut to `danger`.
- **Verify:** focused tests + CLI help snapshot.
- **Rollback:** new subcommand router only.

#### FF-018 — CLI compatibility & connect client protocol matrix (P0)

- **Depends:** FF-016, FF-017.
- **Files:** `tests/integration/mcp-modern-stdio.test.ts`, `tests/integration/mcp-modern-http.test.ts`, `tests/integration/workspace-up-cli.test.ts`, đề xuất `tests/contracts/workspace-cli-compat.test.ts`.
- **TDD:** legacy init/doctor/connect/stdin tools; old flags `--project`, `--policy`, `--stdio`, `--http`; new command receipts; stdout no diagnostics in JSON mode.
- **PASS:** current integration and smoke remain PASS on Linux/macOS/Windows CI; no involuntary user config reset.
- **Verify:** `npm run build`, `npm run smoke:stdio`, `npm run smoke:http`, `npm run smoke:onboarding` on CI isolated workers.
- **Rollback:** disable facade while retaining old commands.

**Checkpoint C3 (CLI):** test `folderforge up <folder>` → config/receipt → actual MCP initialize (via fake client) → file/search → audit → revoke/stop. Stdio not shown as connected until client handshake.

### P04 — Four-screen Web and a stronger Design System

#### FF-019 — Semantic tokens and UI primitives (P1)

- **Depends:** FF-014.
- **Files:** `packages/mission-control/src/theme.css`, `packages/mission-control/src/ui.tsx`, đề xuất `packages/mission-control/src/design-system/status.tsx`, `packages/mission-control/src/design-system/permission-summary.tsx`.
- **TDD:** component tests or visual story cases for neutral/success/error/loading, keyboard focus, no inline raw hex in newly written code.
- **Implementation:** preserve actual FolderForge visual identity; define semantic tokens and primitive contracts. Do **not** add a second UI framework.
- **PASS:** all new screens consume tokens/components; WCAG AA contrast verified, reduced motion, 320–1440 responsive.
- **Verify:** `npm run build:mission-control`, visual tests and axe on preview app (needs running preview URL).
- **Rollback:** replace only new component imports; existing styling remains.

#### FF-020 — Typed API client + hooks (P1)

- **Depends:** FF-014, FF-015.
- **Files:** `packages/mission-control/src/api.ts`, `packages/mission-control/src/types.ts`, đề xuất `packages/mission-control/src/hooks/use-workspaces.ts`, `tests/integration/dashboard-workspaces-v2.test.ts` (contract alignment).
- **TDD:** loading, server unavailable, 401, 403, conflicts, invalid session, cancellation, pagination; no optimistic owner grant success before server ack.
- **Implementation:** single typed client, owner session reuse, response parsing, stable `operationId`, safe polling.
- **PASS:** no duplicated endpoint schema per screen, error states user-actionable, no token logging.
- **Verify:** UI build + API contract tests.
- **Rollback:** API client introduced behind new routes only.

#### FF-021 — Navigation and legacy deep-link preservation (P1)

- **Depends:** FF-019.
- **Files:** `packages/mission-control/src/App.tsx`, đề xuất `packages/mission-control/src/layout/primary-nav.tsx`, `packages/mission-control/src/screens/Overview.tsx`, `tests/visual/spa-visual.test.ts`.
- **TDD:** four destinations present; route `/fleet`, `/tunnels`, `/plugins`, `/workspaces`, `/agent-loops`, `/approvals`, `/audit`, `/responses`, `/tools` still work via aliases or Advanced; keyboard Tab order.
- **Implementation:** Folders/Sessions/Activity/Settings; Advanced accessible, not removed.
- **PASS:** existing bookmarks/tests work, no blank screen, valid active nav at narrow widths.
- **Verify:** mission-control build and Playwright visual/route test in isolated preview.
- **Rollback:** revert route/nav component, other screens unaffected.

#### FF-022 — Add Folder wizard, typed permissions (P1)

- **Depends:** FF-019, FF-020, FF-021.
- **Files:** đề xuất `packages/mission-control/src/features/workspaces/AddFolder.tsx`, `packages/mission-control/src/features/workspaces/AccessStep.tsx`, `packages/mission-control/src/FolderPicker.tsx`, đề xuất `tests/visual/workspace-onboarding.spec.ts` (hoặc existing test framework file).
- **TDD:** path valid/invalid, duplicate, filesystem picker unavailable, Inspect/Develop/Full caveat, back/forward state, owner confirmation.
- **Implementation:** accessible form steps, preview effective grant server-side, no browser filesystem assumption in remote session.
- **PASS:** can add non-Git folder, shows effective scoped permissions and denial reasons, keyboard-only.
- **Verify:** UI build, e2e on preview, axe where available.
- **Rollback:** new feature route only.

#### FF-023 — Connect Agent + accurate health receipt (P1)

- **Depends:** FF-012, FF-020, FF-022.
- **Files:** đề xuất `packages/mission-control/src/features/workspaces/ConnectAgent.tsx`, `packages/mission-control/src/features/workspaces/ConnectionReceipt.tsx`, `packages/mission-control/src/api.ts`, đề xuất `tests/visual/workspace-connect.spec.ts`.
- **TDD:** stdio configured/not connected, HTTP ready/connected, auth mismatch, invalid client choice, save config denied, token redacted, copy receipt correct.
- **Implementation:** transport-aware copy, probe status, Open ChatGPT option only when secure auth path explicitly supported.
- **PASS:** 0 false CONNECTED; dry-run config modifications understandable, undo available.
- **Verify:** preview Web E2E + mocked auth failure + real fake MCP server handshake.
- **Rollback:** disable new flow; existing `Tunnels` and legacy client connect remain.

#### FF-024 — Folder details, Sessions and Activity (P1)

- **Depends:** FF-015, FF-020, FF-021, FF-023.
- **Files:** đề xuất `packages/mission-control/src/features/workspaces/FolderDetails.tsx`, `packages/mission-control/src/features/sessions/SessionsPage.tsx`, `packages/mission-control/src/features/activity/ActivityPage.tsx`, đề xuất `tests/visual/workspace-control.spec.ts`.
- **TDD:** active session list, stop/revoke pending/succeeded/error, pagination, activity redaction, offline polling retry, confirmation and keyboard focus.
- **Implementation:** owner operations through common API, no direct server token shell command in UI.
- **PASS:** same workspace visible from CLI and Web; operators can trace each action by operation ID; no phantom success before response.
- **Verify:** build + E2E a11y + route regression.
- **Rollback:** revert new features to Advanced navigation.

#### FF-025 — Web visual + accessibility acceptance suite (P1)

- **Depends:** FF-019 through FF-024.
- **Files:** `tests/visual/spa-visual.test.ts`, `tests/visual/README.md`, đề xuất `tests/visual/workspace-v2-a11y.test.ts`.
- **TDD:** 320, 390, 768, 1024, 1440 snapshots; focus visible; dialogs focus trapped; error copy; reduced motion; contrast checks.
- **PASS:** no critical/serious a11y findings, no broken layout, no secret content in screenshots. Baseline screenshots reviewed rather than blind snapshot update.
- **Verify:** CI pinned-browser visual suite + manual screen reader walkthrough notes.
- **Rollback:** no runtime changes, only tests.

**Checkpoint C4:** Web onboarding 4 steps, old links still usable, all state/controls live through owner-authenticated API, CLI/Web same workspace ID.

### P05 — Source consolidation, E2E, documentation, RC

#### FF-026 — Extract Dashboard workspace/owner routes by domain (P2)

- **Depends:** FF-014, FF-015, FF-025.
- **Files:** `src/dashboard/server.ts`, đề xuất `src/dashboard/routes/index.ts`, `src/dashboard/routes/workspace-controller.ts`, `tests/integration/dashboard-admin.test.ts`.
- **TDD:** exact route/permission/error snapshot before move; malformed body, CSRF/Origin, content-type, owner token, status code negative tests.
- **Implementation:** move routing logic behind existing auth gates, NOT duplicate checks in each route; keep same public v1 URLs.
- **PASS:** server shrinks by responsibility, tests unchanged, no auth header divergence, no circular imports.
- **Verify:** Dashboard integration suite, `npm run architecture:check`, `npm run verify`.
- **Rollback:** revert extraction with no state migration.

#### FF-027 — Simplify `src/main.ts` dispatch without changing options (P2)

- **Depends:** FF-018, FF-026.
- **Files:** `src/main.ts`, đề xuất `src/cli/command-dispatch.ts`, `src/onboarding/workspace-up.ts`, đề xuất `tests/contracts/legacy-commands.test.ts`.
- **TDD:** command precedence, old help, env precedence, `--project`/stdio/HTTP, unknown command errors, `connect` ambiguous forms.
- **Implementation:** move command dispatch into focused functions; keep `main.ts` composition root, do not duplicate startup logic.
- **PASS:** all legacy CLI cases no behavioral drift; diff size reviewable.
- **Verify:** focused CLI tests, smoke stdio+HTTP, `npm run verify`.
- **Rollback:** revert only command extraction.

#### FF-028 — Break up Fleet UI & formalize Advanced navigation (P2)

- **Depends:** FF-021, FF-025.
- **Files:** `packages/mission-control/src/screens/Fleet.tsx`, đề xuất `packages/mission-control/src/features/advanced/fleet/FleetOverview.tsx`, `packages/mission-control/src/features/advanced/fleet/FleetActions.tsx`, `packages/mission-control/src/App.tsx`.
- **TDD:** existing Fleet operations/settings/permissions stable; no hidden required controls; links preserved.
- **Implementation:** split by feature responsibility and state, not arbitrary line count; owner guard centralized; expose Advanced breadcrumb.
- **PASS:** same function, fewer concerns per file, 0 orphan state, no need install UI toolkit.
- **Verify:** Mission Control build + Fleet integration/visual regression.
- **Rollback:** return old Fleet screen via route alias.

#### FF-029 — Golden end-to-end scenario + parity proof (P0)

- **Depends:** FF-018, FF-024, FF-026, FF-027.
- **Files:** đề xuất `tests/acceptance/workspace-v2-e2e.test.ts`, `tests/integration/workspace-tool-governance.test.ts`, `scripts/smoke-onboarding.mjs` (extend, don't rewrite), `docs/audit/` (new evidence report).
- **TDD/E2E:** scenario A (non-Git→Cursor→stdio configured→MCP connected→read/write→audit); B (HTTP auth and two isolated workspace sessions); C (revoke + crash + disk full), all on isolated test dirs.
- **PASS:** AC-01..AC-14 evidence table with commit SHA, command, exit code and counterexample cases; 0 wrong-root / 0 false connection.
- **Verify:** `npm run verify`, `npm run build`, `npm run smoke:stdio`, `npm run smoke:http`, `npm run smoke:onboarding`, `npm run docs:check`, selected coverage/critical tests.
- **Rollback:** no live migration; hold release if any parity failure.

#### FF-030 — Documentation, migration, release candidate (P2)

- **Depends:** FF-029.
- **Files:** `README.md`, `docs/ARCHITECTURE.md`, `docs/CONFIGURATION.md`, đề xuất `docs/migrations/workspace-v2.md`, `docs/README.md` (if five files enough; split task if tests need more).
- **TDD:** copy/paste commands from README run against release candidate; compare help/API docs to implementation; feature inventory no stale PR-only F14/F15 claims.
- **Implementation:** quickstart (5 min), CLI/Web equivalence, security truth-in-advertising, non-Git walkthrough, troubleshooting, old-to-new mapping.
- **PASS:** user can follow quickstart without needing Fleet terminology; docs check green, commands accurate, compatibility policy clear.
- **Verify:** docs check and manual first-user test with fresh state dir.
- **Rollback:** docs-only.

**Checkpoint C5 / MVP RC:** all AC-01..AC-11, AC-13, AC-14 proved in source/CI. AC-12 **remains a separate production gate**, not automatically green.

### P06 — Advanced extensions and production acceptance (not part of automatic MVP)

#### FF-031 — Multi-project gateway eligibility (P3)

- **Depends:** C5 + explicit gateway security review; #118 only if activating isolation registry/recovery.
- **Files:** `src/multiproject/project-gateway.ts`, `src/multiproject/fair-scheduler.ts`, `tests/integration/multi-project.test.ts`, `tests/integration/multiproject-fair-load.test.ts`.
- **TDD:** host same UID risk, per-principal grant scope, worker isolation, cross-project concurrency, queue fairness, restart reset, auth token rotation, p95 under measured load.
- **PASS:** no wrong-root across gateway; explicit limit statements; no claim multi-host fairness without shared store.
- **Verify:** staged load/chaos, independent security review, metrics report.
- **Rollback:** gateway remains opt-in, single-project route unaffected.

#### FF-032 — Browser control scope (P3; chỉ sau user quyết định)

- **Depends:** FF-013, C5.
- **Files:** `src/browser/`, `src/tools/browser-tools.ts`, `src/adapters/child-mcp/`, `tests/integration/` matching current browser adapter.
- **Decision:** có hai nghĩa: Web *control console* đã nằm P04; AI *browser automation* là adapter riêng. Owner chọn có bật Playwright/real browser hay không.
- **TDD:** allowed origins/domains, session isolation, secrets/cookies redaction, downloads confined, navigation abuse, approval for destructive external websites.
- **PASS:** browser remains OFF by default unless explicit scoped grant and sandbox evidence; no privileged browser tool bypass.
- **Verify:** pinned browser CI + isolated real browser E2E.
- **Rollback:** adapter feature flag off.

#### FF-033 — Production attestation, canary, rollback (P0 production-only)

- **Depends:** C5 + owner written sign-off + host capacity/artifact/auth gates; **GATE-SEC-118 + GATE-RECOVERY nếu có isolation registry/recovery integration**; FF-031 nếu deploy gateway.
- **Files:** đề xuất `docs/operations/workspace-v2-canary.md`, `scripts/` release evidence helpers (if necessary), `docs/operations/workspace-v2-rollout-checklist.md`.
- **Steps:** off-host backup/restore drill → disk headroom → process binary SHA/version provenance → isolated canary owner consent → live auth negative tests → controlled route transition → roll back dry run → soak and monitoring. Do not auto-delete legacy data.
- **PASS:** independent security sign-off cho boundary được deploy (bao gồm #118 nếu động isolation registry), exact artifact hash matches process, rollback tested, no audit-loss ENOSPC; no active invalid record overwritten. Owner approves cutover.
- **Verify:** signed operator evidence + CI links + runtime traces, not just passing unit tests.
- **Rollback:** revert route/process via approved supervisor; registry preserved.

## 5. Traceability matrix — mỗi nghiệm thu được chứng minh ở đâu?

| Spec acceptance | Implementation tasks | Evidence chính |
|---|---|---|
| AC-01 folder thường/Git/rỗng | FF-003, 005, 010, 016, 022, 029 | E2E temp roots |
| AC-02 CLI/Web same ID/grant | FF-006, 010, 014, 020, 029 | API/CLI parity |
| AC-03 STDIO vs HTTP state truth | FF-007, 008, 011, 023, 029 | MCP handshakes |
| AC-04 2+ roots/session no wrong-root | FF-005, 007–009, 029, 031 | adversarial integration |
| AC-05 owner-only scopes | FF-009, 013–015, 029 | auth/CSRF negatives |
| AC-06 same usecases/errors | FF-010, 014, 016–018, 020 | typed contract tests |
| AC-07 revoke and worker acknowledgement | FF-013, 015, 017, 024 | owner revoke flow |
| AC-08 idempotency | FF-006, 011, 014 | duplicate/race tests |
| AC-09 disk/crash/unknown | FF-003, 006, 011, 029, 033 | injected faults / durable event |
| AC-10 old API/CLI behavior | FF-001, 018, 021, 026, 027 | golden compatibility |
| AC-11 Web accessibility | FF-019, 021–025 | browser + axe + manual |
| AC-12 production qualification | FF-002, 031, 033 | signed gates/canary |
| AC-13 CI verify, no blind skip | all + FF-029 | exact SHA CI |
| AC-14 Advanced reachable | FF-021, 028, 030 | route/deeplink tests |

## 6. Quality gates — lệnh thật và lịch chạy

Các lệnh dưới đây lấy từ `package.json` của baseline; các file test `workspace-v2-*` là **file dự định tạo**. Test/fault phải chạy trên CI hoặc isolated checkout đủ dung lượng, **không trên production host đang gần đầy**.

```bash
# Sau mỗi task code: dùng focused suite theo Files/Test của task
npx vitest run tests/integration/workspace-store.test.ts
npm run typecheck
npm run lint
npm run architecture:check

# Checkpoint sau 2–3 task; không áp lực chạy lặp trên host live
npm run verify                 # typecheck + lint + architecture + npm test
npm run docs:check
npm run build
npm run smoke:stdio
npm run smoke:http
npm run smoke:onboarding

# Release candidate / nhánh coverage riêng trên CI
npm run test:coverage
```

**CI baseline:** tại main `b2ad52e` GitHub Actions 7 jobs success; run trước đó có Ubuntu/Node22 **1,590 pass / 47 skip / 0 fail**, branch coverage **66.91%**. Giữ hoặc tăng critical changed-branch coverage; không làm test skipped/disabling gate để tô xanh. Nếu test flaky, report reproduction + root cause; không đổi timeout vô hạn.

**Automated acceptance:** Linux/macOS/Windows, Node 22/24 theo matrix hiện có. Browser/visual runs pinned Chromium như CI; CI success không đồng nghĩa host deployment success.

## 7. Migration strategy — không đập bỏ thứ đang chạy

| Thành phần cũ | Hành động MVP | Khi nào deprecate? | Rollback |
|---|---|---|---|
| `folderforge init`, `connect <client>`, `--stdio/--http` | Giữ, thêm lệnh mới đứng bên cạnh | Chỉ sau usage/versioning policy | dispatch cũ |
| Dashboard `/workspaces*`, `/operator/config*` | Giữ v1; API mới `/api/v2/*` | Sau E2E parity & documented migration | disable v2 routes |
| `WorkspaceManager.current` | Hỗ trợ legacy single-process nhưng **không** dùng cho new agent requests | Khi 100% request paths request-scoped và tests xanh | legacy local single-project only |
| Old Mission Control routes | Redirect hoặc giữ dưới Advanced | Sau link/bookmark inventory | restore nav |
| Fleet/plugin/browser/agent loop modules | Giữ code, ẩn khỏi quickstart | Chỉ sau usage/cost/security review | feature flag/Advanced tab |
| 39 detached worktrees, 24 isolation records | Không động đến | Chỉ theo recovery program riêng có approved host fence | backup + owner restore |
| npm/release pipeline | Không đổi artifact packaging trong MVP | Sau release proof | npm semver/revert plan |

**Không migrate tất cả dữ liệu trong ngày đầu.** New schema có version, read-through adapter (nếu cần) và dry-run; migrate chỉ sau diff/recovery proof. Cùng workspace root phải không tạo trùng ID; làm rõ merge conflict bằng owner review.

## 8. Rủi ro quan trọng và cách xử lý

| Rủi ro | Dễ xảy ra như thế nào? | Cách chặn |
|---|---|---|
| "One folder" hứa hẹn security quá mức | Shell cùng UID có thể đọc ngoài root dù UI nói confined | phân biệt logical boundary vs OS sandbox; deny unsupported full mode |
| Feature flag phản tác dụng | Code bị nhân đôi trong thời gian migration | one usecase, adapter thin, sunset date, no parallel business logic |
| Hiển thị trạng thái giả | PID lên nhưng MCP handshake failed, STDIO chưa có client | connection state machine + real protocol checks |
| Split server phá auth | Route handler mới bỏ Origin/CSRF/owner guard | route contract snapshots + auth negatives + shared guard |
| Stored identity drift | folder rename/mount/symlink changed | root revalidation + owner rebind, no silent reassignment |
| CI xanh nhưng live runtime cũ | dist/process digest mismatch | canary/proof process SHA before cutover |
| Host 100% disk | audit/config write fail, corrupt registry | off-host backup, headroom gate, fail-closed faults |
| "Chỉ còn main" che mất recovery | 39 detached worktrees chứa state, branch identities gone | no forced deletion; owner recovery classification |
| Revoke không dừng child | running subprocess vẫn có OS quyền | supervisor ownership, cancellation/revocation ack + honest status |
| Thêm tính năng mọi nơi | MVP phình thành full Fleet/browser/distributed rewrite | advanced backlog after AC-01..14 and owner approval |

## 9. Chính sách change control, owner review và điều kiện dừng

**Phải dừng và yêu cầu owner duyệt** nếu task muốn: đổi production auth mode, bật `danger`, tăng quyền host/UID, ghi real isolation registry, xóa detached worktree, thay trusted runner permissions, auto-publish npm, mở public tunnel, xóa user config, migration destructive hoặc có E2E/coverage giảm.

**Khi không đủ thông tin**, ghi state `OPEN/UNVERIFIED` và thử nghiệm trong fixture, không điền bằng suy đoán. Reviewer độc lập cần được giao #118 riêng; người viết implementation không tự phê duyệt security proof của chính mình.

**Quyết định owner cần chốt trước FF-016/FF-022:** mục tiêu primary MCP connection `stdio` hay HTTP; "full quyền" có OS-isolated workspace shell hay trusted local developer-only; Web browser automation thuộc MVP hay Advanced; OS/platform support level. Defaults của bản plan: local stdio đầu tiên, OS-confined claim chỉ sau proof, browser automation Advanced, mọi platform hỗ trợ nhưng no unsupported sandbox claim.

## 10. Bảng kiểm nghiệm thu cuối cùng

- [ ] **C0:** nguồn/compat contract frozen, backup/recovery provenance, isolated fixture.
- [ ] **C1:** immutable workspace context; no wrong-root tool execution, session tests.
- [ ] **C2:** owner-controlled usecase parity, no double business logic, idempotent operations.
- [ ] **C3:** one CLI command, non-Git folder, connection receipt và handshake truth.
- [ ] **C4:** four-section Web, onboarding, revoke, Activity, accessibility, old links.
- [ ] **C5:** modular refactor + full CI, documentation and RC proof.
- [ ] **C6:** independently approved production security, artifact SHA/live canary/rollback, 24h soak as required.

**Nguyên tắc cuối:** ưu tiên **một luồng sản phẩm đơn giản, một policy engine chuẩn và một root identity không thể nhầm**, thay vì chỉ thu nhỏ menu hoặc xóa mã cho đẹp. Phase P00–P05 đủ để cho ra v2 MVP; P06 là chương trình nâng cao riêng có gate.

---

**Cách dùng plan:** chủ repo review Spec và các quyết định còn mở → xác nhận từng checkpoint → triển khai một task mỗi lần trên isolated checkout → đính CI/evidence trong task checklist → chỉ merge/cutover sau gates. *Không task nào đã được thực hiện bởi việc xuất bản tài liệu này.*