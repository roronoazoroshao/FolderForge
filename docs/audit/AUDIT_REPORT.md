# FolderForge — evidence-first engineering audit

Baseline: `main@8c00b15ff7d34dedfd8f50e46066ad0a3defc23c` (2026-11-10). Read-only source inspection, exact-baseline local tests, and documentation-only changes in `chore/audit-and-docs`. This is **not** a production security assessment or a deployment.

## Scope / assumptions
- **Name/value:** MCP-native AI coding-agent control plane (`package.json:2-5`; `src/tools/index.ts:39-83`).
- **Users:** local developers, remote SSH owners, and operators of multiple MCP-backed project folders (`README.md:16-61,64-93`; `src/dashboard/server.ts:950-1028`).
- **Modes:** manual CLI/stdin, HTTP Dashboard and governed workflow/agent-loop resume. General scheduled production runner existence **[UNVERIFIED]** (`src/main.ts:98-155`; `src/agent-loops/agent-loop-runner.ts:59-90`).
- **Constraints/business:** precise token budget, price, paid API credentials, adoption/conversion and SLA not supplied: **[UNVERIFIED]**. Use planned KPI targets rather than claiming observed performance.
- **Production boundary:** PR source code is merged; host-installed writer fencing, independent security review and production deployment are **not** verified (`src/isolation/worktree-manager.ts:103-112,1289-1294`; `docs/r14-kernel-registry-fence-migration.md:74-83`).

## Phase 0 reproduction
| Command / evidence | Observed |
|---|---|
| `git rev-parse origin/main` | `8c00b15ff7d34dedfd8f50e46066ad0a3defc23c` |
| `node -v` / `npm -v` | `v22.23.0` / `10.9.8` |
| `npm ci --ignore-scripts --no-audit --no-fund` and SPA equivalent | PASS |
| `npm run build` / `npm run typecheck` / `npm run lint` | PASS |
| `npm run architecture:check` | PASS, 160 files / 375 runtime edges / 0 cycles / 0 violations (`scripts/check-architecture.mjs`) |
| `npm run docs:check` | PASS (baseline check: 123 Markdown files; `scripts/check-docs.mjs`) |
| `npx vitest run --maxWorkers=4` | **195 files passed, 2 skipped; 1,580 tests passed, 34 skipped, 0 failed** |
| `npm run test:coverage` | **PASS**; statements **76.20%**, branches **66.85%**, functions **81.82%**, lines **79.77%** overall (V8 `coverage/coverage-summary.json`; 21,999 statements, 18,663 branches, 3,516 functions, 19,416 lines). Separately gated critical subset passed its thresholds: statements 84%, branches 76%, functions 90%, lines 87%; these are **thresholds**, not measured global percentages (`scripts/check-critical-coverage.mjs`). |
| Exact-main GitHub CI #42737772633 | 7/7 SUCCESS at baseline; cross-OS evidence is still not a live-host cutover (`.github/workflows/ci.yml:17-83`) |
| `git shortlog -sne HEAD` | Hermes Agent 296; owner 134; Dependabot 20; two additional authors 11 combined. Authorship ≠ operational bus factor: **[UNVERIFIED]** |
| Hotspots since 2026-09-01 | `CHANGELOG.md` (55), `package-lock.json` (38), `tests/unit/worktree-manager.test.ts` (22), `src/isolation/worktree-manager.ts` (19), `src/main.ts` (18). Command: `git log --since=2026-09-01 --name-only --format='' | sort | uniq -c | sort -nr` |

## Dimension scores (1 weak / 5 strong)

| Dimension | Score | Evidence | Highest-impact next action |
|---|---:|---|---|
| Architecture & modularity | 4 | Composed registry/container and architecture boundary gate: `src/runtime/container.ts:7-44`; `src/tools/index.ts:42-83` | Split very large HTTP route dispatcher into typed per-domain routers (`src/dashboard/server.ts:936-3024`) |
| Reliability, idempotency, fallbacks | 3 | Durable loops `src/agent-loops/agent-loop-runner.ts:53-73`; locks `src/isolation/worktree-manager.ts:1303-1315` | Implement real epoch fence and cross-version restart drills before enabling reconcile |
| Agent loop, reasoning, memory | 2 | Deterministic proposer and hard-coded votes `src/agent-loops/agent-loop-runner.ts:156-216` | Label simulated council honestly; add optional real model provider and grounded review |
| Token/cost efficiency | 2 | Adaptive/50-tool preset `src/tools/index.ts:164-209`, but loop model/cost records absent from `src/agent-loops/agent-loop-manager.ts:67-107` | Add per-run model usage ledger, budget stop, caching metric |
| Security, permissions, approval | 3 | Policy/audit `src/tools/registry.ts:529-600`; owner auth `src/dashboard/server.ts:950-1028`; unimplemented host fence `docs/r14-kernel-registry-fence-migration.md:74-83` | Qualified independent review + kernel DAC fence, then per-action approval |
| Observability | 3 | Audit `src/audit/audit-log.ts:36`, events `src/agent-loops/agent-loop-manager.ts:57-65` | Correlate request, run, tool, cost, retries and alert on stalled Fleet |
| Testing & regression | 4 | Local 1,580 pass and CI `.github/workflows/ci.yml:17-83`; fault tests `tests/unit/worktree-durable-registry.test.ts:71-173` | Broaden production-like fault, prompt-injection and LLM eval coverage |
| Performance & scalability | 3 | Rate limits `src/runtime/config.ts:255-267`; tool-surface cap `src/tools/index.ts:164-209` | Record p95 end-to-end latency, queue saturation, storage pressure before optimization |
| Developer experience | 3 | `package.json:68-109` scripts; `README.md:64-93` | Make one truthful onboarding path and remove stale quickstarts |
| Technical debt / dependency risk | 2 | Large Dashboard dispatcher `src/dashboard/server.ts:936-3024`; historical docs `docs/PROJECT_STATUS.md:1-20`; release pipeline `.github/workflows/publish-npm.yml` | Docs freshness check, modular router split, dependency/provenance policy |

## Prioritized findings

| ID / severity | Finding and evidence | Impact / suggested fix | Verification |
|---|---|---|---|
| **C-01 Critical** | **No real host-enforced mixed-version writer fence.** The optional callback is unwired and writes fail closed: `src/isolation/worktree-manager.ts:103-112,1289-1294`; `docs/r14-kernel-registry-fence-migration.md:24-38,74-83` | Data loss if an old writer blindly renames registry after new CAS. Build separate UID + trusted supervisor; deny legacy writes at kernel level; independent exact-HEAD review. Keep reconcile write disabled until proven. | Real host migration rehearsal: old-writer EACCES, kill/restart, symlink and ancestor mutation, checksummed backup/restore, approval |
| **H-02 High** | Agent council scripted vote uses fixed `0.92/0.82` and even claims “Independent review”: `src/agent-loops/agent-loop-runner.ts:185-216`. | Misleading assurance to operator. Rename to deterministic heuristic, show provenance; provide a real optional multi-model council with reviewer identities and evidence. | Eval distinguishes simulated vs real; no synthetic “independent” label; tests on missing models |
| **H-03 High** | D1 inventory exposes four descriptors, `source='unknown'` and all `editable:false` (`src/operator/config-descriptors.ts:4-60`). D2 writes only parent `shell_exec`, counters process-local (`src/operator/rate-limit-settings.ts:20-30,64-70,184-196`). | Claim “configure everything in Web Control” is not true. Extend **typed** allowlist via staged desired/effective + explicit restart/rollback; never generic JSON patch. | Signed owner, stale revision, audit, freeze, restart rollback, anonymous denial |
| **H-04 High** | Several “current truth” docs actually describe Oct 9 and npm 3.0.1 (`docs/PROJECT_STATUS.md:3-23`; `docs/CURRENT_FRONTIER.md:3-15`; `docs/HANDOFF.md:1-22`), conflicting with source v3.2.4 (`package.json:2-3`). | Operational misrouting and false release claims. Mark historical snapshots, link dated audit, create docs freshness CI checks. | Docs drift test compares metadata, links and commit baseline |
| **H-05 High** | Explicit source-merge sign-off is not an independent review. R14 file still says reviewer absent and production not installed (`docs/r14-kernel-registry-fence-migration.md:66-83`). | No technical grounds to unlock prod reconciliation or auto-delete recovery records. Maintain live activation no-go and independent review artifacts. | Reviewer approval at exact SHA + migration/recovery evidence |
| **H-06 High** | HTTP dashboard combines many domains in one 2,000+ line handler (`src/dashboard/server.ts:936-3024`), with admin bearer/Origin and owner logic (`src/dashboard/server.ts:950-1028`). | Higher regression chance; extract route families with shared auth middleware and contract tests. | Route-by-route auth/CORS/CSRF tests across POST/DELETE |
| **M-07 Medium** | Tool registry has **359 native definitions**, plus dynamic child catalogs (`src/tools/index.ts:42-83,128-153`), while `vibe-lite` has cap 50 (`src/tools/index.ts:164-209`). | Unbounded child metadata/discovery can grow cost and confuse users; publish budgeted catalog selection metrics, no blind full-list advertising. | Token-count diff, compatibility with 50-tool clients, gateway authorization tests |
| **M-08 Medium** | Default audit durability is `best-effort` (`src/runtime/config.ts:230-234`), while critical paths depend on reliable audit (`src/tools/registry.ts:529-600`). | Stronger policies and durable alerting need operator-selected fail-closed mode. Verify error paths, don't infer audit delivery from local test alone. | fsync/write failure injection and alert status |
| **M-09 Medium** | Fleet signed owner onboarding and README disagree: `README.md:46-48,162-170` describe mandatory folder Browse while preselected/optional change is implemented (`packages/mission-control/src/screens/Fleet.tsx`). | New-user friction and bad setup instructions. Route through Overview first-run link and signed owner flow. | 390px browser and unsigned origin cases (`tests/visual/spa-visual.test.ts`) |
| **M-10 Medium** | Config path defaults to `cwd` and checks multiple filenames (`src/runtime/config.ts:312-339`); control commands are per-project (`README.md:145-149`). | CLI may target wrong workspace. Display active project/allowed roots in CLI/UI; refuse ambiguous stop. | Integration test from alternate cwd |
| **M-11 Medium** | External dynamic adapters are registered/advertised from child catalogs (`src/tools/adapter-tools.ts:38-50,82-118`). Live readiness and sub-operation trust depend on target. | Tighten schema/version pinning, quarantine and dynamic risk inspection. | Malicious child schema, supply-chain and timeouts regression |
| **M-12 Medium** | Agent-loop durable schema holds state/proposals/events but no model token/cost ledger (`src/agent-loops/agent-loop-manager.ts:67-107`). | No reliable per-job budget/ROI telemetry in this module. Implement cost attribution without leaking prompts. | Fake provider totals, quotas, abort/stop evidence |
| **M-13 Medium** | Historical docs describe PR #117 as still Draft/blocked (`docs/r13-mixed-version-registry-fencing.md:52-56`; `docs/r14-kernel-registry-fence-migration.md:74-84`), though source is merged. | Clarify: source merged, production activation still blocked, historical text timestamped. | Doc drift check against GitHub and current main SHA |
| **L-14 Low** | Root `CHANGELOG.md:9-15` ends at package version v3.2.4 despite later source merges; `docs/roadmap.md:1-10` is explicitly historical. | Add Unreleased section and new dated roadmap; don't imply npm published. | Release/version policy check |
| **L-15 Low** | Commit authorship concentrated across a bot/agent and owner (`git shortlog -sne HEAD`). **[UNVERIFIED]** whether multiple reviewers/maintainers can operate on-call. | Define CODEOWNERS/review rotation and bus-factor checks. | Two humans demonstrate incident and release drill |

## Security checklist (current vs target)
- [x] Govern tool calls through policy, risk, audit and quota (`src/tools/registry.ts:143-146,529-600`).
- [x] Protect privileged owner Fleet actions with auth/Origin and verified SSH option (`src/dashboard/server.ts:950-1028`).
- [x] Deny reconciliation writes when no external coordinator is wired (`src/isolation/worktree-manager.ts:1289-1294`).
- [ ] Qualified independent review + kernel-enforced mixed-version writer epochs in real production.
- [ ] Threat-model and test prompt injection over child MCP results, fetched pages, logs and model-generated commands.
- [ ] Credential rotation/revocation drill and accidental URL-log redaction on every transport.
- [ ] Secrets inventory, verified OS ACL/0600 tests across supported platforms.
- [ ] Review dependency provenance, publisher OIDC and real immutable release attestations.

## Testing and readiness checklist
- [x] Build, typecheck, lint, architecture, docs checks on exact source.
- [x] Unit/integration/fault tests; 1,580 pass, 34 skip. Skips are **NOT_RUN**, not passes.
- [x] Cross-platform exact-main GitHub CI 7/7 at 8c00b15 (independent from local run).
- [x] Local coverage command passed: global S/B/F/L = 76.20/66.85/81.82/79.77%; critical-module gate reported no failures.
- [ ] Independently qualify branch coverage of security-sensitive failure paths; 66.85% global branch coverage is not comprehensive proof.
- [ ] Production writer/rollback/restart fault injection; isolation archival recovery.
- [ ] LLM eval fixtures: prompt injection, budget stop, hallucinated tool calls, provenance, approval interception.
- [ ] Multi-user soak SLO, resource saturation, alerting, incident MTTR.
- [ ] Release identity, signed provenance, credential and secrets redaction under human approval.

## Root documentation change restriction

User instruction **only permits tracked changes under `docs/` in Phases 0–4**. Therefore root `README.md`, `CHANGELOG.md` and `CONTRIBUTING.md` remain untouched by this branch. The exact reviewable patch plan is [ROOT_DOCS_PATCH_PLAN.md](ROOT_DOCS_PATCH_PLAN.md). No source code, workflow, environment secret, production process or registry modified.

See [feature inventory](FEATURE_INVENTORY.md), [tool catalog](TOOL_CATALOG.md), [configuration](../CONFIGURATION.md), [operations](../OPERATIONS.md), [proposals](PROPOSALS.md) and [roadmap](../ROADMAP.md).
