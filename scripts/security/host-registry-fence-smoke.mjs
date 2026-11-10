#!/usr/bin/env node
/**
 * Linux kernel DAC experiment on a disposable /tmp directory, NOT a Poker
 * migration, NOT a proof that every host writer is confined.
 * Docker is used only to create isolated process UIDs and transfer ownership of
 * a brand-new fixture. No network, no host Git mount, no persistent container.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { chmodSync, existsSync, lstatSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const fail = message => { throw new Error(message); };
if (process.platform !== 'linux' || typeof process.getuid !== 'function')
  fail('Linux-only DAC test; no production access was attempted.');
if (process.getuid() === 0) fail('Run as an unprivileged fixture creator.');
const legacyUid = process.getuid();
const fencedUid = 40000 + (process.pid % 10000);
const fixture = mkdtempSync(join(tmpdir(), 'folderforge-dac-fence-fixture-'));
if (!lstatSync(fixture).isDirectory() || lstatSync(fixture).isSymbolicLink())
  fail('Unsafe fixture path.');
// Permit search by the separate bootstrap UID, never directory writes.
chmodSync(fixture, 0o711);
const registry = join(fixture, 'isolations.json');
const hash = value => createHash('sha256').update(value).digest('hex');
const assertBytes = (expected, step) => {
  const expectedHash = hash(expected);
  const actualHash = switched
    ? run(fencedUid, `const fs=require('node:fs');const crypto=require('node:crypto');console.log(crypto.createHash('sha256').update(fs.readFileSync('/fixture/isolations.json')).digest('hex'))`)
    : hash(readFileSync(registry));
  if (actualHash !== expectedHash) fail(step + ': existing registry bytes were not preserved');
};
const imageId = execFileSync('docker', ['image', 'inspect', 'node:22-alpine', '--format', '{{.Id}}'], {
  encoding: 'utf8', timeout: 10000,
}).trim();
if (!/^sha256:[a-f0-9]{64}$/.test(imageId)) fail('Require preinstalled exact Docker image ID; no pulls.');
const base = ['run', '--rm', '--pull=never', '--network=none', '--read-only',
  '--security-opt=no-new-privileges', '--pids-limit=64', '--memory=128m',
  '--mount', `type=bind,src=${fixture},dst=/fixture`];
function run(uid, source, { chown = false, expectedExit = 0 } = {}) {
  const args = [...base, '--cap-drop=ALL'];
  if (chown) args.push('--cap-add=CHOWN', '--cap-add=FOWNER');
  args.push('--user', `${uid}:${uid}`, imageId, 'node', '-e', source);
  const run = spawnSync('docker', args, { encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 });
  if (run.error || run.status !== expectedExit) fail(`container exit ${run.status} (expected ${expectedExit}): ${run.stderr || String(run.error)}`);
  return run.stdout.trim();
}
const denyCode = `const fs=require('node:fs');const path='/fixture/isolations.json';try{fs.writeFileSync(path+'.legacy-'+process.pid+'.tmp','STALE',{flag:'wx'});process.exit(41)}catch(e){if(e.code!=='EACCES'&&e.code!=='EPERM')process.exit(42)};try{fs.chmodSync('/fixture',0o777);process.exit(43)}catch(e){if(e.code!=='EACCES'&&e.code!=='EPERM')process.exit(44)};console.log('DENIED_BY_KERNEL_DAC');`;
const phase = (name, body) => process.stdout.write(`${name}: ${body}\n`);
const makeRegistry = label => {
  const isolations = [{ id: 'iso_disposable', taskId: label, state: 'active' }];
  return Buffer.from(JSON.stringify({
    version: 1, isolations, digest: 'sha256:' + hash(JSON.stringify(isolations)),
  }, null, 2) + '\n');
};
const initial = makeRegistry('initial');
writeFileSync(registry, initial, { mode: 0o600 });
let switched = false;
try {
  // PRE-MIGRATION: existing uid can replace a file in its own directory.
  const earlier = makeRegistry('legacy-before-' + randomUUID());
  const beforeWrite = `const fs=require('node:fs');const path='/fixture/isolations.json';const tmp=path+'.legacy-'+process.pid+'.tmp';fs.writeFileSync(tmp,${JSON.stringify(earlier.toString())},{flag:'wx',mode:0o600});fs.renameSync(tmp,path);`;
  run(legacyUid, beforeWrite);
  assertBytes(earlier, 'before migration');
  phase('BEFORE_MIGRATION', 'legacy writer succeeded on disposable directory');

  // MIGRATION: change kernel-owned directory to a different, dedicated UID.
  run(0, `const fs=require('node:fs');fs.chownSync('/fixture/isolations.json',${fencedUid},${fencedUid});fs.chownSync('/fixture',${fencedUid},${fencedUid});`, { chown: true });
  switched = true;
  if (run(legacyUid, denyCode) !== 'DENIED_BY_KERNEL_DAC') fail('Old writer unexpectedly retained access');
  assertBytes(earlier, 'during migration');
  phase('DURING_MIGRATION', 'legacy write and chmod denied by kernel');

  const trusted = makeRegistry('dedicated-writer-' + randomUUID());
  run(fencedUid, `const fs=require('node:fs');const path='/fixture/isolations.json';const tmp=path+'.epoch.tmp';fs.writeFileSync(tmp,${JSON.stringify(trusted.toString())},{flag:'wx',mode:0o600});fs.renameSync(tmp,path);`);
  assertBytes(trusted, 'trusted writer');
  phase('NEW_WRITER', 'dedicated UID successfully committed atomic replacement');

  if (run(legacyUid, denyCode) !== 'DENIED_BY_KERNEL_DAC') fail('Late legacy writer bypassed kernel');
  assertBytes(trusted, 'post-migration');
  phase('AFTER_MIGRATION', 'old identity still denied and new bytes preserved');

  // Power-loss analogue: terminate before rename; old state must survive.
  const fault = `const fs=require('node:fs');fs.writeFileSync('/fixture/isolations.json.orphan.tmp','INCOMPLETE',{flag:'wx',mode:0o600});process.exit(81);`;
  run(fencedUid, fault, {expectedExit: 81});
  assertBytes(trusted, 'pre-rename fault');
  phase('FAULT_BEFORE_RENAME', 'exit 81 left prior registry intact');
  if (run(legacyUid, denyCode) !== 'DENIED_BY_KERNEL_DAC') fail('Stale writer bypassed fencing after fault');
  phase('FAULT_POSTCHECK', 'late legacy writer still denied');

  // Also simulate the writer dying immediately AFTER rename: atomic old-or-new
  // bytes are visible, not a torn or half-written registry payload.
  const committed = makeRegistry('post-rename-crash-' + randomUUID());
  const afterFault = `const fs=require('node:fs');const p='/fixture/isolations.json';const t=p+'.postrename.tmp';fs.writeFileSync(t,${JSON.stringify(committed.toString())},{flag:'wx',mode:0o600});fs.renameSync(t,p);process.exit(82);`;
  run(fencedUid, afterFault, { expectedExit: 82 });
  assertBytes(committed, 'post-rename fault');
  if (run(legacyUid, denyCode) !== 'DENIED_BY_KERNEL_DAC') fail('Legacy write permitted after post-rename fault');
  phase('FAULT_AFTER_RENAME', 'exit 82 left complete committed registry, legacy denied');
  console.log('RESULT: PASS (isolated host DAC fixture only; no Poker host migration)');
} finally {
  if (switched) {
    // Return ownership only on the exact temporary fixture, so it can be removed.
    run(0, `const fs=require('node:fs');fs.chownSync('/fixture',${legacyUid},${legacyUid});`, { chown: true });
  }
  rmSync(fixture, {recursive:true,force:true});
  if (existsSync(fixture)) fail('Fixture cleanup failed.');
}
