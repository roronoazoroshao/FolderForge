# FOLDERFORGE — NORTH STAR 2027–2030

**Tầm nhìn, chiến lược sản phẩm, kiến trúc sạch và roadmap thực thi**  
**Ngày lập:** 14/11/2026 · **Trạng thái:** **ĐỀ XUẤT CHIẾN LƯỢC, CHƯA DUYỆT, CHƯA TRIỂN KHAI**  
**Baseline source:** `main@b2ad52e1bb20babed2436890841ec622cc6c4a5a` · `@musashishao/folderforge@3.2.4` · CI main success.  
**Liên kết chi tiết:** [Spec v2](../superpowers/specs/2026-11-14-folderforge-v2-design.md) · [Plan 33 nhiệm vụ](../superpowers/plans/2026-11-14-folderforge-v2-implementation.md).  
**Phương pháp:** từ người dùng → định vị cạnh tranh → trải nghiệm cốt lõi → ranh giới bảo mật → cấu trúc code → thước đo → roadmap. Các mốc trong tương lai là **mục tiêu/giả thuyết**, không phải cam kết về kết quả thị trường.

---

## 0. Bản quyết định dành cho người sở hữu sản phẩm (đọc 3 phút)

> **FolderForge is the trusted workspace runtime for AI agents.**  
> Chọn một folder. Cấp quyền cụ thể. Kết nối AI bất kỳ. Cho agent thực thi công việc. Quan sát, kiểm chứng và thu hồi quyền từ Web hoặc CLI.

**Không xây thêm một AI coding assistant. Không xây siêu ứng dụng gồm hàng chục dashboard ngang hàng. Không xây một framework agent độc quyền.** AI và MCP là các đối tác/giao diện; “sản phẩm” thực sự là **năng lực biến một tài nguyên máy tính thành môi trường làm việc đáng tin cho agent**.

**Một câu hỏi sản phẩm duy nhất:** *Người dùng có thể giao một folder cho AI và tin rằng nó chỉ làm đúng việc trong phạm vi đã cấp, thấy được kết quả thật, dừng được khi cần hay không?*

**Đề xuất chốt 8 quyết định:**

1. **Beachhead:** cá nhân có kỹ thuật và nhóm phát triển nhỏ, chạy local-first; chưa bán enterprise orchestration từ ngày đầu.
2. **Hero workflow:** `folderforge up <folder> --client <agent>` → kết nối thật → thao tác có chứng cứ; UI cùng một workspace.
3. **Kiến trúc:** modular monolith + worker/capsule cô lập theo workspace; giữ ToolRegistry, transport, policy, audit đã có; từng lát chuyển dịch (strangler), không đại rewrite.
4. **UI:** bốn khu vực Folders / Sessions / Activity / Settings; Advanced chỉ bật theo nhu cầu. *Web control dashboard* khác với *browser automation tool* — không gộp khái niệm.
5. **Quyền:** `Inspect`, `Develop`, `Full workspace` là grant được owner định nghĩa; `Full workspace` **không** tương đương quyền toàn host. Kernel containment là điều kiện để thực sự hứa “chỉ trong folder”.
6. **AI:** FolderForge ban đầu là **runtime cho agent bên ngoài**. Planner/model bên trong là tùy chọn, chỉ thêm khi chứng minh mang lại giá trị và có budget/evidence; không gọi heuristic là multi-agent intelligence.
7. **Tài sản cạnh tranh (moat):** project/session identity bất biến + policy/OS isolation + task evidence + portability giữa agent; không phải số lượng MCP tools.
8. **Cách triển khai:** mã nguồn và CI không phải production. Không phá 24 isolation record đang mất tính nhất quán, không xóa dữ liệu detached worktree, không restart live service trước canary/owner approval.

### Kiểm tra tham vọng “clean mọi thứ”

“Clean” không có nghĩa càng ít file càng tốt. Một codebase sạch có **ranh giới rõ, thay đổi cô lập, hợp đồng ổn định, test chứng minh đúng**, kể cả số file tăng. Một sản phẩm sạch có **ít quyết định người dùng phải đưa ra**, chứ không phải thiếu tính năng. Một hệ thống an toàn sạch phải **thất bại có giải thích, phục hồi được và không nói quá năng lực**.

---

## 1. Tại sao FolderForge cần tồn tại trong thời đại agentic AI?

### 1.1. Xu hướng đã có bằng chứng (tính đến 14/11/2026)

- **MCP 2026-07-28** mở rộng lõi stateless, routing dựa trên header, catalog caching, xác thực tốt hơn và extension chính thức. Do đó **MCP protocol implementation đang dần là hạ tầng tiêu chuẩn**, không phải điểm khác biệt lâu dài của một sản phẩm.
- **Các agent runtime lớn** đã có công cụ, sandbox, session và quan sát. FolderForge không nên đối đầu bằng cách tự viết một agent framework khổng lồ; cần làm tốt môi trường chạy *do chủ máy sở hữu* và liên thông nhiều client/provider.
- **A2A** giải bài toán giao tiếp giữa các ứng dụng agent; **MCP** giải bài toán kết nối đến năng lực và dữ liệu. FolderForge nên thiết kế ranh giới adapters để tận dụng cả hai nếu thị trường cần, không mặc định triển khai A2A khi MVP chưa ổn.
- **An ninh MCP** là vấn đề thực: tool poisoning, prompt injection, confused deputy, shared privilege và data exfiltration. Khả năng chứng minh “agent đã/không đã làm gì” sẽ quan trọng hơn việc quảng cáo “AI toàn quyền”.

**Nguồn:** [MCP 2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28/), [OpenAI Agents](https://developers.openai.com/api/docs/guides/agents), [A2A](https://a2a-protocol.org/), [OWASP MCP Security](https://cheatsheetseries.owasp.org/cheatsheets/MCP_Security_Cheat_Sheet.html).

### 1.2. Thị trường ban đầu và lựa chọn không theo đuổi

| Phân khúc | Pain thực tế | Giá trị FolderForge có thể cung cấp | Quyết định |
|---|---|---|---|
| Solo developer / power user | Kết nối mỗi agent một kiểu, nhầm cwd, thiếu audit, sợ shell | Một lệnh, quyền theo folder, bằng chứng dễ xem | **Beachhead #1** |
| Nhóm 2–20 dev | Chia sẻ policy, đồng nhất môi trường, phiên làm việc, kiểm toán | Profile có thể lặp lại, session/revoke, export evidence | **Beachhead #2 sau local beta** |
| Enterprise / SOC / SRE | Phân quyền tổ chức, IAM, tuân thủ, host fleet quy mô | Có tiềm năng cao nhưng cần SSO, isolation, billing, support | **Không cam kết trong 12 tháng đầu** |
| Người dùng không kỹ thuật | Muốn AI thao tác laptop như một người | Rất rộng, rủi ro lớn, kỳ vọng GUI automation cao | **Chưa phải ICP** |

**Đối thủ thực tế không chỉ là MCP server khác:** cấu hình thủ công một MCP server, tool runner của IDE, sandbox của agent provider, và cách người dùng cho AI chạy shell trực tiếp. Muốn thắng, phải nhanh hơn cách đơn giản nhất **mà không đánh đổi niềm tin**.

### 1.3. Category và thông điệp marketing

- **Category:** Local-first Agent Workspace Runtime / Trusted Agent Execution Layer.
- **Hero:** “One folder. Any AI agent. Controlled execution.”
- **Giải thích trong 10 giây:** “Chọn thư mục, kết nối Cursor/Claude/ChatGPT hoặc MCP client tương thích, cho AI đọc/sửa/chạy công việc trong quyền bạn cấp, xem được mọi thay đổi và dừng khi muốn.”
- **Không tuyên bố:** “AI tự làm tất cả mà không rủi ro”, “full isolation” khi còn cùng Unix UID, “agent đã connected” khi mới ghi client config, “multi-model council” khi chỉ là heuristic.

---

## 2. Clean Product — đơn giản đến mức người mới hiểu ngay

### 2.1. North Star Journey

```text
Pick folder → Review scope → Connect agent → Do work → Verify result → Revoke / Stop
      |             |              |            |             |            |
  realpath       capabilities   handshake     run/tool     diff + tests    proof
  + identity     + expiry       + principal   + logs       + timeline     + receipt
```

**Ba điều mà màn hình đầu tiên cần trả lời:** (1) Folder nào AI được quyền truy cập? (2) Agent nào đang kết nối thật? (3) Agent đã thay đổi gì, tôi dừng nó như thế nào?

### 2.2. Giao diện đích

| Tab chính | Người dùng hỏi gì? | Nội dung bắt buộc | Không đặt tại đây |
|---|---|---|---|
| **Folders** | AI đang được cấp thư mục nào? | folder list, Add Folder, canonical root, profile, health, Start/Stop, quick connect | Danh sách 300 tools, Fleet operator |
| **Connections** | Agent nào đang kết nối thật? | client config vs connected session, method, scope, last-seen, revoke | Tunnel raw flags và OAuth internals trong mặc định |
| **Activity** | Nó đã làm gì và có thể chứng minh không? | runs, approvals, diff, tests, errors, evidence receipt, timeline | Raw JSON làm giao diện chính |
| **Settings** | Tôi kiểm soát quyền và runtime thế nào? | grants, quotas, browser capability, alerts, service diagnostics, Advanced entry | Cấu hình YAML tùy ý không giới hạn |

**Phân biệt quan trọng:** Web Control là UI điều khiển FolderForge; Browser Automation là **quyền để agent thao tác trình duyệt**. Browser Automation phải có quyền cấp độc lập, session profile và network/download controls.

### 2.3. Một command là đường nhanh — không che giấu quyền

```bash
# CÚ PHÁP MỤC TIÊU, CHƯA CÓ TRONG RELEASE 3.2.4
folderforge up ~/Projects/site --client cursor
folderforge status ~/Projects/site
folderforge ui ~/Projects/site
folderforge stop ~/Projects/site
```

`up` phải thực hiện preflight + cung cấp kết quả có nghĩa; nếu tạo hoặc sửa client config, người dùng phải có thông tin/undo. **CONFIGURED khác CONNECTED**. Với stdio, cấu hình client thành công không tự sinh một session đang online. Với HTTP hiện đại, đừng ràng buộc identity vào hidden transport session; dùng explicit authorized workspace context/handle hoặc endpoint binding.

### 2.4. Feature portfolio: giữ, hợp nhất, ẩn, hoãn

| Nhóm hiện tại | Quyết định | Lý do |
|---|---|---|
| File/search/Git/shell/build/test, MCP stdio/HTTP, ToolRegistry, policy/audit | **KEEP CORE** | Giá trị trực tiếp, nhiều test hiện có |
| Workspace, on-boarding, client config, dashboard activity | **UNIFY** | Một identity, một service, cùng hợp đồng CLI/Web |
| Agent loop heuristic | **REFRAME** | Đưa vào Advanced, ghi rõ heuristic; không tạo ảo giác reviewer độc lập |
| Browser controls, adapters/child MCP, tunnel, OpenAI, Plugins | **ON-DEMAND CAPABILITIES** | Không hiển thị/bật mặc định; cung cấp health + provenance |
| Fleet, trusted host, provisioner, distributed worker, marketplace, Godot | **ADVANCED / LATER** | Có thể giữ source nhưng không đẩy thành hero workflow |
| Legacy process-wide `WorkspaceManager.current` cho MCP identity | **MIGRATE / RETIRE PATH** | Nguy cơ cross-folder khi nhiều session |
| Dozens of equally prominent admin pages / duplicate control paths | **CONSOLIDATE UI** | Giảm tải nhận thức, không nhất thiết xóa API |
| New swarm/agent OS/cloud sync/enterprise billing | **NOT NOW** | Không có proof product-market fit cho tầng cơ bản |

### 2.5. Product quality: hành vi, không phải trang trí

- Một `Add Folder` flow tối đa 4 bước và luôn cho biết *cái gì sẽ được sửa trên máy*.
- Một ngôn ngữ trạng thái thống nhất: `UNCONFIGURED → CONFIGURED → READY → CONNECTED → ACTIVE`, hoặc `DEGRADED / REVOKING / STOPPED / ERROR`; các bước phải được định nghĩa theo transport, không gộp bừa.
- Empty state hướng người dùng đi tiếp; error state nói rõ **nguyên nhân, tác động, cách khắc phục**; stale state hiện timestamp.
- Design tokens semantic (`surface`, `text`, `border`, `accent`, `warning`, `danger`), spacing scale, typography, dialog, toast, status chip; keyboard/WCAG 2.2 AA là **mục tiêu được test**, không tự nhận chứng nhận.
- Ảnh hưởng do sử dụng lâu dài quan trọng hơn landing page: audit filter, undo, stop/revoke và phiên hoạt động phải luôn truy cập nhanh.

---

## 3. Clean Architecture — lõi nhỏ, ranh giới mạnh, mở rộng có điều kiện

### 3.1. Đích kiến trúc (logical, không phải cấu trúc code hiện hữu)

```text
CLIENTS & SURFACES
  IDE / AI agent         CLI                  Web Control
      |                   |                       |
    MCP adapters       CLI adapter           HTTP owner API
      \                   |                      /
       +------------------+---------------------+
                          |
               APPLICATION USE CASES
       Workspace / Connection / Grant / Run / Revoke
                          |
           IMMUTABLE EXECUTION CONTEXT
      {workspaceId, principalId, grantRevision,
       capabilities, requestId, effectiveLimits}
                          |
           TOOL GOVERNANCE KERNEL  [KEEP]
        catalog → validate → authorize → rate/budget
                 → approve → audit → dispatch
                          |
                WORKSPACE EXECUTORS
    file/Git/shell/test | browser adapter | child MCP
                  OS confinement/capsule
                          |
             DURABLE STATE + EVIDENCE
     owner grants / workspace registry / run proof
                + diagnostics/observability
```

**Quan điểm kỹ thuật:** giữ **modular monolith**, có worker process/sandbox khi chạy việc. Không tách thành 10 microservice hoặc thay toàn bộ persistence vì mong muốn code sạch.

### 3.2. Capability boundaries và dependency direction

| Module đích | Chịu trách nhiệm | Không được làm |
|---|---|---|
| `workspace-domain` | Identity canonical root, workspace invariant | Import React, HTTP, shell runner |
| `grants` | Scope, owner-issued capability, expiry/revision | Tin lời agent để tự nâng quyền |
| `connections` | Client setup receipt, transport/auth status, revoke | Đồng nhất `configured` và connected |
| `use-cases` | Add/Start/Connect/Status/Stop/Grant/Run | Tự rẽ nhánh policy cho CLI và Web |
| `execution` | Immutable request context, tool gateway | Dùng global `current` hoặc cwd ngầm |
| `adapters/mcp`, `adapters/http`, `adapters/cli` | Chuyển protocol sang use case | Chứa business rule hoặc DB write trực tiếp |
| `workers` | Sandbox/capsule, spawn/kill, OS isolation | Bỏ qua grant hoặc escape sang host |
| `evidence` | Audit, proof, run state, metrics | Tạo trạng thái `success` khi chỉ có timeout |
| `integrations` | Browser, child MCP, tunnel, Fleet plugins | Tự chèn admin capability vào core |
| `ui` | Bốn màn hình, typed API client, design system | Gọi shell/permission policy ở frontend |

**Quy tắc phụ thuộc:** Adapters → Use cases → Domain/ports; infrastructure implements ports; không import ngược. Dependency cycles = 0. Chỉ có **một chỗ ra quyết định quyền hành động** (ToolRegistry governance path).

### 3.3. Tránh mô hình dữ liệu sai từ đầu

- **Workspace identity:** canonical root + filesystem identity/owner, UUID ổn định; đổi symlink/rename phải được phát hiện và xử lý như event, không âm thầm trỏ sang path khác.
- **Principal identity:** local owner khác MCP agent identity. HTTP auth scopes/claims không được gộp vào “token đã tồn tại”.
- **Session/connection:** stdio connection có thể được client tạo mới từng process; MCP 2026-07-28 stateless HTTP không còn implicit protocol session. Tạo `ConnectionReceipt` và app-level `Run`/`WorkspaceHandle` riêng nếu cần.
- **Grant:** typed capabilities, version, expiry, explicit revocation intent. Không gửi secret raw vào Web/API response/log.
- **Run:** state `pending/running/succeeded/failed/cancelled/unknown`, có correlation ID, attempted tools, side-effects proof, resource budget và file diff khi liên quan.
- **Persistence:** v1 dùng JSON/evidence có sẵn; v2 cần transaction/CAS đảm bảo dữ liệu khi CLI/Web cạnh tranh. **Chưa khóa SQLite** nếu chưa có feasibility test cross-platform/backup/restore; dùng repository port, benchmark thực, quyết định storage một lần trước migration. Không đụng isolation registry cũ bằng tiện ích workspace mới.

### 3.4. MCP: chiến lược tương thích 2026+

Source hiện có **modern 2026-07-28 opt-in / dual-mode** (`src/server/protocol/*`, `src/server/transports/{http,stdio}.ts`, tests) và config mặc định vẫn `legacy`. Vì thế:

1. **Giữ legacy hoạt động**; lập compatibility matrix theo client/provider.
2. **Thêm conformance tests** cho stateless modern tools/calls, header validation, auth, cache/list changes, MRTR khi có nhu cầu.
3. **Không nâng default chỉ vì spec mới**; đổi default khi client matrix, auth threat model và rollback đều đạt.
4. **Không dựa vào protocol-level session** để chọn workspace trong future modern HTTP; identity phải explicit, authorized, request-bound.
5. **Thiết kế runtime independent of protocol.** MCP/A2A/REST chỉ là adapters. A2A chỉ là một thử nghiệm cho delegated task dài hạn.

### 3.5. Clean code = thay ít, đúng điểm, có contract

**Những chỗ cần ưu tiên bóc tách** (độ dài không tự nó là bug): `src/dashboard/server.ts` ~3.084 dòng, `src/main.ts` nhiều command, `src/chatgpt/cli.ts` ~116 KB, `screens/Fleet.tsx` ~1.362 dòng. Không tách chỉ để làm đẹp số dòng; tách **endpoint auth boundary**, **command dispatch**, **use case**, **presentational components** và bảo đảm contract test trước/sau.

**Quy tắc review:** một thay đổi phải có một mục tiêu; không “tiện tay” dọn module khác; trước khi xóa, có usage inventory; tất cả public CLI/API cần deprecation window/compatibility test; không thêm abstraction một chỗ dùng; team chỉ thêm dependencies khi chứng minh lợi ích.

---

## 4. Clean Security, Operations và AI Trust — không phải lớp phụ

### 4.1. Quyền theo cấp độ

| Profile | Ví dụ được phép | Mặc định cấm / cần cấp riêng |
|---|---|---|
| **Inspect** | read/list/search, git status | write, shell, outbound network, browser mutation |
| **Develop** | file changes, bounded shell/test/build, git diff/commit sau scope | host/admin, credential access, deploy/publish, exfiltration, arbitrary network |
| **Full workspace** | autonomous work đã cấp trong folder, process/build/test tối đa trong scope | host root, global `$HOME`, sibling folders, uncontrolled network, self-upgrade grants |
| **Host capability** | tác vụ ngoài folder rõ ràng, được owner xác nhận | Mặc định *không có*, không cấp qua lời nhắc agent |

**Ràng buộc thực:** Path validation không thể cô lập một process shell cùng Unix UID. Muốn nói “Full workspace chỉ trong folder”, cần sandbox/OS enforcement: UID hoặc container/namespaces, mount restrictions, seccomp/permissions tương đương theo OS; Windows/macOS phải có chiến lược riêng. Không có containment → UI hiển thị capability limited/risk, không đưa lời hứa sai.

### 4.2. Bất biến an toàn (invariants)

1. Một request có **một workspaceId cố định** từ auth đến dispatch; không thay đổi bởi request khác.
2. Mọi mutation phải có grant hợp lệ và audit attempt/result; không ghi được audit khi bắt buộc → fail closed.
3. Revoke ngăn request mới ngay; in-flight tasks phải có cancellation & acknowledgment policy, không tuyên bố đã kill nếu chưa xác nhận.
4. External adapter/browser/child MCP không thể bypass governance; tool schema/risk/manifest changes cần provenance và pinning.
5. Secret không vào logs, bundles, UI, issue/traces; prompt và tool return là **untrusted input**.
6. Crash/ENOSPC → persisted status đúng, không tự duplicate destructive action khi retry. `UNKNOWN` là trạng thái hợp lệ.
7. Không động đến registry recovery đang rủi ro khi kernel writer fencing và reviewer #118 chưa đủ điều kiện.
8. Source SHA, built artifact SHA, runtime process SHA, tunnel endpoint routing phải có bằng chứng riêng; không suy luận từ CI.

### 4.3. Thực trạng cần đối diện (snapshot 14/11/2026)

- Repo source sạch trên `main@b2ad52e`, CI success; nhưng **live host không được coi là đã chạy source mới** (bản build trước đó cũ hơn merge và không có attestation quá trình rollout).
- **5 issues open**, đặc biệt #118 thiếu real host writer fence + independent security review; #145 stale D2; #126 ledger drift; #105 publish trust gap; #70 self-hosted runner.
- Sau branch-only purge, **39 detached worktree** còn nguyên; isolation metadata **24 active records: 22 unverifiable, 2 missing worktree**. Đây là trạng thái recovery, không phải “24 agent running”. Không force-clean hay auto-reconcile.
- Host trước đó `df` gần như 100%, ~2.8GB free; quan sát `danger` và privileged daemons. Đây là **P0 operational debt**, phải xử lý có kiểm kê trước rollout.

### 4.4. Reliability và security posture

- **Control plane** chạy cùng quyền owner hay service account ít quyền; **execution plane** chạy trong containment có ranh giới OS khi khả thi. Không expose owner API qua MCP bearer.
- Audit có tamper-evident records, nhưng tamper-evident ≠ tamper-proof. Có backup off-host + restore drill.
- Một release cần reproducible `commit → artifact → process → connection` chain, canary, rollback, audit events và exact-head matrix.
- Browser automation cần browser profile cô lập, domain allow rules, credential restrictions, download policy, recording/redaction và kill switch. **Không gộp quyền browser vào Full workspace mặc định.**

---

## 5. Roadmap ngắn hạn — 0 đến 90 ngày (15/11/2026 đến 12/02/2027)

**Nguyên tắc:** ưu tiên an toàn, một luồng end-to-end, người dùng thực trước khi tiếp tục platform hóa. Đây là **milestone theo đầu ra**, không giả định số người hay giờ công cố định.

| Thời điểm | Mốc | Deliverable có thể dùng | Điều kiện kết thúc / kill gate |
|---|---|---|---|
| **D0–D14** | **H0 Trust & Baseline** | Kiểm kê host/isolations, off-host backup + restore drill, đo activation baseline, CI/protocol matrix, capability map được duyệt | Không mất recovery evidence; no prod mutation; owner chấp thuận scope; #118 tiếp tục chặn isolation mutation |
| **D15–D30** | **H1 Workspace Identity** | Typed `WorkspaceId`/grant/request context, versioned owner grants, project-bound tool dispatch thử nghiệm | 2 concurrent sessions trên 2 folder **0 cross-root** trong negative tests; revoke denies new calls |
| **D31–D45** | **H2 One Control API** | `Add/Status/Connect/Stop/Grant/Revoke` qua một service, CLI và Web parity, journal rõ ràng | Không có đường UI bypass policy, contract tests + crash/race tests pass |
| **D46–D60** | **H3 One-command Alpha** | `up`/`status`/`stop`/`ui` trên folder Git và non-Git, client connect receipt, diagnostics | Test Linux/macOS/Windows, stdio vs HTTP states đúng; người thử mới làm được end-to-end |
| **D61–D75** | **H4 Four-screen Web Alpha** | Folders, Connections, Activity, Settings; design tokens/component library, UI state machine | Keyboard + responsive smoke; tests on owner/auth/stop; no 11-tab default navigation |
| **D76–D90** | **H5 Beta Quality Gate** | 5–10 người dùng thử có cấu trúc, latency/error instrumentation, backward-compat smoke, docs và release candidate | Metric đạt ngưỡng beta thử nghiệm; issue blocker có owner và rollback; **không tự động production rollout** |

### KPI mục tiêu của giai đoạn beta (đề xuất, chưa đo)

| Metric | Cách đo đúng | Mục tiêu beta cần kiểm nghiệm |
|---|---|---|
| **Time to First Verified Action (TTFVA)** — North Star | Từ chọn folder đến MCP client thực hiện 1 action thành công, có record | **p50 ≤ 3 phút** trên setup hỗ trợ, mục tiêu chứ không phải số hiện có |
| **Activation success** | User mới hoàn tất Add → Connect → tool invocation | **≥ 85%** trên cohort 5–10 người; mẫu nhỏ chỉ dùng học, không suy luận thị trường |
| **Cross-workspace isolation** | Kiểm thử song song/đối kháng 2+ folder + symlink + spawn | **0 lỗi vượt ranh giới** trong test suite; vẫn cần OS/security approval cho lời hứa isolation |
| **CLI/Web parity** | Cùng use case, cùng effective grant/state/response | **100% của 6 hành động MVP** |
| **Policy/Audit integrity** | Đối chiếu mutation attempts với events/proof | **100% critical mutations** có durable decision/result hoặc fail-closed |
| **Regressions** | Exact-head CI OS/Node matrix, old client handshake | Không có severity-1 break; coverage critical scope không giảm |
| **Product comprehension** | Quan sát 5 user hoàn thành journey không hướng dẫn | ≥ 4/5 phân biệt được CONFIGURED vs CONNECTED và Revoke vs Stop |

**Chiến lược giảm rủi ro:** Nếu H0 và H1 chưa đạt, **không đưa nguồn lực vào UI redesign đầy đủ**. Nếu H3 onboarding không làm tốt hơn cách cấu hình MCP thủ công, dừng scope creep và cải thiện hero flow trước.

---

## 6. Roadmap trung và dài hạn — 3 đến 36 tháng

| Chặng | Giá trị người dùng | Năng lực cần đạt | Gate quyết định đầu tư |
|---|---|---|---|
| **3–6 tháng / 2027 H1** | Workspace Runtime “đáng tin” | Worker OS confinement theo nền tảng; permissions/TTL/revoke; modern MCP conformance; browser automation opt-in; crash/ENOSPC drills | Threat-model review + independent pen test cho host-sensitive; 0 cross-root regression, 1-click recovery proof |
| **6–12 tháng / 2027 H2** | “Giao việc, rồi xem bằng chứng” | Reproducible runs, diff/test/proof, per-task budgets, project templates, opt-in agent executor/provider, collaboration nhỏ | ≥ 30% beta cohort dùng lại hàng tuần; user nhận ra giá trị evidence; real LLM eval vs heuristic |
| **12–24 tháng / 2028** | Nền tảng công việc AI đa agent / đa máy **có kiểm soát** | Signed task handoff, optional A2A adapter, scoped remote worker trust, team roles, centralized policies, org audit export | Chỉ đầu tư sau bằng chứng trả phí/retention và security reviewer; no hidden shared bearer principal |
| **24–36 tháng / 2029** | “Agent workspace layer” mở, không phụ thuộc model/vendor | Portable Workspace Manifest, capability negotiation, policy bundles, evidence portability, SDK for external agents | Provider diversity tăng và có ecosystem adoption; nếu không, duy trì mô hình local-first nhỏ nhưng có lợi nhuận |
| **3–5 năm / 2030–2031 (vision option)** | Một hệ điều hành quyền hạn cho công việc được AI ủy quyền | Workspace task economy: identity → authorization → execution → verification → handoff, chạy local/edge/managed | **Không coi là roadmap đã cam kết**; revisit 6 tháng một lần theo thị trường, tiêu chuẩn và nguồn lực |

### Chuỗi đầu tư, không phải danh sách tất cả cùng làm

```text
T1  TRUST + WORKSPACE BINDING
        ↓
T2  SINGLE-FOLDER GOLDEN PATH + UI
        ↓
T3  GOVERNED OS EXECUTION + RELIABILITY
        ↓
T4  VERIFIED TASK RUNS + COST CONTROL
        ↓
T5  TEAM + REMOTE + INTEROPERABILITY (only if demanded)
```

**Không làm vội trong 12 tháng đầu:** autonomous multi-agent swarm, generic marketplace growth, cloud-first rewrite, microservices, enterprise compliance claims, arbitrary root admin, provider-specific “exclusive AI”. Đây là lựa chọn **tập trung**, không phải cắt bỏ vĩnh viễn.

---

## 7. Definition of Clean — bộ chuẩn đo được ở từng lớp

| Chiều | Quy tắc thiết kế | Verification gate |
|---|---|---|
| **Clean Vision** | Một câu định vị; một persona chính; một hero metric | Mọi feature proposal nêu tác động đến TTFVA/trust; nếu không có thì Advanced/later |
| **Clean Product** | Bốn tab; progress và error minh bạch; revoke luôn tìm thấy | 5-user usability, e2e flow, accessibility keyboard/mobile regression |
| **Clean Architecture** | Domain không phụ thuộc transports/UI; single policy gateway; immutable workspace request context | `architecture:check` 0 cycles/violations; static forbidden-import tests; concurrent tenant E2E |
| **Clean Code** | Đơn trách nhiệm ở service boundary, typed DTO, no duplicate business rules, surgical diffs | Focused TDD; reviewer giải thích thay đổi trong 5 phút; lint/typecheck; legacy contract tests |
| **Clean Security** | No implicit host powers, kernel confinement claim backed by evidence, threat model, true consent | Negative scope/symlink/prompt-injection/tool-poisoning tests; independent approval cho critical paths |
| **Clean API** | Versioned contracts, idempotent mutations, normalized errors, no secrets | CLI/Web parity tests; invalid input & race matrix; deprecation tests |
| **Clean Data** | Durable workspace/grant/run identity; transaction/CAS, backup/restore | Crash/ENOSPC fault injection, migration dry-run, recovery drill |
| **Clean Operations** | Reproducible build → process SHA → tunnel mapping; safe canary/rollback | Artifact attestation, manual rollout gate, health + rollback evidence |
| **Clean AI** | Mọi claim về intelligence có model/provenance; deterministic logic đặt đúng tên | Evals, cost ledger, schema validation, evidence-linked task completion |
| **Clean Docs** | Current status có baseline SHA; historical docs gắn nhãn; một nguồn sự thật | `docs:check`, link tests, ADRs, stale-check khi release |

### Quality budget để không “clean bằng cảm giác”

**Giữ baseline:** 7/7 main CI success, kiểm thử nhiều OS/Node, lint/typecheck/architecture 0 cycles, 0 prod dependency vulnerability ở đợt audit trước. **Nhận diện khoảng trống:** branch coverage gần 66.91%, 47 skipped Ubuntu Node22 ở một lần chạy, live process còn drift. Không biến các số này thành lời hứa production-ready.

**Ratchet đề xuất:** mọi thay đổi trong policy/auth/workspace binding phải có branch tests ở các trường hợp deny/revoke/race; test coverage phần code thay đổi không giảm, mục tiêu ≥ 90% branch cho critical *new modules* (không ép cả repo đạt ngay); 0 skip không có lý do; CI security/audit/pack smoke; E2E hai folder và 3 OS trước release. Khi số liệu baseline chưa đầy đủ, đo trước rồi khóa ngưỡng.

---

## 8. Chiến lược tăng trưởng, độ mở và khả năng kiếm tiền

**Open-core có điều kiện**, không đổi sản phẩm thành SaaS ngay: core folder-to-MCP, local runtime, CLI và quyền cơ bản nên dễ thử và có thể kiểm chứng. Giá trị trả phí *có thể* là shared team policies, remote workspace fleet, audit retention/export, managed updates và tổ chức nhiều người — **chỉ khi có buyer interviews, willingness-to-pay và chi phí support thực**.

**Phễu giá trị:** thử trên folder demo → kết nối agent đầu tiên → thực hiện action thật → làm tiếp lần hai → owner tin tưởng dùng hằng tuần → nhóm nhỏ chia sẻ policy → trả phí cho quản trị tổ chức. Không lấy downloads hoặc số tool làm north-star metric.

**Vòng phản hồi sản phẩm:** mỗi fail connection có `error class` không lộ secret; mỗi tool fail có step/permission context; mỗi run có human-verifiable diff/proof; hỗ trợ export diagnostics redacted; aggregate adoption chỉ khi user opt-in, không tự thu thập dữ liệu nhạy cảm.

---

## 9. Chiến lược giả thuyết 3–5 năm — những điều có thể thay đổi

| Kịch bản | Điều gì xảy ra? | FolderForge nên phản ứng |
|---|---|---|
| **Agent providers đóng gói sandbox của họ** | Runtime cơ bản trở thành hàng hóa | Tập trung vào **owner-held workspace identity, policy portability và independent evidence**; bớt chạy model bên trong |
| **MCP thay đổi phiên bản hoặc có chuẩn mới** | Protocol APIs dịch chuyển | Duy trì adapter boundary; annual conformance budget; không để business logic phụ thuộc `initialize`/session header |
| **Agent tự động hóa trên browser/computer mạnh hơn** | Capability web tăng, rủi ro exfiltration tăng | Capability-based browser grant, isolated profile, domain/network budget, download/credential protection |
| **Các công ty bắt đầu dùng agent để làm việc liên hệ thống** | Quyền, audit, compliance tạo cơ hội | Optional signed agent handoff/A2A và org policy, nhưng đòi evidence về nhu cầu + khả năng security |
| **Thị trường không muốn nền tảng tự chủ quá rộng** | Dễ mất trọng tâm vì build platform | Quay về sản phẩm local-first nhỏ, one-folder workflow hoàn hảo; không ràng buộc tồn tại vào mega platform |

### “Tầm nhìn rộng” nhưng có giới hạn

Tương lai lý tưởng: một agent của người dùng xin quyền qua **Workspace Manifest**, làm task qua **Governed Execution**, trả lại **Proof of Work**, sau đó chuyển cho agent khác nếu owner đồng ý. FolderForge lúc đó giống **hệ thống phân quyền và thực thi đáng tin cậy cho AI làm việc**, không phải một AI chatbot thêm vào thị trường.

Tuy nhiên đây là **định hướng có điều kiện**, không phải một dự báo chắc chắn. Mỗi quý phải sẵn sàng loại bỏ một ý tưởng “hay” nếu chưa cải thiện reliability, adoption hoặc cost-to-operate.

---

## 10. Đặt roadmap này vào spec/plan 33 task hiện có

Bộ tài liệu v2 hiện tại có **14 acceptance criteria, 33 task, 7 checkpoint**. Không thay thế chúng bằng thêm 100 task chiến lược. Cách dùng đúng:

| Lớp tài liệu | Vai trò | Quy tắc cập nhật |
|---|---|---|
| **North Star (tài liệu này)** | Quyết định *vì sao*, khách hàng nào, đầu tư nào bị từ chối, 2027–2030 | Review mỗi 6 tháng / khi có chứng cứ thị trường mới |
| **Spec v2** | Quy định *cần làm gì*, invariants, UX/API, 14 acceptance criteria | Cập nhật khi phạm vi hay contract đổi, owner approve |
| **Plan v2 (33 task)** | Quy định *làm như thế nào*, thứ tự và test từng bước | Chỉ triển khai từng vertical slice sau acceptance; không big bang |
| **Task checklist** | Tình trạng thực thi và evidence PR/CI | Track exact SHA, owner, blocker, pass/fail, rollback |
| **Audit evidence & ops register** | Sự thật source/CI/runtime/recovery | Không sửa lịch sử để “xanh hóa” status |

**Mapping 90 ngày:** H0 ↔ P00; H1 ↔ P01; H2 ↔ P02; H3 ↔ P03; H4 ↔ P04; H5 ↔ P05 và các phần release readiness. P06 (Advanced) **không** là mặc định bắt buộc để ship v2 local-first. Issue #118 là *gate* cho isolation/recovery thực, không tự động khóa mọi hoạt động MCP basic nếu không chạm nhánh đó.

### Năm quyết định thực sự phải khóa trước khi sửa source

1. **Định vị:** có chấp nhận FolderForge là *runtime cho mọi AI agent* thay vì tự làm một all-in-one autonomous agent không?
2. **Ranh giới “Full workspace”:** chỉ gọi như vậy khi có OS containment, hay trước mắt đặt tên trung thực `Trusted local execution` với cảnh báo?
3. **Beachhead:** solo developer + small team; không enterprise-first trong năm đầu — có phù hợp với mục tiêu kinh doanh không?
4. **Chỉ số:** có chấp nhận TTFVA + repeat usage + verified outcomes là trọng tâm, thay vì số tools/cài đặt không?
5. **Lệnh và UI:** có chốt một hero flow và bốn tabs, chuyển feature khác sang Advanced, giữ backwards compatibility không?

**Quan điểm của tác giả:** chốt cả năm quyết định theo khuyến nghị trên để tránh dàn trải. Nhưng đây vẫn là **đề xuất chờ chủ repo duyệt**; việc sửa production, xóa feature/code cũ, thay transport default hoặc migration registry **không được tự động suy ra từ tài liệu**.

---

## 11. Danh sách nguồn và trạng thái bằng chứng

**Source đã đọc trên `main@b2ad52e`:** `src/main.ts`, `src/runtime/config.ts`, `src/server/protocol/*`, `src/server/transports/*`, `src/dashboard/server.ts`, `src/tools/registry.ts`, `src/workspace/workspace-manager.ts`, `src/multiproject/*`, `packages/mission-control/src/App.tsx`, `screens/Fleet.tsx`, `ui.tsx`, `theme.css`, `package.json`, `docs/audit/REPO_FULL_FLOW_ISSUES_AUDIT_2026-11-14.md` và các bài test protocol. Source support **không** đồng nghĩa active live deployment.

**Public primary references (xác minh 14/11/2026):**

1. [MCP spec release 2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28/) — stateless, headers, auth, extensions, deprecations.
2. [MCP specification 2026-07-28](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/basic/index.mdx) — schema/protocol contracts.
3. [OpenAI Agents documentation](https://developers.openai.com/api/docs/guides/agents) — agent runtimes, tool ecosystems.
4. [A2A project](https://a2a-protocol.org/) — inter-agent interoperability, not a mandated MVP dependency.
5. [OWASP MCP Security](https://cheatsheetseries.owasp.org/cheatsheets/MCP_Security_Cheat_Sheet.html) — tool/schema integrity, sandbox, principle of least privilege.
6. [GitHub main CI](https://github.com/roronoazoroshao/FolderForge/actions/runs/43542136075) và [repo audit](https://github.com/roronoazoroshao/FolderForge/blob/main/docs/audit/REPO_FULL_FLOW_ISSUES_AUDIT_2026-11-14.md). 2026-11-14 snapshot: 5 open issues (#118, #145, #126, #105, #70), 0 open PR.

**Thành thật về giới hạn:** Không có dữ liệu người dùng thật, revenue, support cost, buyer interviews hoặc market share trong phạm vi audit. TTFVA targets, giai đoạn và thứ tự kinh doanh là **giả thuyết chiến lược có test**, không phải số liệu thực tế. Không có thay đổi source hoặc production trong công việc soạn tài liệu này.