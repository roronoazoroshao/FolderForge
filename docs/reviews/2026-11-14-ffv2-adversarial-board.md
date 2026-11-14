# FolderForge v2 — Hội đồng phản biện adversarial review

**Ngày:** 2026-11-14 · **Bản được soi:** PR [#200](https://github.com/roronoazoroshao/FolderForge/pull/200), commit `a8068cc6595d947e206e0cc829cf73ee4b6d9053` · **Status:** `CHANGES REQUESTED / DESIGN NOT APPROVED` · **Review board:** [#201](https://github.com/roronoazoroshao/FolderForge/issues/201)

> **Provenance:** Đây là **một lần phân tích do ChatGPT thực hiện qua 8 lăng kính chuyên môn**. Không phải tám chuyên gia độc lập, tám model độc lập, hội đồng nhân sự được bổ nhiệm hay kiểm thử người dùng. Các vai diễn là **AI_SIMULATED**. GitHub hiện không có submitted review trên PR #200 tại lúc kiểm tra. Hai GitHub Actions run của head `a8068cc` đã `success`, nhưng CI **không phải approval**.

## 1. Phán quyết trước khi xem chi tiết

**Không khóa Spec/Plan và không merge PR #200 như một “complete foundation”** trước khi xử lý các bất nhất P0 và có người có thẩm quyền duyệt. Cho phép tiếp tục cải tiến **documentation/tests trên nhánh review**, nhưng mọi quyền host/sandbox/cutover chỉ khi gate độc lập được thông qua. Code mới trong PR là primitive chưa wired vào MCP tool dispatch.

### Phạm vi bằng chứng

- [Spec v2](../superpowers/specs/2026-11-14-folderforge-v2-design.md), [Plan](../superpowers/plans/2026-11-14-folderforge-v2-implementation.md), [Tasks](../../tasks/plan.md), [Vision](../strategy/FOLDERFORGE_NORTH_STAR_2027_2030.md).
- [PR #200 source changes](https://github.com/roronoazoroshao/FolderForge/pull/200/files), đặc biệt [workspace-context.ts](https://github.com/roronoazoroshao/FolderForge/blob/a8068cc6595d947e206e0cc829cf73ee4b6d9053/src/workspace/workspace-context.ts#L3-L42) và [workspace-identity.ts](https://github.com/roronoazoroshao/FolderForge/blob/a8068cc6595d947e206e0cc829cf73ee4b6d9053/src/workspace/workspace-identity.ts#L6-L23).
- [ToolRegistry](https://github.com/roronoazoroshao/FolderForge/blob/a8068cc6595d947e206e0cc829cf73ee4b6d9053/src/tools/registry.ts), [WorkspaceManager](https://github.com/roronoazoroshao/FolderForge/blob/a8068cc6595d947e206e0cc829cf73ee4b6d9053/src/workspace/workspace-manager.ts), [Mission Control App](https://github.com/roronoazoroshao/FolderForge/blob/a8068cc6595d947e206e0cc829cf73ee4b6d9053/packages/mission-control/src/App.tsx).
- [Audit ngày 14-11](https://github.com/roronoazoroshao/FolderForge/blob/main/docs/audit/REPO_FULL_FLOW_ISSUES_AUDIT_2026-11-14.md), [security gate #118](https://github.com/roronoazoroshao/FolderForge/issues/118), [roadmap #195](https://github.com/roronoazoroshao/FolderForge/issues/195).
- Quan sát kết quả GitHub Actions: [run 43610849080](https://github.com/roronoazoroshao/FolderForge/actions/runs/43610849080) và [run 43610813088](https://github.com/roronoazoroshao/FolderForge/actions/runs/43610813088) thành công cho SHA `a8068cc` tại thời điểm kiểm tra. Không có evidence về production deploy.

**Mức độ:** `BLOCKER` (ngăn chốt design/merge/cutover tùy phạm vi), `HIGH` (cần sửa trước phase tương ứng), `MEDIUM` (có thể cho phép với action owner+deadline). **Loại:** `OBSERVED` (thấy trực tiếp source/docs/status), `INFERRED_RISK` (kịch bản chưa được chứng minh), `EVIDENCE_GAP` (chưa có chứng cứ để kết luận).

## 2. Findings table — kết quả phản biện 8 vai trò

| ID | Lăng kính | Loại | Mức | Dữ liệu và phản ví dụ / failure oracle | Cách sửa nhỏ nhất · owner · gate |
|---|---|---|---|---|---|
| **RV-01** | Software architect | **OBSERVED** | **BLOCKER** cho FF-004 acceptance | Spec §6 định nghĩa `WorkspaceContext` gồm `canonicalRoot` + `grantId`; PR source lại `root` và **không có** `grantId`. `grantRevision` còn do input truyền, chưa được đối chiếu từ persisted grant. *Phản ví dụ:* giả context cùng sessionWorkspaceId nhưng grant bị revoke vẫn tạo được DTO. | Khóa một interface duy nhất; đưa verification vào trusted session/grant resolver, không cho domain nhận context từ dữ liệu agent. **Owner:** architecture+security. **PASS:** type contract + unauthorized/revoked negative tests; FF-004/007/008/013. |
| **RV-02** | Domain architect | **OBSERVED** + **INFERRED_RISK** | **HIGH** | `resolveWorkspaceIdentity` SHA hash của canonical **path**, spec §10 nói WorkspaceId ổn định trong registry, rebind/rename có event. *Phản ví dụ:* rename `/a`→`/b` thay ID dù đây có thể là cùng directory; reuse rename không có store/rebind semantics. | Quyết định ID cố định do store cấp hay path-derived; path fingerprint không phải authority. Bổ sung rename/rebind/mount test. **Owner:** architecture; FF-004/005/006. |
| **RV-03** | QA / traceability | **OBSERVED** | **BLOCKER** chốt Spec | Spec §16 có AC-15…AC-18, nhưng Plan §5 chỉ ánh xạ AC-01…14; FF-029 vẫn ghi AC-01..14. *Failure oracle:* bất kỳ AC nào không có task, test, reviewer hoặc gate → spec chưa có Definition of Done. | Thêm AC-15..18 mapping và review gates, phân biệt MVP vs Advanced; cập nhật FF-029 và FF-037. **Owner:** QA lead+tech lead. |
| **RV-04** | Product / project planning | **OBSERVED** | **BLOCKER** chốt MVP | Spec §2 và §16 nói browser local opt-in trong MVP; FF-035 ở P07 lại phụ thuộc FF-029 (E2E/RC); FF-029 không phụ thuộc browser. *Phản ví dụ:* RC được ký C5 nhưng chưa có browse/click/screenshot. | Đặt `FF-034` (capability inventory) vào MVP trước Connect UX; `FF-035` trước FF-029; FF-029 phụ thuộc browser proof; FF-032 chỉ remote browser/desktop Advanced. **Owner:** PM+architecture+QA. |
| **RV-05** | Security | **EVIDENCE_GAP** + **INFERRED_RISK** | **BLOCKER** cho Full Workspace/Host | Spec xác nhận shell cùng OS UID vượt ra khỏi `cwd`, nhưng chưa có verified sandbox hoặc Host Broker. *Counterexample to test, not a proven exploit:* `node -e` hay subprocess đọc file cùng UID ngoài root. | OS enforcement/threat model trước Full Workspace claim, riêng Host Operator yêu cầu real owner, OS identity, expiry, revoke, egress, audit. **Owner:** independent security reviewer; FF-005/009/013/036. Không tự duyệt. |
| **RV-06** | MCP / agent protocol | **EVIDENCE_GAP** | **HIGH** | Stdio client config hoặc self-probe không chứng minh client đang `CONNECTED`; một server `READY` không đồng nghĩa session được nhận dạng. *Phản ví dụ:* client không bao giờ khởi động sau `connect cursor`. | State machine với evidence nguồn + session identity và handshake protocol; test 2 clients, stale/reconnect và cross-era version. **Owner:** MCP specialist; FF-007/008/011/018/023. |
| **RV-07** | Browser / integrations security | **INFERRED_RISK** | **HIGH** | Playwright, child MCP, outbound network chưa có mô hình transitive grants đầy đủ; page content là untrusted. *Test:* agent được quyền browser `https://x` có thể gọi loopback/internal metadata URL hay khai thác file downloads không? Không khẳng định đã khai thác được. | Egress/URL scheme rules, isolated browser profile, credentials boundary, capability inheritance non-escalating, test denied origins. **Owner:** integration+security; FF-034/035. |
| **RV-08** | Accessible UX research | **EVIDENCE_GAP** | **HIGH** cho UX sign-off | Không có quan sát người dùng thực, task completion, screen-reader flow hoặc contrast measurement cho UI mới; wireframe không là proof WCAG. *Test:* user bàn phím tạo folder, hiểu `CONFIGURED` vs `CONNECTED`, revoke và xử lý lỗi. | Study plan + task flows, keyboard+screen reader+zoom+motion+copy audits; không bịa participant findings hoặc tuyên bố chứng nhận. **Owner:** UX researcher + accessibility specialist; FF-022..025. |
| **RV-09** | SRE / operations | **OBSERVED** + **EVIDENCE_GAP** | **BLOCKER** production | Host có ~2.0 GB available trên 457 GB (100% used rounded), #118 chưa được independent sign-off; recovery worktrees/registry nhạy cảm. *Test:* audit write khi ENOSPC; rollback giữ registry. | Off-host backup + restore drill + disk gate + process artifact attestation, fence #118 khi in-scope. **Owner:** SRE/security/owner; FF-002/033. Tuyệt đối chưa canary production. |
| **RV-10** | Clean code / maintainer | **OBSERVED** | **MEDIUM** | 37 task mà nhiều file lớn, một số task gộp security+host broker+audit+rollback, chưa chia thành các vertical slice reviewable ≤5 files. *Test:* PR FF-036 vượt một change review và reviewer không thể ký từng ranh giới riêng. | Tách substeps: contract→negative tests→isolated broker→independent assessment; giữ 1 ToolRegistry, không thêm service vô cớ. **Owner:** maintainer; plan P07. |
| **RV-11** | Governance | **OBSERVED** | **BLOCKER** chữ ký phê duyệt | PR #200 có CI success nhưng **0 submitted GitHub reviews** khi kiểm tra; không có CODEOWNERS chỉ định hội đồng. *Failure oracle:* AI gắn nhãn “approved” khi không có reviewer identity hoặc qualified proof. | Review board #201 với RACI, người thật nhận review, explicit owner approval; CI chỉ được ghi `SOURCE-TESTED`. **Owner:** product owner/security lead. |
| **RV-12** | Product strategy | **EVIDENCE_GAP** | **HIGH** cho product sign-off | “AI làm mọi thứ” chưa xác định ngành/người dùng trọng tâm và top jobs; không có research hiện tại. *Test:* 3 người dùng mới có hoàn thành first verified action với non-Git folder không, và có hiểu quyền không? | JTBD/segment assumptions, 5–8 usability/discovery sessions là **đề xuất**, không phải đã diễn ra; đo baseline TTFVA. **Owner:** PM/UX. |

## 3. Phân vai và quyền ký (không “đa chuyên gia” giả)

| Reviewer | Phân tích AI_SIMULATED hôm nay | Quyền ký cuối | Chứng cứ tối thiểu |
|---|---|---|---|
| Product owner / PM | Có góc nhìn chiến lược, không có customer research | **Human product owner** | Personas, non-goals, tradeoffs, primary MVP, decision log |
| Architecture lead | Có code/docs read-only comparison | **Human engineer không tự xem PR mình** | dependency DAG, data contracts, 2-root tests |
| AppSec / OS isolation reviewer | Có threat hypotheses, không pentest live | **Independent qualified reviewer** | broker & sandbox negative evidence; scope-specific exceptions |
| MCP specialist | Có review states/protocol, không chạy client matrix trong review này | **Qualified engineer/interop reviewer** | protocol versions + real client handshake logs |
| UX/accessibility researcher | Có test-plan critique, không có participants | **UX/accessibility practitioner + owner** | flow test, WCAG-relevant manual checks, limitations |
| QA/verification | Có mapping gaps, CI public evidence | **QA lead** | AC matrix, negative cases, reproducible reports |
| SRE/operator | Có disk/issue/rollback evidence gaps | **Host owner/SRE** | backup restore, capacity, signed canary/rollback |
| Maintainability reviewer | Có task/code review | **Independent maintainer reviewer** | diff review, API compatibility, clean architecture |

**Review rule:** AI reviewer không được tạo review “APPROVED” trên PR tác giả bằng chính tài khoản tác giả, không thay tên người thật. Status đến khi có chữ ký: `AI_PRE_REVIEWED / HUMAN_REVIEW_PENDING`.

## 4. Đường thoát các blocker

| Gate | Mục tiêu | Điều kiện PASS | Đang thiếu |
|---|---|---|---|
| **G-DESIGN** | Chốt quyền, boundary, phase | Owner ký D-01..D-09 và quyết định rename, browser MVP, host access | Owner decisions + traceability 18 AC |
| **G-ARCH** | Data + execution identity không mâu thuẫn | 1 canonical contract; grant provenance; no global workspace; adapter tests | FF-004→FF-009 chưa integrated |
| **G-SEC** | Không tự nâng quyền / escape | Qualified independent reviewer, threat model, negative tests | OS/sandbox and host broker |
| **G-MCP** | `CONNECTED` thật | Real client handshake and session binding, no false statuses | FF-007/008/018/023 |
| **G-UX** | Người mới hiểu/cấp đúng quyền | Research protocol, manual a11y tests + copy/error-state review | Actual UX evidence |
| **G-QA** | Không AC bị bỏ quên | 18/18 AC with tests, issue, owner, gate; no cycles | AC-15…18 missing mapping |
| **G-OPS** | Cutover có đường lùi | backup restore + capacity + SHA + canary + #118 when in-scope | Live evidence |
| **G-MERGE** | PR reviewable | CI green + independent non-author review + zero unresolved blockers | PR reviews |

## 5. Dissent & assumptions — vấn đề cần owner quyết định

- **D1 — Một thư mục thành MCP hay full host automation?** Đề nghị product path đầu là **folder→agent→verified action**. Quyền host là sản phẩm Advanced khác cấp bảo mật, không nên gộp vào nút “Full”.
- **D2 — WorkspaceId:** ưu tiên **store-assigned opaque ID** khi đã đăng ký, canonical root là lookup key. Đổi tên cần owner rebind event. Không sửa mã PR identity khi chưa thống nhất contract.
- **D3 — Browser MVP:** nếu giữ lời hứa “browser local opt-in” là MVP, buộc FF-035 vào C5; remote desktop vẫn Advanced. Nếu không sẵn sàng sandbox/browser CI, hạ scope thành MVP+1 với tuyên bố minh bạch.
- **D4 — Trusted local shell vs OS confinement:** không mô tả như “isolated” khi chỉ dùng process UID/cwd. Nếu owner chấp nhận unconfined local mode thì phải có banner, scope warning và explicit consent, không coi như sandbox.
- **D5 — Cross-platform:** phân biệt "core works" và "OS-isolated privileged operator". Không claim Windows/macOS parity cho host broker chưa chứng minh.
- **D6 — Review proof:** nếu không có collaborator ngoài tác giả, để PR **DRAFT** và lập kế hoạch mời reviewer; không tạo synthetic GitHub approvals.

## 6. Công thức review cho mỗi failure case

`{findingId, role, kind=OBSERVED|INFERRED_RISK|EVIDENCE_GAP, severity, claim, exactSourceShaAndPath, reproducibleInput, expectedOracle, actualObserved, exception, blastRadius, minimalFix, owner, verificationCommand, reviewGate, verdict}`.

Reviewer cần ghi `NOT_RUN` nếu chưa chạy. Đề xuất kiểm thử là `PROPOSED_TEST`, không gọi là defect đã tái hiện.

## 7. Next review gate — chốt hay tiếp tục?

**Decision: CHANGES_REQUESTED.** Chỉ cho phép chuẩn hóa Spec/Plan, bổ sung test/probe source trong PR draft. Không ký G-DESIGN cho đến khi RV-01, RV-03, RV-04 được xử lý trong tài liệu; không ký G-MERGE cho đến khi non-author reviewer; không ký G-PROD vì RV-05/RV-09. Review lại trên **exact head SHA mới**, không dùng chữ ký của SHA cũ.

**Source/test evidence không tương đương sản phẩm chạy được:** CI đã PASS nhưng WorkspaceContext chưa được wired vào MCP request chain, nên không cấp G-ARCH / C1.


## 8. Recheck sau vòng sửa tài liệu — nhánh review 2026-11-14

**Phương pháp:** kiểm tra trực tiếp các bản Markdown ở `feat/ff-v2-foundation`, parse `#### FF-XXX` và dòng `Depends:`, duyệt dependency graph bằng DFS, đối chiếu `AC-XX` giữa Spec §12 và Plan §5, kiểm đủ issue links. Đây là **static consistency audit**, không phải test runtime hay security certification.

| Mục | Kết quả tại SHA `53812e94` | Diễn giải |
|---|---|---|
| Plan task headings | **37/37**, không trùng ID | PASS cấu trúc tài liệu |
| Acceptance trong Spec | **18/18** | PASS coverage ID |
| AC trace rows trong Plan | **18/18** | PASS *mapping existence*, chưa PASS nghiệm thu runtime |
| Task issue links | **37/37** trong `tasks/plan.md` và `tasks/todo.md` | PASS liên kết |
| DAG từ dòng Depends | **0 cycle, 0 unknown dependency** | PASS sau khi chuyển ghi chú “FF-029” ra khỏi dòng Depends FF-035 |
| Reviewer signatures | **0 independent reviews** tại lần kiểm tra | **HOLD** G-MERGE |
| Latest GitHub Actions | `in_progress` cho source SHA `53812e94` tại lúc kiểm tra | **PENDING**; các run SHA cũ có kết luận success hoặc cancelled, không dùng thay thế |

**Disposition của findings:** RV-03 (18 AC trace) và RV-04 (browser DAG) đã được **addressed in draft documentation**; chưa có chữ ký product owner và chưa có test sản phẩm. RV-01/02 (contract + identity persistence), RV-05/07 (real privilege enforcement), RV-06 (real MCP handshake), RV-08 (user/a11y evidence), RV-09 (host proof) và RV-11 (human review) **vẫn mở**. Vì vậy verdict chung vẫn **CHANGES REQUESTED / NOT APPROVED**.

**Bài học:** kiểm thử graph cần parse riêng dòng `Depends:`; đặt mã task trong ngoặc chú thích cũng có thể gây *dependency edge giả*. Thêm graph checker vào CI nếu quy trình còn phát triển; chưa tuyên bố đã có checker trong repo.
