# BR-001 — Browser Capability Backends: Source Review and Proposed Design

- **Date:** 2026-11-23, Asia/Ho_Chi_Minh.
- **Status:** `PARTIAL / PROPOSED / UNREVIEWED`; not `DONE`, `APPROVED`, `SOURCE_TESTED`, `E2E_VERIFIED`, `MERGED_MAIN`, or `LIVE_VERIFIED`.
- **Goal:** a trustworthy, owner-controlled browser capability layer for Observe → Act → Verify → Repair. This is research/design only; **no browser runtime change is authorized in BR-001**.
- **Repository:** https://github.com/roronoazoroshao/FolderForge
- **Exact inspected main:** [`599473dec46bddcabda618223d5ec7636261b5ef`](https://github.com/roronoazoroshao/FolderForge/commit/599473dec46bddcabda618223d5ec7636261b5ef).
- **Companions:** `docs/adr-0013-browser-capability-backend-admission.md`; `docs/superpowers/plans/2026-11-23-browser-capability-backends.md`; canonical [Goal Map](https://github.com/roronoazoroshao/FolderForge/blob/599473dec46bddcabda618223d5ec7636261b5ef/docs/strategy/UNIVERSAL_AGENT_GOALMAP_2026-11-15.md), [Roadmap](https://github.com/roronoazoroshao/FolderForge/blob/599473dec46bddcabda618223d5ec7636261b5ef/docs/strategy/UNIVERSAL_AGENT_ROADMAP_2026-11-15.md), [architecture spec](https://github.com/roronoazoroshao/FolderForge/blob/599473dec46bddcabda618223d5ec7636261b5ef/docs/superpowers/specs/2026-11-15-universal-agent-work-environment-design.md), [UA task ledger](https://github.com/roronoazoroshao/FolderForge/blob/599473dec46bddcabda618223d5ec7636261b5ef/tasks/universal-agent-todo.md).

## 1. Evidence and scope rules

**Labels:** `FRESH_SOURCE` = read from exact GitHub commit or a read-only live host result in this session; `HISTORICAL` = prior user snapshot; `PROPOSAL` = design/test target not yet implemented; `UNKNOWN` = evidence absent; `NOT_RUN` = no runtime test/build/installation. A pinned repository SHA is **source provenance**, not verification of release binary signatures or an npm/PyPI distribution tarball. A recent upstream commit is not proof of a sustainable release cadence.

**BR-001 execution boundary:** remote GitHub and FolderForge were read-only; no upstream code or install scripts executed; no production/recovery/worktree changes; no source/runtime tests; no new browser binary; no documentation PR. The attached files are a proposed, copy-ready artifact pending qualified review. An independent review must be a genuine, identifiable nonauthor review under applicable policy, not self-attestation or the known synthetic council issue #202.

## 2. Refreshed local and repository baseline

| Item | Evidence and conclusion |
| --- | --- |
| GitHub canonical | `main@599473dec46bddcabda618223d5ec7636261b5ef` (`FRESH_SOURCE`). |
| Local `/home/devops/FolderForge` | Branch `feat/ua002-trusted-context-20261117` at `b51334fea35679cc51ea8e2b3ac43c008882a0c8`; clean; `origin/main` matches GitHub main; `origin/main` is ancestor of local HEAD (`FRESH_SOURCE`). **Not** a BR-001 scratch branch. |
| Existing worktrees | 40, 39 detached; 24 active managed records: 22 `ISOLATION_HEALTH_UNVERIFIABLE`, 2 `ISOLATION_WORKTREE_MISSING` (`FRESH_SOURCE`). Do not clean/reconcile. |
| Host capacity | `/dev/sda2`: 457G total, 353G used, **81G available**; RAM ~4.9Gi available and swap ~3.5/4 Gi in use at inspection (`FRESH_SOURCE`). No concurrency admission proof. |
| Host policy and capsules | `mode=danger` (can bypass tool approvals), `capsule enforcement=optional`, no bound capsule reported (`FRESH_SOURCE`). **Not** authorization for root or proof of OS isolation. |
| GitHub status | No open PR results returned; #118 OPEN (writer fencing/recovery), #202 OPEN (synthetic reviewers), PR #208 CLOSED/UNMERGED (`FRESH_SOURCE`). Applicable branch protection and independent approval waiver `UNKNOWN`; search results are not a protection-policy query. |
| Documentation race | Both proposed 2026-11-23 spec/plan paths absent from inspected `main`; no current active plan ownership was established beyond absence of an open PR. Recheck before any future write. |
| CI | Historical main merge message describes prior CI state. No BR-001 PR or exact BR-001 head exists; GitHub combined-status lookup returned no statuses and the commit-workflow lookup only searches PR-triggered runs. Therefore **current main full CI outcome UNKNOWN**, **BR-001 CI NOT_RUN**. |

### Browser baseline: exact inspected source

- [`package.json`](https://github.com/roronoazoroshao/FolderForge/blob/599473dec46bddcabda618223d5ec7636261b5ef/package.json): `@playwright/mcp` declared `^0.0.84`, `playwright-core` declared `1.64.1`. [`package-lock.json`](https://github.com/roronoazoroshao/FolderForge/blob/599473dec46bddcabda618223d5ec7636261b5ef/package-lock.json) locks `@playwright/mcp@0.0.84` and `playwright-core@1.64.1`; an upstream newer release does not change this lock.
- [`src/adapters/child-mcp/resolve.ts`](https://github.com/roronoazoroshao/FolderForge/blob/599473dec46bddcabda618223d5ec7636261b5ef/src/adapters/child-mcp/resolve.ts): package-local Playwright MCP resolution and default `--isolated`; existence of this flag is not OS/egress confinement.
- [`src/adapters/child-mcp/registry.ts`](https://github.com/roronoazoroshao/FolderForge/blob/599473dec46bddcabda618223d5ec7636261b5ef/src/adapters/child-mcp/registry.ts): child lifecycle, retry/backoff, health state, diagnostics; [`risk-map.ts`](https://github.com/roronoazoroshao/FolderForge/blob/599473dec46bddcabda618223d5ec7636261b5ef/src/adapters/child-mcp/risk-map.ts) pessimistic fallback for unrecognized subtools. Reuse, do not create a second privileged MCP dispatcher.
- [`src/tools/registry.ts`](https://github.com/roronoazoroshao/FolderForge/blob/599473dec46bddcabda618223d5ec7636261b5ef/src/tools/registry.ts): classification, capsule check, policy/approval, rate limits and audit per registered call. The present `ToolPrincipal` type does not itself supply the full proposed `workspaceId + grantId + grantRevision` tuple.
- [`src/tools/browser-tools.ts`](https://github.com/roronoazoroshao/FolderForge/blob/599473dec46bddcabda618223d5ec7636261b5ef/src/tools/browser-tools.ts): `browser_open`, snapshot, click, type, console, network, screenshot, viewport, visual compare, accessibility audit, emulation, bounded `browser_flow_run`, `browser_close`, HIGH-risk `browser_eval`. Composed flow dispatches each allowed step through ToolRegistry; arbitrary eval is excluded from the flow allowlist. Screenshots can become content-addressed artifacts.
- [`src/browser/emulation-manager.ts`](https://github.com/roronoazoroshao/FolderForge/blob/599473dec46bddcabda618223d5ec7636261b5ef/src/browser/emulation-manager.ts) and [`network-proxy.ts`](https://github.com/roronoazoroshao/FolderForge/blob/599473dec46bddcabda618223d5ec7636261b5ef/src/browser/network-proxy.ts): device/viewport/UA and loopback proxy *shaping*. Network-shaping latency/bandwidth/offline support must not be represented as firewall enforcement.
- [`src/setup/browser.ts`](https://github.com/roronoazoroshao/FolderForge/blob/599473dec46bddcabda618223d5ec7636261b5ef/src/setup/browser.ts): explicit browser setup, dry run and opt-in package-compatible Chromium download; no automatic download on ordinary installation as documented by source.
- Inspected existing tests: `tests/unit/browser-tools.test.ts`, `browser-flow.test.ts`, `browser-quality.test.ts`, `browser-emulation.test.ts`, `browser-setup.test.ts`; there are unit/mock/emulation assertions but **no freshly run live browser cross-agent containment proof** from this session.

## 3. Admission matrix (pinned exact upstream source)

The dispositions classify whether to **use an existing foundation**, **study/adapt patterns**, or **consider a future runtime**. `ADAPT` does not imply installation or production acceptance. All version/OS/dependency claims below are documentation/source observations, not measured compatibility.

| Candidate; exact inspected SHA (UTC date) | License/source | Runtime, compatibility and concrete advantage | Risks, outstanding proof and disposition |
| --- | --- | --- | --- |
| [Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp/commit/2337aff0213d28db41d3e3daf48cee19b3d0bd82) `2337aff0213d28db41d3e3daf48cee19b3d0bd82` (2026-11-18) | [Apache-2.0](https://github.com/microsoft/playwright-mcp/blob/2337aff0213d28db41d3e3daf48cee19b3d0bd82/LICENSE); [package.json](https://github.com/microsoft/playwright-mcp/blob/2337aff0213d28db41d3e3daf48cee19b3d0bd82/package.json) reports v0.0.86 and Node >=20. | Node, Playwright-driven Chromium and structured MCP observation/action; **already wired** through FolderForge. Existing lock v0.0.84 remains canonical reference. | Must still prove per-agent process, redirects, subresources, network, storage, downloads and proof redaction. Treat file/origin CLI flags as defense-in-depth, not a security boundary. **ADOPT existing locked baseline; do not upgrade in BR-001.** |
| [Patchright](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright/commit/521ad98adbb35e09c135864058428b117bf47be8) `521ad98adbb35e09c135864058428b117bf47be8` (2026-11-12) | [Apache-2.0](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright/blob/521ad98adbb35e09c135864058428b117bf47be8/LICENSE). [README](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright/blob/521ad98adbb35e09c135864058428b117bf47be8/README.md) links separate Node/Python implementations. | Playwright-related browser automation; potentially narrow adapter compatibility experiment, not required for ordinary UX tests. | **Separate Node package source** [patchright-nodejs@a2e746c](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright-nodejs/commit/a2e746cdea6d29d4ef53176ac979e63fdab6fbbf). Node tarball provenance, version compatibility, install/postinstall, browser binary, support matrix, profile isolation and egress remain unverified. No anti-bot claim accepted. **EVALUATE**, opt-in only after BR-002/003. |
| [Camoufox](https://github.com/daijro/camoufox/commit/f24d59ce091bb6a8abdb69a9a1943cba501020e9) `f24d59ce091bb6a8abdb69a9a1943cba501020e9` (2026-11-22) | Engine [MPL-2.0](https://github.com/daijro/camoufox/blob/f24d59ce091bb6a8abdb69a9a1943cba501020e9/LICENSE), TypeScript and Python bindings each [MIT](https://github.com/daijro/camoufox/blob/f24d59ce091bb6a8abdb69a9a1943cba501020e9/typescript/LICENSE). | Modified Firefox with TypeScript/Python launchers; local/dedicated browser runtime and additional OS/headless dependencies for some modes. | [TypeScript README](https://github.com/daijro/camoufox/blob/f24d59ce091bb6a8abdb69a9a1943cba501020e9/typescript/README.md) documents `playwright-core` peer **below 1.63**, conflicting with FolderForge 1.64.1; `camoufox fetch` pulls separate binary; transitive/copy obligations and OS support need review. Distinct build, binary and resource footprint, not yet measured. **DEFER** direct adoption. |
| [Browser Use](https://github.com/browser-use/browser-use/commit/753d629d76eb2b670f4cf467f3355bbe750f6845) `753d629d76eb2b670f4cf467f3355bbe750f6845` (2026-11-22) | [MIT](https://github.com/browser-use/browser-use/blob/753d629d76eb2b670f4cf467f3355bbe750f6845/LICENSE); [pyproject.toml](https://github.com/browser-use/browser-use/blob/753d629d76eb2b670f4cf467f3355bbe750f6845/pyproject.toml) v1.0.8; Python >=3.11. | Python/Pydantic AI, persistent REPL/CDP browser agent, cloud or local Chromium; interesting agent observation/repair patterns. | Python runtime and second agent orchestration would increase trust surface. README says domain guard is *not* sandbox and page resources may escape domain scope; local vs cloud defaults, credentials and telemetry need explicit selection. Hosted cloud not assumed open-source. **ADAPT ideas only later; DEFER runtime now.** |
| [Rebrowser Playwright](https://github.com/rebrowser/rebrowser-playwright/commit/caecbe312404121e70a4e3f894b21eb9fb645a53) `caecbe312404121e70a4e3f894b21eb9fb645a53` (2026-11-02) | [Apache-2.0](https://github.com/rebrowser/rebrowser-playwright/blob/caecbe312404121e70a4e3f894b21eb9fb645a53/LICENSE); [package](https://github.com/rebrowser/rebrowser-playwright/blob/caecbe312404121e70a4e3f894b21eb9fb645a53/package.json) v1.64.102, Node >=20, depends on `rebrowser-playwright-core@1.64.102`. | Familiar Node/Playwright forked interface; experimental alternative to Patchright for special browser behavior. | Independently patched runtime and dependencies; do not install it **as well as** Patchright for same requirement. Compare once in mutually exclusive controlled matrix. Lock, supply chain, OS/engine coverage, security remain untested. **EVALUATE, alternative only.** |
| [Stagehand](https://github.com/browserbase/stagehand/commit/3bedd822f2e31c6716added7743179405985a439) `3bedd822f2e31c6716added7743179405985a439` (2026-11-21) | [MIT](https://github.com/browserbase/stagehand/blob/3bedd822f2e31c6716added7743179405985a439/LICENSE); root [package](https://github.com/browserbase/stagehand/blob/3bedd822f2e31c6716added7743179405985a439/package.json) v4.0.0, Node >=22.18. | TypeScript/other SDKs, local Chrome via `localBrowser`, structured act/observe/extract; hosted Browserbase is optional/separate. Useful for agentic action strategy without replacing control plane. | Prompt-injection exposure, LLM/model call cost, unsafe profile reuse (`userDataDir` examples), local Chrome dependency, provider secrets and model provenance. Need versioned SDK package review, typed gated calls, resource testing. **ADAPT one future vertical slice after BR-002/003.** |
| [Crawlee](https://github.com/apify/crawlee/commit/377c7a4943f1856119e66ff448ffc669f1cd0be2) `377c7a4943f1856119e66ff448ffc669f1cd0be2` (2026-11-20) | [Apache-2.0](https://github.com/apify/crawlee/blob/377c7a4943f1856119e66ff448ffc669f1cd0be2/LICENSE.md); Node/TypeScript [package.json](https://github.com/apify/crawlee/blob/377c7a4943f1856119e66ff448ffc669f1cd0be2/package.json). | Playwright/Puppeteer crawling, request queues, retries, datasets and session management. Adds value for permitted broad extraction tasks, not ordinary single-site browser QA. | Queue expansion, proxy rotation, storage growth, origin traversal, compliance and concurrency quotas; must be bounded and owner-authorized. GitHub README language about human-like browsing is not an evasion guarantee. **DEFER.** |
| [Lightpanda](https://github.com/lightpanda-io/browser/commit/8dae37d688a866f67e3b67e7b14ab33eee35e60d) `8dae37d688a866f67e3b67e7b14ab33eee35e60d` (2026-11-23) | [AGPL-3.0](https://github.com/lightpanda-io/browser/blob/8dae37d688a866f67e3b67e7b14ab33eee35e60d/LICENSE); Zig browser + CDP/WebDriver BiDi. | Headless alternative for speed/resource investigation, Linux/macOS binaries advertised, Windows via WSL rather than native Windows. | AGPL network/distribution and modification review, nightly binary integrity, compatibility gaps, telemetry default, MCP session IDs do not represent trusted principal ownership. Vendor speed claims unmeasured. **DEFER separate legal/functional study.** |

### Additional admission ledger — status across mandatory dimensions

Each candidate above has a verified **repository URL**, **commit SHA**, **top-level license file**, and at least one inspected source/package/README; a fresh last-commit timestamp provides only a **maintenance signal**. The following are **not yet admitted for any new backend**:

| Required dimension | Current evidence | Gate before `ADOPT` as new runtime |
| --- | --- | --- |
| Transitive license compatibility and notices | `UNKNOWN`; package/engine top-level license is not complete transitive review | Produce pinned dependency graph, license SBOM, attribution and copyleft counsel review (especially Camoufox/Lightpanda). |
| Source/binary integrity | Upstream source SHA `FRESH_SOURCE`; npm/PyPI tarball hashes, browser release signature, installer scripts `UNKNOWN` | Pin precise package versions, integrity hashes, provenance/attestation when available; do not run unreviewed postinstall, scripts or automatic binary downloads. |
| Release cadence | Recent commit dates above, per-repo release support policy `UNKNOWN` | Record last stable tags, changelog, issue responsiveness and breakage notices before adopting. |
| Runtime and supported OS | Source README/package-level claims only; full OS/engine matrix `UNKNOWN` | Linux/macOS/Windows + Node 22/24 where claimed; execute approved fixture and document unsupported cells as unavailable. |
| MCP/adapter contract | Playwright existing: source wrappers present. Other candidates: `UNKNOWN` | Keep same ToolRegistry policy/audit entry; typed, version-pinned adapters; no arbitrary child delegation. |
| Per-agent profile, cookies, credentials | `UNKNOWN` as security boundary for all runtimes | Two authenticated principals with disjoint writable profile dirs, process/OS roots, cookie/storage/credentials; negative tests after revocation/crash. |
| Network policy | `UNKNOWN` for backend enforcement; source shows present FF shaping is not network ACL | Kernel/container egress and DNS/IP controls for browser process; validate redirects, websocket, subresources, service workers and downloads. |
| CPU/RAM/disk/startup | `NOT_RUN` / `UNKNOWN`; no measurements | Reproducible controlled same-host benchmark, p50/p95, high-water RSS, process/FD limits, disk deltas, concurrency admission. |
| Recovery and rollback | Design only; code/CI/uninstall proof `NOT_RUN` | Forced crash, lost worker, orphan profile/process cleanup, no residual auth, reversible disable without changing Playwright baseline. |
| Competitive advantage | Vendor claims not accepted; no FolderForge A/B result | Demonstrate at least one controlled positive metric while passing every negative security gate. |

## 4. Existing policy gap register (threat-oriented, not exploit certification)

| ID | Severity hypothesis | Fresh source observation | Test oracle / required mitigation |
| --- | --- | --- | --- |
| BG-01 | P0 candidate | `browser_open` URL helper unconditionally permits `file:` and loopback hosts; no `grantId/grantRevision` evaluation in helper: [`browser-tools.ts#L174-L183`](https://github.com/roronoazoroshao/FolderForge/blob/599473dec46bddcabda618223d5ec7636261b5ef/src/tools/browser-tools.ts#L174-L183). | Deny file and any host including localhost unless explicit owner grant; prevent `0.0.0.0` wildcard destination; explicit tests in safe/dev/danger. Existing child MCP file flags may independently reject some requests: actual exploit status UNKNOWN. |
| BG-02 | P0 candidate | `browser_open` skips external URL restriction in `danger`: [`browser-tools.ts#L277-L290`](https://github.com/roronoazoroshao/FolderForge/blob/599473dec46bddcabda618223d5ec7636261b5ef/src/tools/browser-tools.ts#L277-L290). | `danger` cannot bypass invariant grant/network/credential restrictions; test positive authorized fixture and negative external target. |
| BG-03 | P0 candidate | Proxy forwards absolute HTTP/HTTPS and CONNECT host/port without origin/IP ACL in inspected handlers: [`network-proxy.ts#L153-L229`](https://github.com/roronoazoroshao/FolderForge/blob/599473dec46bddcabda618223d5ec7636261b5ef/src/browser/network-proxy.ts#L153-L229). | Deny private/loopback/link-local/metadata and ungranted public destinations at actual sandbox egress; verify DNS rebinding and proxies do not escape controls. Distinguish emulator mode from containment. |
| BG-04 | P1 | ToolRegistry enforces policy/audit for top-level actions, but `ToolPrincipal` presently lacks the complete server-owned grant tuple: [`src/core/types.ts`](https://github.com/roronoazoroshao/FolderForge/blob/599473dec46bddcabda618223d5ec7636261b5ef/src/core/types.ts) and [`registry.ts#L355-L660`](https://github.com/roronoazoroshao/FolderForge/blob/599473dec46bddcabda618223d5ec7636261b5ef/src/tools/registry.ts#L355-L660). | Recheck `principalId + workspaceId + capsuleId + grantId + grantRevision + operationId` before each action including continuation/retry; forged or stale grant denied. Dependency UA-002/003. |
| BG-05 | P0 candidate | `--isolated` child and capsule directory are not OS and network isolation; host currently reports `capsule enforcement=optional`. | Disable new multi-agent backend until workers have separately verified UID/process/net/storage/mount separation and no Docker-socket/host credential access. UA-004/005. |
| BG-06 | P1 | Initial `browser_open` check cannot cover links, redirects, popups, frames, JS fetch, service workers, WebSockets or page-triggered resource loading. | Controlled fixture with allow→deny redirect, frame/popup, fetch/WSS, DNS and service worker cases, no outbound contact to unapproved targets. |
| BG-07 | P1 | Screenshot/console/network output and trace may carry cookie, auth header, page secrets, PII. Artifact persistence does not itself prove redaction. | Sanitized evidence on all channels, scoped artifact retrieval, expiry, hashing and proof linkage; test seeded harmless canary secret and cross-agent access denial. |
| BG-08 | P1 | Per-principal browser profile, cookie and download/storage isolation not proven; emulation manager mutates named adapter configuration. | A/B agents with cookie and localStorage sentinels, storage path ownership, download target denial; stress two simultaneous sessions and crash restart without profile reuse. |
| BG-09 | P1 | Snapshot/ref and `browser_eval` expose untrusted page instructions and arbitrary page JavaScript respectively; risks differ by action. | Page text never confers authority; browser eval separately HIGH/owner-gated, no agent-crafted eval promoted through flow, never raw child MCP subtool bypass. |
| BG-10 | P1 | No live session-correlated DOM/screenshot/console/network/trace E2E proof in BR-001; existing unit suites predominantly mock adapters. | Real, owner-authorized fixture with per-action receipt and evidence timestamps/hashes; fail when screenshot is missing, console failure hidden, or test oracle fails. |
| BG-11 | P1 | Process lifecycle, backpressure, rate limits, revoke-in-flight and stale adapter health not validated as browser-specific guards. | Revoke A mid-navigation, terminate browser, run B, enforce per-capsule CPU/RAM/disk/FD/process quotas; report `unavailable/degraded/unknown` honestly. |

**Severity is provisional:** a source-local weakness is not an externally demonstrated exploit. Protection at a downstream layer may mitigate an individual path, but it must be shown through executed negative tests. Conversely, a clean unit test or external runtime with an isolated context does not independently establish OS confinement.

## 5. Recommended architecture and trust model (`PROPOSAL`)

**Selected:** preserve current locked **Playwright MCP** as the reference/default backend. Strengthen **policy and executor isolation first** (BR-002); add the smallest backend seam only when a second backend requires it (BR-003). Evaluate *either* Patchright *or* Rebrowser on identical controlled fixtures in a disposable, owner-authorized worker (BR-004), without global Playwright replacement. Camoufox and Lightpanda are independent later feasibility work. Stagehand is a candidate *strategy/action* adapter (BR-006), not a browser isolation provider or a substitute for the existing Observe→Act→Verify→Repair orchestrator.

```text
Authenticated principal + owner grant + immutable workspace/capsule context
    → ToolRegistry (risk/approval, grant freshness, audit, quota)
    → Browser capability broker (session binding; admission; policy decision)
    → OS-isolated, egress-restricted browser worker
       → Playwright MCP DEFAULT (or explicit backend opt-in, when proven)
    ← redacted DOM/a11y/console/network/screenshot/trace
    → content-addressed evidence + per-action receipt
    → verify / bounded repair / owner cancel / session close
```

**Crossing rules:** no raw page text, user-specified context field, child MCP tool, or imported agent runtime may define authorization. An owner grant must pin allowed origins, outbound destinations, downloads, file roots, profile scope, retention and resource limits. Network enforcement has to apply to *all traffic from the worker* (DNS/IP at connection time; redirects, frames, popups, scripts, websocket, proxy hops), not only URL strings at tool entry. If enforcement cannot be attached to a backend, report `unavailable` or `denied`, never fall back to unchecked host access.

**Minimum proposed interface; not shipped and may be reduced after BR-002:**

```ts
// Server-created, immutable; never accepted from page content or model arguments.
type BrowserAuthority = Readonly<{
  principalId: string;
  workspaceId: string;
  capsuleId: string;
  grantId: string;
  grantRevision: number;
  operationId: string;
}>;

type BrowserBackendState = 'available' | 'enabled' | 'denied' | 'unavailable' | 'degraded';
type BrowserActionName =
  | 'browser_open' | 'browser_snapshot' | 'browser_click' | 'browser_type'
  | 'browser_console' | 'browser_network' | 'browser_screenshot'
  | 'browser_set_viewport' | 'browser_close';

type BrowserSession = Readonly<{
  id: string;                 // unguessable, server-issued; scoped to the authority
  backendId: string;          // version-pinned backend identity
  authority: BrowserAuthority;
  workerId: string;           // verified executor identity, not just process name
}>;

type BrowserCapability = Readonly<{
  backendId: string;
  state: BrowserBackendState;
  capabilities: readonly BrowserActionName[];
  reason?: string;
  sourceSha?: string;
  packageVersion?: string;
}>;

interface BrowserBackend {
  probe(authority: BrowserAuthority): Promise<BrowserCapability>;
  open(authority: BrowserAuthority, signal: AbortSignal): Promise<BrowserSession>;
  call(session: BrowserSession, action: BrowserActionName,
       args: Readonly<Record<string, unknown>>, signal: AbortSignal): Promise<unknown>;
  close(session: BrowserSession): Promise<void>;
}
```

This is only an **internal port design**; the public `browser_*` tools remain stable. The broker (not a backend) validates grant revision/allowed operation, binds a session to a verified executor and a resource/egress policy, redacts returned data, and writes audit/proof receipts. `browser_eval` remains a separate HIGH-risk tool outside the minimal shared action list. A backend `probe` must not start a browser unless owner policy allows it; truthful availability may be `unavailable` before launch. The design must be revised if an existing `ChildMcpRegistry` port already suffices: **do not introduce an abstraction merely to match this document.**

**Per-action receipt (`PROPOSAL`):** `{ operationId, principalId, workspaceId, capsuleId, grantId, grantRevision, sessionId, backendId, backendVersion, sourceSha, requestedAction, policyDecision, startTime, endTime, outcome: 'passed'|'failed'|'denied'|'unavailable'|'unknown', artifactIds:[], artifactHashes:[], redactionVersion }`. No raw credentials in receipts. For async cancellation or uncertain side effects, outcome must distinguish *not started* from *unknown completion*.

## 6. Rejected and conditional alternatives

1. **Global replacement of `playwright-core`/MCP with stealth fork — REJECT.** Unnecessary baseline regression risk, unreviewed packages, no isolation benefit established.
2. **Parallel installation of Patchright and Rebrowser — REJECT initially.** Overlapping purpose and two supply chains; pick one experiment at a time.
3. **Fork/vendoring a modified browser engine — REJECT now.** No requirement proven that justifies binary build, license, security and update burden.
4. **Browser Use as FolderForge orchestrator — REJECT now.** Duplicates agent loop/credential and owner authority; study local observation patterns without inheriting unchecked REPL or cloud defaults.
5. **Crawlee as browser safety boundary — REJECT.** Request queues and retries do not provide egress restriction or multi-agent OS isolation.
6. **Provider cloud browser as security boundary — REJECT absent independent contract/attestation.** Remote service is neither automatically owner-authorized nor equivalent to an isolated local worker.
7. **Unrestricted `danger` policy as network grant — REJECT.** A tool approval bypass is not owner-granted browser-origin authorization.

## 7. Goal Map and acceptance traceability

| FolderForge Goal | Browser outcome | Required acceptance and roadmap gate |
| --- | --- | --- |
| G2 Independent work | Distinct session/profile/process/credential boundary and safe revocation | UA-AC02/UA-AC03/UA-AC04/UA-AC06, C1/C2; UA-002/003/004/005 prerequisites |
| G3 Eyes/Observation | Correlated DOM/a11y/screenshot/console/network evidence | UA-AC09 and UA-AC15, C4; UA-007/009 |
| G4 Hands/Action | Authorized click/type/navigate with grants enforced at child/network boundary | UA-AC11 and UA-AC14, C4; UA-007 |
| G5 Verify/Repair | Seeded bug captured, fixed and truly rerun | UA-AC10 and UA-AC15, C4; UA-009/010 |
| G7 Controlled extension | One opt-in, version-pinned backend through existing policy/audit and truthful status | UA-AC11/UA-AC14/UA-AC15; no new gate bypass |
| G8 Product leverage | Measured improvement on equal, authorized fixtures | UA-AC17; C7; no unsupported superiority claim |

## 8. Acceptance, research gate and provenance

**BR-001 closure requirements:** independent source/architecture/security review; each candidate SHA + license and unverified items recorded; ADR accepted through applicable mechanism; no active document ownership collision; documentation branch with exact head CI if/when permitted. Until then the proper status is **PARTIAL / UNREVIEWED**.

**BR-002 entry:** inspect fresh GitHub/host state; reconcile C0 and M1 C1/C2 prerequisites; use safe isolated fixtures to write RED/negative tests *before* changing browser code. If no executable isolated fixture or authoritative owner grant, produce test-spec-only evidence and report `BLOCKED`—do not claim security PASS. No production or recovery changes.

**BR-007 benchmark target, not result:** same fixtures, baseline versions, task success, DOM/action reliability, correlated evidence completeness, failure recovery, startup p50/p95, CPU/RAM/disk, per-agent isolation, negative security matrix, total cost; attach raw measurements and failed cells. No unapproved anti-defense-evasion trials.