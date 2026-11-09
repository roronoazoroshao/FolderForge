import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../src/runtime/config.js';
import { RateLimiter } from '../../src/policy/rate-limiter.js';
import { describeConfig } from '../../src/operator/config-descriptors.js';

describe('read-only operator configuration descriptors', () => {
  it('enumerates only bounded and redacted parent settings without exposing paths or secrets', () => {
    const config = defaultConfig('/tmp/folderforge-config-descriptors');
    config.workspace.allowedDirectories = ['/private/DO_NOT_EXPOSE'];
    config.server.name = 'SECRET_SENTINEL_DO_NOT_EXPOSE';
    config.rateLimit.overrides.shell_exec = { maxCalls: 13, windowMs: 9000, dailyQuota: 777 };
    const descriptors = describeConfig({ config, rateLimiter: new RateLimiter(config.rateLimit) });
    expect(descriptors.map(d => d.key)).toEqual([
      'rateLimit.overrides.shell_exec.dailyQuota',
      'rateLimit.overrides.shell_exec.maxCalls',
      'rateLimit.overrides.shell_exec.windowMs',
      'rateLimit.enabled',
    ]);
    expect(descriptors[0]).toMatchObject({
      scope: 'parent', category: 'LIVE_SAFE', type: 'integer',
      effective: 777, desired: null, source: 'unknown',
      editable: false, requiresRestart: false,
    });
    expect(descriptors[1]?.effective).toBe(13);
    expect(descriptors[2]?.effective).toBe(9000);
    expect(descriptors[3]).toMatchObject({ category: 'OWNER_ONLY', effective: true, editable: false });
    expect(descriptors.every(d => Boolean(d.blockedReason))).toBe(true);
    expect(JSON.stringify(descriptors)).not.toMatch(/SECRET_SENTINEL|DO_NOT_EXPOSE|token|apiKey|allowedDirectories/);
  });

  it('reflects the effective runtime rule without claiming persisted provenance', () => {
    const config = defaultConfig('/tmp/folderforge-config-descriptors');
    const limiter = new RateLimiter(config.rateLimit);
    config.rateLimit.overrides.shell_exec = { maxCalls: 7, windowMs: 3500, dailyQuota: 80 };
    const view = describeConfig({ config, rateLimiter: limiter });
    expect(view[0]?.effective).toBe(80);
    expect(view.every(d => d.source === 'unknown' && d.desired === null)).toBe(true);
  });
});
