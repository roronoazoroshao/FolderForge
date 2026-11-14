# FolderForge — Audit toàn bộ feature, runtime flow và issue đang tồn tại

**Thời điểm kiểm kê:** 14/11/2026 (Asia/Ho_Chi_Minh).
**Baseline source:** `main@35a400319ea1abfebb786400b465b872b028bc03`, package `@musashishao/folderforge@3.2.4`.
**Phạm vi bằng chứng:** source TypeScript, tests, GitHub issues/CI exact SHA, trạng thái FolderForge connector và phép đọc host. Không có production cutover/restart, không chạy reconcile/restore registry thực, không có độc lập security approval.
**Cách đọc:** `IMPLEMENTED` = có source; `TESTED` = có test/CI; `LIVE-VERIFIED` = đã xác minh trên host production; `NOT PROVEN` = chưa có bằng chứng, không đồng nghĩa tính năng hỏng.

## 1. Kết luận kiểm tra chính xác

- GitHub **chỉ còn remote `main`**, local cũng chỉ còn `main`; không còn PR mở. Đã xóa 42 branch local và remote G01 cuối sau khi lưu Git bundle, bản vá chưa commit, snapshot registry và sequencer cherry-pick.
- 40 worktree vẫn tồn tại, gồm root `main` và **39 detached worktree**. Đây là checkout dữ liệu còn được giữ, KHÔNG phải 39 branch hay 39 tiến trình agent.
- Backup lưu nội bộ (KHÔNG push lên GitHub): `.git/branch-cleanup-backups/2026-11-14-main-only/` — bundle ~30 MB/131 ref, inventory, bản vá 4 worktree, untracked evidence, snapshot `isolations.json` và G01 cherry-pick metadata. Bundle `git bundle verify` và SHA-256 đều PASS. Backup nằm cùng host: chưa có off-host restore drill.
- Sau purge, API `isolation_list` báo **24 record active trong metadata, 22 `unverifiable`, 2 `missing_worktree`**. Tất cả không đạt điều kiện `present_consistent` cho tiếp tục workflow. Không gọi `isolation_reconcile_missing`, `restore`, `discard`, `git clean` hoặc force-delete đối với chúng khi chưa có owner provenance và writer fence.
- GitHub main CI [run 43483493827](https://github.com/roronoazoroshao/FolderForge/actions/runs/43483493827) **7/7 SUCCESS tại attempt 2**, vì attempt 1 có một job macOS/Node24 bị hủy. Ubuntu Node22 **1.590 tests PASS, 47 SKIP, 0 FAIL**, 199 files PASS / 3 SKIP. Coverage statements **76.03%**, branches **66.91%**, functions **81.52%**, lines **79.67%**. Các bước SKIP không phải kiểm chứng.
- Các kiểm tra đọc từ checkout `main`: `npm audit --omit=dev --audit-level=moderate` 0 vulnerabilities; `npm run docs:check` 128 Markdown PASS; `npm run architecture:check` 0 cycles, 0 violations (165 files / 389 runtime edges).
- **Source != live deployment:** `dist/main.js` trên host sửa đổi cuối ngày 17/10, trong khi commit main là 14/11; các tiến trình đang chạy có thời điểm khởi động 7–11/11. Không có bằng chứng process/tunnel đã load source F14/F15 hoặc các bản vá vừa merge. KHÔNG restart/cutover tự động.
- Máy host chỉ có khoảng **2.8 GB khả dụng, `df` hiển thị 100%**; `.git/folderforge/` ~9.7 GB phần lớn do checkout/caches lịch sử. Rủi ro ENOSPC/durability cao, cần giải phóng cache có kiểm kê mà không xóa bằng chứng recovery.
- `workspace_status`: `danger`; `policy_get`: `dangerBypassesApprovals=true`; `capsule_status`: 0 capsule active. Scan process cho thấy nhiều live FolderForge service ở danger (một số có `--dangerously-allow-critical`) và một số tunnel `--no-oauth`. Authentication token có thể vẫn bật; **đây là mặt phẳng rủi ro quyền hạn, không phải bằng chứng exploit**.
- Repo công khai có **5 issue OPEN** (#70/#105/#118/#126/#145), **0 PR OPEN**. Một số issue và feature inventory phản ánh baseline cũ, không nên dùng làm trạng thái hiện tại mà không đối chiếu source/CI.

## 2. Luồng hoạt động và bằng chứng theo từng nhóm tính năng

| # | Flow / entrypoint | Flow thực tế theo source | Mức độ chứng minh | Khoảng trống còn lại |
|---|---|---|---|---|
| F01 | `src/main.ts` + `src/onboarding/cli.ts`, `src/doctor/` | Parse CLI → load/validate config → project root → Container → server / adapter. `init → doctor → connect cursor`. | **TESTED**: CI onboarding và CLI smoke | Không suy luận host hiện chạy bản build tương ứng `main`. |
| F02 | `src/server/mcp-server.ts`, `src/server/protocol/`, `src/server/transports/` | MCP initialize → phiên stdio hoặc HTTP → token/API-key/OAuth principal → tools/list/call → response. HTTP ràng session với principal và protocol version. | **TESTED**: matrix/HTTP/stdio smoke | Live tunnel/SDK matrix trên từng operator cần chứng minh riêng. |
| F03 | `src/tools/registry.ts`, `src/policy/`, `src/capsule/`, `src/audit/` | Principal → classify tool risk/args → capsule/policy → approval nếu cần → per-tool rate limiter → handler → audit event/result. | **TESTED**: unit/integration | Mode `danger` bỏ approval; shell cùng host UID không bị kernel chặn ngoài root. |
| F04 | `src/tools/file-tools.ts`, `git-tools.ts`, `terminal-tools.ts`, `search-tools.ts`, `code-tools.ts` | File/search/LSP/code context → Git/patch/shell/build → JSON evidence. Chỉ tập con tool bật theo preset. | **TESTED**: CLI/MCP/tool cases | Thao tác path đối kháng, prompt injection và external binary trong live permission cần kiểm chứng. |
| F05 | `src/tools/agent-tools.ts` | `project_analyze` + `code_context` + `patch_transaction` + `project_verify`. Context/patch có giới hạn; verification trả trạng thái thực. | **TESTED** | Cung cấp tools cho agent khác, không tự chứng minh có LLM tự viết code. |
| F06 | `src/workflows/workflow-manager.ts` | Validate DAG/roles/tools/args → step execution → approval/checkpoint/revision → resume/cancel/handoff. | **TESTED** | Exactly-once side effect giữa crash/commit ở host khác chưa được chứng minh tổng quát. |
| F07 | `src/agent-loops/agent-loop-runner.ts` | Discovery → proposal heuristic → council deterministic → implementation qua `workflowId` được cấp → verification/iteration. | **PARTIAL** | Council gán điểm 0.92/0.82 và dùng câu “Independent review” dù không có multiple real model reviewer; thiếu model-call provenance và token-cost ledger. |
| F08 | `src/isolation/worktree-manager.ts`, `src/tools/isolation-tools.ts` | Task → worktree + branch identity → patch apply/rollback → registry journal/CAS → reconcile/restore có writer fence hook. | **SOURCE+TESTED; LIVE BLOCKED** | 22 record unverifiable + 2 missing; issue #118 thiếu production kernel old-writer fencing và independent security review. |
| F09 | `src/workspace/workspace-manager.ts` | `activate/list/switch/current` quản lý nhiều workspace trong một process. | **TESTED SEQUENTIAL** | `current` mutable process-wide; không bảo đảm concurrent clients cùng process luôn đúng project. |
| F10 | `src/multiproject/project-gateway.ts`, `project-worker*.ts` (F14) | Owner allowlist canonical root → loopback bearer → project selector/session affinity → worker riêng cho project, kiểm tra root identity → proxy MCP. | **MERGED+CI TESTED; OPT-IN** | Shared bearer không phải per-principal OAuth; worker cùng UID không phải kernel filesystem isolation; chưa có bằng chứng tunnel production route đúng worker. |
| F11 | `src/multiproject/fair-scheduler.ts` (F15) | Pre-body admission → per-project/global quota → fair bounded queue/concurrency → 429/503/retry/cancel. | **MERGED+CI TESTED; OPT-IN** | Counter in-memory, restart reset; quota chưa per-principal/per-tool, production p95 & multi-host chưa đo. |
| F12 | `src/dashboard/server.ts`, `src/operator/config-descriptors.ts`, `rate-limit-settings.ts`, Mission Control `Settings.tsx` | Admin/owner authentication + Origin/CSRF → read config → validate/apply bounded `shell_exec` quota → durable revision + audit → UI refresh. | **D1 + D2 IMPLEMENTED/TESTED** | Không phải arbitrary YAML config hub; D3 staged settings/adapter/Fleet rộng hơn vẫn thiếu. Issue #145 chưa đánh dấu D2. |
| F13 | `src/chatgpt/`, `src/control/`, `src/server/auth/`, `src/tunnels/` | Owner connect → credential/token/OAuth metadata → local MCP origin → tunnel → principal/session → tools. | **SOURCE+TESTS, LIVE PROCESSES EXIST** | Live tunnel phiên cũ, no OAuth ở một số launch; cần chứng minh auth scope, revocation, endpoint mapping, không tự repoint F14. |
| F14 | `src/adapters/child-mcp/`, `src/plugins/`, `src/browser/`, Godot package | Manifest/tool discovery → adapter subprocess/sandbox → policy projection → tool outputs/evidence. | **PACKAGE/COMPAT TESTED** | Runtime connector hiện không có plugin installed; Playwright/Serena adapter disabled, live browser/Godot không được chứng nhận. |
| F15 | `src/operator/`, `src/provisioner/`, `src/distributed/`, `src/marketplace/` | Owner consent/Trusted Host/Fleet → provision/manage child → optional distributed signed workers and plugin marketplace. | **SOURCE+CI**, một số live services ngoài connector | Connector báo 0 managed Fleet instance và 0 distributed workers; không thể suy ra toàn host không có daemon (process scan có). Production cross-host fencing chưa chứng minh. |
| F16 | `src/evidence/`, `src/audit/`, `src/verification/`, `src/artifacts/` | Structured audit record → chained hash/signature/proof pack → verify, migrate, detect tamper. | **TESTED**, evidence smoke & coverage CI | Mandatory durability trên thật phải chứng minh với ENOSPC, crash và file owner migration. |
| F17 | `.github/workflows/`, `scripts/`, `package.json` | Exact-head matrix → test/coverage/security/audit → pack/install smoke → attestation → owner-controlled npm publish. | **CI 7/7 main**, npm latest 3.2.4 | Npm `v3.2.3` bị thiếu, OIDC trusted publisher chưa chứng minh khôi phục; 24h production soak chưa được kết luận. |

## 3. Các GitHub issue đang mở — kiểm tra lại với mã và registry

| Issue | Thực tế sau kiểm tra | Kết luận và chứng cứ cần bổ sung |
|---|---|---|
| [#118](https://github.com/roronoazoroshao/FolderForge/issues/118) security R14 | PR #117/#124 đã có mã trong main, nhưng host kernel old-writer epoch chưa được chứng minh; hook `withLegacyWritersFenced` không có production coordinator. | **P0/P1 PRODUCTION BLOCKER**. Cần reviewer độc lập có quyền APPROVED + real host UID/DAC fencing + restart/crash and rollback proof. Không dùng metadata reconcile thật. |
| [#145](https://github.com/roronoazoroshao/FolderForge/issues/145) Config Hub | D1 read-only có sẵn; hiện source/backend/UI/test đã có bounded D2 `shell_exec` quota validate/apply, owner same-origin, CAS revision và fail-closed audit. Checklist issue D2 còn unchecked. | **P2 ISSUE STALE/PARTIAL**: đánh dấu D2 code delivered sau khi xác minh live rollout; D3/D4 và staged config vẫn cần làm. Quota là per-process. |
| [#126](https://github.com/roronoazoroshao/FolderForge/issues/126) completion ledger | Refer cũ tới main sau #120, PR #117/#124 ở draft, nhiều branch lịch sử; hiện main 35a4003, #117/#124 đã merge source, F14/F15/#158 cũng merged, remote chỉ main. | **P1 DOC/PROCESS DRIFT**: đóng/supersede checklist cũ hoặc cập nhật trạng thái theo exact SHA. Không tự bỏ security gates #118. |
| [#105](https://github.com/roronoazoroshao/FolderForge/issues/105) npm Trusted Publisher | `npm view @musashishao/folderforge version` cho latest `3.2.4`; truy vấn `@3.2.3` trả `E404`, phù hợp lần publish đó không thành công. | **P2 EXTERNAL RELEASE FLOW**: không cho rằng OIDC đã sửa chỉ vì 3.2.4 có trên registry; cần xác minh actual publication method/trusted publishing và exact artifact bytes. |
| [#70](https://github.com/roronoazoroshao/FolderForge/issues/70) self-hosted CI | GitHub-hosted matrix Ubuntu/macOS/Windows 22/24 đạt 7/7; không có chứng cứ runner org self-hosted được cấp quyền cho repo. | **P2 EXTERNAL OPERATIONAL**: verify org runner access bằng owner permission; không cho untrusted fork PR chạy trên persistent privileged self-hosted runner. |

## 4. Các phát hiện chưa được phản ánh đầy đủ trong issue tracker

| ID | Mức độ | Finding | Bằng chứng | Đề xuất điều kiện đóng |
|---|---|---|---|---|
| NEW-01 | **P0 ops** | 24 active isolation record không còn usable branch identity sau branch-only purge. | `isolation_list`: 22 unverifiable, 2 missing worktree. Worktrees detached còn 39, backup complete. | Giữ registry read-only; phân loại task/owner/recovery. Chỉ khôi phục branch từ bundle nếu có chứng minh owner và cần chạy task; không tự động reconcile/overwrite. |
| NEW-02 | **P0 security** | Live `danger` bỏ approval, capsule không hoạt động, một số daemon cho phép critical. | `policy_get`, `capsule_status`, read-only process scan. | Chốt privileged actions bằng explicit owner grant, sandbox UID separation, deploy security review; không giả định allowDirectories bảo vệ host shell. |
| NEW-03 | **P1 deployment** | Build/runtime drift: `dist/main.js` sửa 17/10; source main merge 14/11; daemon khởi chạy trước merge. | stat, `git log`, process start times. | Artifact attestation, binary/version endpoint & process SHA, manual canary rollout, rollback; không tự restart. |
| NEW-04 | **P1 durability** | Host disk `df=100%`, ~2.8GB free, cache checkout ~9.7GB. | `df -h`, `du .git/folderforge`. | Backup off-host rồi prune cache tái tạo có kiểm kê; test ENOSPC fail-closed, alert disk threshold. |
| NEW-05 | **P1 accuracy** | Agent council có điểm/vote và rationale `Independent review` do chương trình gán. | `agent-loop-runner.ts` `0.92/0.82`, `proposalForExpert()`. | Đổi nhãn thành heuristic, hoặc thêm real independent reviewer/model provenance/cost logs. |
| NEW-06 | **P1 tenancy** | Legacy `WorkspaceManager.current` là mutable process-global; F14 worker isolates by project nhưng optional, không mặc định thay mọi tunnel. | `workspace-manager.ts`, `multiproject/project-gateway.ts`. | Request-scoped immutable project binding, cross-session 2+ tenant isolation tests and route attestation. |
| NEW-07 | **P1 auth** | F14 gateway bearer dùng chung; per-project worker cùng Unix UID; F15 quota in-memory. | Gateway, scheduler and worker code. | Per-principal grants/ratelimits, credential rotation, kernel separation and staging load p95. |
| NEW-08 | **P1 documentation** | `docs/audit/FEATURE_INVENTORY.md` vẫn ghi F14/F15 “PR only” và baseline `main@8c00b15`, trái với source main hiện tại. | Header và F14/F15 rows của inventory. | Dán nhãn historical rõ ràng hoặc regenerate current inventory với SHA hiện hành. |
| NEW-09 | **P1 test-gap** | CI branch coverage 66.91%, 47 test skipped trên Ubuntu Node22; kiểm thử sản phẩm chưa tương đương chứng nhận live host. | Main CI coverage + skipped counts. | Định nghĩa critical branch gates, load/chaos + Windows/macOS-specific regression, SLO error budget. |
| NEW-10 | **P2 feature readiness** | Browser/Serena disabled, 0 plugin và 0 workflow/distributed managed runs trong session được hỏi. | `workspace_status`, plugin/workflow/distributed tools. | Validate live adapter readiness / real workflows independently; không quảng cáo toàn bộ feature luôn hoạt động. |
| NEW-11 | **P2 quota semantics** | `shell_exec` quota có owner editor nhưng `RateLimiter` vẫn process-local, reset sau restart và không shared giữa workers. | `rate-limiter.ts`, `rate-limit-settings.ts`. | Chỉ hiển thị process scope; hard spend cap cần durable cross-process store nếu được yêu cầu. |
| NEW-12 | **P2 backup** | Git bundle và dirty evidence được lưu trên cùng host gần đầy đĩa. | `.git/branch-cleanup-backups/2026-11-14-main-only/`; SHA/bundle verified. | Bản off-host mã hóa + restore drill trước khi xóa detached worktree/recovery cache. |

## 5. Điều kiện nghiệm thu theo từng tuyến

| Tuyến | Đã có | Chưa có hoặc không nên suy luận |
|---|---|---|
| Source/CI | 7/7 GitHub Actions `main@35a4003`, coverage và audit dependency; docs/architecture check PASS | Không có fresh exact runtime build hash của live daemon |
| Single-project MCP | stdio/HTTP/OAuth token protocol code + smoke | Production OAuth/token rotation + provider live reproducible trace cho mọi tunnel |
| Multi-project | F14/F15 source trên main, deterministic gateway/fairness tests | Production per-principal auth/OS confinement, measured p95, no wrong-root under full load |
| Dashboard D2 | Owner-only bounded quota UI/API + integration tests | Config Hub D3, actual host version and authorized rollout |
| Isolation | R11/R16 registry/recovery source tests | 24 active records consistency, kernel epoch fencing, independent security approval |
| Agent autonomy | Tool governance, workflow, verify and heuristic proposal support | Real model executor/council, strict cost ledger, secure unattended permission scope |
| Ecosystem | Browser/Godot/plugin/distributed modules + package smoke | Browser/Serena enabled in inspected runtime, deployed Fleet/distributed fleet proof |
| Release | v3.2.4 published, CI healthy | 3.2.3 publish gap, Trusted Publisher OIDC verified, production 24h soak |

## 6. Kết luận và thứ tự xử lý

**Cần làm ngay:** (1) bảo toàn bundle/registry evidence và không chạy recovery mutation cho 24 record invalid; (2) giải quyết host disk 100% qua cache audit, không xóa task data; (3) đánh giá quyền `danger` và Capsule/OS isolation của daemon đang live; (4) kiểm tra artifact/runtime drift bằng canary, không blind restart.

**Sau đó:** (5) điều kiện bảo mật #118 trước production activation; (6) refresh D2/D3 issue #145 và ledger #126; (7) thêm authenticated per-project principal, bounded spend ledger & real LLM provenance; (8) verify npm OIDC and self-hosted runner owner-managed scope; (9) cập nhật feature inventory cũ.

**Giới hạn báo cáo:** Đây là source+ops evidence audit, **không phải chứng nhận tất cả feature đã chạy production**. Không tạo thêm branch, không force delete worktree, không publish/deploy/restart, không chỉnh policy hoặc sửa registry của host.

**Tham chiếu:** [main commit](https://github.com/roronoazoroshao/FolderForge/commit/35a400319ea1abfebb786400b465b872b028bc03); [CI 7/7](https://github.com/roronoazoroshao/FolderForge/actions/runs/43483493827); [issues](https://github.com/roronoazoroshao/FolderForge/issues); `docs/audit/FEATURE_FLOW_AUDIT_2026-11-14.md` (prior dated audit).
