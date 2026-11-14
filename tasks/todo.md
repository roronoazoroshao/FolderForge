# FolderForge v2 — Implementation Checklist

**Canonical specification:** [Spec](../docs/superpowers/specs/2026-11-14-folderforge-v2-design.md) · **Detailed plan:** [Plan](../docs/superpowers/plans/2026-11-14-folderforge-v2-implementation.md) · **Issue tracker:** [tasks/plan.md](plan.md).

**Source implementation đã bắt đầu trong nhánh review:** FF-001 contract regression, FF-003 isolated fixtures và FF-004 workspace identity/context mới (chưa gắn MCP). **Chưa checkpoint nào được ký nhận và chưa issue nào được đóng.** Checklist được đồng bộ với [Implementation Plan](../docs/superpowers/plans/2026-11-14-folderforge-v2-implementation.md). Đây là công cụ theo dõi, không phải báo cáo tiến độ thực tế.
**Cách dùng:** tích task **sau khi** có test/CI evidence và owner review; ghi commit SHA, test run và reviewer trong issue/PR tương ứng. Đừng xóa task cũ chỉ vì không còn branch.

## Các checkpoint cần ký nhận

- [ ] **C0** Baseline source/contracts, fixture, backup/recovery owner provenance.
- [ ] **C1** Immutable per-request workspace context, no wrong-root; chưa coi là OS sandbox-certified.
- [ ] **C2** Shared usecases, Control API, owner auth, CLI/Web parity.
- [ ] **C3** CLI `up` → connection receipt → real client MCP handshake → controlled work.
- [ ] **C4** Web bốn khu vực, Add Folder, Connect, Sessions, Activity, keyboard/a11y, legacy links.
- [ ] **C5** Full source CI, feature flow E2E, docs, release candidate review.
- [ ] **C6** Owner-approved canary + rollback + security gates thích hợp; #118 riêng nếu dùng isolation registry.

## Danh sách 33 nhiệm vụ

### FF-001 — Chốt baseline và compatibility contract (P0)

**GitHub:** [#162](https://github.com/roronoazoroshao/FolderForge/issues/162)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** không.
- **PASS:** baseline SHA và list public contracts được khóa; 0 unexpected change; test tập trung có lệnh tái hiện.
- **Kiểm tra:** `npx vitest run tests/integration/facade.test.ts tests/integration/dashboard-workspaces.test.ts tests/integration/mcp-modern-stdio.test.ts` trong isolated runner; `npm run docs:check`.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-002 — Tạo operational safety manifest và recovery boundary (P0)

**GitHub:** [#163](https://github.com/roronoazoroshao/FolderForge/issues/163)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-001.
- **PASS:** manifest liệt kê exact paths + sha/digest (không lộ token), 24 registry identities và hướng xử lý; không thay registry/worktrees.
- **Kiểm tra:** owner-signed snapshot comparison; file checksum và restore drill **trên host khác**, không dùng live registry.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-003 — Isolated fixture/test harness + fault injection (P0)

**GitHub:** [#164](https://github.com/roronoazoroshao/FolderForge/issues/164)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-001.
- **PASS:** temp directories auto cleanup theo ownership; không target `~/.folderforge` thật; every destructive case isolated.
- **Kiểm tra:** `npx vitest run tests/integration/workspace-v2-faults.test.ts` (sau khi tạo).
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-004 — Workspace identity / immutable context types (P0)

**GitHub:** [#165](https://github.com/roronoazoroshao/FolderForge/issues/165)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-001, FF-003.
- **PASS:** tests rejects missing principal, ambiguous root, reused session across root; no mutable global in new API.
- **Kiểm tra:** `npx vitest run tests/unit/workspace-identity.test.ts`; `npm run typecheck`.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-005 — Verify root & path identity with adversarial cases (P0)

**GitHub:** [#166](https://github.com/roronoazoroshao/FolderForge/issues/166)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-004.
- **PASS:** mọi path escape deterministic bị deny; không claim OS confinement chỉ bằng string checks; test Windows/macOS/Linux theo CI.
- **Kiểm tra:** focused Vitest + cross-OS matrix; `npm run architecture:check`.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-006 — Durable registry + CAS + idempotency port (P0)

**GitHub:** [#167](https://github.com/roronoazoroshao/FolderForge/issues/167)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-004, FF-003.
- **PASS:** zero duplicate record for same root, no truncated JSON after fault tests, deterministic error codes; no new database dependency.
- **Kiểm tra:** focused tests + `npm run typecheck`, fault harness.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-007 — Bind workspace context at MCP entry (stdio) (P0)

**GitHub:** [#168](https://github.com/roronoazoroshao/FolderForge/issues/168)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-004, FF-005, FF-006.
- **PASS:** 0 cross-project wrong-root; backward compatible request/response wire format.
- **Kiểm tra:** focused tests, `npm run smoke:stdio` after build.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-008 — Bind workspace context at MCP entry (HTTP) (P0)

**GitHub:** [#169](https://github.com/roronoazoroshao/FolderForge/issues/169)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-004, FF-005, FF-006.
- **PASS:** switching folder in legacy UI never changes existing HTTP session execution root; no principal escalation.
- **Kiểm tra:** integration tests + `npm run smoke:http` after build.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-009 — Tool kernel context enforcement and two-root matrix (P0)

**GitHub:** [#170](https://github.com/roronoazoroshao/FolderForge/issues/170)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-007, FF-008.
- **PASS:** all tool families tested with 0 wrong-root; no bypass through adaptive tools. Shell OS confinement evidence separated from logical checks.
- **Kiểm tra:** focused tests, `npm run architecture:check`, security negative tests.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-010 — Add/list/status usecases (P1)

**GitHub:** [#171](https://github.com/roronoazoroshao/FolderForge/issues/171)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-006, FF-009.
- **PASS:** parity result DTO for same input; no network open during add.
- **Kiểm tra:** focused tests + typecheck.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-011 — Managed start/stop/health supervisor (P1)

**GitHub:** [#172](https://github.com/roronoazoroshao/FolderForge/issues/172)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-010.
- **PASS:** no duplicate daemon, no arbitrary process kill, reason-coded degraded state, no false connected.
- **Kiểm tra:** focused tests + local isolated smoke.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-012 — ConnectionReceipt + client config preview/undo (P1)

**GitHub:** [#173](https://github.com/roronoazoroshao/FolderForge/issues/173)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-010, FF-011.
- **PASS:** stdio configured correctly, no token in console/audit, existing user settings preserved.
- **Kiểm tra:** focused + `npm run smoke:onboarding` in test environment.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-013 — Owner grants, revocation and enforcement lifecycle (P0)

**GitHub:** [#174](https://github.com/roronoazoroshao/FolderForge/issues/174)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-006, FF-009, FF-010.
- **PASS:** new requests fail on revoked grant, existing long-running request status truthful, no host elevation from local token.
- **Kiểm tra:** focused tests + threat cases.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-014 — Versioned local Control API for add/status/health (P1)

**GitHub:** [#175](https://github.com/roronoazoroshao/FolderForge/issues/175)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-010, FF-011, FF-013.
- **PASS:** owner-only mutation enforced server-side; same service output as CLI service; legacy dashboard integration still green.
- **Kiểm tra:** focused tests + `tests/integration/dashboard-admin.test.ts`.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-015 — Connection/grants/session/activity endpoints (P1)

**GitHub:** [#176](https://github.com/roronoazoroshao/FolderForge/issues/176)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-012, FF-013, FF-014.
- **PASS:** Web can list real connections, create receipt, review grant/approval and revoke; no owner claim from tunnel.
- **Kiểm tra:** focused tests, `npm run architecture:check`.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-016 — New command router for `up` (P1)

**GitHub:** [#177](https://github.com/roronoazoroshao/FolderForge/issues/177)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-010, FF-012, FF-014.
- **PASS:** one-command produces stable receipt; exit statuses and error explanations are deterministic.
- **Kiểm tra:** `npx vitest run tests/integration/workspace-up-cli.test.ts`; `npm run smoke:onboarding` (built fixture).
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-017 — CLI `status`, `ui`, `stop`, scoped access controls (P1)

**GitHub:** [#178](https://github.com/roronoazoroshao/FolderForge/issues/178)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-011, FF-013, FF-016.
- **PASS:** CLI and Web share operation ID, status enums, validation; no new insecure shortcut to `danger`.
- **Kiểm tra:** focused tests + CLI help snapshot.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-018 — CLI compatibility & connect client protocol matrix (P0)

**GitHub:** [#179](https://github.com/roronoazoroshao/FolderForge/issues/179)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-016, FF-017.
- **PASS:** current integration and smoke remain PASS on Linux/macOS/Windows CI; no involuntary user config reset.
- **Kiểm tra:** `npm run build`, `npm run smoke:stdio`, `npm run smoke:http`, `npm run smoke:onboarding` on CI isolated workers.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-019 — Semantic tokens and UI primitives (P1)

**GitHub:** [#180](https://github.com/roronoazoroshao/FolderForge/issues/180)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-014.
- **PASS:** all new screens consume tokens/components; WCAG AA contrast verified, reduced motion, 320–1440 responsive.
- **Kiểm tra:** `npm run build:mission-control`, visual tests and axe on preview app (needs running preview URL).
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-020 — Typed API client + hooks (P1)

**GitHub:** [#181](https://github.com/roronoazoroshao/FolderForge/issues/181)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-014, FF-015.
- **PASS:** no duplicated endpoint schema per screen, error states user-actionable, no token logging.
- **Kiểm tra:** UI build + API contract tests.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-021 — Navigation and legacy deep-link preservation (P1)

**GitHub:** [#182](https://github.com/roronoazoroshao/FolderForge/issues/182)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-019.
- **PASS:** existing bookmarks/tests work, no blank screen, valid active nav at narrow widths.
- **Kiểm tra:** mission-control build and Playwright visual/route test in isolated preview.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-022 — Add Folder wizard, typed permissions (P1)

**GitHub:** [#183](https://github.com/roronoazoroshao/FolderForge/issues/183)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-019, FF-020, FF-021.
- **PASS:** can add non-Git folder, shows effective scoped permissions and denial reasons, keyboard-only.
- **Kiểm tra:** UI build, e2e on preview, axe where available.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-023 — Connect Agent + accurate health receipt (P1)

**GitHub:** [#184](https://github.com/roronoazoroshao/FolderForge/issues/184)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-012, FF-020, FF-022.
- **PASS:** 0 false CONNECTED; dry-run config modifications understandable, undo available.
- **Kiểm tra:** preview Web E2E + mocked auth failure + real fake MCP server handshake.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-024 — Folder details, Sessions and Activity (P1)

**GitHub:** [#185](https://github.com/roronoazoroshao/FolderForge/issues/185)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-015, FF-020, FF-021, FF-023.
- **PASS:** same workspace visible from CLI and Web; operators can trace each action by operation ID; no phantom success before response.
- **Kiểm tra:** build + E2E a11y + route regression.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-025 — Web visual + accessibility acceptance suite (P1)

**GitHub:** [#186](https://github.com/roronoazoroshao/FolderForge/issues/186)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-019 through FF-024.
- **PASS:** no critical/serious a11y findings, no broken layout, no secret content in screenshots. Baseline screenshots reviewed rather than blind snapshot update.
- **Kiểm tra:** CI pinned-browser visual suite + manual screen reader walkthrough notes.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-026 — Extract Dashboard workspace/owner routes by domain (P2)

**GitHub:** [#187](https://github.com/roronoazoroshao/FolderForge/issues/187)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-014, FF-015, FF-025.
- **PASS:** server shrinks by responsibility, tests unchanged, no auth header divergence, no circular imports.
- **Kiểm tra:** Dashboard integration suite, `npm run architecture:check`, `npm run verify`.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-027 — Simplify `src/main.ts` dispatch without changing options (P2)

**GitHub:** [#188](https://github.com/roronoazoroshao/FolderForge/issues/188)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-018, FF-026.
- **PASS:** all legacy CLI cases no behavioral drift; diff size reviewable.
- **Kiểm tra:** focused CLI tests, smoke stdio+HTTP, `npm run verify`.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-028 — Break up Fleet UI & formalize Advanced navigation (P2)

**GitHub:** [#189](https://github.com/roronoazoroshao/FolderForge/issues/189)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-021, FF-025.
- **PASS:** same function, fewer concerns per file, 0 orphan state, no need install UI toolkit.
- **Kiểm tra:** Mission Control build + Fleet integration/visual regression.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-029 — Golden end-to-end scenario + parity proof (P0)

**GitHub:** [#190](https://github.com/roronoazoroshao/FolderForge/issues/190)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-018, FF-024, FF-026, FF-027.
- **PASS:** AC-01..AC-14 evidence table with commit SHA, command, exit code and counterexample cases; 0 wrong-root / 0 false connection.
- **Kiểm tra:** `npm run verify`, `npm run build`, `npm run smoke:stdio`, `npm run smoke:http`, `npm run smoke:onboarding`, `npm run docs:check`, selected coverage/critical tests.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-030 — Documentation, migration, release candidate (P2)

**GitHub:** [#191](https://github.com/roronoazoroshao/FolderForge/issues/191)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-029.
- **PASS:** user can follow quickstart without needing Fleet terminology; docs check green, commands accurate, compatibility policy clear.
- **Kiểm tra:** docs check and manual first-user test with fresh state dir.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-031 — Multi-project gateway eligibility (P3)

**GitHub:** [#192](https://github.com/roronoazoroshao/FolderForge/issues/192)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** C5 + explicit gateway security review; #118 only if activating isolation registry/recovery.
- **PASS:** no wrong-root across gateway; explicit limit statements; no claim multi-host fairness without shared store.
- **Kiểm tra:** staged load/chaos, independent security review, metrics report.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-032 — Browser control scope (P3)

**GitHub:** [#193](https://github.com/roronoazoroshao/FolderForge/issues/193)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** FF-013, C5.
- **PASS:** browser remains OFF by default unless explicit scoped grant and sandbox evidence; no privileged browser tool bypass.
- **Kiểm tra:** pinned browser CI + isolated real browser E2E.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

### FF-033 — Production attestation, canary, rollback (P0)

**GitHub:** [#194](https://github.com/roronoazoroshao/FolderForge/issues/194)

- [ ] **Hoàn thành và có bằng chứng**
- **Phụ thuộc:** C5 + owner written sign-off + host capacity/artifact/auth gates; **GATE-SEC-118 + GATE-RECOVERY nếu có isolation registry/recovery integration**; FF-031 nếu deploy gateway.
- **PASS:** independent security sign-off cho boundary được deploy (bao gồm #118 nếu động isolation registry), exact artifact hash matches process, rollback tested, no audit-loss ENOSPC; no active invalid record overwritten. Owner approves cutover.
- **Kiểm tra:** signed operator evidence + CI links + runtime traces, not just passing unit tests.
- **Evidence / Commit / Reviewer:** _(chưa có; bổ sung khi triển khai)_

## P07 — Host Operator / full-capability agent (Advanced)

### FF-034 — Capability catalog và effective access explanation

**GitHub:** [#196](https://github.com/roronoazoroshao/FolderForge/issues/196)
- [ ] **Hoàn thành và có bằng chứng** (chưa triển khai)
- **Phụ thuộc:** FF-009, FF-013, FF-020.
- **PASS:** correct `ready/disabled/not-installed/denied` plus CLI/Web parity.
- **Kiểm tra:** unit capability inventory, TypeScript, lint, architecture.

### FF-035 — Local browser automation quality & proof

**GitHub:** [#197](https://github.com/roronoazoroshao/FolderForge/issues/197)
- [ ] **Hoàn thành và có bằng chứng** (chưa triển khai)
- **Phụ thuộc:** FF-013, FF-023, FF-029.
- **PASS:** owner opt-in, pinned Chromium E2E, isolated browser profile and screenshot evidence.
- **Kiểm tra:** browser integration + permission negative tests.

### FF-036 — Owner-authenticated Host Operator broker

**GitHub:** [#198](https://github.com/roronoazoroshao/FolderForge/issues/198)
- [ ] **Hoàn thành và có bằng chứng** (chưa triển khai)
- **Phụ thuộc:** FF-013, FF-034, C5 + independent security review.
- **PASS:** no MCP privilege self-grant, expiring broker scope and rollback.
- **Kiểm tra:** host authority negative matrix and approved isolated canary.

### FF-037 — Cross-agent capability conformance + host rollback

**GitHub:** [#199](https://github.com/roronoazoroshao/FolderForge/issues/199)
- [ ] **Hoàn thành và có bằng chứng** (chưa triển khai)
- **Phụ thuộc:** FF-034, FF-035, FF-036.
- **PASS:** verified end-to-end evidence; 0 wrong-scope mutations and truthful outcomes.
- **Kiểm tra:** CI capability matrix + independent operator sign-off.

- [ ] **C7:** Full-host authority stage independently reviewed and approved; not required for basic MCP MVP.

## Gate phải báo owner trước khi đổi production

- [ ] Rà soát backup off-host, available disk và runtime SHA trước canary.
- [ ] Nếu đụng isolation registry: security issue #118 (host writer fencing) + phân loại 24 active records; không tự reconcile.
- [ ] Nếu quyền Full workspace: chứng minh OS/sandbox và auth boundary, không đánh đồng với `danger`/host root.
- [ ] Canary riêng, logs/audit không chứa secrets, rollback được owner xác nhận.
- [ ] Không xóa detached worktree, recovery metadata hoặc đổi tunnel endpoint ngoài phạm vi đã duyệt.