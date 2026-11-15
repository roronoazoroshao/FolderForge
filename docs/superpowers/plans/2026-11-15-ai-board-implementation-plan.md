# FolderForge — AI Review Board implementation plan

**Status:** underway in isolated branch. **Spec:** [Execution design](../specs/2026-11-15-ai-board-execution-design.md). **Task ledger:** [AI board workstream](../../../tasks/ai-review-board.md). **GitHub:** [#202](https://github.com/roronoazoroshao/FolderForge/issues/202).

## Implementation phases (test-first)

| Phase | Task IDs | What will be proven | Gate |
|---|---|---|---|
| ARB-P0 | ARB-001, ARB-002 | 8 profiles and fail-closed independent 2-round voting engine | ARB-C0 |
| ARB-P1 | ARB-003, ARB-004 | Real OpenAI provider port and explicit read-only CLI | ARB-C0 |
| ARB-P2 | ARB-005 | Existing AgentLoopRunner cannot auto-approve fake experts | ARB-C0 |
| ARB-P3 | ARB-006 | End-to-end model run on explicit key/clean checkout | ARB-C1 |
| ARB-P4 | ARB-007 | Full six-gate chain, signed receipt store and UI integration | ARB-C2/C3 |

### Evidence required to claim source PASS

1. Tests first: agent calls, unique remote IDs, peer blindness, cross-examination, quorum, role veto, stale digest, duplicate provider ID, no model, invalid API response, CLI sandboxed file access.
2. Focused Vitest and legacy agent loop regression; `npm run typecheck`, `npm run lint`, `npm run architecture:check`, `npm run docs:check`.
3. CI success at exact commit, review notes, no accidental worktree/production changes. Distinguish source/fake fetch tests vs real provider calls.
4. Report JSON contains hashes, provider/model IDs and role findings; no secret, no fabricated user test, no fake model response IDs.

### Execute on a clean isolated checkout

```bash
# Read-only dry run: writes NOT_QUORATE (no provider call, exit code 2).
npm run review:ai -- --stage GOAL --source-sha "$(git rev-parse HEAD)" \
  --artifact docs/strategy/FOLDERFORGE_NORTH_STAR_2027_2030.md \
  --out /tmp/ff-ai-goal-dryrun.json

# Actual review: explicit external API credential and model; 16 model requests per stage.
# This incurs model usage costs and transmits the selected artifact to the provider.
export OPENAI_API_KEY='<from your secret manager>'
export FOLDERFORGE_AI_BOARD_MODEL='<model-id-supported-by-your-API-account>'
npm run review:ai -- --stage GOAL --source-sha "$(git rev-parse HEAD)" \
  --artifact docs/strategy/FOLDERFORGE_NORTH_STAR_2027_2030.md \
  --out /tmp/ff-ai-goal-review.json --execute

# Continue ROADMAP only if GOAL state === APPROVED on the SAME source SHA; then SPEC, PLAN, TASK, PR.
npm run review:ai -- --stage ROADMAP --source-sha "$(git rev-parse HEAD)" \
  --artifact docs/strategy/FOLDERFORGE_NORTH_STAR_2027_2030.md \
  --previous /tmp/ff-ai-goal-review.json --out /tmp/ff-ai-roadmap-review.json --execute
```

Do **not** put credentials in shell history, tracked docs, `.env` committed to Git, report files or CI logs. The sample uses placeholder text intentionally; no key was created or installed as part of this plan.

### Rollback and safety

Rollback entire AI board as one separate branch; legacy loop continues to require explicit manual review. Never remove or rewrite live isolation state; host disk is near full and issue #118 remains gated. No auto-merge/publish or process restart.
