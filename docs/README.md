# FolderForge documentation

This index separates current user and operator guidance from contributor design
material and historical records.

## Dated handoffs (historical, not current source truth)

| Document | Audience | Purpose |
| --- | --- | --- |
| [Project status](PROJECT_STATUS.md) | Maintainer / Agent | 2026-10-09 release/source snapshot. Not current; see the 2026-11-10 audit below. |
| [Current frontier](CURRENT_FRONTIER.md) | Maintainer / Agent | Historical G58/G59 frontier; current review is the dated feature-flow audit. |
| [Handoff](HANDOFF.md) | Maintainer / Agent | Historical 2026-10-09 handoff and preserved recovery evidence. |

These dated records preserve forensic and release evidence, not current operational
instructions. For the current checked source baseline use the 2026-11-10 audit,
configuration guide and new full feature-flow audit linked below. Live host/release state is a
separate operational verification gate.

## FolderForge v2 — product vision, specification and tasks

| Document | Audience | Purpose |
| --- | --- | --- |
| [North Star 2027–2030](strategy/FOLDERFORGE_NORTH_STAR_2027_2030.md) | Product owner / contributor | Long-term direction, architecture principles, portfolio choices and roadmap; **DRAFT**. |
| [Workspace-first v2 spec](superpowers/specs/2026-11-14-folderforge-v2-design.md) | Product / engineering | Journeys, security invariants, proposed contracts and 14 acceptance criteria; **DRAFT**. |
| [33-task detailed plan](superpowers/plans/2026-11-14-folderforge-v2-implementation.md) | Contributor / agent | Dependency-ordered TDD steps, verification and rollback; **not yet implemented**. |
| [Task and checkpoint index](../tasks/plan.md) | Maintainer | 33 FF tasks, phases P00–P06 and owner approval gates. |

## Getting started

| Document | Audience | Purpose |
| --- | --- | --- |
| [README](../README.md) | User | Install, first run, MCP client examples, and product overview. |
| [Compatibility](compatibility.md) | User / Operator | Supported Node and operating-system matrix and evidence rules. |
| [Playwright setup](playwright-macos.md) | User / Operator | Browser installation, degraded behavior, diagnostics, and macOS notes. |
| [Godot MCP](godot-mcp.md) | User / Operator | Install the shipped Godot addon and use editor/runtime tools. |

## Guides

| Document | Audience | Purpose |
| --- | --- | --- |
| [OpenAI Secure MCP Tunnel](openai-secure-mcp-tunnel.md) | User / Operator | One-command private ChatGPT connection with verified client installation, local auth, and supervised health. |
| [ChatGPT connection](chatgpt-connect.md) | Operator | Guided public Auth0/DCR lifecycle for ChatGPT connectors. |
| [Mission Control](mission-control.md) | Operator | Active calls, sessions, tasks, approvals, processes, isolation containment, and persistent write freeze. |
| [Durable structured verification](structured-verification.md) | Agent / operator | Owner-bound passed/failed/skipped/unavailable verification evidence with restart recovery. |
| [OAuth](oauth.md) | Operator | External authorization-server and protected-resource configuration. |
| [Workflows](workflows.md) | User / Contributor | Persistent governed workflow usage. |
| [MCP platform](mcp-platform.md) | User / Contributor | Resources, prompts, progress, cancellation, subscriptions, and principal-bound tasks. |
| [MCP session reliability](mcp-session-reliability.md) | Operator / Contributor | HTTP session lifetime, reconnect identity, mutation replay, and stable-endpoint requirements. |
| [Policy as code](policy-as-code.md) | User / Operator | Restrictive project policy, RBAC selectors, execution identity, and audit correlation. |
| [AI coding runtime](ai-coding-runtime.md) | User / Contributor | Analyze, patch, verify, and report workflow. |
| [Artifacts and browser quality](artifacts.md) | User / Contributor | Content-addressed evidence, visual comparison, and accessibility checks. |
| [Browser emulation and flows](browser-emulation-flows.md) | User / Contributor | Device/network profiles and bounded governed UI flows. |
| [Distributed workers](distributed-workers.md) | Operator / Contributor | Remote worker identity, leases, artifacts, replay policy, and signed evidence. |
| [Verified marketplace](marketplace.md) | Operator / Plugin author | Publisher trust, immutable index, quarantine, moderation, and disabled install. |
| [Plugin SDK](plugin-sdk.md) | Plugin author | Template, validate, test, deterministic pack, keygen, SBOM/provenance, and signing CLI. |
| [Beta program](beta-program.md) | User / Maintainer | Entry, evidence, privacy, and graduation criteria for external beta testing. |
| [Benchmark protocol](../benchmarks/README.md) | Contributor / Maintainer | Neutral tasks, immutable result validation, and publication rules. |
| [Benchmark operations](benchmark-operations.md) | Contributor / Maintainer | No-shell harness execution, evidence, environment isolation, and result creation. |
| [Stability and regression policy](stability-policy.md) | Maintainer / Contributor | Feature-freeze scope, bug definition of done, severity, and regression-test requirements. |

## Reference

| Document | Audience | Purpose |
| --- | --- | --- |
| [Tools](tools.md) | User / Contributor | Native tool groups and behavior. |
| [Adapters](adapters.md) | User / Contributor | Child MCP configuration, facades, lifecycle, and diagnostics. |
| [Plugin system](plugin-system.md) | User / Contributor | Local plugin packaging and trust boundaries. |
| [Sandboxing](sandbox.md) | Operator / Plugin author | Docker/Podman isolation, image pinning, mounts, resources, and diagnostics. |
| [MCP facade](mcp-facade.md) | Contributor | Large child-server facade contract. |

## Security

| Document | Audience | Purpose |
| --- | --- | --- |
| [Vulnerability reporting](../SECURITY.md) | User / Researcher | How to report a suspected vulnerability privately. |
| [Technical security model](security.md) | Operator / Contributor | Path, command, secret, approval, auth, and audit controls. |
| [Audit durability ADR](adr-0006-audit-durability.md) | Operator / Contributor | Required versus best-effort evidence writes and failure semantics. |
| [Evidence store v2 ADR](adr-0007-evidence-store-v2.md) | Operator / Contributor | Hash chaining, signatures, strict migration, verification, and threat-model limits. |
| [Core/runtime boundary ADR](adr-0008-core-runtime-package-boundary.md) | Contributor / Maintainer | Dependency direction, cycle gates, and the Godot adapter extraction. |
| [Child MCP compatibility](child-mcp-compatibility.md) | Operator / Contributor | Deterministic protocol profiles, evidence, and third-party certification limits. |
| [Pinned third-party MCP compatibility](third-party-mcp-compatibility.md) | Operator / Contributor | Exact server/package pins, isolated execution, cross-platform artifacts, and claim boundaries. |
| [Runtime soak evidence](runtime-soak.md) | Operator / Maintainer | Resumable long-run harness, hash-chained samples, fault injection, verification, and 24-hour claim boundary. |
| [Maturity and proof matrix](maturity-and-proof.md) | User / Maintainer | Capability maturity, reproducible gates, prohibited claims, and external evidence backlog. |
| [Release inventory](release-inventory.md) | Maintainer / Researcher | Factual npm, tag, and hosted-release provenance snapshot with explicit unknowns. |
| [OAuth ADR](adr-0004-oauth-resource-server.md) | Contributor / Maintainer | Resource-server architecture and trade-offs. |

## Architecture

| Document | Audience | Purpose |
| --- | --- | --- |
| [Architecture](architecture.md) | Contributor | Main components and data flow. |
| [MCP plugin architecture](mcp-plugin-architecture.md) | Contributor | Plugin architecture. |
| [Distributed workers and marketplace ADR](adr-0005-distributed-workers-marketplace-gates.md) | Contributor / Maintainer | Implemented local architecture and remaining public-service gates. |
| [Browser agent design](browser-agent-design.md) | Internal design | Browser design notes; not a current user contract. |

## Migration

| Document | Audience | Purpose |
| --- | --- | --- |
| [Migration to 2.0](migration-2.0.md) | User / Operator | Breaking and operational changes in 2.0. |
| [ChatGPT lifecycle v2](migration-chatgpt-lifecycle-v2.md) | Operator | Receipt and lifecycle migration notes. |

## Contributing and releasing

| Document | Audience | Purpose |
| --- | --- | --- |
| [Contributing](../CONTRIBUTING.md) | Contributor | Development, tests, pull requests, and review expectations. |
| [Release process](releasing.md) | Maintainer | Release gates and operator-controlled publication steps. |

## Internal / historical

These documents are useful context but are **not current product contracts**:

- [Implementation log](implementation-log.md) — historical implementation notes.

When an internal document conflicts with README, reference, security, or
compatibility documentation, the current user-facing document and executable
tests take precedence.

## Workspace safety

- [Workspace Capsules](workspace-capsules.md)
- [Managed task isolation](task-isolation.md)
- [Durable task runtime and Proof Packs](task-runtime-and-proof-packs.md)
- [ADR-0011: Capsules and worktrees](adr-0011-workspace-capsules-and-isolation.md)

## Full feature and flow audit (2026-11-14)

[Current repository flow and open-issues audit](audit/REPO_FULL_FLOW_ISSUES_AUDIT_2026-11-14.md) is the latest cross-check against `main`, GitHub issues/CI and the live host, including the branch-only cleanup and isolation-recovery warning. The [earlier source-focused feature-flow audit](audit/FEATURE_FLOW_AUDIT_2026-11-14.md) is retained as dated evidence. Superseded plan documents were removed from the active tree; Git history retains their committed versions.

## Multi-project gateway (F14/F15 — source integrated)

[Multi-project MCP gateway](multi-project-gateway.md) documents the opt-in per-project worker and fair admission. Merging source does not activate a public tunnel or certify production readiness; independent security and host-isolation evidence remain required.

## Audit and configuration (baseline 2026-11-10)

The dated [Audit report](audit/AUDIT_REPORT.md) and [Feature inventory](audit/FEATURE_INVENTORY.md) document the source baseline before F14/F15 were merged. See [Multi-workspace isolation audit](audit/MULTI_WORKSPACE_TUNNEL.md), [Architecture](ARCHITECTURE.md), [Configuration](CONFIGURATION.md), [Tools and APIs](TOOLS.md), and [Operations](OPERATIONS.md). These documents are historical evidence where their status references differ from current main; no production cutover is implied.
