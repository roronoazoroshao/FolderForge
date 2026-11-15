# AI Review Board — Decision record 2026-11-15

**Scope of this decision:** govern review and approval of FolderForge v2 Vision, Spec, Plan, Tasks and source PR quality with **AI agents as principal reviewers and decision-makers**.

**Origin of delegation:** project owner explicitly indicated on 2026-11-15 that AI specialist agents, not humans playing mandatory reviewer roles, should make review and design decisions. This is **scope delegation**, not permission to bypass OS privileges, access secrets, merge without repository rights or perform destructive production operations.

**Policy:** [AI Review Board Governance](../governance/AI_REVIEW_BOARD_POLICY_2026-11-15.md). **Tracking:** [#201](https://github.com/roronoazoroshao/FolderForge/issues/201). **PR:** [#200](https://github.com/roronoazoroshao/FolderForge/pull/200).

## Ruling

- **ADOPTED AS GOVERNANCE DIRECTION:** AI agents are the primary reviewers; valid AI-board decision can close G-DESIGN/G-ARCH/G-UX-plan/G-QA/G-MCP without a mandatory human-specialist review. AI chair must verify provenance and voting quorum.
- **SECURITY REALITY:** AI can block unsafe authority designs and decide engineering approach, but it cannot create owner-level OS permission or certify unperformed isolation tests. Production and destructive operations remain separately permission-gated.
- **NO EXTERNAL AGENTS RUN IN THIS DECISION:** Current tooling has not produced separate LLM reviewer invocation receipts; the earlier 8 roles were one model's analysis. This record has **one AI coordinator**, not an eight-agent voting quorum.
- **CURRENT SPEC/PLAN VERDICT: NOT APPROVED.** Prior findings RV-01/02 remain open (Spec/WorkspaceContext mismatch; path-hash ID migration semantics); other runtime/security/UX evidence gaps remain.
- **TASKS TO IMPLEMENT ACTUAL AGENT REVIEW:** provision separate model execution contexts, build evidence manifest+receipt validation, route independent reviewer prompts, implement veto/quorum calculator, store decision records, then run all 8 roles on an immutable SHA. Do not count simulated role paragraphs.

## Explicit authority ledger

| Gate | Decision-maker | Status 2026-11-15 |
|---|---|---|
| G-DESIGN / G-ARCH / G-QA / G-UX-plan / G-MCP | Quorate AI Review Board | **NOT_QUORATE** |
| G-MERGE technical verdict | Quorate AI Board + actual CI | **HOLD**; no independent receipts |
| G-SEC authority design | A-SEC veto + real security test evidence | **HOLD** |
| G-PROD and destructive changes | Operator with actual permissions; AI can veto/recommend | **NOT AUTHORIZED** |

**Next evidence gate:** one recorded 8-agent (or ≥6 eligible) run with separate invocation IDs, exact input SHA, full findings, machine-checkable test evidence and a re-review after resolving blocking findings. `CI success` alone does not satisfy this gate.
