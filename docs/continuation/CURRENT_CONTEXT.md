# FolderForge — Rolling Session Context

**CONTEXT_ID:** `FF-RECURSIVE-01/STATE`  
**CHECKED:** 2026-11-23 Asia/Ho_Chi_Minh; GitHub and authorized FolderForge reads  
**GOAL:** `C0-GATE-RECONCILIATION` (docs-only prerequisite)  
**STATUS:** `BLOCKED_SECURITY_REVIEW` for C0; this documentation change requires PR review. PR #212's historical `BLOCKED_REVIEW` is superseded.  
**MASTER:** [MASTER_PROMPT.md](MASTER_PROMPT.md)

## Verified checkpoint at source baseline
- GitHub `main@567ce3f4974a011e90625693793d23a82347d447` contains [PR #212](https://github.com/roronoazoroshao/FolderForge/pull/212), merged on 2026-11-23 from head `a959fd777d1b84a3c9fc3a89dae6bdec314bcd16`. Post-merge [Actions #45204690187](https://github.com/roronoazoroshao/FolderForge/actions/runs/45204690187): **7/7 jobs SUCCESS** on that main SHA. Prior `BLOCKED_REVIEW` described the **pre-merge** state.
- PR #212 had one author-connected `COMMENTED` review, **zero independent APPROVED reviews**, and a recorded **one-time docs-only owner exception**. It does not authorize this or another PR.
- [PR #211](https://github.com/roronoazoroshao/FolderForge/pull/211) OPEN/unmerged; ADR-0013 remains proposed. Its head `37616fb` has 7/7 successful check runs, but **zero submitted reviews or review threads**. [PR #200](https://github.com/roronoazoroshao/FolderForge/pull/200) and [#203](https://github.com/roronoazoroshao/FolderForge/pull/203) are CLOSED without merge; prototype code is not main.
- [Issue #118](https://github.com/roronoazoroshao/FolderForge/issues/118) remains OPEN. PR #117 (R11/R15) and PR #124 (R16) **were merged into source**, but `src/isolation/worktree-manager.ts` documents no production `withLegacyWritersFenced` coordinator. Mutating reconcile/restore needs a durable external old-writer fence; locks, CAS, disposable UID tests do **not** establish a production boundary. Qualified independent review, kernel fence, cross-process restart/fault and off-host restore evidence remain missing.
- [Issue #202](https://github.com/roronoazoroshao/FolderForge/issues/202) OPEN; synthetic council votes, closed prototype #203 and self-commentary do not constitute independent approval.
- FolderForge workspace `/home/devops/FolderForge`: `danger` policy, capsule enforcement `optional` with 0 active capsules; local `feat/ua002-trusted-context-20261117` clean. 25 managed isolation records and one stash preserved. Read-only capacity: **67G** disk available, roughly **1.0GiB** RAM available, swap **4.0/4.0GiB used**. No heavy host suite, registry mutation, cleanup or migration.

## Next smallest unblockers
1. Obtain independent qualified #118 review and owner-authorized effective host writer-epoch fencing, cross-process crash/restart/rollback and off-host restore proof. **C0 operational HOLD** until evidence exists.
2. Separately implement a **disposable-only** stale-writer/rollback fault negative fixture in a small RED→GREEN PR; never exercise live metadata.
3. Only conditionally progress **UA-002 / M1 / C1 / UA-AC02** with persisted trusted grants and forged/stale/revoked identity denial. Draft #200's frozen DTO lacks authoritative `grantId` and registry-issued identity; do not adopt it as an authorization mechanism.
4. This docs-only increment still requires exact-final-HEAD CI and authentic independent review; without them **preserve PR/branch and report BLOCKED**, never reuse #212's exception.

**Precedence:** [AGENTS.md](../../AGENTS.md), [Goal Map](../strategy/UNIVERSAL_AGENT_GOALMAP_2026-11-15.md), [Roadmap](../strategy/UNIVERSAL_AGENT_ROADMAP_2026-11-15.md), [Task Ledger](../../tasks/universal-agent-todo.md), [UA-002 Handoff](../handoffs/NEXT_SESSION.md). Refetch; do not extrapolate.
