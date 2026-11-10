import type { FolderForgeConfig } from '../core/types.js';
import type { RateLimiter } from '../policy/rate-limiter.js';

export interface ConfigDescriptor {
  key: string;
  scope: 'parent';
  category: 'LIVE_SAFE' | 'OWNER_ONLY';
  label: string;
  type: 'integer' | 'boolean';
  effective: number | boolean | null;
  desired: null;
  source: 'unknown';
  editable: false;
  requiresRestart: false;
  blockedReason: string;
}

/**
 * Read-only, explicitly allowlisted runtime values.
 *
 * Do not serialize FolderForgeConfig: it contains sensitive host scopes,
 * credential setup and endpoints. Source provenance stays unknown until
 * startup-config precedence is tracked end-to-end.
 */
export function describeConfig(context: {
  config: FolderForgeConfig;
  rateLimiter: RateLimiter;
}): ConfigDescriptor[] {
  const shell = context.rateLimiter.ruleFor('shell_exec');
  const numeric = (key: string, label: string, value: number | undefined): ConfigDescriptor => ({
    key,
    scope: 'parent',
    category: 'LIVE_SAFE',
    label,
    type: 'integer',
    effective: value ?? null,
    desired: null,
    source: 'unknown',
    editable: false,
    requiresRestart: false,
    blockedReason: 'Configuration editing is not enabled in the read-only inventory.',
  });
  return [
    numeric('rateLimit.overrides.shell_exec.dailyQuota', 'shell_exec daily calls (per process, rolling 24h)', shell.dailyQuota),
    numeric('rateLimit.overrides.shell_exec.maxCalls', 'shell_exec short-window calls', shell.maxCalls),
    numeric('rateLimit.overrides.shell_exec.windowMs', 'shell_exec window (milliseconds)', shell.windowMs),
    {
      key: 'rateLimit.enabled',
      scope: 'parent',
      category: 'OWNER_ONLY',
      label: 'Rate limiting enabled',
      type: 'boolean',
      effective: context.config.rateLimit.enabled,
      desired: null,
      source: 'unknown',
      editable: false,
      requiresRestart: false,
      blockedReason: 'Rate limiting cannot be disabled in Mission Control.',
    },
  ];
}
