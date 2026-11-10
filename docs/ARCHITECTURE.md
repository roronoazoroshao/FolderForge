# System architecture — current and proposed (audit baseline)

Baseline `main@8c00b15`; references are source locations, not deployed host assertions. This is the *current* technical architecture; the target remains a Phase 4 **proposal**.

## Current runtime structure

`src/main.ts:98-300,380` parses CLI and selects stdio/HTTP/Dashboard. `src/runtime/config.ts:202-285,312-361` resolves defaults/config/env. `src/runtime/container.ts:7-44` composes services. `src/tools/index.ts:42-83` registers tools; `src/tools/registry.ts:529-600` provides governance; `src/server/mcp-server.ts:122` serves MCP; `src/dashboard/server.ts:213,936-3024` serves the SPA/control REST.

```text
CLI (main.ts) ──> Config (runtime/config.ts) ──> Container (runtime/container.ts)
  ├── stdio / HTTP MCP (server/) ──> ToolRegistry (tools/)
  │                                     ├── policy / approval / quota / audit
  │                                     ├── files, terminal, git, code, tests
  │                                     ├── child MCP / browser / Godot
  │                                     └── workflow, agent-loop, Fleet, isolation
  └── Dashboard HTTP (dashboard/server.ts) ──> Mission Control SPA
              ├── read-only overview / inventory
              └── owner-authenticated mutations / host consent
                                    │
                    durable JSON/evidence/worktrees/state
                                    │
                OS file permissions + optional external services
```

### Security/data trust boundaries
1. **Principal/transport:** stdio, token/API key or OAuth MCP and Dashboard credentials are different authorities (`src/server/transports/http.ts:67-149,595-715`; `src/dashboard/server.ts:950-1028`). Port forwarding is not owner authentication.
2. **Tool authorization:** named tool/risk → principal + policy → approval → quota → audit, including classified child MCP calls (`src/tools/registry.ts:529-600`; `src/tools/adapter-tools.ts:121-126`).
3. **Fleet host privilege:** explicit owner/proven scope, not blanket root privileges (`src/operator/trusted-host-consent.ts:46-76,84-117`).
4. **Isolation registry:** cooperative lock, durable hash and patch journal; metadata reconciliation requires unprovided host writer epoch (`src/isolation/worktree-manager.ts:103-112,1289-1307,1813-1825`).
5. **External:** ChatGPT/OpenAI tunnel, Cloudflare, child MCP, package/marketplace and worker peers are separately authenticated and cannot be called “local-only” (`src/chatgpt/openai-tunnel.ts:1746`; `src/tools/adapter-tools.ts:38-50`).

## Multi-child tunnel / workspace-context gap (new 2026-11-10 finding)

An OpenAI secure tunnel launches a single MCP origin with `--project <root>` (`src/chatgpt/openai-tunnel.ts:1245-1304,1719-1739`), not a verified independent per-subfolder router. `WorkspaceManager.current` is **process-wide mutable state** (`src/workspace/workspace-manager.ts:30-33,64-102`); `workspace_switch` affects the same context used by subsequent pathless requests (`src/tools/workspace-tools.ts:40-60`). HTTP sessions bind principal ID, **not a project root per request** (`src/server/transports/http.ts:337-359`). In addition, `workspace_route` changes a shared tool **preset** rather than a child directory (`src/tools/workspace-tools.ts:149-195`), while quota is per-tool per-process (`src/policy/rate-limiter.ts:22-39,56-62`).

**Preferred future direction — not implemented:** authenticated endpoint → owner-approved child workspace identity pinned to request/session → trusted gateway → separate bounded MCP worker per child (safer initial isolation) → immutable request context, per-project policy/quota/audit and fair queue. A shared-process alternative needs a later exhaustive cross-tool state refactor. Ambiguous project selection should fail closed, and changing one session must never alter another session's root or visible tool catalog. See [focused design and test matrix](audit/MULTI_WORKSPACE_TUNNEL.md) and proposed F14/F15.

## Agent loop: actual behavior versus planned

**Current** driver is deterministic in its built-in fallback; providers may connect externally but this implementation itself does not invoke multiple independent LLMs (`src/agent-loops/agent-loop-runner.ts:31-39,156-216`).

```text
start/recover persisted loop
while state == running:
    if cancellation: pause and checkpoint
    if discovery: call project_analyze + code_context
                   synthesize proposals for configured experts
    if council:   sort proposals by heuristic
                  synthesize votes (0.92 winner / 0.82 otherwise)
    if implementation:
                   if no validated workflowId -> BLOCK
                   else run governed workflow; pause on human approval
    if verification:
                   run checks + proof; evaluate acceptance criteria
                   if pass -> complete
                   else if iteration budget exhausted -> fail
                   else checkpoint and iterate
persist state/events/proof; never claim code changed without workflow evidence
```

Evidence: `src/agent-loops/agent-loop-runner.ts:107-147,156-216,219-287,331-356` and `src/agent-loops/agent-loop-manager.ts:67-107`. The “independent” review rationale in `src/agent-loops/agent-loop-runner.ts:201-213` is synthetic and should be relabelled.

**Target (NOT IMPLEMENTED / Phase 5 approval needed):**

```text
receive request with explicit principal, project and budget
authenticate -> freeze immutable policy and artifact/input hashes
deterministic planner classifies: no-model vs model-required
retrieve bounded, provenance-tagged context; quarantine untrusted inputs
optional real LLM step (provider, version, max_tokens, cost cap)
validate output schema; require explicit evidence for each claim
for each proposed tool:
    risk classify -> path/approval scope -> per-run token/time/expense budget
    if irreversible/credential/host-write: STOP for human operator approval
    execute through ToolRegistry; audit attempt, result and correlation id
    verify postconditions immediately; retry only idempotent safe steps
    if uncertain state / writer-epoch missing: FAIL CLOSED + preserve recovery
checkpoint state and cost; stop on max iterations, time, money, approval expiry
run unit/integration/LLM eval + independent review where required
produce evidence-linked final report with rollback and remaining limitations
```

Proposed model/usage ledger, true council, token limits and eval harness are **new features**, not present guarantees.

## Proposed architecture direction and trade-offs

| Decision | Keep / change | Benefit | Trade-off / evidence |
|---|---|---|---|
| MCP tool registry + policy | **Keep** centralized governance | Single audited permission boundary | Guard dynamic adapters with manifest/risk review (`src/tools/registry.ts:143-146`; `src/tools/adapter-tools.ts:121-126`) |
| Dashboard route implementation | **Refactor** by domains without changing URLs | Better auth contract testability | Migration risk across `src/dashboard/server.ts:936-3024` |
| Agent loop | **Keep** durable state; **add** optional real provider interface | Honest AI capability, measured costs | External credentials/latency, privacy (`src/agent-loops/agent-loop-manager.ts:67-107`) |
| Isolation metadata | **Keep fail-closed**; add dedicated host writer service only after evidence | Prevent stale-writer overwrite | Operational UID/ACL migration, cannot bypass reviewer (`docs/r14-kernel-registry-fence-migration.md:40-72`) |
| Settings | **Extend typed allowlist**, desired vs effective, restart plan | Real Web Control UX without universal host write | More config validation/tests (`src/operator/config-descriptors.ts:4-60`) |
| Multi-child tunnel/session | **Replace shared mutable workspace selection** with request-bound authorized project identity (F14), then add per-project admission/fairness (F15) | Prevent wrong-folder operations and noisy-neighbor limits | Requires RPC context migration, negative tests and backward-compatible single-project default (`src/workspace/workspace-manager.ts:30-33`; `src/policy/rate-limiter.ts:22-39`) |
| Child MCP | **Keep** facade/presets; add trust health and cost ceilings | Limited context and blast radius | Extra discovery metadata / quarantine (`src/tools/index.ts:164-209`) |

## Target folder structure (proposal only)

```text
src/
  api/
    routes/             # per-domain typed REST routes, shared owner/auth gates
    schemas/            # single-source request/response contracts
  agent/
    providers/          # optional model adapters, token meter, explicit consent
    orchestration/      # state machine, checkpoints, planner, verifier
    evals/              # reproducible prompts / simulated adversaries
  operator/
    config/             # descriptors, desired/effective, rollback
    incidents/          # read-only health, alerts, evidence
  isolation/
    host-epoch/         # separate privileged supervisor contract; no implicit enable
  observability/
    correlation/        # trace IDs, SLO and usage events
  integrations/
    adapters/           # pinned child MCP manifests and trust metadata
tests/
  security/             # identity, injection, epoch and approval failure tests
  evals/                # golden set, judged output and regression
docs/                  # current architecture, ops, audit and roadmap
```

Files/directories above are **planned**, not asserted to exist. Release and production cutover remain manual and operator-approved.
