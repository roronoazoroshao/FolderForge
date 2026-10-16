# SPA visual regression suite (proposal 018)

Pixel-level visual regression tests for the Mission Control SPA
(`packages/mission-control`, 9 screens). The suite boots the real dashboard
harness (fixture data, no auth, ephemeral loopback port), serves the BUILT
SPA at `/app/`, drives headless Chromium via `playwright-core`, and compares
each screen against the committed baselines in `baselines/`.

## Running

```sh
npm run build                 # the suite reads the built SPA from dist/
npx vitest run tests/visual   # compare against baselines
```

The suite runs **real browser behavioral and 390px overflow assertions** when
Chromium is available, but pixel comparisons are **not portable across host
fonts, installed browsers, and rendering libraries**. Ordinary `npm test`,
`npm run release:check`, and local `npm publish` do not compare arbitrary
local screenshot pixels against Linux CI baselines. This prevents release
preflight from failing solely because the publisher's Linux desktop uses
different fonts or Chrome from CI.

Pixel tests are **mandatory**, not deleted: the `visual-pixels` job in
`.github/workflows/ci.yml` runs them on every PR and main push using
Ubuntu 24.04, Node 22, and the Chromium revision pinned by `playwright-core`
in `package-lock.json`. Its environment sets both
`FF_VISUAL_REQUIRE_BROWSER=1` and `FF_VISUAL_SNAPSHOTS=1` so a missing
browser cannot silently yield PASS.

## Running pixel comparisons in the canonical CI environment

```sh
FF_VISUAL_REQUIRE_BROWSER=1 FF_VISUAL_SNAPSHOTS=1 npx vitest run tests/visual/spa-visual.test.ts
```

That command is intended **only** for the pinned CI image. Local machines
should run `npm test` for functional behavior and consult the required
`visual-pixels` PR check for screenshot stability.

## Regenerating baselines (intentionally, never as a reflex)

```sh
FF_VISUAL_UPDATE=1 FF_VISUAL_SNAPSHOTS=1 npx vitest run tests/visual/spa-visual.test.ts
```

Run updates **only** in the canonical CI image with matching locked browser,
review the screenshots and affected filenames, and keep the 0.2% threshold
unchanged. The mobile screenshot width must actually be **390px**; a browser
snapshot wider than the viewport is a responsive defect, not an acceptable
golden baseline.

## Thresholds (locked by QA — never bump to hide churn)

- Per-channel tolerance: 12 (absorbs anti-alias noise).
- Fail when more than 0.2% of pixels differ, or on any dimension mismatch.
- On failure the actual and heat-map PNGs land in `/tmp/ff-visual-*` and the
  assertion message names them.

## Stability mechanics

- Animations and transitions are disabled via injected CSS before every
  screenshot.
- Settle = `networkidle` + one 300ms beat past the first data paint.
- Any page request off `127.0.0.1` is aborted **and fails the test** — the
  SPA must stay fully self-contained.
- Any masked (excluded) region in a screenshot must carry a code comment
  with evidence of why it churns.
