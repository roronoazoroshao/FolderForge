import { resolve, relative, isAbsolute, sep } from 'node:path';
import picomatchLite from './glob-match.js';
import { PathEscapeError } from '../core/errors.js';
import { canonicalCandidatePath, isPathWithin } from '../core/path-identity.js';

/**
 * PathPolicy enforces the workspace boundary:
 *  - every path must resolve inside an allowed directory
 *  - symlink escapes are rejected
 *  - denied globs (secrets, node_modules, git internals) are blocked
 */
export class PathPolicy {
  private allowed: string[];
  private deniedGlobs: string[];

  constructor(allowedDirectories: string[], deniedGlobs: string[]) {
    this.allowed = allowedDirectories.map((d) => canonicalCandidatePath(d));
    this.deniedGlobs = deniedGlobs;
  }

  /** Resolve a (possibly relative) path against the project root and validate it. */
  resolveSafe(inputPath: string, projectRoot: string): string {
    const abs = isAbsolute(inputPath) ? resolve(inputPath) : resolve(projectRoot, inputPath);
    this.assertInsideAllowed(abs);
    this.assertNotDenied(abs, projectRoot);
    this.assertNoSymlinkEscape(abs);
    return abs;
  }

  isInsideAllowed(abs: string): boolean {
    const canonical = canonicalCandidatePath(abs);
    return this.allowed.some((root) => isPathWithin(root, canonical));
  }

  assertInsideAllowed(abs: string): void {
    if (!this.isInsideAllowed(abs)) {
      throw new PathEscapeError(`Path is outside allowed directories: ${abs}`);
    }
  }

  isDenied(abs: string, projectRoot: string): boolean {
    const rel = relative(projectRoot, abs).split(sep).join('/');
    const candidates = [rel, abs.split(sep).join('/')];
    return this.deniedGlobs.some((g) => candidates.some((c) => picomatchLite(g, c)));
  }

  assertNotDenied(abs: string, projectRoot: string): void {
    // A lexical alias to an owner-controlled file is not a different
    // authority. Check the nearest existing ancestor's realpath as well.
    const canonical = canonicalCandidatePath(abs);
    const canonicalRoot = canonicalCandidatePath(projectRoot);
    if (this.isDenied(abs, projectRoot) || this.isDenied(canonical, canonicalRoot)) {
      throw new PathEscapeError(`Path is denied by policy (secret/ignored): ${abs}`);
    }
    // Sensitive home folder aliases must not bypass the direct path check.
    const sensitive = ['/.ssh/', '/.aws/', '/.gnupg/', '/.config/gcloud/', '/.kube/'];
    if ([abs, canonical].some((path) =>
      sensitive.some((s) => path.toLowerCase().split('\\').join('/').includes(s)))) {
      throw new PathEscapeError(`Path touches a protected credential folder: ${abs}`);
    }
  }

  /** Resolve aliases/symlinks on the nearest existing ancestor and re-check the boundary. */
  assertNoSymlinkEscape(abs: string): void {
    const real = canonicalCandidatePath(abs);
    if (!this.isInsideAllowed(real)) {
      throw new PathEscapeError(`Symlink escapes the workspace boundary: ${abs} -> ${real}`);
    }
  }
}
