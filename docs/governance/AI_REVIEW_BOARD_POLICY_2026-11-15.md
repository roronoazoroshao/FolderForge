# FolderForge v2 — AI Review Board Governance

**Effective proposal:** 2026-11-15. **Authority:** project owner explicitly delegated **design/spec/plan/task review and decisions** to specialist AI agents in the project conversation (2026-11-15). **Review thread:** [#201](https://github.com/roronoazoroshao/FolderForge/issues/201). **PR:** [#200](https://github.com/roronoazoroshao/FolderForge/pull/200).

**Important:** This document defines the **decision system**, not a claim that independent agent runs have already happened. Earlier 8-role findings are `AI_SIMULATED` (one assistant, several lenses), not eight separate agents. Until execution receipts exist, label verdicts `AI_SINGLE_REVIEW / NOT_QUORATE`.

## 1. Governance objective

FolderForge should be built by AI agents, **reviewed by AI agents, and governed by evidence-based AI decisions**. No mandatory human expert committee for the ordinary product strategy, architecture, implementation or test-review gates.

An AI vote **may decide what the product should do and whether a review gate is satisfied**. It is not a security credential and cannot grant an agent access to the host, sign legal attestations, publish a release, bypass repository branch rules or perform destructive activity absent the required authority.

## 2. Decision rights (binding policy for AI-led review)

| Decision class | AI board authority | Actual execution boundary |
|---|---|---|
| VISION / SPEC / ARCH / PLAN / TASK | **FINAL** after quorum, adversarial tests, source-backed reasons and no blockers | AI may publish design decision record to GitHub branch and issues |
| SOURCE / TEST / PR_QUALITY | **FINAL technical verdict** on exact source SHA after required tests and negative cases | Merging depends on repository permission, branch rules and actual CI; no fake GitHub APPROVED events |
| PRODUCT_EXPERIMENT / UX_TEST_PLAN | **FINAL for protocol and research plan**, not unobserved user behavior | Human participant results cannot be invented or replaced by a synthetic session |
| OS_ISOLATION / AUTH / HOST_BROKER design | **CAN VETO and require changes**; may approve threat-model design | OS-confinement claims require independent executed proof; environment/operator authority still controls deployment |
| PROD_CUTOVER / ROOT_PRIVILEGE / RECOVERY / SECRET_USE / DELETION / PUBLISH | **RECOMMEND or BLOCK, not self-authorize physical execution** | Must hold actual owner/system permission and relevant operational approvals; #118 if isolation registry affected |

**Default when evidence is missing: HOLD.** `PR_CI_PASS` is not an independent review or production sign-off.

## 3. Specialist AI agents (separate execution receipts, not just role labels)

| ID | AI reviewer persona | Mandatory deliverable | Decides/veto |
|---|---|---|---|
| **A-PRODUCT** | Principal Product/JTBD Strategist | target jobs, first verified action, MVP cut-line, measurable UX hypotheses | Product scope |
| **A-ARCH** | Principal Domain + Clean Architecture Engineer | canonical contracts, dependency DAG, migration and rollback | Technical architecture veto |
| **A-SEC** | Adversarial AppSec/OS Boundary Analyst | threat model, identity+grant, transitive tool attacks, sandbox assumptions | **Blocking safety veto** on unresolved Critical/High |
| **A-MCP** | MCP Transport & Client Interop Engineer | stdio/HTTP handshake, version matrix, cross-session test oracle | Protocol gate |
| **A-UX** | Accessible UX Researcher/Interaction Designer | full task journey, errors, consent language, WCAG risk + study plan | UX design gate; no certification claim |
| **A-QA** | Staff SDET/Verification Architect | AC→test→task→gate coverage, fault tests, graph, reproducibility | **Blocking quality veto** for missing critical coverage |
| **A-SRE** | SRE/Recovery & Release Engineer | capacity, backups, audit durability, host SHA, rollback | Operational readiness veto |
| **A-CLEAN** | Code Maintainability/Developer Experience Reviewer | API simplicity, clean modular boundaries, small slices, backward compatibility | Maintainability gate |
| **A-CHAIR** | Adversarial Review Chair (non-voting) | verify provenance, challenge votes, calculate machine-checkable verdict, publish decision | Resolves conflict by rules, **never fabricates** missing votes |

**Execution requirements:** Each voting agent must have its own invocation/context, unmodified source pack plus exact reviewed SHA, individual `runId`/model/provider metadata, a fresh prompt, bounded scope and structured output. It may use the same model family as other agents, but reports must say so; separate prompts alone within one answer are `SIMULATED_LENSES`, **not** independent executions. The implementer **cannot be a voting reviewer of its own patch**.

## 4. Professional review protocol (mandatory for every agent)

1. **Preflight:** freeze `sourceSha`, Spec SHA, Plan SHA, task/CI artifacts; any drift invalidates the decision for new changes.
2. **Blind independent review:** each reviewer receives the same evidence, own role prompt and **no other agent's verdict**. Write a separate signed-or-attributed review receipt.
3. **Adversarial cross-examination:** A-CHAIR shares contradictory claims; opponents must show a reproducer/failure oracle, retract or defend with evidence.
4. **Minimum patch request:** each P0/P1 finding names owner, smallest safe fix, exact test and acceptance condition.
5. **Fresh re-review:** after code/docs update, run fresh reviews against new SHA. Do not reuse previous APPROVED votes blindly.
6. **Decision calculation:** A-CHAIR applies quorum/veto rules below to real receipts; update task/PR and ledger with exact SHA and evidence links.
7. **Execution separation:** AI source verdict is not host access. Destructive or privileged operations require separate authorization and real security evidence.

### Review receipt (JSON schema-like contract)

```json
{
  "boardVersion": "1.0",
  "reviewId": "unique-run-receipt",
  "agentId": "A-SEC",
  "execution": "SEPARATE_AGENT_RUN",
  "model": "exact-model-identifier",
  "provider": "provider-name",
  "runId": "actual-runtime-generated-id",
  "sourceSha": "exact-40-char-sha",
  "specSha": "exact-40-char-sha",
  "planSha": "exact-40-char-sha",
  "filesRead": ["verified/path"],
  "testsRun": [{"command":"exact command","status":"PASS|FAIL|NOT_RUN","evidence":"log digest"}],
  "findings": [{"id":"RV-XX","kind":"OBSERVED|INFERRED_RISK|EVIDENCE_GAP","severity":"BLOCKER|HIGH|MEDIUM|LOW","source":"path:line","oracle":"falsifiable test","fix":"minimal fix","owner":"task-id"}],
  "vote": "APPROVE|APPROVE_WITH_CONDITIONS|REQUEST_CHANGES|ABSTAIN",
  "dissent": "most serious counterargument",
  "artifactDigest": "digest of full receipt"
}
```

No placeholder is proof. If model/runID/signature or actual proof is unavailable, say `EXECUTION_UNVERIFIED` and **do not count the vote**.

## 5. Quorum, veto, disagreement and validity

- **8 possible voting seats.** Design/spec requires **at least 6 separate, provenance-verifiable receipts**, including A-PRODUCT, A-ARCH, A-SEC and A-QA. Minimum **6 APPROVE/APPROVE_WITH_CONDITIONS** votes; conditions must be explicit, non-blocking and assigned.
- **No approval if any unresolved BLOCKER**, any unverified mandatory test, or A-SEC/A-QA/A-ARCH submits an evidenced `REQUEST_CHANGES` on their blocking domain. The chair must resolve false positives with counterevidence, not majority override.
- For UX-specific gate, A-UX is also mandatory; protocol gate requires A-MCP. For release/runbook planning A-SRE is mandatory. These roles can require changes; there is no human placeholder vote.
- `APPROVE_WITH_CONDITIONS` is allowed only for **non-blocking** issues with assigned follow-up issue and validation date; cannot waive missing OS-isolation evidence, unreviewed host escalation or disabled critical security tests.
- On tie or unverified independence: **HOLD**, request adversarial evidence or a new separate reviewer run. Abstentions do not count toward quorum.
- Every vote expires when the **reviewed source/spec/plan digest changes** in a material way. A recheck of document-only edits may be scoped narrowly but must record that limit.
- **No model plurality theater:** 8 role paragraphs from the same assistant is **one synthesis, zero separate-agent quorum votes**. One synthesizer must not impersonate distinct bot accounts or submit sham GitHub approvals.

## 6. Terminal states and exact meaning

- `AI_PRE_REVIEWED`: one-model specialist-lens analysis; useful findings, **no multi-agent quorum**.
- `AI_REVIEW_RUNNING`: at least one verified separate agent invocation.
- `AI_CHANGES_REQUESTED`: proven blocking issues or veto by a qualified AI reviewer.
- `AI_DESIGN_APPROVED`: quorum satisfied for Vision/Spec/Plan with exact SHA and evidence ledger.
- `AI_CODE_APPROVED`: quorum/mandatory roles and CI satisfied for exact PR SHA; GitHub merge remains a separate permissioned action.
- `HOST_DEPLOY_AUTHORIZED`: **not an AI board vote**. Real operator authorization, capacity, backup/restore, root/broker permissions, applicable issue #118 and rollback evidence must exist.
- `NOT_QUORATE`: roles simulated/absent, vote receipts missing or execution identity not verified.

## 7. Execution adapter requirements / future automated board

The board runner should isolate agent review contexts (independent calls or jobs) and preserve provenance in `docs/reviews/runs/<runId>/` or a signed artifact store. If runtime cannot start separate LLM agents, **stop at `AI_PRE_REVIEWED`**; do not silently substitute multi-role prose.

FolderForge's current tool workflows can invoke configured tools but their existence alone does **not** establish multiple independently reasoning LLM agents. A real runner needs: agent model/provider config, distinct invocation IDs, immutable evidence input, prompt version, output validation, digest verification, audit trail and replay/expired-vote controls. Keep CI test gates external to the model's own narrative.

## 8. Current application to PR #200 — no false signatures

At delegation date, head under review `bc9d8b3046fadec094e705d1e22c05a0eafe2106`, two GitHub Actions workflow runs for that SHA successful, **0 recorded PR reviews**. Earlier report contains 12 findings from one ChatGPT multi-lens pass. It does **not** satisfy 6-agent quorum. Open blocking/important work: source/context `grantId` vs Spec mismatch, path ID persistence/rebind, MCP permission wiring, real browser E2E and host proof.

**Decision today:** `AI_PRE_REVIEWED / NOT_QUORATE / CHANGES_REQUESTED` on design acceptance. The AI board is designated **primary future decision-maker**, but **has not been run as independent agents**. Ordinary read-only audit and spec/plan remediation on a draft branch may continue.

## 9. Traceability

[Role prompts](../reviews/2026-11-14-ffv2-review-prompts.md) · [Findings](../reviews/2026-11-14-ffv2-adversarial-board.md) · [Decisions](../reviews/2026-11-14-ffv2-decision-register.md) · [Review board #201](https://github.com/roronoazoroshao/FolderForge/issues/201).

No synthetic research numbers, accessibility certification, human security signature, real participant findings, agent runtime traces, tests or deployment claims.


## 10. P0 discovered defect in current `AgentLoopRunner` — NEVER count fallback council as real reviewers

**Observed, not hypothetical:** [`src/agent-loops/agent-loop-runner.ts`](https://github.com/roronoazoroshao/FolderForge/blob/main/src/agent-loops/agent-loop-runner.ts) has a deterministic `proposalForExpert()` in discovery and a `council()` loop that sets **`approve: true` for every listed expert**, with fixed `0.92 / 0.82` scores and the string `Independent <role> review`. This is a **synthetic automated vote generator**, not actual LLM expert judgment. The existing run/manager types do not record verified model execution IDs for those votes.

**Blocking issue:** [#202 — Replace synthetic auto-yes council with provenance-verified LLM reviewers](https://github.com/roronoazoroshao/FolderForge/issues/202). **Policy consequence:** No output from that fallback is eligible for A-PRODUCT/A-ARCH/A-SEC/A-QA quorum or any `AI_*_APPROVED` gate. Fallback may remain as `SIMULATED_LENSES` preview **only if labeled and fail-closed for approval**.

**Implementation gate:** Red test first (no configured provider → never approves; fake/duplicate/stale receipt rejected), then independently invoked provider adapter, digest and run identity verification, veto rules and exact SHA proof. Do **not** silently enable a provider or expose API keys. Until #202 evidence is attached, **`AI_PRE_REVIEWED / NOT_QUORATE` is the maximum substantiated state** for this repository's current built-in council.
