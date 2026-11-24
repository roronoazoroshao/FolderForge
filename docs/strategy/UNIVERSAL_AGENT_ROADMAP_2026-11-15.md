# FolderForge — Universal Agent Roadmap

**Decision date:** 2026-11-15. **Status:** strategic direction **APPROVED**, implementation **NOT VERIFIED**, schedules **targets**. **Companion:** [Goal Map](UNIVERSAL_AGENT_GOALMAP_2026-11-15.md), [Spec](../superpowers/specs/2026-11-15-universal-agent-work-environment-design.md), [Plan](../superpowers/plans/2026-11-15-universal-agent-work-environment-implementation.md), [Tasks](../../tasks/universal-agent-todo.md).

## 1. Dependency order, not an indiscriminate feature list

```text
M0 Evidence and source baseline
  → M1 Identity + grants + 2-agent OS isolation + MCP truth
    → M2 Live coding browser observability + run/test/repair + proof
      → M3 Creative native editable design adapter + 10-agent scale
        → M4 Cross-application workflows, portability, benchmark and beta
          → M5 production attestation / owner-approved rollout
```

M2 browser E2E MUST NOT claim verified if browser is only installed, or screenshot is captured without assertions. M3 creative MUST NOT claim editable source when only raster image exists. Parallel UI work can proceed on fake typed contracts but cannot declare real runtime integration done until M1.

## 2. Delivery roadmap

| Target window | Milestone | Deliverable | Exit evidence | Replan when |
| --- | --- | --- | --- | --- |
| D0–14 / 2026-11-15–11-28 | M0 Evidence | Update source baseline, current issue/PR/CI state, owner/capability/OS threat model, existing FF backlog mapping | exact SHA snapshot, bounded test fixture, no production mutations | first gate fails / new source risk |
| D15–30 / 2026-11-29–12-14 | M1 Trust | Stable workspace identity, persisted scoped grants, per-request context, real MCP binding; isolated worker spike | forged root/grant/session denied; 2 principals/2 roots tests | OS confinement unavailable |
| D31–60 / 2026-12-15–2027-01-13 | M2 Coding/Live QA | CLI first action, sandboxed preview server, Playwright DOM/screenshot/network/console/trace, E2E and repair | run source+browser, intentional frontend bug detected/fixed, replayable proof | product flow unobservable |
| D61–90 / 2027-01-14–02-12 | M3 Workbench | Owner Web view, 10-agent resource admission and negative conformance; first native editable design bridge | no cross-agent access; live UI flow; one editable Figma/artifact source + render | insufficient isolation/resources/provider access |
| 3–6 months / 2027 H1 | M4 Cross-app beta | Desktop and creative plugin proof, task handoff between agents, executor portability, benchmark | real participants/benchmark, rollback capability and specific measured gain | no meaningful advantage vs native tool |
| 6–12 months / 2027 H2 | M5 Hardening | OS platform matrix, recovery drills, untrusted adapter security, authorization canary, production SLA candidate | supported-platform sandbox evidence, restored backup, release controls | missing #118 remediation for affected operations |
| 12–36 months / 2028–29 | Optional platform | Multi-machine task/agent collaboration, signed portable execution, richer creative app ecosystem | usage, revenue/retention, auth proof and integration support | weak adoption or maintenance exceeds value |

All windows are hypotheses and subject to effort, compatibility, host resources, licensing and actual tests; there are no guarantees of completion dates.

## 3. Product gates and exact evidence

| Gate | To PASS | Not sufficient |
| --- | --- | --- |
| C0 BASELINE | CI exact commit, test fixture, immutable baseline, current host risk log | clean `git status` alone |
| C1 IDENTITY | per-request principal/grant/capsule binding, simultaneous two-client denial tests | a `workspaceId` string or one bearer shared among chats |
| C2 EXECUTOR | sandbox OS proof, separate writable roots/process/net/secret, quotas and revoke | `cwd`, Docker CLI configured, current process sandbox |
| C3 FIRST ACTION | real ChatGPT/other MCP handshake, authorized run, owner sees outcome | config installed / self-probe only |
| C4 LIVE WEB | build+start+browser actions+DOM+screenshot+console/network+E2E and negative cases | passing unit tests / screenshot alone |
| C5 CREATIVE | native editable design artifact, visible review, revision and re-open/export proof | single generated PNG |
| C6 TEN-AGENT | 10 distinct verified principals, 10 independent capsules, forged-ID/secret/process/sibling tests, load/queue handling | 10 tabs sharing one token |
| C7 BETA | real workflows benchmarked against current OpenHands/Docker sandboxes and native tools; platform limitations stated | marketing comparison table |
| C8 PROD | owner operational grant, exact artifact→process attestation, capacity, backup restore, canary, rollback, isolation #118 if touched | green CI or AI approval |

## 4. Scope / decisions that constrain execution

- **Default Mode A:** full tool access *within a verified capsule*; deny unsupported privileged OS capabilities. Mode B: typed host broker with owner grants and expiry; Mode C unrestricted root never meets independent-isolation guarantee.
- **Safety early:** if host capacity is critically low or OS/agent isolation unproven, continue docs/fixtures/CI only. No forced cleanup of detached worktrees or isolation registry (#118).
- **Browser:** existing Playwright adapter is a foundation, not a live-e2e certification. Prefer standard Playwright for stable assertions, MCP/browser tools for agent operation and trace support.
- **Creative:** initial supported target = Figma native editable canvas contract. Photoshop/Blender are provider-specific extensions after one verified creative vertical slice.
- **Task status:** `PLANNED` → `IN_PROGRESS` → `SOURCE_TESTED` → `E2E_VERIFIED` → `MERGED_MAIN` → `LIVE_VERIFIED` (only if actually tested). `BLOCKED` is not DONE.

## 5. Existing roadmap reconciliation

The v2 33 FF issues on `main` and the draft 37-task plan on PR #200 remain as linked historical/implementation work: **do not bulk-close** or rewrite completion statuses. Use [universal-agent task matrix](../../tasks/universal-agent-todo.md) to relate each new proof milestone to FF issue ranges. Review #200/#203 separately as source changes; documentation approval alone does not authorize merging their code.

## Proposed execution overlay — continuous development

See [Autonomous Development Execution Plan](AUTONOMOUS_DEVELOPMENT_EXECUTION_PLAN.md) for the prioritized increment queue, risk tiers, verification, rollback and session audit. Retain M0–M5, C0–C8 and original dependencies. Operational C0 HOLD does not itself prove that every isolated fixture or unrelated source task is unsafe; select genuinely independent eligible work under the applicable approved rules. Never promote dev previews to production evidence. This overlay is proposed pending authorized governance adoption.
