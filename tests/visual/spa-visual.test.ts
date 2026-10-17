/**
 * Visual regression suite for the Mission Control SPA (proposal 018, debt
 * #21/#24): boots the REAL dashboard harness (fixture data, no auth) serving
 * the BUILT SPA at /app/, drives headless Chromium via playwright-core
 * (cached binary, offline), and pixel-diffs every screen against committed
 * baselines in tests/visual/baselines/.
 *
 * Regenerate baselines intentionally (never as a reflex):
 *   FF_VISUAL_UPDATE=1 npx vitest run tests/visual
 * Host-locked pixel baselines run ONLY in the pinned visual CI job via
 * FF_VISUAL_SNAPSHOTS=1. Ordinary npm test/release:check keeps browser
 * behavioral and mobile-overflow tests but never compares a developer's
 * locally installed Chromium/fonts to Linux CI golden images.
 * FF_VISUAL_REQUIRE_BROWSER=1 fails closed when the pinned browser is missing.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type BrowserContext } from 'playwright-core';
import { execFileSync } from 'node:child_process';

import { defaultConfig } from '../../src/runtime/config.js';
import { Container } from '../../src/runtime/container.js';
import { startDashboard } from '../../src/dashboard/server.js';
import { buildRegistry } from '../../src/tools/index.js';
import { diffPngs, MAX_DIFF_RATIO } from './lib/pixel-diff.js';

const UPDATE = process.env.FF_VISUAL_UPDATE === '1';
const SNAPSHOTS = process.env.FF_VISUAL_SNAPSHOTS === '1' || UPDATE;
const BASELINES = fileURLToPath(new URL('./baselines', import.meta.url));
const DESKTOP = { width: 1280, height: 900 } as const;
const MOBILE = { width: 390, height: 844 } as const;

const ROUTES: ReadonlyArray<{ name: string; path: string }> = [
  { name: 'overview', path: '/' },
  { name: 'responses', path: '/responses' },
  { name: 'fleet', path: '/fleet' },
  { name: 'tools', path: '/tools' },
  { name: 'tunnels', path: '/tunnels' },
  { name: 'workspaces', path: '/workspaces' },
  { name: 'plugins', path: '/plugins' },
  { name: 'approvals', path: '/approvals' },
  { name: 'audit', path: '/audit' },
  { name: 'settings', path: '/settings' },
];
/** Responsive spot-checks (the two screens audited at 390px in #17). */
const MOBILE_ROUTES: ReadonlySet<string> = new Set(['overview', 'fleet']);

/** playwright-core's registry resolves the cached chromium build offline;
 * fall back to the newest cached chromium-* (e.g. when the packaged
 * playwright version and the cached revision drift apart).
 *
 * tests/setup.ts sandboxes $HOME to a temp dir (probe evidence 2026-09-09),
 * so playwright-core's default cache (~/.cache/ms-playwright) points into
 * the void inside vitest. Pin the REAL user cache — resolved from the OS
 * password entry via userInfo(), not $HOME — before any registry call. */
function resolveChromiumExecutable(): string | undefined {
  process.env.PLAYWRIGHT_BROWSERS_PATH ??= join(userInfo().homedir, '.cache', 'ms-playwright');
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH;
  try {
    const p = chromium.executablePath();
    if (existsSync(p)) return p;
  } catch {
    // Registry lookup failed — scan the cache directly.
  }
  if (!existsSync(cache)) return undefined;
  const builds = readdirSync(cache)
    .filter((d) => /^chromium(?:_headless_shell)?-\d+$/.test(d))
    .sort((a, b) => Number(b.match(/\d+$/)![0]) - Number(a.match(/\d+$/)![0]));
  for (const build of builds) {
    for (const rel of [
      'chrome-linux/chrome',
      'chrome-linux64/chrome',
      'chrome-linux/headless_shell',
      'chrome-linux64/headless_shell',
    ]) {
      const p = join(cache, build, rel);
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

const CHROMIUM = resolveChromiumExecutable();
if ((process.env.FF_VISUAL_REQUIRE_BROWSER === '1' || SNAPSHOTS) && !CHROMIUM) {
  throw new Error('VISUAL_BROWSER_REQUIRED: Chromium unavailable. A visual release test must not skip.');
}

interface VisualHarness {
  root: string;
  server: Server;
  baseUrl: string;
  container: Container;
}

async function startHarness(withGit = false): Promise<VisualHarness> {
  const root = mkdtempSync(join(tmpdir(), 'folderforge-visual-'));
  if (withGit) {
    execFileSync('git', ['init', '-b', 'main'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'Visual Fixture'], { cwd: root });
    writeFileSync(join(root, 'tracked.txt'), 'baseline\n');
    execFileSync('git', ['add', 'tracked.txt'], { cwd: root });
    execFileSync('git', ['commit', '-m', 'fixture'], { cwd: root });
  }
  const config = defaultConfig(root);
  config.rateLimit.enabled = false;
  config.policy.defaultMode = 'dev';
  const container = new Container(config);
  const registry = buildRegistry(container);
  const server = startDashboard(container, registry, { host: '127.0.0.1', port: 0 });
  if (!server.listening) await once(server, 'listening');
  const address = server.address() as AddressInfo;
  return { root, server, container, baseUrl: `http://127.0.0.1:${address.port}` };
}

/** Navigate, stabilize, and capture a full-page screenshot. Security
 * amendment: any request off 127.0.0.1 is aborted AND fails the test — the
 * SPA must be fully self-contained (bundled icons, system fonts). */
async function shoot(context: BrowserContext, url: string): Promise<Buffer> {
  const page = await context.newPage();
  const external: string[] = [];
  await page.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') {
      void route.continue();
    } else {
      external.push(u.toString());
      void route.abort();
    }
  });
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    // Kill animations/transitions so pixels are stable (animate-pulse-dot,
    // animate-fade-in, hover transitions) — the #1 flake source for SPA shots.
    await page.addStyleTag({
      content: '* { animation: none !important; transition: none !important; }',
    });
    await page.waitForTimeout(300); // one beat past the first data paint
    expect(external).toEqual([]);
    return await page.screenshot({ fullPage: true });
  } finally {
    await page.close();
  }
}

function compare(name: string, viewportLabel: string, actual: Buffer): void {
  const baselinePath = join(BASELINES, `${name}.${viewportLabel}.png`);
  if (UPDATE) {
    mkdirSync(BASELINES, { recursive: true });
    writeFileSync(baselinePath, actual);
    console.log(`[visual] baseline written: ${name}.${viewportLabel}.png (${actual.length} bytes)`);
    return;
  }
  if (!existsSync(baselinePath)) {
    throw new Error(
      `Missing baseline ${name}.${viewportLabel}.png — regenerate intentionally with FF_VISUAL_UPDATE=1`,
    );
  }
  const result = diffPngs(readFileSync(baselinePath), actual);
  const pct = (result.ratio * 100).toFixed(3);
  if (!result.sameDimensions) {
    writeFileSync(`/tmp/ff-visual-${name}.${viewportLabel}.actual.png`, actual);
    throw new Error(
      `Dimension mismatch for ${name}.${viewportLabel}: baseline is ${result.width}x${result.height} ` +
        `(actual written to /tmp/ff-visual-${name}.${viewportLabel}.actual.png)`,
    );
  }
  if (result.ratio > MAX_DIFF_RATIO) {
    writeFileSync(`/tmp/ff-visual-${name}.${viewportLabel}.actual.png`, actual);
    if (result.diffPng) {
      writeFileSync(`/tmp/ff-visual-${name}.${viewportLabel}.diff.png`, result.diffPng);
    }
    throw new Error(
      `Visual regression on ${name}.${viewportLabel}: ${result.diffPixels}/${result.totalPixels} px ` +
        `(${pct}%) exceeds ${MAX_DIFF_RATIO * 100}% — artifacts: ` +
        `/tmp/ff-visual-${name}.${viewportLabel}.{actual,diff}.png`,
    );
  }
  console.log(`[visual] ${name}.${viewportLabel}: ${result.diffPixels}/${result.totalPixels} px (${pct}%)`);
}

describe.skipIf(!CHROMIUM)('Mission Control SPA visual regression (proposal 018)', () => {
  let harness: VisualHarness;
  let browser: Browser;
  let desktop: BrowserContext;
  let mobile: BrowserContext;

  beforeAll(async () => {
    harness = await startHarness();
    // Preflight: the suite reads the BUILT SPA — fail loudly if it is stale/missing.
    const probe = await fetch(`${harness.baseUrl}/app/`);
    const html = await probe.text();
    if (probe.status !== 200 || !html.includes('id="root"')) {
      throw new Error('SPA bundle not served at /app/ — run `npm run build` first.');
    }
    browser = await chromium.launch({ executablePath: CHROMIUM!, headless: true });
    desktop = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1 });
    mobile = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 1, isMobile: true });
  }, 60_000);

  afterAll(async () => {
    await desktop?.close().catch(() => undefined);
    await mobile?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
    if (harness?.server.listening) {
      await new Promise<void>((resolve) => harness.server.close(() => resolve()));
    }
    if (harness) rmSync(harness.root, { recursive: true, force: true });
  });

  for (const route of ROUTES) {
    (SNAPSHOTS ? it : it.skip)(`matches the baseline for ${route.name} (desktop)`, { timeout: 30_000 }, async () => {
      const shot = await shoot(desktop, `${harness.baseUrl}/app${route.path}`);
      compare(route.name, 'desktop', shot);
    });
    if (MOBILE_ROUTES.has(route.name)) {
      (SNAPSHOTS ? it : it.skip)(`matches the baseline for ${route.name} (mobile)`, { timeout: 30_000 }, async () => {
        const shot = await shoot(mobile, `${harness.baseUrl}/app${route.path}`);
        compare(route.name, 'mobile', shot);
      });
    }
  }

  it.each(['overview', 'fleet'])('keeps %s inside the 390px mobile viewport', { timeout: 30_000 }, async name => {
    const path = name === 'overview' ? '/' : '/fleet';
    const page = await mobile.newPage();
    try {
      await page.goto(`${harness.baseUrl}/app${path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      const dimensions = await page.evaluate(() => ({
        viewport: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
      }));
      expect(dimensions.viewport).toBe(MOBILE.width);
      expect(dimensions.documentWidth).toBeLessThanOrEqual(MOBILE.width);
      expect(dimensions.bodyWidth).toBeLessThanOrEqual(MOBILE.width);
    } finally {
      await page.close();
    }
  });

  it('keeps the advanced AI access modal inside a short mobile viewport with scrollable actions', { timeout: 30_000 }, async () => {
    const local = await startHarness();
    const project = join(local.root, 'modal-project');
    mkdirSync(project);
    local.container.fleet.create({ projectPath: project, authMode: 'api-key' });
    const context = await browser.newContext({
      viewport: { width: 390, height: 560 }, deviceScaleFactor: 1, isMobile: true,
    });
    const page = await context.newPage();
    try {
      await page.route('**/operator/ssh-session/status', route => route.fulfill({
        status: 200, contentType: 'application/json', body: '{"verified":false}',
      }));
      await page.goto(`${local.baseUrl}/app/fleet?token=local-preview-token`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Configure', exact: true }).first().click();
      const modal = page.getByRole('dialog', { name: 'AI access to this computer' });
      await modal.getByRole('button', { name: 'Advanced settings', exact: true }).click();
      const dimensions = await modal.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const body = element.querySelector('[data-modal-scroll-content]') as HTMLElement | null;
        return {
          top: rect.top, bottom: rect.bottom, viewport: window.innerHeight,
          scrollHeight: body?.scrollHeight ?? 0, clientHeight: body?.clientHeight ?? 0,
        };
      });
      expect(dimensions.top).toBeGreaterThanOrEqual(0);
      expect(dimensions.bottom).toBeLessThanOrEqual(dimensions.viewport);
      expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);
      await modal.locator('[data-modal-scroll-content]').evaluate(element => {
        element.scrollTop = element.scrollHeight;
      });
      expect(await modal.getByRole('button', { name: 'Save advanced settings' }).isVisible()).toBe(true);
      // Close must remain accessible even while the long content scrolls.
      await modal.getByRole('button', { name: 'Close dialog' }).click();
      expect(await modal.count()).toBe(0);
    } finally {
      await context.close();
      await new Promise<void>(resolve => local.server.close(() => resolve()));
      rmSync(local.root, { recursive: true, force: true });
    }
  });

  it('rejects one-click host enrollment in Fleet Configure without an OS-verified owner session', { timeout: 30_000 }, async () => {
    const local = await startHarness();
    const page = await desktop.newPage();
    const project = join(local.root, 'fleet-project');
    mkdirSync(project);
    const { instance } = local.container.fleet.create({ projectPath: project, authMode: 'api-key' });
    let statusReads = 0;
    let privilegedWrites = 0;
    let legacyWrites = 0;
    try {
      // This ordinary browser has NO OS-owner session. Model an explicit
      // unverified status response rather than issuing a fake bootstrap grant.
      await page.route('**/operator/ssh-session/status', async route => {
        statusReads++;
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ verified: false }),
        });
      });
      await page.route('**/fleet/*/one-click-trusted-host', async route => {
        if (route.request().method() !== 'GET') {
          privilegedWrites++;
          return route.fulfill({ status: 403, body: '{"error":"VERIFIED_OWNER_SESSION_REQUIRED"}' });
        }
        return route.continue();
      });
      await page.route(/\/fleet\/[^/]+\/(profile-intents|preset|policy|terminal)$/, async route => {
        if (route.request().method() !== 'GET') legacyWrites++;
        await route.fulfill({ status: 403, body: 'legacy host authorization route must not run' });
      });
      await page.goto(`${local.baseUrl}/app/fleet?token=local-preview-token`, { waitUntil: 'networkidle' });
      // Quickstart is prominent; manual sandbox settings stay collapsed.
      await page.getByRole('textbox', { name: 'Folder path to provision' }).fill(project);
      const quickStartCta = page.getByRole('button', {
        name: 'Verify in VS Code to create Fleet', exact: true,
      });
      await quickStartCta.waitFor({ state: 'visible', timeout: 6_000 });
      expect(await quickStartCta.isEnabled()).toBe(true);
      expect(await page.getByText('Advanced: manual Fleet setup', { exact: false }).isVisible()).toBe(true);
      expect(await page.getByRole('button', { name: 'Provision manually' }).isVisible()).toBe(false);
      // An ordinary localhost/forwarded browser can initiate a verified owner
      // handoff without gaining authority or invoking any privileged mutation.
      const verifyCta = page.getByRole('button', {
        name: 'Verify in VS Code to allow AI access', exact: true,
      });
      await verifyCta.waitFor({ state: 'visible', timeout: 6_000 });
      expect(await verifyCta.isEnabled()).toBe(true);
      await page.getByRole('button', { name: 'Configure', exact: true }).first().click();
      const modal = page.getByRole('dialog');
      await modal.getByText('Allow AI to work on this computer').waitFor({ timeout: 6_000 });
      // No profile-intent CLI flow should ever be surfaced as a prerequisite.
      expect(await modal.getByText(/folderforge operator trusted-host approve/).count()).toBe(0);
      // Config must offer a verified VS Code handoff, not a doomed host mutation.
      expect(await modal.getByRole('button', { name: 'Allow AI access', exact: true }).count()).toBe(0);
      const verifyInModal = modal.getByRole('button', {
        name: 'Verify in VS Code to allow AI access', exact: true,
      });
      await verifyInModal.waitFor({ state: 'visible', timeout: 6_000 });
      expect(await verifyInModal.isEnabled()).toBe(true);

      // Advanced trusted-host changes also require the verified handoff.
      await modal.getByRole('button', { name: 'Advanced settings', exact: true }).click();
      await modal.getByRole('combobox', { name: 'Terminal execution' }).selectOption('trusted-host');
      const verifyAdvanced = modal.getByRole('button', {
        name: 'Verify in VS Code to save AI access', exact: true,
      });
      await verifyAdvanced.waitFor({ state: 'visible', timeout: 6_000 });
      expect(await verifyAdvanced.isEnabled()).toBe(true);

      // Polling may repeat owner status reads, but no privileged/legacy mutation occurs.
      expect(statusReads).toBeGreaterThanOrEqual(1);
      expect(privilegedWrites).toBe(0);
      expect(legacyWrites).toBe(0);
      expect(local.container.fleet.get(instance.id)).toMatchObject({
        authMode: 'api-key',
        terminalExecution: 'sandbox-required',
      });
    } finally {
      await page.close();
      await new Promise<void>(resolve => local.server.close(() => resolve()));
      rmSync(local.root, { recursive: true, force: true });
    }
  });

  it('labels an unavailable task worktree without exposing discard action', { timeout: 30_000 }, async () => {
    const gitHarness = await startHarness(true);
    const page = await desktop.newPage();
    try {
      const isolation = gitHarness.container.isolation.create('visual-missing-health');
      execFileSync('git', ['worktree', 'remove', '--force', isolation.worktreeRoot], { cwd: gitHarness.root });
      await page.goto(`${gitHarness.baseUrl}/app/`, { waitUntil: 'networkidle' });
      await page.getByText('Health: Worktree missing').waitFor({ state: 'visible' });
      expect(await page.getByRole('button', { name: /Discard/ }).count()).toBe(0);
      expect(await page.getByText(isolation.taskId).count()).toBeGreaterThan(0);
    } finally {
      await page.close();
      await new Promise<void>((resolve) => gitHarness.server.close(() => resolve()));
      rmSync(gitHarness.root, { recursive: true, force: true });
    }
  });

  it('rejects stale discard confirmation without erasing task metadata or branch', { timeout: 30_000 }, async () => {
    const gitHarness = await startHarness(true);
    const page = await desktop.newPage();
    try {
      const isolation = gitHarness.container.isolation.create('visual-confirm-race');
      const statePath = join(gitHarness.root, '.git', 'folderforge', 'isolations.json');
      const before = readFileSync(statePath);
      await page.goto(`${gitHarness.baseUrl}/app/`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Discard…' }).click();
      await page.getByRole('button', { name: 'Confirm discard' }).waitFor({ state: 'visible' });
      execFileSync('git', ['worktree', 'remove', '--force', isolation.worktreeRoot], { cwd: gitHarness.root });
      await page.getByRole('button', { name: 'Confirm discard' }).click();
      await page.getByText(/ISOLATION_WORKTREE_MISSING/).waitFor({ state: 'visible' });
      expect(readFileSync(statePath)).toEqual(before);
      expect(execFileSync('git', ['show-ref', '--verify', `refs/heads/${isolation.branch}`], { cwd: gitHarness.root, encoding: 'utf8' })).toContain(isolation.branch);
    } finally {
      await page.close();
      await new Promise<void>((resolve) => gitHarness.server.close(() => resolve()));
      rmSync(gitHarness.root, { recursive: true, force: true });
    }
  });
});
