# Root-documentation patch plan — deferred by scope rule

**Hard constraint:** Phases 0–4 only modify `docs/**` on `chore/audit-and-docs`. Root files are therefore unchanged even though the requested deliverables name them. Apply **only after explicit approval** and a separate scope amendment or Phase 5 docs task. Do not silently interpret the user's README request as authorization to violate the docs-only rule.

| Root file | Current evidence | Proposed minimal edit, NOT performed |
|---|---|---|
| `README.md` | `README.md:46-48,119-185`; real Fleet/Overview `packages/mission-control/src/screens/Fleet.tsx` and `Overview.tsx` | First-run path Overview → Set up AI access → ready workspace → owner-signed Enable; Browse/Change folder optional; no implicit local operator grant; clarify installed CLI version vs current git main |
| `CHANGELOG.md` | `CHANGELOG.md:9-15` ends at v3.2.4 | Add `[Unreleased]` source-only changes from Nov 6–10; link `docs/audit/UNRELEASED_CHANGELOG.md`; do NOT call this a public npm release |
| `CONTRIBUTING.md` | `CONTRIBUTING.md:5-65` | Add pre-PR commands, security exact-head and human-review requirements for privileged/kernel changes, docs drift check, test skip/coverage reporting, separate release and host activation gates |

**Reviewable staged content:** [source-only changelog](UNRELEASED_CHANGELOG.md), [current operations](../OPERATIONS.md), [current configuration](../CONFIGURATION.md), [audit](AUDIT_REPORT.md). Do not run root-edit steps in the current phase.
