/** A role is a prompt configuration; it becomes an agent only after a real provider invocation. */
export interface ReviewRole {
  readonly id: string;
  readonly name: string;
  readonly purpose: string;
  readonly blocking: boolean;
}

export const REVIEW_ROLES: readonly ReviewRole[] = Object.freeze([
  { id: 'A-PRODUCT', name: 'Principal Product and JTBD Strategist', purpose: 'Challenge GOAL, primary users, success metrics, positioning, MVP boundaries and competing alternatives.', blocking: false },
  { id: 'A-ARCH', name: 'Principal Domain and Clean Architecture Engineer', purpose: 'Audit domain contracts, workspace isolation, persistence identity, dependencies, migration and maintainability.', blocking: true },
  { id: 'A-SEC', name: 'Adversarial AppSec and OS Boundary Engineer', purpose: 'Challenge owner identity, grants, subprocess/sandbox escape, MCP transitivity, browser network and privilege escalation.', blocking: true },
  { id: 'A-MCP', name: 'MCP and AI Interoperability Specialist', purpose: 'Verify real handshake, stdio/HTTP compatibility, session binding, protocol versions and cross-agent behavior.', blocking: false },
  { id: 'A-UX', name: 'Accessible UX Researcher', purpose: 'Trace first verified action, keyboard/screen reader/copy/error states; never fabricate participants or WCAG certification.', blocking: false },
  { id: 'A-QA', name: 'Staff QA and Verification Architect', purpose: 'Map every AC to a real test and oracle; inspect fault injection, evidence gaps, dependency graph and CI proof.', blocking: true },
  { id: 'A-SRE', name: 'SRE and Recovery Assessor', purpose: 'Review disk, audit durability, backups, recovery, staging, canary, rollbacks and process artifact attestation.', blocking: false },
  { id: 'A-CLEAN', name: 'Developer Experience and Code Quality Reviewer', purpose: 'Detect bloat, duplicate logic, high-churn code, API compatibility risks and unreviewable task slices.', blocking: false },
]);
