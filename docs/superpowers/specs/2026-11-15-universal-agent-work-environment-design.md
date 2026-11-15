# FolderForge — Universal Agent Work Environment: Architecture & Product Spec

**Status:** **DESIGN BASELINE APPROVED BY OWNER** 2026-11-15, **IMPLEMENTATION NOT CERTIFIED**. **Goal Map:** [Universal Agent Goal Map](../../strategy/UNIVERSAL_AGENT_GOALMAP_2026-11-15.md) · **Roadmap:** [Milestones](../../strategy/UNIVERSAL_AGENT_ROADMAP_2026-11-15.md) · **Plan:** [Incremental implementation](../plans/2026-11-15-universal-agent-work-environment-implementation.md) · **Tasks:** [UA checklist](../../../tasks/universal-agent-todo.md) · **Status:** [Live evidence gap register](../../status/UNIVERSAL_AGENT_STATUS_2026-11-15.md).

## 1. Outcome and users

FolderForge supplies **eyes, hands, workspace and verification** for a separately chosen AI agent, plus owner-governed principal identity and capability routing. The first persona is a developer/power user who wants to connect ChatGPT/Claude/Codex/OpenHands to one host, start isolated jobs, code a running web app and visually test it. A second persona is a designer asking an AI to modify native *editable* artifacts and critique previews. A third is a host operator supervising up to 10 independent agent slots and revoking one without impacting the others.

**Not in scope as a product promise:** that FolderForge creates the AI model, that 10 ChatGPT tabs inherently have distinct secure identity, that root on a shared host can be fully isolated, or that passing visual tests proves an app has zero defects.

## 2. Options considered / tradeoff

- **Option A: expand static MCP tool catalog:** cheap but doesn't prove real tool availability, isolate agents or enable closed-loop observation. **Reject as final goal.**
- **Option B: monolithic agent OS with built-in model/VM/Photoshop clone:** maximal conceptual control but duplicates hardened infrastructures, locks provider and bloats scope. **Reject.**
- **Option C: modular monolith control plane + independent executor/capsule + perception/action/verification adapters:** reuses existing registry/audit/MCP/Playwright and can support new apps. **Select.**

**Deployment:** one control plane; many bounded, potentially separate processes/containers/VMs. Do not conflate source modules with microservices. AI engines and expert reviewer tools are optional clients, not mandatory architecture dependencies.

## 3. Context map and trust boundaries

```text
Trusted owner (Web/CLI) ─► grants / identity registry / resource scheduler
                                      │
ChatGPT, Codex, Claude, etc ─► MCP stdio/OAuth HTTP Gateway
                                      │ authenticate principal
                                      ▼
                      Immutable authorized RunContext
                                      │
                        ToolRegistry policy/audit
                                      │
                   Capability catalog & adapter router
                      ┌───────────────┼────────────────┐
                      ▼               ▼                ▼
                   Observe          Act             Verify
                DOM, image,      file, shell,     browser E2E,
                 logs, app       browser, API,    visual diff,
                  preview        creative app     assertions
                      └───────────────┼────────────────┘
                                      ▼
                        Capsule/Executor boundary
                        (OS isolation + budgets)
                                      │
                         Artifacts & Proof Packs
```

**Critical enforcement:** any tool which can mutate or observe off-capsule data must pass through a principal-scoped, capability-scoped policy check. Browser/desktop/native creative adapters must not run as an unchecked host deputy. *Full tool access* is allowed only within an OS-verified capsule; unsupported enforcement means deny or explicit unsafe label, not false confinement claims.

### 3.1 Domain contracts (design targets, NOT shipped interfaces)

```ts
// Proposed. Trusted service resolves all fields from authenticated state.
type AgentSlot = Readonly<{
  agentSlotId: string;
  ownerId: string;
  principalId: string;
  workspaceId: string;
  capsuleId: string;
  grantId: string;
  grantRevision: number;
  issuedAt: string;
  expiresAt: string;
}>;

type AuthorizedRunContext = Readonly<{
  principalId: string;
  workspaceId: string;
  canonicalRoot: string;
  capsuleId: string;
  grantId: string;
  grantRevision: number;
  sessionId: string | null; // do not require protocol session for stateless HTTP
  operationId: string;
  effectiveLimits: { cpuShares: number; memoryMb: number; diskMb: number; maxSeconds: number };
}>;

type CapabilityState = 'available' | 'disabled' | 'denied' | 'unavailable' | 'degraded';
type OperationState = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'unknown';
type EvidenceKind = 'test' | 'browser-trace' | 'screenshot' | 'dom' | 'console' |
  'network' | 'visual-diff' | 'editable-document' | 'render' | 'runtime-health';
type ActionReceipt = Readonly<{
  operationId: string;
  agentSlotId: string;
  principalId: string;
  capsuleId: string;
  requestedCapability: string;
  authorizedGrantRevision: number;
  executorId: string;
  startedAt: string;
  finishedAt?: string;
  outcome: OperationState;
  evidence: ReadonlyArray<{ kind: EvidenceKind; sha256: string; uri: string }>;
}>;
```

Implementation must **reuse/converge**, not duplicate, existing ToolPrincipal, ToolRegistry call context, capsule manager and proof types. `WorkspaceId` should be a durable registry-issued identity; canonical path is verified attachment, not the only identity. `grantId` and revision must come from actual persisted owner grant; a client-supplied DTO is not an authority token. Mutation uses root-fd/OS boundary and prevents path/symlink TOCTOU as applicable.

### 3.2 Concurrency and ChatGPT/MCP identity

- Each distinct agent slot binds authenticated principal → grant → capsule. **A chat/thread ID supplied by a client is untrusted** unless the platform provides a verifiable authenticated binding. Ten chat tabs sharing one OAuth bearer are one security identity until a supported independent binding is proven.
- Same project across agents: separate writable clone/worktree/volume by default; a verified merge/review mechanism is required before sharing changes. `git worktree` separates working directories, **not OS permissions**.
- Resource scheduler refuses admission, queues with fairness or scales out when memory/disk/CPU/port pool insufficient; never starts agent processes without enforceable quotas or fails with misleading success.
- Mode A: verified full-power capsule. Mode B: explicit per-action owner-granted Host Broker with TTL, external resource allowlist and audit. Mode C: unrestricted host root is outside the 10-agent isolation claim; never auto-elevate.

### 3.3 Observe/Act/Verify/Repair action semantics

**Observe:** for web, use accessible DOM/tree, screenshot, console and network (traces redacted); for desktop/creative, use native document/scene model and rendered preview; always return timestamp+source/capsule+artifact reference. **Act:** typed tool with target, grants, user consent where needed and bounded side effects. **Verify:** machine assertions first, visual inspection supplementary. **Repair:** bounded iteration with failure description, changed artifacts and re-run; no infinite loop or hidden spend. Treat app content and tool outputs as untrusted inputs. A model claiming success does not substitute for assertions and receipts.

### 3.4 Adapter criteria

- All adapters use a manifest of `capabilityId`, provider, installation status, required grant, network/host rights, version and receipt schema. Disable before use if implementation cannot enforce scope.
- **Browser**: prefer Playwright/DOM API; stable test runner and structured screenshot/trace; separate browser profile and cookie jar for each agent; gate internal/localhost URLs, downloads and extension credentials.
- **Graphic**: prefer Figma API/MCP editable frames/layers over image raster. Photoshop and Blender adapters only when installed/supported/licensed; source file must re-open and remain editable. When only a generated image is available, declare Level 1 rather than Level 3 design capability.
- **Desktop/UI**: computer use only through approved host/remote desktop bridge, window/app bounds, explicit screen disclosure, no unrestricted keyboard fallback into arbitrary host sessions.
- **Existing tools**: include file/Git/shell, child MCP, workflows, Godot, browser, proof/audit. Use existing, don't rewrite them for name symmetry.

## 4. User journeys / verifiable outcomes

**J1 Agent Connect:** owner chooses folder and agent, reviews scope and client config diff, authenticates connection, sees `CONFIGURED → READY → CONNECTED` only with matching evidence; one authorized action recorded; owner revokes. **J2 Ten independent sessions:** owner provisions ten separately authenticated slots (not mere chat names); two then ten workload tests; unauthorized cross-slot file/read/kill/token/network blocked; one revoke does not kill unrelated slots; admission control handles over-capacity. **J3 Developer live browser:** AI modifies full-stack project, starts preview server on capsule port, opens browser, performs clicks/forms, observes screenshot+DOM+console+network, catches seeded defect, repairs and reruns E2E, emits source diff/trace and `FAILED` if unresolved. **J4 Designer:** AI creates/edit Figma design via native capability, captures render, critiques layout, changes layer/component and exports editable artifact; returns no fictional user-research or WCAG certification. **J5 Failures:** ENOSPC, timeout, untrusted page prompt injection, stale grant, worker crash, adapter unavailable, expired host grant; side effects accurately logged as `unknown` when appropriate; no blind replay of non-idempotent operations.

## 5. Acceptance criteria and failure oracles

| AC | Testable behavior | Verification owner / stage |
| --- | --- | --- |
| UA-AC01 | Real MCP client can handshake and perform one authorized action; configured/connected states distinct | MCP / C3 |
| UA-AC02 | Forged workspaceId, grantId, revision and cross-principal session denied | Security / C1 |
| UA-AC03 | A and B concurrent requests on different roots never mutate wrong root | QA / C1 |
| UA-AC04 | OS-level file/process/network/secret isolation holds for two agents; cwd-only mode cannot claim secure isolation | Security / C2 |
| UA-AC05 | Ten unique verified principals with ten slots and separate writable data; same bearer not counted as ten identities | MCP / C6 |
| UA-AC06 | Revoke A prevents new requests and reports in-flight status; B continues | SRE / C2/C6 |
| UA-AC07 | CPU/RAM/disk/process/port exhaustion queues/denies safely and reports status | SRE / C6 |
| UA-AC08 | Owner UI and CLI show identical authoritative workspace, grants, status, recent action receipts | UX / C3/C4 |
| UA-AC09 | Coding agent builds/starts app, exercises browser E2E and captures DOM+screenshot+console+network or trace | Browser QA / C4 |
| UA-AC10 | Seeded web defect is detected, fixed and rerun; failing build/test cannot be labeled PASS | QA / C4 |
| UA-AC11 | Browser/profile/credential/network targets are capsule/grant scoped; denied origins and downloads tested | Security / C4 |
| UA-AC12 | Creative adapter edits a native, re-openable design file; edit changes named layer/component | Design / C5 |
| UA-AC13 | Creative preview is captured and one feedback-driven revision is recorded with editable source | UX / C5 |
| UA-AC14 | Plugin unavailable/denied/degraded returns real capability status and remediation, not fabricated success | DX / C3–C5 |
| UA-AC15 | Evidence receipts link source SHA, capsule, principal, action and artifact hashes; confidential values redacted | QA / C4–C6 |
| UA-AC16 | Host Broker cannot self-grant via child MCP, token or prompt; C mode not marketed as isolated | Security / C2/C8 |
| UA-AC17 | Neutral OpenHands/native benchmark shows measured completion, elapsed time, setup steps and failures | Product / C7 |
| UA-AC18 | Exact source+artifact+process, safe canary, backup/restore, capacity and rollback approved before prod | Operator / C8 |

All 18 criteria require an actual verifier/fixture and evidence before they can be recorded PASS. Non-browser tasks do not need screenshot artifacts; creative tasks do need editable source evidence. Accessibility: WCAG 2.2 AA is an **audit target**, not a claim of certification.

## 6. Threats and release gates

| Threat / mistaken premise | Required mitigation | Stop rule |
| --- | --- | --- |
| 10 ChatGPT threads = 10 principals | authenticated principal+slot evidence, no self-assertion | no TEN-AGENT VERIFIED |
| OS shell cwd = sandbox | dedicated OS boundary/capsule proof | no unrestricted shell with isolation marketing |
| Browser/child MCP has host privileges | transitive grant enforcement and network rules | disable unsafe adapter |
| Model supplies external prompt injection | treat pages/artifacts/tool output as data | no policy override from observed content |
| Shared cookies, credentials or folders | per-slot isolation, deny cross-slot | FAIL C6 |
| Test results missing | return `unknown`/`failed`, attach reason | no DONE |
| Host disk near 100%; isolation records drift | backup, operator capacity, issue #118 writer fencing for any registry mutation | no live restart/reconcile/force cleanup |
| GitHub green CI but release unverified | artifact→running process SHA, canary and rollback | no LIVE_VERIFIED |

## 7. Non-functional requirements / scope ceilings

- No model/API credentials committed or logged. Per-agent costs/runtime bounded; user sees estimated tool/provider spend.
- No mandatory choice of Docker vs Podman vs VM until OS/platform matrix and negative tests; sandbox adapter selected by available safe capability.
- CLI/Web/API compatibility preserved; deprecate legacy tool behavior intentionally, never silently.
- No speculative microservices/graph database/autonomous council mandatory for runtime.
- Target metrics such as p50 first action ≤3 minutes and 10-slot admission are **proposed SLOs** requiring measured baseline and host sizing.

## 8. Repo and verification conventions

**Runtime source:** `src/server/`, `src/tools/registry.ts`, `src/workspace/`, `src/capsule/`, `src/sandbox/`, `src/adapters/child-mcp/`, `src/tools/browser-tools.ts`, `src/proof/`, `packages/mission-control/`. **Tests:** `tests/unit/`, `tests/integration/`; add focused negative suites before implementation. **Commands:** `npm run typecheck`, `npm run lint`, `npm run architecture:check`, `npm run docs:check`, focused `npx vitest run <test>`, `npm test`, `npm run build` on available CI/isolated build runners. Do not run resource-heavy builds on unsafe full hosts.

**Source of truth:** this spec and linked goalmap/roadmap supersede product direction of the historical [v2 draft spec](2026-11-14-folderforge-v2-design.md), but **do not retroactively change shipped behavior**, source PR review state, or 33/37 FF task results. Persist implementation progress in [UA tasks](../../../tasks/universal-agent-todo.md) and [status log](../../status/UNIVERSAL_AGENT_STATUS_2026-11-15.md).
