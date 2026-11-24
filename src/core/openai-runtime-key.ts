/** Match the official tunnel-client's control-plane credential contract.
 * File credentials are trimmed with Go's unicode.IsSpace semantics; env
 * credentials are not. Errors must never include the supplied value.
 */
export function normalizeOpenAiRuntimeFileKey(value: string): string {
  return value.replace(/^\p{White_Space}+|\p{White_Space}+$/gu, '');
}

export function assertOpenAiRuntimeKey(value: string): void {
  if (value.length === 0) {
    throw new Error('OPENAI_RUNTIME_KEY_MISSING: Provide a runtime API key.');
  }
  if (/[^A-Za-z0-9_-]/.test(value)) {
    throw new Error('OPENAI_RUNTIME_KEY_MALFORMED: Runtime API key contains invalid characters. Paste the raw key or check the configured key file/environment.');
  }
}
