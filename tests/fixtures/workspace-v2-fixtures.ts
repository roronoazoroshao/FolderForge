import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isPathWithin } from '../../src/core/path-identity.js';

/** Owned, disposable fixture only; never use it as a product security guard. */
export function createV2Fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'ff-v2-fixture-')));
  const alpha = join(root, 'alpha');
  const beta = join(root, 'beta');
  mkdirSync(alpha);
  mkdirSync(beta);
  return {
    root,
    alpha,
    beta,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

/** Prevents an integration fixture from writing to the real operator's files. */
export function ensureFixturePath(root: string, candidate: string): string {
  const resolvedRoot = realpathSync(root);
  const resolvedCandidate = realpathSync(candidate);
  if (!isPathWithin(resolvedRoot, resolvedCandidate)) {
    throw new Error('FIXTURE_OUTSIDE_ROOT');
  }
  return resolvedCandidate;
}
