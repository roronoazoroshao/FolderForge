# FolderForge — Rolling Session Context

**CONTEXT_ID:** FF-RECURSIVE-01/STATE  
**CHECKED:** 2026-11-24 Asia/Ho_Chi_Minh (pre-commit)  
**GOAL:** UA-001 / M0 / C0 disposable process interruption fixture  
**STATUS:** IN_PROGRESS; proposed test awaiting exact-head execution and review. Operational C0 HOLD.

- Canonical main before this change: `567ce3f4974a011e90625693793d23a82347d447`, PR #212 merged; exact main check runs 7/7 SUCCESS. Previous BLOCKED_REVIEW snapshot is historical.
- PR #214 governance draft `9948a0b0ace892cdf72b061a69fbedc68629f703`, CI observed 3/7 success, 4 running, zero reviews. Not adopted. Proposal omits G8 from stated goal preservation; retain G1–G8.
- PR #213 `2584e62db66092eae65244bdd0e676a6e318efe8` and #211 `37616fbecd7abffa66e288684028a56db2c23ce4`: 7/7 exact-head checks, zero reviews; preserve both HEADs. Reconcile overlapping continuation text only through reviewed integration. No reuse of #212 exception.
- #118 (host writer fencing/recovery) and #202 (synthetic reviewers) remain OPEN. FolderForge MCP Session terminated; workspace, local refs/stashes, capsule, effective policy, host capacity and recovery UNKNOWN. GitHub rulesets []; protection detail 403. No production change.
- Fixture scope: `tests/unit/worktree-manager.test.ts` plus stable handoff files. Real child kills itself at beforeUntrackedCopy after tracked apply and durable applying journal; restart must refuse rollback while lock remains and preserve journal, patch, bytes and refs. Linux/macOS only. No production registry/lock removal. Local synthetic Node harness verified SIGKILL and exclusive lock EEXIST; actual FolderForge test not run locally (no checkout/network). Test-only, no product behavior change; RED/GREEN unverified. Obtain exact-head CI and focused output before claims.
- Audit: UA-001 baseline source integrated/tested historically, full C0 not passed; UA-002–018 unproven as complete; no new AC or milestone PASS. Main master revision remains 4 until reviewed integration.

**Next:** prefer eligible #214 governance review/integration; otherwise finish the disposable fixture on its own draft PR (CI, review, authorized merge and safe branch deletion). Then reconcile #213/#211 without rewriting their green HEADs. UA-002 persisted owner grant and C1 depend on applicable gates; no live authority. Rollback by reviewed revert if integrated, otherwise preserve draft. No unattended execution.
