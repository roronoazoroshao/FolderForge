# Recursive handoff template — fill with measured state at the END of every task

**DO NOT use placeholders to claim DONE.** Save latest state in `docs/handoffs/NEXT_SESSION.md`, and paste the next master prompt to the user.

## Durable handoff record schema

| Field | Required facts |
| --- | --- |
| `generatedAt` | actual date and timezone (never invent future delivery) |
| `northStar` | unchanged approved one-line product goal or changed ADR |
| `roadmapPhase` | M0–M5, current gate C0–C8, exit criteria |
| `completedTask` | UA-###, actual status and proof; if blocked name blocker |
| `currentSource` | exact main SHA, working branch and commit SHA, dirty/clean state |
| `prAndCI` | PR URL, base/head, review requirements, exact-head CI URLs and status |
| `files` | edited files, docs, tests, artifacts and commit |
| `testEvidence` | commands, exit statuses, relevant assertions and run IDs; distinguish mocks from live runs |
| `securityAndOps` | limits, owner approvals, capacity, #118 and runtime warnings |
| `nextTarget` | first unblocked UA ID, dependencies, 1 measurable outcome, intended files/tests |
| `stopRules` | what must not be attempted without new authority |

## Copy-ready recursive prompt contract

```text
FOLDERFORGE SESSION — RECURSIVE HANDOFF
Use the FULL operating instructions in docs/prompts/MASTER_IMPLEMENTATION_RECURSIVE_HANDOFF.md and AGENTS.md.

NORTH_STAR: [approved goal; one sentence]
ROADMAP_PHASE / GATE: [M... / C...]
CURRENT_MAIN_SHA: [sha from git, with timestamp]
WORKING_BRANCH / SHA / PR: [exact checked state]
LAST_TASK / STATUS: [UA-### / verifiable outcome]
EVIDENCE: [commands & results, CI and E2E artifact URLs, what was NOT tested]
BLOCKERS: [missing permissions/model/runtime, host risk, approvals]
NEXT_TARGET: [one UA-### only]
NEXT_DONE_WHEN: [specific test oracle, required CI/PR + verified main merge]
NEXT_FILES / TESTS: [exact paths and commands]
NEXT_AFTER: [successor UA-### or gate]

Do not infer prior work is merged or deployed; verify current source and GitHub.
Use task-appropriate installed Superpowers, agent-skills, Karpathy and connected plugins, reading their current instructions.
Prove red-green, review, CI and real runtime behavior before any DONE.
Do not force merge, skip security gate, delete unique branch/worktree data, or touch production without operator authorization.
At session end, update task ledger, status, durable NEXT_SESSION.md and output a NEW full recursive handoff prompt containing all current evidence and the next unblocked task.
```

When the next agent cannot access the repo, include the material excerpts and source URLs needed to resume; don't claim it can access private files merely from a pasted prompt. Handoff recursion is **a procedure across explicit chat turns**, not autonomous background execution.
