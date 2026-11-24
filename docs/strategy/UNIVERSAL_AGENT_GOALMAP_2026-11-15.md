# FolderForge — Universal Agent Work Environment GOAL MAP

**Decision:** PRODUCT DIRECTION APPROVED BY OWNER, 2026-11-15. **Source state:** strategic decision only; not feature implementation, security certification or PR approval. **Project:** `roronoazoroshao/FolderForge`. **Base observed:** `main@104f57f4280d288a61ce52168ea4982ddd7432f8`; proposed source PRs #200/#203 are separate drafts. **Operational scope:** no host deployment/restart/cleaning authorized by this document.

> **North Star:** *Give any authorized AI agent the eyes, hands, environment and verifiable feedback to complete real work, independently of other agents.*
>
> **Category:** agent-neutral Work Environment / Capability & Execution Layer. **Tagline:** `Any agent · Any authorized task · Observe → Act → Verify → Repair`.

## 1. WHY / WHO / WHAT

**WHY:** AI agent có thể suy luận, nhưng không tự có quyền/công cụ/phiên ứng dụng/môi trường đáng tin để thao tác và biết kết quả thật. Cần một lớp *owner-controlled* liên kết model → năng lực → quyền → môi trường → kiểm chứng mà không khóa vào một agent framework.

**WHO (đầu tiên):** developer / solo maker / power user có kỹ thuật, cần kết nối Claude, ChatGPT, Codex, Cursor, OpenHands hoặc generic MCP client vào máy của họ. Nhóm nhỏ và người làm design/QA là beachhead kế tiếp; không hứa enterprise compliance.

**WHAT:** Một host chạy FolderForge; nhiều danh tính agent và project capsules; mỗi agent có manifest quyền và budget, các adapter chuyên ngành, công cụ quan sát và proof pack. Ưu tiên APIs native (DOM/Playwright, Figma, Blender, Photoshop) trước pixel/desktop fallback. FolderForge không bán model AI và không tự phát triển một bản sao Photoshop/VM hypervisor.

**10-chat scenario:** 10 kết nối ChatGPT chỉ là 10 principal *nếu server kiểm chứng được từng identity và grant độc lập*. Mười tab/chat dùng chung bearer không mặc định là mười principal. Bật 10 slot riêng và kiểm tra bound credentials/sessions. Mười *concurrent* workloads phụ thuộc CPU/RAM/ports; quá tải → queue/deny, không breach isolation.

## 2. Outcome map — từ mục tiêu đến proof

| Goal | Giá trị cho AI/người dùng | Sản phẩm phải cấp | Verification gate | Phase |
| --- | --- | --- | --- | --- |
| G1 Agent-neutral Connect | Một client có thể thực sự hành động | MCP stdio/HTTP, config/handshake receipt, app-level identity | Real client handshake + authorized tool result; CONFIGURED ≠ CONNECTED | M1 |
| G2 Independent work | Agent A không phá dữ liệu/process/secret của B | per-principal grants, per-task capsule, isolated OS/user/process/network/storage, resource budgets | Two-agent negative suite → 10-agent conformance | M1–M2 |
| G3 Eyes/Observation | AI nhìn thấy phần mềm đang chạy | screenshot, DOM, accessibility tree, logs, console, network, app status, render preview | Vision/DOM/log evidence attached to same run | M2 |
| G4 Hands/Action | AI thật sự sửa, click, build, thao tác editor | file/Git/shell/browser; approved native creative adapters; bounded desktop input fallback | Real action state changes + audit/correlation | M2–M3 |
| G5 Verify/Repair | AI tự phát hiện lỗi và sửa có căn cứ | test runner, visual diff, trace, proof pack, retries bounded and typed outcome | Observe→Act→Verify→Repair on 1 live web scenario; failure cases preserved | M2 |
| G6 Creative production | AI tạo file nguồn editable và review hình ảnh | Figma frame/layers; Blender scene/render; Photoshop layers where supported | Editable source + preview + feedback + exported artifact | M3 |
| G7 Controlled extension | Công việc liên app, nhiều backend | capability catalog, adapter auth/provenance, handoff, owner consent | End-to-end cross-app use case under same grant identity | M4 |
| G8 Product leverage | Tốt hơn native agent tools ở ít nhất 1 workflow | setup efficiency, audit trust, reuse of identity/evidence across agents | Neutral comparative test; publish environment and failures, no unsupported winner claim | M4 |

## 3. Architecture principles — quyết định không thương lượng

1. **Same execution identity from request to tool:** `{principalId, workspaceId, capsuleId, grantId, grantRevision, operationId, effectiveLimits}`; trusted transport/server resolves against persisted owner grants. Never trust user/model self-asserted fields.
2. **Sandbox ≠ current working directory:** an agent's full power is *inside its own boundary*; no promise of isolation for a shell running as shared host UID. Separate host privilege broker is opt-in and review-gated; host root cannot be claimed fully isolated.
3. **Eyes without hands is a viewer; hands without eyes is blind automation; neither is DONE without verification.** Every task must identify an observable outcome and a test oracle.
4. **Observe → Act → Verify → Repair** is a loop with bounded iterations, costs, timestamps and owner cancellability. Failures and `unknown` outcomes are first-class.
5. **Capabilities are adapters, not marketing claims:** list `available/enabled/denied/unavailable/degraded` from real checks. No phantom connected sessions or editable files when only PNG output exists.
6. **Reuse existing assets:** `src/tools/registry.ts`, MCP transports, owner/auth/policy/audit, sandbox, Playwright adapter, capsule manager, proof packs, Mission Control. Thin integration with tested sandbox/browser/design providers; no massive rewrite.
7. **Competitive benchmark, not cargo cult:** OpenHands parity is a *measured acceptance target* for coding workflow; test against current versions under comparable configuration, never assert blanket victory over every competitor.
8. **Separate decision and operation authority:** AI may review technical work; CI/PR policy, owner grants, production and recovery remain independently controlled.

## 4. Deliberate non-goals

- Not a proprietary LLM/chat app; not a copy of OpenHands orchestrator; not an MCP tool-count race.
- Not hypervisor/container engine development, free-form remote admin, guaranteed 10 heavy workloads on unspecified hardware.
- Not guaranteed universal GUI automation on every desktop/OS/app; adapter availability and licensing remain explicit.
- Not automatic root access, non-consensual credential extraction, unrestricted browser egress or hidden proxy of host privileges.
- Not 'all tests pass' from screenshots alone or zero-defect claims from finite test coverage.

## 5. Success measures (targets, NOT observed metrics)

| Measure | First proposed target | Source of truth |
| --- | --- | --- |
| TTFVA: first verified agent action | p50 ≤3 minutes on supported setup | timed onboarding runs, sample size recorded |
| Two-root wrong-workspace or cross-principal mutation | 0 in repeated adversarial test suite | deterministic CI + isolation runtime proof |
| Ten independent agent slots | 10 bound identities; zero cross-boundary cases; fair quota/queue under saturation | executed matrix and host sizing |
| Coding live Web E2E | 1 fresh-app journey: build → run → click → screenshot → detect/fix intentional regression → rerun PASS | trace and artifact SHA |
| Creative output | editable source + rendered preview + revision loop; native adapter permission proves control | tool receipts + diff/source reopen test |
| Security posture | no false owner/host escalation; explicit unavailable when enforcement absent | negative tests, threat review |
| Adoption hypothesis | better first verified task completion or auditable control than named alternative | independent comparison, not documentation claim |

## 6. Why this replaces the previous emphasis

[Historical North Star 2027–2030](FOLDERFORGE_NORTH_STAR_2027_2030.md) used *trusted workspace runtime* / folder-first as its principal framing. **Retain** workspace, permission, audit and local-first commitments. **Broaden** ultimate value to observation, interaction with running applications, editable creative artifacts and whole-workflow testing. A folder is the simplest entry point, not the ceiling on capabilities. Do not interpret this document as permission to claim current product supports all Goals.

**Further authority:** [Roadmap](UNIVERSAL_AGENT_ROADMAP_2026-11-15.md) · [Spec](../superpowers/specs/2026-11-15-universal-agent-work-environment-design.md) · [Implementation plan](../superpowers/plans/2026-11-15-universal-agent-work-environment-implementation.md) · [Task tracker](../../tasks/universal-agent-todo.md) · [Baseline status](../status/UNIVERSAL_AGENT_STATUS_2026-11-15.md) · [Master prompt](../prompts/MASTER_IMPLEMENTATION_RECURSIVE_HANDOFF.md).

## Development delivery objective (proposed)

Preserve G1–G8 and all acceptance criteria. Add a cross-cutting delivery objective: each interactive session produces one small verifiable increment, records actual integration and audits the entire roadmap. Separate disposable dev/source proof from live operational certification; park scoped blockers and select an independent eligible outcome. See [Autonomous Development Execution Plan](AUTONOMOUS_DEVELOPMENT_EXECUTION_PLAN.md). This is a proposal, not a completed goal or permission to waive existing controls.
