# FolderForge — Full Feature & Runtime Flow Audit

**Ngày:** 2026-11-14 (Asia/Ho_Chi_Minh)
**Nguồn mã:** GitHub `main@5b588f7ac616eb05f8768960f24bfa3b6d46a2ad`, sau khi merge F14 PR #156 và F15 PR #157. Audit được biên soạn tại nhánh tài liệu, đối chiếu tree đã merge `origin/main`.
**Mức chứng cứ:** Kiểm tra source + local merge build/lint/typecheck/docs/architecture + Vitest, **không phải kiểm thử production**. Không đụng đến tunnel, credentials, VPS process, Docker service, npm release hoặc registry phục hồi.

## 1. Bằng chứng mới nhất

- F14 PR #156 merge commit `be36dec5585ca273c101ae4497b699fdb8d55f23`; F15 PR #157 merge commit `5b588f7ac616eb05f8768960f24bfa3b6d46a2ad`. PR source đã merge, gateway **opt-in**, chưa có bằng chứng bật trên host thật. F14/F15 CI tại exact source HEAD trước merge 7/7 jobs GREEN, vẫn có một số bước cross-platform SKIPPED.
- Trên tree bao gồm F14 + F15 + nhánh tài liệu, `npm run docs:check`, `npm run architecture:check`, `npm run typecheck`, `npm run lint`, `npm run build` PASS. `npx vitest run --maxWorkers=4`: **200 test files pass, 2 skipped; 1.603 tests pass, 34 skipped, 0 failed**. Đây là local evidence của nhánh, **không phải post-merge exact-main CI**.
- 24 managed isolation records có `state=active`: 20 `present_consistent`, 2 `unverifiable`, 2 `missing_worktree`; 2 `sourceDirty`. `workflow_list` trả về 0 run; `process_list` 0 session; `distributed_status` 0 running jobs; `provision_list` 0 Fleet. **Không được suy ra có 24 agent đang chạy**. Không prune/force-remove worktrees.
- Nhánh `fix/g01-recovery-adversarial-20261030@4c5bff8` còn 4 commit chưa tích hợp; merge thử nghiệm có conflict trong `src/isolation/worktree-manager.ts` và `tests/unit/worktree-manager.test.ts`. Mã recovery mức rủi ro cao: giữ nguyên branch cho tới khi có conflict resolution/TDD và independent security gate.

## 1.1. Pinned third-party compatibility security remediation (2026-11-14)

Sau lần CI đầu tiên của PR #158, Windows Node 22 báo lỗi tại `Pinned third-party child MCP compatibility`: cả năm MCP probe thành công nhưng npm audit của fixture phát hiện hai advisory mức Moderate, không phải lỗi test logic. Chính sách fail-closed được giữ nguyên. Bổ sung integrity-pinned overrides cho `@hono/node-server@2.1.6` và `hono@4.13.16`, đồng bộ `compatibility/child-mcp-third-party.package-lock.json` theo registry npm. Chạy lại `node scripts/child-mcp-third-party.mjs --output evidence.json` trên Linux: **5/5 profiles PASS, audit 0 vulnerabilities (exit 0)**; Windows exact-head CI của commit sửa bảo mật phải được xác minh riêng. Không thay đổi cơ chế kiểm tra hoặc hạ ngưỡng bảo mật.

## 1.2. Production dependency advisory remediation (2026-11-14)

Đợt CI trước đó #43478220883: 6/7 job thành công, Ubuntu Node 22 không qua `Production dependency audit` do **3 npm audit Moderate findings** (hai package trực tiếp `hono@4.13.14`, `@hono/node-server@2.1.5`, một finding lan truyền qua `@modelcontextprotocol/sdk`). Findings thuộc **dependency production của repo**, phân biệt với fixture child-MCP ở §1.1. Đây là lỗ hổng dependency thực tế, không phải lỗi test hay điều kiện được phép bỏ qua.

Thay đổi tối thiểu: nâng root `package.json` overrides lên `hono@4.13.16` và `@hono/node-server@2.1.6`, chỉ thay đổi hai package tương ứng và SHA-512 trong `package-lock.json`, đồng bộ test khóa pin. `npm audit --omit=dev` trên cây mới: **0 vulnerabilities / exit 0**; các test tương thích, build, multi-OS CI exact-head cần được kiểm tra lại trên commit mới trước khi merge. Không tắt audit, không tự động phát hành hoặc triển khai.

## 2. Inventory feature theo lớp

| Feature | Entry/source chính | Flow và dữ liệu | Trạng thái audit | Rủi ro / next proof |
|---|---|---|---|---|
| CLI, config & doctor | `src/main.ts`, `src/runtime/config.ts`, `src/doctor/` | CLI args -> validated config -> container -> server/tools | Có source và tests | Path CWD ambiguity; prove actual install |
| MCP stdio/HTTP dual-protocol | `src/server/mcp-server.ts`, `src/server/protocol/`, `src/server/transports/http.ts` | client initialize -> auth/session -> tools/list & call -> result | Có source và compatibility tests | Session replay; modern-client end-to-end |
| Native tool registry | `src/tools/index.ts`, `src/tools/registry.ts` | Tool schemas/presets -> dispatch -> risk-aware pipeline | 359 definitions ở baseline audit; không phải 359 tool active | Catalog cap, tool-surface drift, injection |
| Files/search/code context | `src/tools/file-tools.ts`, `src/tools/search-tools.ts`, `src/tools/code-tools.ts` | Read/search -> bounded/redacted context -> patch | Có tests | Path/symlink/TOCTOU + sensitive files |
| Commands, Git, build, verification | `src/tools/terminal-tools.ts`, `src/tools/git-tools.ts`, `src/verification/` | Command -> policy -> subprocess -> structured checks | Có source/tests | Host-shell is not filesystem sandbox |
| Policy, capsule, approvals | `src/policy/`, `src/capsule/`, `src/tools/registry.ts` | Principal/tool/args -> scope+deny -> approval -> quota/audit | Có source/tests | `danger` bypasses approval; require strict deployment boundaries |
| Workflow DAG & state | `src/workflows/workflow-manager.ts` | DAG step -> governed tool -> persisted checkpoint -> resume/cancel | Có source/tests | Exactly-once guarantee limited to recorded step; uncertain mutations |
| Agent loop | `src/agent-loops/agent-loop-runner.ts`, `agent-loop-manager.ts` | Discover -> council -> optional workflow implementation -> verify | **Partial autonomy** | Votes scripted, 0.92/0.82; not independent LLM reviewer |
| Managed task isolation & recovery | `src/isolation/worktree-manager.ts`, `src/server/mcp-task-manager.ts` | Task -> worktree -> apply/rollback/reconcile -> evidence | Có source, 24 historical active entries | Host writer epoch + production fault recovery unverified |
| F14 project gateway | `src/multiproject/project-gateway.ts`, `project-worker*.ts` | Owner allowlist -> per-project session pin -> worker HTTP MCP | **Merged source; opt-in** | Same UID != OS isolation; shared gateway bearer |
| F15 fair scheduler | `src/multiproject/fair-scheduler.ts`, `project-gateway.ts` | Pre-body admission -> project budgets -> bounded queue -> worker | **Merged source; opt-in** | In-memory quotas reset on restart; production p95 unknown |
| Child MCP & plugins | `src/adapters/child-mcp/`, `src/plugins/`, `src/tools/adapter-tools.ts` | Child catalog -> risk projection -> governed adapter call | Có source/tests | Untrusted tool schema, supply chain, permission drift |
| Browser/Playwright & Godot | `src/browser/`, `packages/adapter-godot/`, `addons/` | Optional adapter -> capture/evidence -> visual/project operations | Có modules; browser adapter disabled ở inspected runtime | Real browser/device and Godot editor live proof |
| Mission Control UI & owner Fleet | `src/dashboard/server.ts`, `src/operator/`, `packages/mission-control/` | Dashboard auth -> owner consent -> Fleet configuration and health | Có source/tests | Host-origin trust, config D3 UX, CSRF, production UAT |
| ChatGPT/tunnel/OAuth | `src/chatgpt/`, `src/control/`, `src/server/auth/` | Local MCP -> authenticated tunnel -> client/session -> tools | Có source; no automatic F14 gateway tunnel switch | Live provider DCR/credential lifecycle proof |
| Distributed workers & marketplace | `src/distributed/`, `src/marketplace/` | Coordinator/leases/signature -> workers/plugins | Labs / not production proven | Cross-host trust, lifecycle/fencing, signed publishers |
| Audit/evidence/artifacts | `src/audit/`, `src/evidence/`, `src/artifacts/` | Preflight -> event chain -> proof-pack -> verification | Có source/tests | Mandatory durability must fail closed; integrity/restart |
| Release governance & CI | `.github/workflows/`, `scripts/`, `tests/` | Commit -> checks/matrix -> provenance/soak -> authorized release | CI source verified; release independently gated | Skips NOT_RUN; prod canary/attestation absent |

## 3. End-to-end flows và quyết định kỹ thuật

### FLOW A — Khởi động CLI/MCP

```text
User CLI -> parse command -> config/defaults -> path/auth validation
-> Container (policy, audit, workspace, adapters, managers)
-> tool factories and curated presets -> stdio or authenticated HTTP transport
-> MCP initialize/tools/list -> tool calls
```

**Gate:** project root/cwd explicit, config validated; bind address/auth independent from whether process started. **Fail path:** invalid workspace or missing dependencies must be structured error, not privileged fallback.

### FLOW B — Tool call & policy

```text
MCP client -> authenticated principal/session -> argument schema
-> tool risk classification -> capsule/root authorization
-> durable audit precondition -> policy-as-code deny/approval decision
-> rate limit -> governed handler -> redacted structured result -> audit record
```

**Gate:** the LLM output is untrusted; `danger` is a separately selected owner posture, not proof of sandbox. Path checks and same-UID process confinement cannot replace kernel isolation. Avoid replay of outcome-uncertain POST/mutation.

### FLOW C — AI coding task

```text
Goal/acceptance -> project_analyze + code_context -> plan
-> (external LLM/agent produces patch or validated workflow)
-> patch preview/apply -> project_verify tests/build/lint
-> proof pack/diff -> report/draft PR or retry within cap
```

**Actual limitation:** existing `agent-loop-runner.ts` uses deterministic council proposals/votes and does not implicitly write code without `implementationWorkflowId`. Calling this a fully autonomous multi-LLM coding agent is inaccurate. Add optional real LLM provider, model provenance and token-cost ledger before PRO claims.

### FLOW D — F14/F15 multi-project MCP

```text
Owner-approved canonical child roots -> loopback gateway
-> gateway bearer + project identifier / existing pinned MCP session
-> F15 per-project/global admission and bounded fair queue
-> F14 immutable session affinity + worker-root integrity
-> lazy child MCP worker, private IPC token, safe default policy
-> normal MCP tool-governance pipeline -> response
```

**Security edge:** callers sharing gateway token have shared selection authority; per-project worker under same OS UID is not kernel filesystem isolation. No OAuth federation or production-tunnel migration proven. No automatic host permission widening. F15 quota is gateway-level request admission, not per-principal/per-tool worker quota.

### FLOW E — Workflow, retry, recovery

```text
DAG validate -> step authorize -> execute -> verify/postcondition
-> durable checkpoint -> next step
FAILED: classified transient -> bounded retry only when idempotent
UNCERTAIN mutation -> stop/quarantine/human resolution
CANCEL/RESTART -> recover state; never blindly replay successful steps
```

**Gate:** trace ID, actor, workspace ID, tool/args digest, idempotency token and wall-clock deadline on every tool step.

### FLOW F — Worktree isolation

```text
Task intake -> source/head fingerprint -> controlled worktree
-> isolated edit/check -> source identity revalidation
-> merge/apply or reversible rollback -> proof/evidence -> close
```

**Gap:** 24 active metadata records do not prove active work; G01 source conflicts, host writer fencing, and missing worktrees require a deliberate preservation-first recovery process. Never run automated `git clean` or force-delete worktrees.

### FLOW G — Browser/Plugins/Godot

```text
Authorized adapter manifest -> discover catalog/schema -> policy mapping
-> bounded subprocess/container or external MCP
-> tool result and artifacts -> verify content/size/risk -> evidence
```

**Gate:** pinned manifests/schema, output redaction, compromised child response/prompt injection tests; real adapter availability measured separately from source presence.

### FLOW H — Dashboard/Fleet/Remote SSH

```text
Mission Control -> owner authentication + Origin/SSH verification
-> scoped Fleet intent -> prepare/activate -> child readiness probe
-> process + audit + UI status -> explicit stop/recovery
```

**Gate:** start requested != healthy; verified host grant != broad root access; system UID and administrative Docker permission are distinct boundaries.

### FLOW I — ChatGPT/tunnel

```text
Client connect -> OAuth/token metadata and client authorization
-> supervised public tunnel -> local MCP origin -> bearer/OAuth check
-> MCP tool call -> audit/response
```

**Gate:** independently confirm tunnel target if routing to F14, no silent repoint and no credential values in logs.

### FLOW J — CI/release

```text
PR exact SHA -> lint/typecheck/build/docs/architecture
-> unit/integration/security and matrix CI -> review + merge
-> post-merge exact-main checks -> release provenance/soak
-> owner-authorized tag/publish/deploy -> rollback observability
```

**Gate:** Green matrix with skipped steps does not prove all operating systems; no automatic npm publication from this merge.

## 4. Findings, prioritized

| ID | Severity | Finding | Evidence / remediation |
|---|---|---|---|
| P0-01 | Critical | Same-UID and host writer epoch may permit cross-process damage on production host | `docs/r14-kernel-registry-fence-migration.md`; independent review + real DAC/cgroup/isolation proof |
| P0-02 | High | G01 reconciliation branch remains diverged and conflict-prone | 4 unmerged commits, conflicts in worktree manager/tests; do not blindly integrate/delete |
| P0-03 | High | Multi-project source merges do not enable per-principal OAuth/sandbox isolation | F14/F15 source; staging and per-project identity/credential policy |
| P1-01 | High | Council scripted scores claim independent review | `src/agent-loops/agent-loop-runner.ts`; label heuristic; add actual provider attestations |
| P1-02 | High | No full agent token/cost budget attribution | `src/agent-loops/agent-loop-manager.ts`; per-run ledger, hard spending limits |
| P1-03 | High | Local Git has many worktrees, 24 active isolation records and stale sources | preserve evidence; classify each with sourceDirty/identity/branch-ref before closure |
| P1-04 | Medium | F15 counters in memory and fairness measured on synthetic load | crash/restart and production-isolated latency baseline |
| P1-05 | Medium | Documentation inherited 2026-10-09 release statements | dated snapshot labels and current evidence link; avoid current-release claims |
| P1-06 | Medium | Browser/Godot/plugin live availability differs from compiled tool presence | live smoke and adapter pinning |
| P2-01 | Medium | General scheduled autonomous runner and independent real-model council not proven | design as optional future feature; evaluate 100 fixed safe tasks |

## 5. Recommended acceptance matrix

| Gate | Evidence required | State |
|---|---|---|
| Source build/lint/typecheck/docs/architecture | Current merged tree execution | PASS locally in audit worktree |
| Automated tests | 1,603 pass, 34 skipped, 0 failed on merge tree | PASS locally; skips NOT_RUN |
| Exact post-merge main CI | 7/7 matrix on final new main SHA | PENDING until audit merge and CI |
| Multi-root correctness | 500+ interleaved project requests, no wrong-root action | Local F14 proof; production NOT VERIFIED |
| Fairness and latency | Fair queues plus p95 vs isolated baseline | Local F15 proof; production NOT VERIFIED |
| Agent real reasoning | Real provider, trace and token budget metering | NOT IMPLEMENTED as complete agent |
| Isolation recovery | External writer fence, restart/rollback, no lost bytes | NO-GO for production reconcile |
| Independent security review | External identity approval for exact SHA | NOT VERIFIED |
| Secrets and credentials | No secret leaks, OS owner scope, rotation/revocation drill | NOT VERIFIED in production |

## 6. Removed-plans boundary

Per operator request, remove **tracked standalone planning/roadmap documents** from the active tree after preserving their history in Git commits. Do not remove ADRs, architecture specs, CI evidence, source code, active task/isolation metadata, artifacts or unknown untracked files. Changes in this audit branch are not a production operation. Source history retains deleted Markdown at prior commit SHAs. This section records the deletion scope and prevents reintroducing stale plan guidance.

## 7. Final recommendation

**Recommended order:** (1) integrate source-only F14/F15 and audit with exact CI; (2) preserve unmerged G01 and worktrees until reviewed; (3) qualify independent project auth/sandbox and real host writer fencing; (4) build real LLM orchestration with a strict budget, idempotency and postcondition verification; (5) only then enable unattended production automation. No branch deletion should erase unique commits or ambiguous worktree bytes.
