# FolderForge — AI Reviewer Council Execution Spec

**State:** IMPLEMENTATION IN DRAFT BRANCH / **NOT APPROVED for production**. **Date:** 2026-11-15. **Tracking:** [Issue #202](https://github.com/roronoazoroshao/FolderForge/issues/202), [AI Review Board #201](https://github.com/roronoazoroshao/FolderForge/issues/201). **Authority:** [AI Board Governance](../../governance/AI_REVIEW_BOARD_POLICY_2026-11-15.md).

## 1. Product intent and job-to-be-done

Owner muốn nhiều AI agent **thực sự được gọi qua model API** đóng vai chuyên gia để tư vấn, phản biện và chốt quyết định có thể truy vết cho chuỗi:

`GOAL → ROADMAP → SPEC → PLAN → TASK → PR`.

Bản phát triển đầu tiên chạy local qua CLI với **OpenAI Responses API** khi operator cấp API key và bật `--execute`. Không giả lập gọi agent, không tự bật network, không có grant host/root/production. Tương lai có thể bổ sung providers khác qua cổng `ReviewerProvider` mà không đổi thuật toán kiểm phiếu.

## 2. Phương án và lý do lựa chọn

| Phương án | Ưu điểm | Hạn chế | Chốt |
|---|---|---|---|
| Tám prompt trong một phản hồi ChatGPT | Rẻ, nhanh | Cùng ngữ cảnh, không có eight provider receipts | **Không có quyền ký** |
| Tám workflow role của `AgentLoopRunner` cũ | Có sẵn state và UI | Dùng `proposalForExpert`, phiếu auto `approve: true` 0.92/0.82 | **Loại khỏi approval** |
| **Một coordinator + 8 Responses API invocations x 2 rounds** | Context tách biệt, real response IDs, tool-free, dễ kiểm phiếu | Tốn API calls, phụ thuộc model provider, cùng model có thể correlated errors | **Chọn cho first slice** |

## 3. Cấu trúc module và trust boundary

| Module | Trách nhiệm | Ranh giới |
|---|---|---|
| `src/ai-board/roles.ts` | 8 profile chuyên gia cố định | Role không phải runtime model |
| `src/ai-board/board.ts` | stage gate, blind/challenge, quorum/veto, checksums | Không có quyền file/network/host; provider receipt phải hợp lệ |
| `src/ai-board/openai-provider.ts` | Một API request cho mỗi agent invocation, Structured Outputs, remote `responseId` | Chỉ network qua explicit CLI `--execute`; không tool, không store, không gửi token vào logs |
| `src/ai-board/cli.ts` | operator đưa source SHA và bằng chứng, tùy chọn gọi model, ghi JSON report | Không đọc file ngoài checkout, không cho gửi tracked dirty state, report `0600`, không overwrite |
| `src/agent-loops/agent-loop-runner.ts` | legacy discovery/implementation | Synthetic proposals **không được tự sinh positive votes**; pause chờ real evidence |

### Evidence / authority

`sourceSha` phải là 40 hex và CLI so với `git rev-parse HEAD`; các artifact phải nằm trong checkout, tổng input tối đa 240000 ký tự. Hash bao gồm stage, source SHA, SHA của nội dung artifact và decision digest của stage trước. Hash trong report chỉ là **integrity checksum**, không phải chữ ký bảo mật/hồ sơ chứng nhận. Chưa có tổ chức certificate, signed attestations hoặc model-run verification API.

Mỗi reviewer thực chạy hai invocation: **BLIND** (không thấy phiếu người khác) và **CHALLENGE** (thấy claim/dissent của reviewer khác dạng dữ liệu untrusted). OpenAI provider lấy `responseId` từ HTTP response, không tin chuỗi do model tự khai. Model chỉ được xem bằng chứng được operator chọn; **không có tool execution**.

### Vote/decision

- 8 seats: PRODUCT, ARCH, SEC, MCP, UX, QA, SRE, CLEAN. AI Chair là code tổng hợp, **không bỏ phiếu**.
- ≥6 verified reviewer receipts vòng CHALLENGE, bắt buộc PRODUCT/ARCH/SEC/QA; 6 phiếu tích cực. Review vòng BLIND hợp lệ là điều kiện của mỗi phiếu vòng CHALLENGE.
- `BLOCKER` của bất kỳ chuyên gia; `HIGH` của ARCH/SEC/QA; veto của ARCH/SEC/QA → `CHANGES_REQUESTED` khi quorum đạt.
- API timeout, missing model, duplicate/stale provider response ID, source không nhất quán, còn thiếu reviewer bắt buộc → `NOT_QUORATE`.
- Mỗi stage phải có một report `APPROVED` từ stage trước **cùng source SHA**; bất kỳ commit mới nào cũng phải đánh giá lại các gate thượng nguồn; `PR` sau `TASK`. Không tự động merge PR, deploy hoặc cấp quyền host.
- Output states: `APPROVED`, `NOT_QUORATE`, `CHANGES_REQUESTED` — đây là **AI board technical verdict**, không phải GitHub official review hay pentest/security certification.

## 4. User stories và acceptance criteria

- **ARB-AC01:** Nếu không cấu hình model/provider, chạy stage GOAL tạo `NOT_QUORATE`, không tạo phiếu, không có mạng.
- **ARB-AC02:** Với provider thực, 8 role x 2 invocation; 16 ID riêng và có source+artifact digest; vòng BLIND không thấy peer.
- **ARB-AC03:** Peer text từ review vòng 1 vào user input dưới nhãn `UNTRUSTED`, không được đưa nguyên văn vào higher-priority `instructions`.
- **ARB-AC04:** Duplicate response ID/digest drift/provider exception/refusal/incomplete structured output làm hạ quorum.
- **ARB-AC05:** Security/QA/Architecture có thể veto; model không được bỏ phiếu APPROVE để bỏ qua BLOCKER của chính nó.
- **ARB-AC06:** Phải có report được kiểm tra digest từ stage trước trước khi sang stage kế; chỉ hash không đủ bảo vệ chống malicious local tampering.
- **ARB-AC07:** CLI không đọc file ngoài checkout/symlink escape; API request chỉ khi `--execute`, có API key và model explicit, source state clean và artifact phải là file tracked trong Git.
- **ARB-AC08:** Legacy AgentLoopRunner không tạo phiếu 0.92/0.82 tự động và không tự triển khai khi thiếu AI review.
- **ARB-AC09:** Người dùng hiểu rõ output chỉ SOURCE-TESTED đến khi chạy với real model credential, có recorded evidence và tổng hợp audit/CI.

## 5. Non-goals và giới hạn cần công bố

- Không ép tạo 8 OS processes hoặc dùng 8 nhà cung cấp; **8 API invocations biệt lập** là 8 lượt gọi model; nếu cùng model/provider thì lỗi nhận thức vẫn có thể tương quan.
- Không tự xác nhận reviewer đã đọc toàn repo, chạy test, nghiên cứu người dùng hoặc độc lập pháp lý. Nhà cung cấp trả `responseId`, nhưng không cung cấp remote attestation có chữ ký trong slice này.
- Không tự call ChatGPT app session hoặc chi tiêu API nếu người dùng chưa bật `--execute` rõ ràng.
- Không tự động khóa/merge/đóng issue theo nội dung model. Bước tích hợp với `AgentLoopManager` state machine, CI provenance evaluator và GitHub reviewer service ở backlog.

## 6. Next security and quality gates

**ARB-C0 source slice:** unit/integration TDD, TS, lint, docs, architecture, legacy AgentLoopManager regressions.

**ARB-C1 real provider proof:** owner-configured credentials, isolated repo checkout, redacted proof pack cho một GOAL stage; 16 actual unique Responses IDs verified, explicit API billing/operator consent.

**ARB-C2 full-chain proof:** GOAL→ROADMAP→SPEC→PLAN→TASK→PR with verified prior report and latest source; independently verify factual claims/tests, re-run after changed SHA, no false `APPROVED`.

**ARB-C3 live integration:** connect AI board verdict to FolderForge workbench/dashboard and task runner, implement signed/trusted receipt storage and cross-provider model diversity option; not part of first slice.
