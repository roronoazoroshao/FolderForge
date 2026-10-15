import { createHmac } from 'node:crypto';

/**
 * A browser's HttpOnly cookies are scoped to hostname, NOT TCP port.
 * The verified desktop proxy must add this separate, non-browser-visible
 * per-SSH-bootstrap proof to each proxied owner request. Ordinary VS Code
 * PORTS forwarding cannot derive this proof from a shared browser cookie.
 */
export const SSH_BROWSER_CHANNEL_HEADER = 'x-folderforge-verified-channel';

export function deriveSshBrowserChannel(bootstrapSecret: string): string {
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(bootstrapSecret)) {
    throw new Error('SSH_BROWSER_CHANNEL_INVALID_BOOTSTRAP');
  }
  return createHmac('sha256', bootstrapSecret)
    .update('FolderForge verified SSH browser channel v1', 'utf8')
    .digest('base64url');
}
