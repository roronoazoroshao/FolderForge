import { useEffect, useRef, useState } from 'react';
import { api, getToken, setToken } from '../api';
import { useAction, useApi } from '../hooks';
import { Button, Card, ErrorNote, Field, Input, PageHeader, Select, useToast } from '../ui';
import type { StatusSnapshot } from '../types';

const POLICY_MODES = ['readonly', 'safe', 'dev', 'danger'];

interface ConfigDescriptorView {
  key: string;
  label: string;
  scope: 'parent';
  category: 'LIVE_SAFE' | 'OWNER_ONLY';
  effective: number | boolean | null;
  source: 'unknown';
  editable: boolean;
  blockedReason: string;
}

interface ConfigInventoryView {
  scope: 'parent';
  readOnly: boolean;
  descriptors: ConfigDescriptorView[];
}

interface RuntimeSettingsView {
  terminal: {
    defaultTimeoutMs: number;
    maxOutputBytes: number;
    envPolicy: string;
    sandbox: { mode: string; requireInDanger: boolean };
  };
  updatedAt?: string;
}


interface QuotaView {
  scope: 'parent';
  tool: 'shell_exec';
  revision: string;
  source: 'startup' | 'operator';
  effective: { dailyQuota?: number; maxCalls: number; windowMs: number };
  usage: { windowCount: number; dailyCount: number };
  enabled: boolean;
  usageScope: 'current-process';
}

/** An allowlisted, revisioned editor; never accepts raw YAML or host privilege settings. */
function ShellQuotaEditor(props: { onSaved: () => void }) {
  const toast = useToast();
  const quota = useApi<QuotaView>('/operator/config/quota', 15000, true);
  const [ownerReady, setOwnerReady] = useState(false);
  const [dailyQuota, setDailyQuota] = useState('');
  const [maxCalls, setMaxCalls] = useState('');
  const [windowMs, setWindowMs] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydratedRevision = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const check = () => {
      void api<{ ready: boolean }>('/fleet/owner-capability', { sensitive: true })
        .then(result => { if (mounted) setOwnerReady(result.ready === true); })
        .catch(() => { if (mounted) setOwnerReady(false); });
    };
    check();
    const interval = setInterval(check, 15_000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!quota.data || hydratedRevision.current === quota.data.revision ||
        (dirty && hydratedRevision.current !== null)) return;
    hydratedRevision.current = quota.data.revision;
    setDailyQuota(String(quota.data.effective.dailyQuota ?? ''));
    setMaxCalls(String(quota.data.effective.maxCalls));
    setWindowMs(String(quota.data.effective.windowMs));
    setError(null);
  }, [quota.data, dirty]);

  const save = async () => {
    if (!quota.data || !hydratedRevision.current || !ownerReady || busy) return;
    const raw = [dailyQuota, maxCalls, windowMs];
    if (raw.some(v => !/^\d+$/.test(v))) {
      setError('Quota values must be whole numbers within the displayed limits.');
      return;
    }
    const value = {
      dailyQuota: Number(dailyQuota),
      maxCalls: Number(maxCalls),
      windowMs: Number(windowMs),
    };
    if (!Number.isSafeInteger(value.dailyQuota) || value.dailyQuota < 1 || value.dailyQuota > 10000 ||
        !Number.isSafeInteger(value.maxCalls) || value.maxCalls < 1 || value.maxCalls > 50 ||
        !Number.isSafeInteger(value.windowMs) || value.windowMs < 1000 || value.windowMs > 60000) {
      setError('Daily quota: 1–10,000; window calls: 1–50; window: 1,000–60,000 ms.');
      return;
    }
    setBusy(true);
    setError(null);
    let applyAttempted = false;
    try {
      const body = {
        scope: 'parent', key: 'rateLimit.overrides.shell_exec',
        expectedRevision: hydratedRevision.current, value,
      };
      // Both operations require a signed local owner and same-origin browser.
      await api('/operator/config/validate', { method: 'POST', sensitive: true, body });
      applyAttempted = true;
      await api('/operator/config/apply', { method: 'POST', sensitive: true, body });
      setDirty(false);
      quota.reload();
      props.onSaved();
      toast('success', 'Quota saved for this process');
    } catch (caught) {
      // An interrupted write may have changed the saved revision even when
      // the HTTP result is an error. Reload authoritative state after apply.
      if (applyAttempted) {
        setDirty(false);
        quota.reload();
      }
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="shell_exec quota" hint="parent process · bounded">
      {quota.error ? <ErrorNote message={quota.error} /> : null}
      {quota.data ? (
        <div className="grid gap-3">
          <p className="text-xs text-muted">
            Current shell command usage: {quota.data.usage.dailyCount} in 24 hours and{' '}
            {quota.data.usage.windowCount} in the short window. Limits apply to this
            control process only; separate Fleet instances have their own quotas.
            Counters reset after restart, but saved limits survive.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Daily quota (1–10,000)">
              <Input type="number" min={1} max={10000} step={1}
                aria-label="shell_exec daily quota"
                value={dailyQuota} onChange={e => { setDailyQuota(e.target.value); setDirty(true); }} />
            </Field>
            <Field label="Calls per window (1–50)">
              <Input type="number" min={1} max={50} step={1}
                aria-label="shell_exec window calls"
                value={maxCalls} onChange={e => { setMaxCalls(e.target.value); setDirty(true); }} />
            </Field>
            <Field label="Window milliseconds (1,000–60,000)">
              <Input type="number" min={1000} max={60000} step={1000}
                aria-label="shell_exec window milliseconds"
                value={windowMs} onChange={e => { setWindowMs(e.target.value); setDirty(true); }} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" busy={busy}
              disabled={busy || !ownerReady || !quota.data.enabled || !hydratedRevision.current}
              onClick={() => void save()}>Save shell quota</Button>
            <span className="text-xs text-muted">
              {ownerReady
                ? 'Signed Dashboard owner verified · changes apply immediately.'
                : 'Open the signed Dashboard owner link to enable editing.'}
            </span>
          </div>
          <p className="text-xs text-muted">
            Source: {quota.data.source === 'operator' ? 'saved operator settings' : 'startup configuration (exact provenance unknown)'}.
            Any concurrent change requires reloading the page; existing usage is never cleared by Save.
          </p>
          <ErrorNote message={error} />
        </div>
      ) : (
        <p className="text-sm text-muted">Loading shell quota…</p>
      )}
    </Card>
  );
}

export function SettingsScreen() {
  const toast = useToast();
  const status = useApi<StatusSnapshot>('/status');
  const runtime = useApi<RuntimeSettingsView>('/runtime/settings');
  const inventory = useApi<ConfigInventoryView>('/operator/config', 15000);
  const action = useAction();
  const [token, setTokenValue] = useState(getToken());
  const [mode, setMode] = useState('dev');
  const [timeout, setTimeout] = useState('120000');
  const [outputBytes, setOutputBytes] = useState('200000');
  const hydratedRuntimeKey = useRef<string | null>(null);

  useEffect(() => {
    const current = status.data?.policy?.mode;
    if (current) setMode(current);
  }, [status.data]);

  useEffect(() => {
    if (!runtime.data) return;
    const key = [
      runtime.data.terminal.defaultTimeoutMs,
      runtime.data.terminal.maxOutputBytes,
      runtime.data.updatedAt ?? '',
    ].join(':');
    // Background status polling must not overwrite a form being edited.
    if (hydratedRuntimeKey.current === key) return;
    hydratedRuntimeKey.current = key;
    setTimeout(String(runtime.data.terminal.defaultTimeoutMs));
    setOutputBytes(String(runtime.data.terminal.maxOutputBytes));
  }, [runtime.data]);

  return (
    <div className="grid gap-6 max-w-3xl">
      <PageHeader title="Settings" subtitle="Manage persistent policy and bounded terminal preferences from the running Control Panel." />

      <Card title="Dashboard bearer token" hint="stored per browser (localStorage)">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-60">
            <Input
              type="password"
              value={token}
              onChange={(e) => setTokenValue(e.target.value)}
              placeholder="Bearer token"
              aria-label="Dashboard bearer token"
            />
          </div>
          <Button
            variant="primary"
            onClick={() => {
              setToken(token.trim());
              location.reload();
            }}
          >
            Save &amp; reload
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setToken('');
              location.reload();
            }}
          >
            Clear
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted">
          Loopback binds skip auth; the token is required when the dashboard is reached through a tunnel or a
          non-loopback bind.
        </p>
      </Card>

      <Card title="Policy mode" hint="admin only · saved across restart">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Runtime policy" className="w-56">
            <Select value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Policy mode">
              {POLICY_MODES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          </Field>
          <Button
            variant="primary"
            disabled={action.busy}
            busy={action.busy}
            onClick={() =>
              void action.run('/policy/mode', { mode }).then((ok) => {
                if (ok) {
                  status.reload();
                  toast('success', `Policy mode → ${mode}`);
                }
              })
            }
          >
            Apply
          </Button>
        </div>
        <ErrorNote message={action.error} />
      </Card>

      <Card title="Configuration inventory" hint="read-only · parent runtime · no secrets">
        {inventory.error ? <ErrorNote message={inventory.error} /> : null}
        {inventory.data ? (
          <div className="grid gap-3 text-sm">
            <p className="text-xs text-muted">
              Live values from this process; source precedence is unknown. No edits are enabled.
              The rolling 24-hour quota is per process, not shared between running instances.
            </p>
            {inventory.data.descriptors.map((item) => (
              <div key={item.key} className="rounded-lg border border-border bg-raised p-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="font-medium">{item.label}</p>
                  <strong>{item.effective === null ? 'Not configured' : String(item.effective)}</strong>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Parent · {item.category === 'OWNER_ONLY' ? 'Owner-only' : 'Runtime value'}
                  {' · '}Source: unknown · Read-only
                </p>
                <p className="mt-1 text-xs text-muted">{item.blockedReason}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Loading redacted configuration…</p>
        )}
      </Card>

      <ShellQuotaEditor onSaved={() => inventory.reload()} />

      <Card title="Terminal execution" hint="effective runtime configuration">
        {runtime.error ? <ErrorNote message={runtime.error} /> : null}
        {runtime.data ? (
          <div className="grid gap-4">
            <div className="rounded-lg border border-border bg-raised p-3 text-sm">
              <p>Sandbox engine: <strong>{runtime.data.terminal.sandbox.mode}</strong></p>
              <p>Required for danger mode: <strong>{runtime.data.terminal.sandbox.requireInDanger ? 'Yes' : 'No'}</strong></p>
              <p>Environment policy: <strong>{runtime.data.terminal.envPolicy}</strong></p>
              {mode === 'danger' && runtime.data.terminal.sandbox.mode === 'process' &&
                runtime.data.terminal.sandbox.requireInDanger ? (
                <p className="mt-2 text-danger">
                  Danger-mode shell commands are blocked until a Docker/Podman
                  sandbox is configured. Changing policy mode alone does not disable containment.
                </p>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Default command timeout (ms)">
                <Input type="number" min={1000} max={1800000} step={1000}
                  value={timeout} onChange={(event) => setTimeout(event.target.value)}
                  aria-label="Terminal timeout in milliseconds" />
              </Field>
              <Field label="Maximum captured output (bytes)">
                <Input type="number" min={1024} max={2000000} step={1024}
                  value={outputBytes} onChange={(event) => setOutputBytes(event.target.value)}
                  aria-label="Terminal output limit in bytes" />
              </Field>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="primary" busy={action.busy} disabled={action.busy}
                onClick={() => void action.run('/runtime/settings', {
                  defaultTimeoutMs: Number(timeout),
                  maxOutputBytes: Number(outputBytes),
                }).then((ok) => {
                  if (ok) {
                    runtime.reload();
                    toast('success', 'Terminal preferences saved');
                  }
                })}>
                Save terminal limits
              </Button>
              <p className="text-xs text-muted">Saved preferences survive process restarts.</p>
            </div>
            <p className="text-xs text-muted">
              The sandbox engine and its containment requirement are configured
              at server startup, not through this remote-accessible page. To
              change them, update the trusted host configuration and restart the service.
              Hard command denies, workspace authorization, audit and rate limits remain enforced.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted">Loading runtime configuration…</p>
        )}
        <ErrorNote message={action.error} />
      </Card>
    </div>
  );
}
