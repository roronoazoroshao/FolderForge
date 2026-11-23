# ADR-0013: Governed Browser Capability Backends and Admission

- **Status:** **Proposed — pending authentic independent security/architecture review; NOT accepted/implemented**.
- **Date:** 2026-11-23 (Asia/Ho_Chi_Minh).
- **Main source baseline:** `599473dec46bddcabda618223d5ec7636261b5ef` — https://github.com/roronoazoroshao/FolderForge/commit/599473dec46bddcabda618223d5ec7636261b5ef
- **Decision owner:** Pending; this ADR does not impersonate an owner decision or human/independent agent vote.
- **Related:** `docs/superpowers/specs/2026-11-23-browser-capability-backends-design.md`; `docs/superpowers/plans/2026-11-23-browser-capability-backends.md`; ADR-0011 (Capsules), ADR-0006 (Audit durability), ADR-0007 (Evidence), canonical UA AC02/03/04/09/10/11/14/15.

## Context

FolderForge already uses `@playwright/mcp@0.0.84` (lockfile), `playwright-core@1.64.1` (lockfile), typed `browser_*` wrappers, ToolRegistry policy/audit and child-MCP lifecycle. It lacks a **demonstrated** full per-agent OS/profile/egress security boundary and an executed security-negative browser suite. The `browser_open` source permits `file:` and loopback URLs and defers external-url restriction in `danger` mode; `ShapingProxy` forwards HTTP(S)/CONNECT without origin/IP ACL in inspected code. Neither the default Playwright MCP `--isolated` flag nor tool-level URL filtering establish complete browser network containment.

Owner goals require browser observation/action, reproduction and repair, grant-specific policy and evidence, but forbid bypassing authentication barriers, CAPTCHA, restrictions or rate limits. The current host has 24 managed isolation records, 22 unverifiable and 2 missing-worktree, plus open writer-fencing issue #118 and synthetic-reviewer issue #202. BR-001 is documentation research only.

## Decision (proposed)

1. Keep **Microsoft Playwright MCP** as the existing, **default** reference backend at its present committed dependency versions. Preserve current tool names, output shape and normal behavior. No global replacement and no BR-001 dependency modification.
2. **Policy before engines:** BR-002 establishes negative tests for destinations, redirects, popups, frames, subresources, WebSockets, downloads, profiles, revocation and trusted grant ownership. Real worker egress and OS isolation are security prerequisites, not new backend features.
3. **Do not build a generic plugin system proactively.** BR-003 may introduce a minimal internal `BrowserBackend` port only if adapters require a shared seam; otherwise reuse `ToolRegistry` and `ChildMcpRegistry`. The policy, audit, secret/redaction, source proof and session admission logic must remain common; a backend cannot declare itself trusted.
4. Every browser session is bound server-side to `principalId + workspaceId + capsuleId + grantId + grantRevision + operationId` and a verified OS-isolated worker with distinct writable profile, storage, cookie jar, downloads and credentials. `danger` cannot enlarge browser egress grants. Fail closed when network/process isolation cannot be enforced.
5. Experiment with **at most one** forked Playwright runtime at a time, with **Patchright** as a bounded candidate and **Rebrowser Playwright** a comparison alternative. Evaluate exact package tarballs/versions, build/OS support, regression/security matrix and performance against unchanged baseline. Only an owner-authorized disposable worker may execute experiments.
6. **Camoufox** is deferred because its inspected TypeScript binding documents a `playwright-core` peer below 1.63, conflicting with FolderForge's 1.64.1, and requires separate modified Firefox binary assurance; **Lightpanda** is deferred for AGPL-3.0, maturity/compatibility and binary/security review.
7. **Stagehand** may later contribute one structured agentic browser action/extraction vertical slice; **Browser Use** is research/reference only and must not import an unscoped Python REPL, cloud defaults or second autonomous control plane; **Crawlee** is deferred until a bounded crawl use case exists.
8. An optional backend is disabled by default and explicitly reports `available`, `enabled`, `denied`, `unavailable` or `degraded` based on observed health. Claims of stealth/evasion effectiveness are out of scope.

## Reasons

- The greatest present risk is **cross-principal authority and network escape**, not missing browser features; adding another executable before closing this boundary increases blast radius.
- Existing Playwright already offers the primary DOM, accessibility, interaction and visual evidence surfaces. New dependencies should earn adoption by a measured improvement on controlled tasks.
- An adapter seam behind existing tools lets later runtimes share policy/audit/proofs without exposing a second path to host authority.
- Source SHA and license do **not** prove safe distribution binaries; no third-party npm package or modified browser download has passed supply-chain admission.

## Alternatives considered and rejected/deferred

| Alternative | Disposition | Why |
| --- | --- | --- |
| Replace `@playwright/mcp` or `playwright-core` globally with Patchright/Rebrowser | Rejected | Breaks locked reference; security/compatibility not established; unnecessary second fork surface. |
| Vendor/fork modified Chromium or Firefox | Rejected | License, binary provenance, maintenance and rollback obligations exceed verified benefit. |
| Stagehand/Browser Use as the control plane | Rejected | Duplicates existing owner grant, audit and Observe→Act→Verify→Repair orchestration. |
| Enforce only a `browser_open` URL regex/allowlist | Rejected | Misses browser-initiated traffic, DNS/IP changes and process egress. |
| Treat `--isolated`, worktree, cwd, child MCP or container label as sufficient sandbox | Rejected | Requires independent OS/network confinement and negative runtime evidence. |
| Cloud browser as implicit trusted capsule | Rejected | Provider execution and credentials require separate explicit contract and independent scope enforcement. |
| No future optional backend | Conditional | Acceptable until a measured requirement needs one; not ruled out permanently. |

## Consequences

**Positive:** compatibility is preserved; blast radius and maintenance scope remain small; status/proofs become truthful and reviewable; controlled experiments can test actual utility. **Costs:** additional grant-freshness/egress policy, OS fixtures, profile/process lifecycle and independent review; optional backends may remain unavailable on unsupported platforms. **Tradeoff:** no performance/evasion gains claimed until reproduced; `browser_eval` remains independently HIGH-risk.

## Verification and reversal

1. BR-001: inspect exact main and upstream SHA/license/package receipts; receive qualified architecture/security review on this ADR and companion plan. No test execution asserted.
2. BR-002: run source-level red/green and **real isolated browser** negative test matrix, including subprocess traffic, file/private-network refusal, redirect/frame/popup/WS, profile storage and grant revocation. Record FAIL/UNKNOWN for unsupported scenarios.
3. BR-003: only if needed, change minimal adapter port with existing Playwright regression and status/unavailable tests; CI on exact final PR SHA.
4. BR-004+: compare one opt-in alternative with pinned source and binary hashes, no default behavior change, CI and independent security review.
5. **Rollback:** disable experimental backend flag and stop/destroy only its disposable worker/profile under approved recovery procedures; preserve original locked Playwright and its tests; never delete managed recovery worktrees as a shortcut.

## References inspected (exact source)

- FolderForge [`src/tools/browser-tools.ts`](https://github.com/roronoazoroshao/FolderForge/blob/599473dec46bddcabda618223d5ec7636261b5ef/src/tools/browser-tools.ts), [`src/browser/network-proxy.ts`](https://github.com/roronoazoroshao/FolderForge/blob/599473dec46bddcabda618223d5ec7636261b5ef/src/browser/network-proxy.ts), [`src/tools/registry.ts`](https://github.com/roronoazoroshao/FolderForge/blob/599473dec46bddcabda618223d5ec7636261b5ef/src/tools/registry.ts).
- [Playwright MCP@2337aff0](https://github.com/microsoft/playwright-mcp/commit/2337aff0213d28db41d3e3daf48cee19b3d0bd82), [Patchright@521ad98a](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright/commit/521ad98adbb35e09c135864058428b117bf47be8), [Patchright Node@a2e746c](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright-nodejs/commit/a2e746cdea6d29d4ef53176ac979e63fdab6fbbf).
- [Camoufox@f24d59ce](https://github.com/daijro/camoufox/commit/f24d59ce091bb6a8abdb69a9a1943cba501020e9), [Browser Use@753d629d](https://github.com/browser-use/browser-use/commit/753d629d76eb2b670f4cf467f3355bbe750f6845), [Rebrowser@caecbe31](https://github.com/rebrowser/rebrowser-playwright/commit/caecbe312404121e70a4e3f894b21eb9fb645a53), [Stagehand@3bedd822](https://github.com/browserbase/stagehand/commit/3bedd822f2e31c6716added7743179405985a439), [Crawlee@377c7a49](https://github.com/apify/crawlee/commit/377c7a4943f1856119e66ff448ffc669f1cd0be2), [Lightpanda@8dae37d6](https://github.com/lightpanda-io/browser/commit/8dae37d688a866f67e3b67e7b14ab33eee35e60d).

**Final ADR state:** **PROPOSED / UNREVIEWED**; not independent `APPROVED`, no runtime changes, no PR, no CI for these proposed documents.