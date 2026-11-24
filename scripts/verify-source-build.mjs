import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function nonempty(path, label) {
  const full = join(root, path);
  try {
    const stat = statSync(full);
    if (stat.isFile() && stat.size > 0) return full;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  throw new Error(`${label} missing or empty: ${path}`);
}

try {
  nonempty('dist/main.js', 'FolderForge CLI');
  const source = nonempty('packages/mission-control/dist/index.html', 'Mission Control build');
  const packaged = nonempty('dist/dashboard/app/index.html', 'Mission Control packaged UI');
  if (!readFileSync(source).equals(readFileSync(packaged))) {
    throw new Error('Mission Control packaged UI does not match the built index.html');
  }
  console.log('[source-build] CLI and Mission Control entry assets verified');
} catch (error) {
  console.error(`[source-build] ${error.message}. Run npm run setup:source from the repository root.`);
  process.exitCode = 1;
}
