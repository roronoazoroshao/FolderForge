# FolderForge v2 — Product & Architecture Specification

**North Star:** [Vision 2027–2030](../../strategy/FOLDERFORGE_NORTH_STAR_2027_2030.md) · **Plan:** [Implementation Plan](../plans/2026-11-14-folderforge-v2-implementation.md) · **Task ledger:** [33 nhiệm vụ](../../../tasks/todo.md).

**Bản đề xuất để duyệt · 14/11/2026 · Ngôn ngữ: Tiếng Việt**  
**Tên hướng đi:** Workspace-first MCP · **Baseline kiểm tra:** `main@b2ad52e1bb20babed2436890841ec622cc6c4a5a`, package `@musashishao/folderforge@3.2.4`.  
**Trạng thái:** DRAFT / CHƯA PHÊ DUYỆT / CHƯA TRIỂN KHAI. Những lệnh, endpoint và interface có ghi **ĐỀ XUẤT** chưa tồn tại trên sản phẩm.

> **Một câu dễ nhớ:** Chọn một thư mục → cấp quyền cho AI → kết nối MCP → xem và điều khiển cùng một workspace bằng Web hoặc CLI.

## 0. Đọc nhanh trong 2 phút

### Sản phẩm giải quyết điều gì?

Hiện FolderForge là một control plane có nhiều công cụ (file, Git, shell, browser, workflow, tunnel, plugin, Fleet...). Tuy nhiên người mới chỉ muốn **"Đây là folder của tôi; hãy để AI agent làm việc trong đó"**. Họ không cần nhìn thấy 11 màn hình quản trị trước khi kết nối agent.

**Đích v2:** một workspace tương ứng một thư mục được chủ máy chấp thuận; cùng một identity/quyền/phiên hoạt động bất kể truy cập từ MCP, CLI hay Web. Cơ chế policy, audit và transport cũ **được tái sử dụng**, không viết lại từ đầu.

### Ba kết quả bắt buộc

1. **Dễ bắt đầu:** một lệnh CLI hoặc một luồng Web bốn bước, dùng được với folder thường (không cần Git).
2. **Đúng folder, đúng quyền:** không có request dùng `WorkspaceManager.current` mutable global để quyết định root; mọi mutation đi qua một policy/audit pipeline.
3. **Dễ quan sát và dừng:** chủ máy thấy kết nối nào chạy, quyền nào được cấp, công việc nào đã làm, có thể revoke/stop và đọc lý do lỗi.

### Những điều KHÔNG phải lời hứa v2

- "Toàn quyền" **không** là root trên toàn máy; `Full workspace` chỉ là grant được owner cấp và chỉ có hiệu lực nếu OS/sandbox thật sự bảo đảm phạm vi.
- UI xanh, CI xanh hay PID tồn tại **không** chứng minh agent đã kết nối hoặc sản phẩm đã chạy version mới trên production.
- Không mặc định chạy browser/cloud/tunnel, không thay đổi registry isolation production, không xóa worktree/metadata cũ.

## 1. Vấn đề hiện tại — chứng cứ nguồn

| Tình trạng trong `main@b2ad52e` | Hệ quả | Quyết định |
|---|---|---|
| `src/main.ts` gần 39 KB, rất nhiều subcommand và flag; `src/dashboard/server.ts` ~3.084 dòng | Khó tìm lệnh/mục chính; thay route có thể tác động auth | Tách adapter theo domain, **giữ CLI/API cũ** |
| Mission Control có 11 mục navigation; `screens/Fleet.tsx` ~1.362 dòng | Người dùng mới bị thông tin vận hành lấn át | UI chính 4 khu vực; tính năng chuyên sâu sang Advanced |
| `src/tools/registry.ts` đã nối policy → approval → quota → tool → audit | Đây là điểm mạnh và ranh giới bảo mật | Giữ làm execution kernel duy nhất |
| `WorkspaceManager.current` là trạng thái process-global; F14/F15 đã merge nhưng opt-in | Nhiều phiên có thể chọn nhầm ngữ cảnh ở legacy path | Context bất biến theo request/session; test hai folder chạy đồng thời |
| CLI `init`, `doctor`, `connect`, server stdio/HTTP đã tồn tại | Không cần thiết kế lại onboarding từ số 0 | Tạo facade thân thiện bao trên logic hiện có |
| `docs/audit` báo #118 thiếu writer fencing host; 24 active isolation record không nhất quán; host gần đầy disk; live build cũ hơn source | Refactor hoặc restart không kiểm soát có thể làm mất recovery, tạo khoảng trống bảo mật | Có gate trước động chạm production; source/CI ≠ live-certified |

**Nguồn kiểm tra:** [audit đầy đủ](https://github.com/roronoazoroshao/FolderForge/blob/main/docs/audit/REPO_FULL_FLOW_ISSUES_AUDIT_2026-11-14.md), [CI main@b2ad52e](https://github.com/roronoazoroshao/FolderForge/actions/runs/43542136075) (success), [security issue #118](https://github.com/roronoazoroshao/FolderForge/issues/118).

## 2. Người dùng, phạm vi, từ điển

### Người dùng chính

- **Local owner (chủ máy):** chọn folder, kết nối client, cấp và thu hồi quyền, cấu hình server, xem audit.
- **AI agent/client:** Cursor, Claude, VS Code, ChatGPT hoặc generic MCP client; chỉ được thao tác theo grant và principal của phiên đó.
- **Advanced operator:** quản lý tunnel, Fleet, browser, child MCP, distributed worker hoặc host trust; không phải hành trình cơ bản.

### Thuật ngữ nói dễ hiểu

| Tên | Hiểu đơn giản | Không nên hiểu nhầm |
|---|---|---|
| Folder | Thư mục trên ổ đĩa, có thể không có Git | Không phải mỗi folder đều cần daemon riêng |
| Workspace | Folder + identity ổn định + policy/grants + cấu hình kết nối | Không phải `cwd` biến đổi toàn process |
| Connection | Một cấu hình client MCP hoặc một phiên kết nối thực | Có config không có nghĩa client online |
| Session | Kết nối có ID, principal, workspace và hạn dùng | Không được tự chuyển sang folder khác |
| Grant | Chủ máy cấp năng lực cụ thể cho agent trong thời hạn | Không phải cấp quyền OS root |
| Run | Một công việc/call có ID và audit/proof | Không phải "agent tự lập kế hoạch" nếu chỉ chạy tool |
| Web control | Giao diện quản lý cùng backend/use case với CLI | Không phải backend quyền riêng |

### Mục tiêu và ngoài phạm vi

**Trong MVP:** Local single-user, one/multiple local folders, stdio + HTTP loopback, owner-approved connection, file/Git/shell/test/build, health/status, revoke, audit, Web & CLI parity, non-Git folders, design system.

**Giai đoạn Advanced có điều kiện:** F14/F15 multi-project HTTP gateway, remote tunnel/OAuth, browser adapter, Fleet, plugin/marketplace, host-wide privilege, model-driven autonomous orchestration.

**Ngoài phạm vi v2 cơ bản:** viết lại MCP protocol, xây một AI model/provider mới, OS root admin qua MCP token, thay filesystem bằng cloud, Kubernetes/microservices, xóa hàng loạt module cũ, sửa issue #118 bằng UI.

## 3. Hai phương án kiến trúc và quyết định đề xuất

| Cách làm | Điểm mạnh | Rủi ro | Nhận định |
|---|---|---|---|
| **A — Rewrite** toàn bộ CLI/backend/UI | Code mới sạch hơn trên giấy | Làm mất protocol nuance, tests, auth, recovery; thời gian đưa vào dùng dài | Không chọn |
| **B — Modular monolith + strangler migration** | Thay từng vertical slice; tận dụng ToolRegistry/CI; có rollback | Một thời gian còn adapter legacy | **Chọn làm giả định cho plan** |
| **C — Chỉ thay UI/onboarding** | Ra mắt nhanh | Shared mutable workspace và backend lớn chưa giải quyết | Dùng làm prototype, không phải kiến trúc cuối |

**Giả định chờ chủ repo duyệt:** phương án B; local owner là người dùng mặc định; Web và CLI chung use case; Full workspace không là Full host. Đây là các quyết định của bản draft, **không coi là đã phê duyệt**.

## 4. Hành trình người dùng — yêu cầu sản phẩm cụ thể

### Journey J1 — Folder từ CLI

**Tình huống:** người dùng có thư mục `~/Projects/site` và Cursor.

```bash
# API MỚI ĐỀ XUẤT, KHÔNG chạy trên release hiện tại
folderforge up ~/Projects/site --client cursor
folderforge status ~/Projects/site
folderforge ui ~/Projects/site
folderforge stop ~/Projects/site
```

**Thứ tự hành vi cần có:**

1. Resolve path, kiểm tra folder tồn tại, xác định realpath và filesystem identity; mặc định không tạo folder.
2. Hiển thị root thực và profile quyền (`Develop` mặc định ở bước khởi tạo, **không** tự nâng thành `danger`).
3. Nếu phải ghi file cấu hình client, trình bày chính xác file sẽ sửa, hỏi owner và lưu bản backup để undo. Nếu chạy headless không có consent, trả lỗi có hướng dẫn hoặc dùng `--profile`/grant đã có, **không coi `--yes` là quyền root**.
4. Tạo/reuse workspace record thông qua **cùng application service**; chống chạy song song tạo trùng.
5. Với `stdio`: tạo connection receipt/client config và chạy probe handshake kiểm soát; chỉ báo `CONFIGURED` hoặc `READY_TO_CONNECT` trước khi client thực sự gọi. Với HTTP: chỉ báo `READY` sau MCP initialize handshake thật qua endpoint và kiểm tra auth/session.
6. In connection receipt: workspace ID, root, profile/effective grant, client, transport, status, đường dẫn sửa, undo, lệnh status/revoke/stop. Không in token thô.
7. Sau khi client kết nối: hiển thị `CONNECTED` kèm `lastSeen`, principal và session ID; ngắt kết nối chuyển đúng state.

**Lỗi cần UX rõ:** folder bị xóa/đổi tên, symlink ra ngoài grant, thiếu permission, client config read-only, port đang dùng, token hết hạn, worker dead, non-Git repo, fail to audit, disk full.

### Journey J2 — Folder từ Web

**Bốn bước, mỗi bước có trạng thái và Back:**

1. **Add folder:** chọn/thêm đường dẫn (filesystem picker chỉ nếu browser và trusted local bridge thật sự hỗ trợ), preview canonical root, cảnh báo duplicate. Không tự dò filesystem bằng browser từ xa.
2. **Set access:** Inspect / Develop / Full workspace. Hiện danh sách cụ thể: read, write, shell, network, child tools, host. Nêu "điều gì không được phép".
3. **Connect AI:** chọn Cursor/Claude/VS Code/ChatGPT/Generic. Hiện cách kết nối phù hợp với transport, OAuth/Token khi cần; kiểm tra kết nối và config. Không giả mạo tình trạng client online.
4. **Control:** connection health, session, run, tool actions, audit, approval; các nút Pause, Stop, Revoke owner-only và có confirm/feedback.

**Success:** Chủ máy thao tác được J1/J2 trên folder rỗng và folder Git; quay lại Web thấy đúng workspace đã tạo từ CLI (và ngược lại).

### Journey J3 — Agent thực thi trong folder

`MCP request → authenticate principal → bind immutable workspace/session/grant → classify tool/capabilities/target → policy & approval → quota → execute via worker → durable audit/result`.

**Kết quả:** ít nhất file read/write, search, Git status/diff, shell bounded, test/build hoạt động đúng workspace. Tool chuyên sâu do adapter cung cấp khi bật, nhưng **không** né policy. Thao tác shell và external binaries phải dùng kernel/OS confinement thật; kiểm tra path string đơn thuần không đủ để coi là sandbox.

### Journey J4 — Chủ máy tạm dừng hoặc thu hồi quyền

Owner bấm **Revoke** hoặc chạy CLI tương ứng; grant revision tăng; request mới bị từ chối; các run/child process đang chạy được xử lý theo chính sách cancel/kill rõ ràng; UI báo "revocation requested" tới khi các worker xác nhận. Không nói "đã thu hồi toàn quyền" khi tiến trình cũ vẫn giữ quyền OS ngoài khả năng kiểm soát.

### Journey J5 — Các trường hợp không thuận lợi

- Hai agent độc lập trên folder A và B chạy song song; switch A không làm B bị chuyển root.
- Một agent được quyền shell không được lách bằng symlink, archive extraction, environment variable hoặc subprocess để động đến outside root nếu chế độ được quảng cáo là "workspace-confined".
- Worker chết giữa mutation: audit có trạng thái `UNCERTAIN`, operator cần xử lý; không retry mutation tự động.
- Phân vùng đĩa đầy/permission audit fail: hành động rủi ro cao fail closed, state không báo completed giả.
- Tunnel đến từ mạng ngoài: token MCP không có quyền owner, không tạo grant/đổi policy.

## 5. Capability map — những module phải tách rõ

```text
CLI adapter ─┐
             ├─> application-control ─> workspace-domain / contracts
Web/API ─────┘                │                   │
                              ├─> workspace-repository + supervisor
MCP transport ─> tool-kernel  ├─> owner/grant manager
                    │         └─> observability
                    └─> worker boundary ─> filesystem/git/shell/browser tools

Quy tắc: UI/CLI/HTTP chỉ gọi use case, không tự sửa state/policy.
```

| ID module | Chỉ chịu trách nhiệm gì? | Depends on | Code đang có để tái sử dụng |
|---|---|---|---|
| `workspace-domain` | WorkspaceId, root identity, capabilities, immutable context, state transition | typed core only | `src/workspace/`, `src/core/types.ts` |
| `control-usecases` | add/list/start/stop/status/connect/grant/revoke; validation, idempotency | domain + ports | `src/runtime/container.ts`, `src/control/`, `src/onboarding/` |
| `workspace-state` | durable registry, CAS, file locking, crash-safe persistence và restore contract | domain | existing storage/audit infra |
| `owner-auth` | owner identity/auth, consent, CSRF/origin, grants | domain + policy contracts | `src/operator/`, `src/dashboard/server.ts`, `src/policy/` |
| `mcp-transport` | stdio/HTTP/OAuth protocol, handshake, sessions; không đổi scope | domain/usecases + tool-kernel | `src/server/`, `src/chatgpt/` |
| `tool-kernel` | một pipeline classify → authorize → quota → invoke → audit | domain + ports | `src/tools/registry.ts`, `src/policy/`, `src/audit/` |
| `workspace-worker` | runtime per workspace, process lifecycle, root/sandbox binding | tool-kernel + OS ports | `src/multiproject/`, `src/sandbox/`, managers |
| `control-adapters` | API + CLI mapping cùng command/query, JSON schema/error | control-usecases | `src/main.ts`, `src/dashboard/server.ts` |
| `web-console` | onboarding/control UX, layout, components, state/error | typed API | `packages/mission-control/` |
| `advanced-adapters` | browser/plugin/tunnel/Fleet/agent loop dưới explicit feature flag | tool-kernel + owner-auth | modules tương ứng hiện có |

**Dependency rule:** domain không import Node HTTP, React hay `process.cwd()`; adapter không gọi trực tiếp store mutation; không có vòng phụ thuộc. Monolith deployable bình thường, **không cần lập 10 process** theo 10 module.

## 6. Hợp đồng dữ liệu và kiểm soát phiên

### Các kiểu dữ liệu dự kiến

```ts
// ĐỀ XUẤT: contract đầu tiên, chưa tạo trong repository
type WorkspaceId = string;
type Profile = 'inspect' | 'develop' | 'full-workspace';
type ConnectionTransport = 'stdio' | 'http' | 'remote-http';

type WorkspaceRecord = Readonly<{
  id: WorkspaceId;
  displayName: string;
  canonicalRoot: string;
  rootIdentity: { deviceId: string; fileId: string } | null;
  createdAt: string;
  revision: number;
}>;

type WorkspaceContext = Readonly<{
  workspaceId: WorkspaceId;
  canonicalRoot: string;
  principalId: string;
  sessionId: string;
  grantId: string;
  grantRevision: number;
  operationId: string;
}>;

type ConnectionState =
  | { kind: 'not-configured' }
  | { kind: 'configured'; transport: 'stdio'; probe: 'passed' | 'not-run' | 'failed' }
  | { kind: 'starting' }
  | { kind: 'ready'; transport: 'http'; healthCheckedAt: string }
  | { kind: 'connected'; transport: ConnectionTransport; sessionId: string; lastSeenAt: string }
  | { kind: 'degraded'; code: string; message: string }
  | { kind: 'stopped' };

type OperationOutcome<T> =
  | { kind: 'succeeded'; operationId: string; value: T }
  | { kind: 'rejected'; operationId: string; code: string; message: string }
  | { kind: 'uncertain'; operationId: string; evidenceId: string };
```

**Lưu ý:** `deviceId/fileId` biểu diễn OS identity theo nền tảng, không giả định inode có nghĩa giống nhau trên Windows. Khi không xác minh được, phải có trạng thái `UNVERIFIED_ROOT`, không tự nhận "kernel confined". Root được revalidate trước mutation nhạy cảm; chống TOCTOU ở worker bằng cơ chế OS handle/path-aware APIs khi có thể.

### Invariants bắt buộc (vi phạm là bug/blocker)

- **I-01:** Mỗi request MCP có `workspaceId`, `principalId`, `sessionId` và grant revision hợp lệ; không tự dựa vào `WorkspaceManager.current`.
- **I-02:** Hai session không thể sửa root, catalog hoặc grant của nhau chỉ bằng lệnh `switch`.
- **I-03:** Không có đường ghi CLI, Web, child MCP, browser hoặc workflow bỏ qua ToolRegistry/policy/audit.
- **I-04:** MCP bearer/remote OAuth principal không tự trở thành local owner.
- **I-05:** JSON state revision và owner mutation dùng CAS/idempotency; retry cùng operation không lặp hiệu ứng.
- **I-06:** Action outcome `uncertain` không được tự retry mutation; lưu evidence và yêu cầu operator quyết định.
- **I-07:** `READY`/`CONNECTED` chỉ có evidence tương ứng; `stdio-configured` không phải server live.
- **I-08:** Existing `folderforge init`, `connect <client>`, `--project ... --stdio`, `/mcp`, Dashboard routes hoạt động trong transition.
- **I-09:** No production reconcile/restore của isolation registry khi security gate #118 chưa có writer fence và approval độc lập.
- **I-10:** No secret/token raw in logs, error string, response JSON, HTML, support bundle.

### Vòng đời trạng thái

```text
UNREGISTERED -> REGISTERED -> CONFIGURED -> (STARTING -> READY) -> CONNECTED
                                 |             |         |
                              STOPPED       DEGRADED  DISCONNECTED

Grant: PROPOSED -> OWNER_APPROVED -> ACTIVE -> REVOKING -> REVOKED/EXPIRED
Run:   QUEUED -> RUNNING -> SUCCEEDED | FAILED | CANCELLED | UNCERTAIN
```

Không ép mọi transport đi cùng một chuỗi: STDIO có thể `CONFIGURED` trong lúc client chưa khởi tạo, HTTP có thể `READY` dù chưa có client; agent `CONNECTED` chỉ khi có phiên thực.

## 7. API, CLI và sự tương thích — hợp đồng dự kiến

### CLI (ĐỀ XUẤT)

| Lệnh | Ý nghĩa | Compatibility |
|---|---|---|
| `folderforge up <path> [--client cursor] [--profile develop]` | Add/reuse + profile + start/configure + receipt | lệnh mới, không thay `folderforge --stdio` |
| `folderforge status [<path>] [--json]` | status/health, no token | mới |
| `folderforge ui [<path>]` | mở Web control local | mới, alias `control open` |
| `folderforge stop [<path>]` | dừng local managed workspace instance | mới; không kill external arbitrary process |
| `folderforge workspace connect <path> --client <id>` | cấu hình client và verify | mới để tránh đụng `connect <client>` cũ |
| `folderforge workspace access <path> --profile inspect|develop|full-workspace` | preview / owner consent / set policy | mới; full không cấp host root |
| `folderforge workspace revoke <path> --session <id>` | revoke grant/connection | mới owner-only |

`--json` phải machine-readable, response code ổn định, stdout chỉ result và stderr chỉ diagnostics (không in secrets). Exit code đề xuất: `0` thành công, `2` validation, `3` authorization, `4` unavailable, `5` uncertain; **chỉ chốt sau khi audit exit codes hiện tại để tránh collision**.

### Local Control API (ĐỀ XUẤT; namespace chưa hiện hữu)

| Request | Vai trò | Response / bất biến |
|---|---|---|
| `POST /api/v2/workspaces` | owner | `{workspaceId,root,revision}`; duplicate canonical root → existing hoặc 409 theo key |
| `GET /api/v2/workspaces` | owner | list paginated; không leak ngoài owner scope |
| `POST /api/v2/workspaces/:id/start` | owner | idempotent operation, status code 202 với job hoặc 200 khi complete |
| `POST /api/v2/workspaces/:id/stop` | owner | hữu hạn thời gian; partial failure công khai |
| `GET /api/v2/workspaces/:id/health` | owner/scoped principal | ready/configured/connected/degraded, transport rõ |
| `POST /api/v2/workspaces/:id/connections` | owner | client config plan/receipt, consent và undo token |
| `GET /api/v2/workspaces/:id/sessions` | owner | principal/session scoped, last-seen, revoke status |
| `POST /api/v2/workspaces/:id/grants` | owner **chỉ** | explicit capability, expiry, revision check |
| `POST /api/v2/workspaces/:id/grants/:gid/revoke` | owner **chỉ** | không nói success trước worker ack |
| `GET /api/v2/workspaces/:id/activity` | owner | cursor pagination, audit ids, redacted args |

**Thiết kế API:** versioned DTO, validation tại adapter và domain, structured errors `{code,message,operationId,details?}`; `Idempotency-Key` bắt buộc với mutations dễ retry; atomically reserve request hash; cùng key+body khác → reject; đang chạy trả 202/409; failure UNKNOWN không replay. Mọi Web owner write cần auth đúng, `Origin`/CSRF và cookie/token handling hiện có. Không tự open network listen ngoài loopback.

**Tương thích:** route hiện tại `/workspaces`, `/operator/config...`, MCP protocol/client config cũ giữ nguyên và có snapshot tests. `/api/v2/*` là đề xuất; không thay route v1 trong cùng release.

## 8. Phân quyền — từ "làm mọi thứ" đến "làm đúng phạm vi"

| Capability | Inspect | Develop | Full workspace | Trusted host Advanced |
|---|---|---|---|---|
| Read/search trong folder | Có | Có | Có | Theo scope |
| File write/delete trong folder | Không | Có + policy/approval | Có + policy + audit | Theo grant |
| Git/patch/test/build | Chỉ inspect | Có, bounded | Có, bounded | Theo scope |
| Shell commands | Không | Các lệnh được phép, bounded | Rộng hơn **nếu** sandbox chứng minh đủ | Explicit scope |
| Browser / network / child MCP | Tắt | Opt-in có policy | Opt-in grant riêng | Theo scope |
| Secrets / host folders / root | Không | Không | Không mặc định | OS-owner consent riêng, expiry, audit |

**Phải ghi sự thật về cách ly:** cùng Unix UID với quyền shell rộng không bảo đảm file isolation chỉ bởi `allowedDirectories`/realpath check. Chỉ hiển thị "workspace confined" khi có OS sandbox, UID/ACL hoặc chính sách execution đủ mạnh đã test. Nếu chưa, show "logical scope only", ngăn full-workspace production quảng cáo sai.

**Bảo mật đặc thù:** reverse proxy/SSH/tunnel không biến user thành owner; MCP tokens scoped, rotated, stored an toàn; CSRF và origin check cho Web; symlinks/hardlinks/mount boundary, Git hooks, shell env, PATH injection, archives và spawned processes là threat vectors cần kiểm tra.

## 9. Web Control v2 + Design System

### Information architecture: bốn khu vực

| Vị trí | Người dùng tìm gì? | Gộp từ feature cũ |
|---|---|---|
| **Folders** | Add, root, status, connect, start, stop, access | Overview + Workspaces + Fleet common |
| **Sessions** | Client/agent đang kết nối, grant, revoke, state | Agent Loops + Tunnels status + connection summary |
| **Activity** | Runs, tool calls, approvals, audit, evidence, errors | Audit + Approvals + Runs |
| **Settings** | Auth, adapter, quotas, runtime; tab Advanced | Tools, Plugins, Responses, Fleet, tunnel deep setup |

**Không xóa** source/module của các feature bị ẩn. Deep links cũ redirect hoặc tiếp tục hoạt động cho operator; có usage inventory và compatibility tests trước khi thật sự deprecate.

### Design tokens và component contracts

Giữ stack **React 18, TypeScript, Vite 6, Tailwind 4** hiện tại. Giữ màu chủ đạo đang có (`#57d49b` mint accent, nền dark), nhưng chuyển mọi hard-coded hex đáng kể sang semantic tokens: `surface-page`, `surface-panel`, `surface-raised`, `content-primary`, `content-muted`, `border-default`, `action-primary`, `status-success/warning/danger`, `focus-ring`. Space theo bội `4px`; radii theo `sm/md/lg`, không rải `rounded-[10px]` lặp lại.

**Primitives có API rõ:** `Button`, `Field`, `TextInput`, `Select`, `Dialog`, `Toast`, `StatusIndicator`, `DataTable`, `EmptyState`, `ErrorNotice`, `PermissionSummary`, `ConnectionReceipt`, `WorkspaceCard`, `WorkspaceHealth`.

- UI chỉ **hiển thị quyền mà API trả về**; nút disabled không là kiểm soát bảo mật.
- Components không tự fetch/cấp quyền; hooks/container giải quyết data loading; presentational components nhận typed props.
- Các trạng thái **loading, empty, error, degraded, success** có copy và retry action rõ; không dùng spinner vô hạn.
- WCAG 2.2 AA mục tiêu: keyboard-only, focus visible, dialog focus management, form label/error, contrast, text scale, reduced motion. Test 320/390/768/1024/1440 px.
- Design tokens sống tại một nguồn; không cài thư viện UI mới nếu primitives hiện có đủ.
- Tạo màn hình "Folder details" là **trang chính**: endpoint/transport, effective profile, health, connection receipt, Active sessions, Activity và owner controls.

### Wireframe mô tả

```text
FOLDERFORGE                        ● LOCAL · OWNER VERIFIED
[ Folders ]  [ Sessions ]  [ Activity ]  [ Settings ]

Your folders                                     [+ Add folder]
───────────────────────────────────────────────────────────
📁 /Projects/web-site          CONFIGURED · DEVELOP
   Cursor config saved · waiting for first client session
   [Copy connection] [Open details] [Change access]

📁 /Projects/api               CONNECTED · INSPECT
   1 client session · 12 audited tool calls
   [See activity] [Revoke] [Stop]
───────────────────────────────────────────────────────────
Attention: 2 requests need owner approval. [Review]
```

## 10. Persistence, security, observability, rollback

### State/data

- Một **canonical registry** trong owner-controlled app state (đường dẫn platform-specific/OS permissions), không ghi nhầm vào root project mà user chỉ cấp Inspect. Reuse durable store/lock pattern hiện có; không tự cài database mới trong MVP.
- `WorkspaceRecord`, `GrantRecord`, `ConnectionReceipt`, `RunRecord` có version/revision, timestamp, deterministic IDs, owner provenance. `WorkspaceId` giữ ổn định trong phạm vi store; root rename/rebind phải tạo owner-authorized migration event.
- Credentials tách ra secure storage, không lưu plaintext trong project `.folderforge/config.yaml`, Git, logs hoặc debug bundle.
- Audit attempt và final result có operation/correlation IDs, redaction, durability mode; critical side effect fail closed nếu audit store không ghi được.

### Supervision/health

- Không kill/restart daemon đang chạy ngoài quản lý; nhận diện binary version/digest, workspace root, session owner trước khi stop hoặc reuse.
- `READY` có validated handshake evidence; `CONNECTED` có session lastSeen; `DEGRADED` có reason code và recovery steps.
- Nâng cấp production cần artifact SHA, ownership/protocol attestation, canary trên isolated instance, rollback plan; không "restart để cập nhật" chung chung.

### Failure / recovery

- Crash trước/giữa/ sau side effect, duplicate request và disk full có integration fault tests.
- Cấu hình client sửa dở phải atomic/backup và rollback; không xóa config khác của client.
- Recovery của legacy isolation registry **không thuộc refactor**; gate #118 và 24 active records phải xử lý theo quy trình chuyên biệt. Không gộp tự động vào `folderforge up`.

## 11. Cấu trúc code đích — tối thiểu, theo thay đổi từng lát

```text
src/
  workspace/              # giữ path cũ, thêm identity/context/contracts + tests
    workspace-identity.ts   # NEW
    workspace-context.ts    # NEW
  application/             # NEW: use cases chung CLI/Web
    workspace-control.ts
    workspace-repository.ts  # port interface
  control/                 # giữ CLI cũ, thêm command adapter mỏng
  dashboard/
    server.ts              # ghép routes, dần chuyển từng route sang controllers
    routes/                # NEW: workspace routes; owner/auth wrappers dùng chung
  server/                  # MCP transport hiện có; add context bind integration
  tools/                   # giữ registry/security kernel
  policy/                  # giữ enforcement
packages/mission-control/src/
  design-system/           # NEW: tokens/controls, composition từ ui.tsx
  features/workspaces/     # NEW: Add Folder, Folder Details, Connect
  features/sessions/       # NEW: session and revoke
  features/activity/       # NEW: timeline
  screens/                 # legacy/advanced until migration is proven
```

**Không áp giới hạn 200 dòng một cách máy móc**; tách file khi trách nhiệm đổi/contract có thể test riêng. Source gọn hơn là hệ quả, không phải mục tiêu duy nhất. Kiểm soát số module public export và dependency cycles bằng script architecture hiện có.

## 12. Kịch bản nghiệm thu — ánh xạ với ID yêu cầu

| ID | Tình huống và chứng cứ PASS | Mức ưu tiên |
|---|---|---|
| **AC-01** | Folder không Git, folder Git và folder rỗng: add/create/reuse workspace không lỗi, không mutate ngoài yêu cầu | P0 |
| **AC-02** | CLI up + Web Add cho cùng root tạo cùng workspace ID, profile/effective grant giống nhau | P0 |
| **AC-03** | STDIO `CONFIGURED` trước client connect, `CONNECTED` sau handshake, lost session → disconnected. HTTP `READY` chỉ sau handshake và auth | P0 |
| **AC-04** | 2 workspace, >=2 simultaneous clients, 100 adversarial requests gồm switching, symlink, path escapes: 0 wrong-root mutation; shell confinement evidence khi claimed | P0 |
| **AC-05** | Remote MCP principal không thể gọi owner-only grant/revoke/settings; owner HTTP writes giữ origin/CSRF | P0 |
| **AC-06** | CLI & Web basic operations trả cùng result/error enums và audit/correlation IDs (contract tests) | P0 |
| **AC-07** | Revoke active grant: request mới bị deny, active worker state được báo trung thực; no leaked secret | P0 |
| **AC-08** | Duplicate start/connect dùng same idempotency key không sinh duplicate config/process; body khác trả reject | P0 |
| **AC-09** | ENOSPC/corrupt state/crash/unknown completion: no false success, recovery evidence và no unsafe auto retry | P0 |
| **AC-10** | Legacy `init`, `connect <client>`, stdio/HTTP MCP, Dashboard API unchanged trong transition | P0 |
| **AC-11** | Folders/Sessions/Activity/Settings hoạt động keyboard-only, 390px, responsive, WCAG checks; old URLs không 404 | P1 |
| **AC-12** | Production activation chỉ sau artifact SHA proof, host security gate #118, canary/rollback sign-off | P0 trước cutover |
| **AC-13** | Source verify/type/lint/architecture/docs/test/stdio-http smoke CI giữ xanh, no skipped critical test không giải thích | P0 |
| **AC-14** | Advanced tools vẫn có truy cập và API compatibility; hidden ≠ deleted | P1 |

**Chỉ số sản phẩm cần đo, không tự hứa:** thời gian first successful handshake (p50/p95), tỷ lệ onboarding thành công ở 3 MCP clients, sai root = 0, số thao tác phải dùng Advanced, `Connected` false positives = 0; thiết lập baseline từ test/telemetry trước khi đặt SLO.

## 13. Thực thi, thử nghiệm, quản trị chất lượng

**Stack/repo thực tế:** Node `>=22`; TypeScript; Vitest; ESLint; MCP stdio/HTTP; React/Vite/Tailwind. Các lệnh đã kiểm từ `package.json`:

```bash
npm run typecheck
npm run lint
npm run architecture:check
npm run docs:check
npm test
npm run verify
npm run build
npm run smoke:stdio
npm run smoke:http
npm run smoke:onboarding
npm run test:coverage
```

**Phương pháp:** TDD/focused regression cho từng lát; contract tests CLI+Web; adversarial tests permission/session/root; integration MCP; visual + accessibility tests; `npm run verify` ở checkpoint; smoke tests chỉ sau khi build và trên fixture/local isolated service, không trỏ production. Coverage branch main hiện khoảng 66.91% tại một lượt CI; không đặt target 90% tùy tiện — ratchet critical changed branches và luôn báo skipped tests.

**Mã lỗi:** không swallow lỗi, không tự retry side effect khi uncertain; validation thống nhất; cấu trúc import một chiều. Mọi rollout giữ rollback, người duyệt và exact source SHA.

## 14. Phụ thuộc, gate và sự thật không được che khuất

| Gate | Vì sao bắt buộc | Có thể làm gì trước? | Không được làm gì? |
|---|---|---|---|
| `G0-A` host disk gần 100% | ENOSPC gây mất audit, evidence, process | inventory/cache candidates, off-host backup, test isolated | xóa bừa checkout/ignored/recovery |
| `G0-B` 24 isolation records không nhất quán | branch purge để lại metadata active, chưa có ownership provenance | snapshot, classify read-only | reconcile/restore/discard thật |
| `G0-C` #118 kernel writer epoch fencing | source hook chưa có host proof/reviewer độc lập | code ở fixture/test harness | production mutation security gate |
| `G0-D` live dist/process drift | source mới không bằng process đang chạy | artifact inventory & isolated canary | blind restart/tunnel repoint |
| `G0-E` current `danger` runtime | approval bypass, quyền host có thể rộng | policy review & controlled tests | tự hạ/nâng policy live không có owner consent |

**Cho phép phát triển source trong fixture trước khi gate vận hành hoàn tất**, nhưng không triển khai production/cutover. Phân biệt **product acceptance**, **source CI**, và **production security qualification** — không cho một loại thay thế hai loại kia.

## 15. Câu hỏi còn mở trước khi khóa đặc tả

1. **Full workspace** có yêu cầu chạy shell tùy ý trong thư mục bằng sandbox bắt buộc không, hay chỉ owner-consented `danger` trong trusted local mode? Khác biệt lớn về OS boundary.
2. Người dùng ưu tiên **stdio local** hay một **HTTP gateway chung**? Cả hai hỗ trợ, nhưng ưu tiên định hình lệnh `up`, health/status và đường triển khai.
3. Browser control nghĩa là **quản trị Web console** hay **AI điều khiển trình duyệt Playwright** (hoặc cả hai)? Đây là hai capability khác nhau, mức nguy cơ khác nhau.
4. Số platform MVP: Linux, macOS, Windows đều được hỗ trợ hiện tại; OS sandbox/isolation equivalence khác nhau và cần matrix proof.
5. Trạng thái cấu hình của client nên yêu cầu consent mỗi lần hay lưu trusted owner grant có thời hạn? Default draft: mỗi loại file ngoài workspace lần đầu phải xác nhận.

### Quyết định chốt để triển khai

**D-01** Modular monolith/strangler; **D-02** Local-first; **D-03** one identity per root; **D-04** 4 khu vực Web; **D-05** existing ToolRegistry; **D-06** scoped Full workspace; **D-07** Advanced opt-in. Các quyết định này đang ở trạng thái **đề xuất**. Sau khi chủ repo duyệt, mới triển khai theo Plan liên kết.

---

**Liên kết tài liệu:** `FolderForge_v2_Plan_2026-11-14.md` (implementation plan), `FolderForge_v2_Tasks_2026-11-14.md` (checklist). **Không có source code hay CI đã thay đổi khi xuất bản draft này.**