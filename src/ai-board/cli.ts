/** Explicit operator-invoked, read-only multi-agent reviewer CLI (not production auto-deploy). */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { runAiReviewBoard, verifyBoardReportDigest, type BoardReport, type ReviewStage } from './board.js';
import { createOpenAIReviewerProvider } from './openai-provider.js';

function parseArgs(argv: readonly string[]) {
  let stage = '';
  let sourceSha = '';
  let out = '';
  let previous = '';
  let model = '';
  let execute = false;
  const artifacts: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]!;
    if (flag === '--execute') { execute = true; continue; }
    if (flag === '--help') {
      process.stdout.write('Usage: npm run review:ai -- --stage GOAL|ROADMAP|SPEC|PLAN|TASK|PR --source-sha <40-hex> --artifact <path> [--artifact ...] [--previous <report.json>] [--out <report.json>] [--execute --model <model>]\nWithout --execute this is a zero-network NOT_QUORATE dry run.\n');
      return null;
    }
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    if (flag === '--stage') stage = value;
    else if (flag === '--source-sha') sourceSha = value;
    else if (flag === '--artifact') artifacts.push(value);
    else if (flag === '--previous') previous = value;
    else if (flag === '--out') out = value;
    else if (flag === '--model') model = value;
    else throw new Error(`Unknown AI board argument: ${flag}`);
  }
  if (!['GOAL', 'ROADMAP', 'SPEC', 'PLAN', 'TASK', 'PR'].includes(stage)) throw new Error('Invalid or missing --stage');
  if (!/^[0-9a-f]{40}$/i.test(sourceSha)) throw new Error('Missing exact --source-sha (40 hex)');
  if (artifacts.length === 0 || artifacts.length > 8) throw new Error('Provide 1–8 --artifact files');
  return { stage: stage as ReviewStage, sourceSha, artifacts, previous, out, model, execute };
}

function within(root: string, input: string): string {
  const path = realpathSync(isAbsolute(input) ? input : resolve(root, input));
  const suffix = relative(root, path);
  if (suffix === '..' || suffix.startsWith('..' + sep) || isAbsolute(suffix)) {
    throw new Error('Evidence outside the reviewed repository is not allowed');
  }
  if (!statSync(path).isFile()) throw new Error(`Artifact is not a file: ${input}`);
  return path;
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  const args = parseArgs(argv);
  if (!args) return 0;
  const root = realpathSync(process.cwd());
  const actualSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', timeout: 5_000 }).trim();
  if (actualSha !== args.sourceSha) throw new Error('Source SHA differs from current checkout HEAD; review an exact checkout');
  const evidence = args.artifacts.map(artifact => {
    const file = within(root, artifact);
    if (statSync(file).size > 240_000) throw new Error('Artifact size exceeds review limit');
    return { path: relative(root, file), content: readFileSync(file, 'utf8') };
  });
  let previous: BoardReport | undefined;
  if (args.previous) {
    const parsed: unknown = JSON.parse(readFileSync(resolve(args.previous), 'utf8'));
    previous = parsed as BoardReport;
    if (!verifyBoardReportDigest(previous)) throw new Error('Previous review integrity checksum failed');
  }
  if (args.execute && !args.out) throw new Error('--execute requires --out to preserve evidence');
  let provider;
  if (args.execute) {
    const model = args.model || process.env.FOLDERFORGE_AI_BOARD_MODEL;
    if (!model || !process.env.OPENAI_API_KEY) throw new Error('Reviewer model and API key must be explicitly configured');
    // Prevent sending uncommitted code/evidence to a remote model under a misleading committed SHA.
    const changed = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8', timeout: 5_000 });
    if (changed.trim()) throw new Error('Tracked files have uncommitted changes; reviewer execution requires clean checkout');
    for (const item of evidence) {
      try {
        execFileSync('git', ['ls-files', '--error-unmatch', '--', item.path], {
          cwd: root, encoding: 'utf8', timeout: 5_000, stdio: 'pipe',
        });
      } catch {
        throw new Error('Execution can send only committed tracked evidence files');
      }
    }
    provider = createOpenAIReviewerProvider({ apiKey: process.env.OPENAI_API_KEY, model });
  }
  const report = await runAiReviewBoard({ stage: args.stage, sourceSha: args.sourceSha, evidence, ...(previous ? { previous } : {}), ...(provider ? { provider } : {}) });
  if (args.out) {
    const dest = resolve(args.out);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  }
  process.stdout.write(`${args.stage}: ${report.state} | valid votes ${report.quorum}/8 | blockers ${report.blockers.join(',') || 'none'} | digest ${report.decisionDigest}\n`);
  return report.state === 'APPROVED' ? 0 : 2;
}

if (process.argv[1] && /(?:\/|^)cli\.(?:ts|js)$/.test(process.argv[1])) {
  main().then(code => { process.exitCode = code; }).catch(error => {
    process.stderr.write(`AI board: ${error instanceof Error ? error.message : 'unknown error'}\n`);
    process.exitCode = 1;
  });
}
