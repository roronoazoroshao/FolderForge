/**
 * Disposable cross-process integration fixture: DO NOT use as a production CLI.
 * It accepts a test-only private IPC root from the test harness and intentionally
 * does not mint or expose Dashboard/Fleet authorization.
 */
import { runSshDashboardHelper } from '../../src/operator/ssh-session-helper.js';
import { openSshOperatorIpcClient } from '../../src/operator/ssh-operator-ipc.js';
import { sshOperatorIpcSocketPath } from '../../src/operator/ssh-session-runtime.js';

async function main(): Promise<void> {
  const operatorRoot = process.argv[2];
  if (typeof operatorRoot !== 'string' || !operatorRoot) {
    throw new Error('TEST_OPERATOR_ROOT_REQUIRED');
  }
  if (typeof process.getuid !== 'function') {
    throw new Error('UNSUPPORTED_HOST');
  }
  const uid = process.getuid();
  const remote = await openSshOperatorIpcClient(
    sshOperatorIpcSocketPath(operatorRoot), uid,
  );
  await runSshDashboardHelper({
    osUid: uid,
    stdin: process.stdin,
    stdout: process.stdout,
  }, remote);
}

main().catch(error => {
  process.stderr.write(String(error) + '\n');
  process.exitCode = 1;
});
