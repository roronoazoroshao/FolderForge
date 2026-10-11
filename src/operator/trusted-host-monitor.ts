/** Reconcile local operator grant revocations while the FolderForge parent lives. */
export function startTrustedHostRevocationMonitor(
  fleet: { reconcileRevokedTrustedHosts(): string[] },
  audit: (instanceId: string) => void,
  pollMs = 1000,
  reconcileBeforeServing = false,
): () => void {
  // Startup is a security boundary: a previous parent may have died after
  // local revocation but before its next timer tick. Reconcile synchronously
  // before exposing the Dashboard; do not swallow unreadable state here.
  if (reconcileBeforeServing) {
    for (const id of fleet.reconcileRevokedTrustedHosts()) {
      try { audit(id); } catch { /* Audit failure cannot restore host grant. */ }
    }
  }
  const timer = setInterval(() => {
    try {
      for (const id of fleet.reconcileRevokedTrustedHosts()) {
        try { audit(id); } catch { /* A logged failure cannot restore a revoked capability. */ }
      }
    } catch {
      // Unexpected storage/process failures are handled fail-closed by Fleet
      // start, and the next tick retries. Never tear down the parent.
    }
  }, pollMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
