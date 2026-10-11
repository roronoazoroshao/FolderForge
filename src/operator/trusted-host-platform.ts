/** Platform and operator I/O preconditions for Fleet trusted-host grants. */
export type OperatorPlatform = 'darwin' | 'linux' | 'unsupported';

export function detectConsentPlatform(platform: string): OperatorPlatform {
  if (platform === 'darwin' || platform === 'linux') return platform;
  return 'unsupported';
}

export function requireSupportedLocalPlatform(platform: string): void {
  if (detectConsentPlatform(platform) === 'unsupported') {
    // Unqualified platforms remain fail-closed.
    throw new Error('LOCAL_CONFIRMATION_UNAVAILABLE');
  }
}

export function checkLocalTerminal(io: { stdinIsTTY: boolean; stdoutIsTTY: boolean }): void {
  if (!io.stdinIsTTY || !io.stdoutIsTTY) throw new Error('LOCAL_TERMINAL_REQUIRED');
}
