/**
 * API client for the governed dashboard endpoints. Mirrors the legacy UI's
 * convention: the bearer token comes from `?token=` or localStorage and is
 * appended as a query param (the dashboard also accepts the Authorization
 * header; the query param keeps static hosting simple).
 */

const TOKEN_KEY = 'folderforge.dashboard.token';
const TAB_TOKEN_KEY = 'folderforge.dashboard.tab-token';

// A signed URL is an entry ticket to the current browser TAB, not a token
// that should remain in the address bar, browser history or referrer.
// BrowserRouter replaces ?token= during navigation: keep it in sessionStorage
// so reload/navigation still authorize APIs without another setup step.
let signedTabToken = '';
if (typeof window !== 'undefined') {
  const entry = new URL(window.location.href);
  const signed = entry.searchParams.get('token');
  if (signed) {
    signedTabToken = signed;
    try { sessionStorage.setItem(TAB_TOKEN_KEY, signed); } catch { /* restricted storage */ }
    entry.searchParams.delete('token');
    window.history.replaceState(window.history.state, '', entry.pathname + entry.search + entry.hash);
  }
}

export function getToken(): string {
  // Keep compatibility with callers that supply location without Window
  // (unit harness and embedded SPA), while normal browser entry strips the
  // signed URL immediately and retains the credential per tab.
  let locationToken = '';
  let storedTabToken = '';
  let savedToken = '';
  try {
    if (typeof location !== 'undefined')
      locationToken = new URLSearchParams(location.search).get('token') || '';
  } catch { /* inaccessible location */ }
  try { storedTabToken = sessionStorage.getItem(TAB_TOKEN_KEY) || ''; } catch { /* restricted storage */ }
  try { savedToken = localStorage.getItem(TOKEN_KEY) || ''; } catch { /* restricted storage */ }
  return locationToken || signedTabToken || storedTabToken || savedToken;
}

export function setToken(token: string): void {
  signedTabToken = token;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* restricted storage */ }
  if (!token) {
    try { sessionStorage.removeItem(TAB_TOKEN_KEY); } catch { /* restricted storage */ }
  }
}

export async function api<T = unknown>(
  path: string,
  options?: { method?: string; body?: unknown; sensitive?: boolean; headers?: Record<string, string> },
): Promise<T> {
  const url = new URL(path, location.origin);
  const token = getToken();
  if (token && !options?.sensitive) url.searchParams.set('token', token);
  const headers: Record<string, string> = {};
  if (options?.body !== undefined) headers['content-type'] = 'application/json';
  if (token && options?.sensitive) headers.authorization = `Bearer ${token}`;
  if (options?.headers) Object.assign(headers, options.headers);
  const response = await fetch(url.toString(), {
    method: options?.method ?? 'GET',
    headers: Object.keys(headers).length ? headers : undefined,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }
  if (!response.ok) {
    const err = data as { message?: string; error?: string };
    throw new Error(err.message || err.error || `${path} → HTTP ${response.status}`);
  }
  return data as T;
}
