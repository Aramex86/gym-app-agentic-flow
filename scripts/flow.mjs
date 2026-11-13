// scripts/flow.mjs - the pipeline Flow: full circle + fix loop + committer step.
// SANDBOX MODE (default): every circle runs in its own git worktree copy of
// the repo -> hops never touch your main working tree; results land on a
// dedicated feat/<name> branch in the work/ dir. Cleanup: after merge,
//   git worktree remove work/<name>
// Opt-out: pnpm flow tasks\<x>.md --no-wt (run everything in main checkout).
// Usage:
//   pnpm flow tasks\<date>-<name>.md     planner->[Y]->developer->[Y]->tester->[committer Y]
//   pnpm flow:fix                        newest FAIL report -> fix rounds (max 3) -> PASS
// Plain Node. No PowerShell, no ExecutionPolicy issues.

import { existsSync, readFileSync, readdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve, isAbsolute, basename as pathBasename } from 'node:path';
import readline from 'node:readline/promises';
import * as trace from './trace.mjs';
import { stdin as input, stdout as output } from 'node:process';

const exit = (code, msg) => { if (msg) console.error(msg); process.exit(code); };
const isY = (s) => /^\s*y(es)?\s*$/i.test(s || '');

async function ask(question) {
  if (input.readableEnded) return '';          // EOF (piped/scripted runs) -> treat as N
  const rl = readline.createInterface({ input, output });
  try { return (await rl.question(question)).trim(); } finally { rl.close(); }
}

const git = (args, opts = {}) => spawnSync('git', args, { stdio: 'pipe', ...opts });
const gitRun = (args, cwd) => spawnSync('git', args, { stdio: 'inherit', cwd });

function hop(args, cwd, rid) {
  const script = join(process.cwd(), 'scripts', 'run-agent.mjs');
  const r = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit', cwd, env: { ...process.env, PIPELINE_RUN_ID: rid, PIPELINE_TRACE_BASE: process.cwd() } });
  if (r.status) trace.ev(rid, { event: 'hop_failed', role: args[0], exit: r.status });
  return r.status ?? 1;
}

const newestReport = (dir = 'docs/plans') => {
  const p = join(dir);
  if (!existsSync(p)) return null;
  const files = readdirSync(p).filter((f) => f.endsWith('-report.md'))
    .map((f) => join(dir, f));
  return files[files.length - 1] ?? null;
};

const verdict = (file, cwd) => (readFileSync(file, 'utf8').split('\n')[0] || '').trim().toUpperCase();

const ROLE_COLOR = { planner: '\x1b[32m', developer: '\x1b[38;5;208m', tester: '\x1b[36m', committer: '\x1b[35m' };
const clog = (role, text) => console.log((ROLE_COLOR[role] || '') + text + '\x1b[0m');

const MAX_FIX_ROUNDS = 3;

// ---------- COMMITTER STEP ----------
// after PASS: show the copy-ready commit; on Y the TOOL runs git add+commit
// inside the sandbox (or main checkout with --no-wt). The committer role
// itself never touches git; a human Y executes it.
function parseCommitMd(text) {
  const msg = text.match(/^COMMIT MESSAGE:\s*(.+)$/m)?.[1]?.trim();
  const pr = text.match(/^PR TITLE:\s*(.+)$/m)?.[1]?.trim();
  const add = (text.match(/^ADD LIST:\n([\s\S]*?)\nPR TITLE:/m)?.[1] || '')
    .split('\n').map((l) => l.trim()).filter(Boolean);
  return { msg, pr, add };
}
async function committerStep(_name, report, cwd, rid) {
  // derive the name from the report's BASENAME (the report may be passed as
  // an absolute path -> name would otherwise contain directories)
  const name = pathBasename(String(report)).replace(/\.md$/, '').replace(/-report$/, '');
  console.log('\n===> COMMITTER (copy-ready)');
  if (hop(['committer', '-i', report], cwd, rid) !== 0) {
    console.log('(committer hop failed - commit by hand)');
    return;
  }
  const cm = `docs/plans/${name}-commit.md`;
  if (!existsSync(join(cwd, cm))) { console.log('(no commit artifact produced)'); return; }
  const text = readFileSync(join(cwd, cm), 'utf8');
  const { msg, pr, add } = parseCommitMd(text);
  if (!msg || !add.length) { console.log(text); console.log('(not parseable - commit by hand)'); return; }
  console.log('\nCOMMIT: ' + msg);
  console.log('FILES:\n  ' + add.join('\n  '));
  console.log('PR TITLE: ' + (pr || msg));
  if (!isY(await ask('\nAccept and commit? (Y/N): '))) { console.log('skipped - commit by hand'); trace.ev(rid, { event: 'gate', gate: 'commit', result: 'N' }); return; }
  trace.ev(rid, { event: 'gate', gate: 'commit', result: 'Y' });
  const wtRef = String(cwd) === process.cwd() ? '(--no-wt)' : (String(cwd).replace(/\\/g,'/').startsWith('/') ? cwd : join(process.cwd(), cwd));
  const pending = git(['status', '--porcelain', ...add], { cwd }).stdout.toString().trim();
  if (!pending) { console.log('files already committed - nothing to commit (skipping git steps)'); return; }
  const a = spawnSync('git', ['add', ...add], { stdio: 'inherit', cwd });
  if (a.status !== 0) exit(1, 'git add failed');
  const c = spawnSync('git', ['commit', '-m', msg], { stdio: 'inherit', cwd });
  if (c.status !== 0) exit(1, 'git commit failed');
  clog('committer', `\nCommitted: ${msg}`);
  console.log('\n' + '='.repeat(60));
  console.log('FINISH (human):');
  console.log('  1) git push -u origin HEAD   (or: git push origin ' + (git(['branch','--show-current'],{cwd}).stdout.toString().trim() || 'feat/<name>') + ')');
  console.log('  2) PR: gh pr create --base develop --head feat/<name>');
  console.log('  3) review -> merge (human only)');
  console.log('  4) ' + (cwd !== process.cwd() ? 'git worktree remove ' + wtRef + ' --force; git branch -d feat/<name>' : '(no worktree in this run)'));
  console.log('='.repeat(60));

  console.log(`After merge, cleanup: git worktree remove ${cwd}`);
}

// ---------- FIX LOOP ----------
async function fixLoop(opts) {
  const cwd = opts.cwd ?? process.cwd();
  const base = resolve(cwd);          // absolute from here on: no double-joins
  const inCwd = (p) => (isAbsolute(p) ? p : join(base, p));
  const rid = opts.rid;
  for (let round = 1; round <= MAX_FIX_ROUNDS; round++) {
    const report = newestReport(join(base, 'docs/plans'));
    if (!report) exit(1, 'no *-report.md found in docs/plans');
    const repPath = inCwd(report);
    const v = verdict(repPath);
    if (v.startsWith('PASS')) exit(0, `PASS already. Nothing to fix. (${report})`);

    // "uncommitted work" blocker: if the human has since committed (clean
    // tree in the sandbox) the blocker is stale -> skip dev, re-test only.
    let skipDevHop = false;
    if (/not committed|uncommitted|committed anywhere/i.test(readFileSync(repPath, 'utf8'))) {
      const st = spawnSync('git', ['status', '--porcelain'], { cwd }).stdout.toString().trim();
      if (st) {
        const short = spawnSync('git', ['status', '--short'], { cwd }).stdout.toString().trim();
        console.error('\n' + '='.repeat(62));
        console.error('HUMAN STEP REQUIRED - the report says the work is uncommitted.');
        console.error(`(sandbox: ${cwd} on branch feat/<task>)`);
        console.error('='.repeat(62));
        console.error('Auto-fix cannot commit for you (agents never commit).');
        console.error('\nFiles waiting in the sandbox working tree:\n');
        console.error('  ' + short.replace(/\n/g, '\n  '));
        console.error('\nYour move (scoped to the deliverables only):');
        console.error('   1) git add <the task files listed above>');
        console.error('   2) git commit -m "feat(<task>): <what was built> (tests in same commit)"');
        console.error('   3) re-run:  pnpm flow:fix   <- skips the fix hop, just re-tests');
        console.error('='.repeat(62));
        process.exit(1);
      }
      skipDevHop = true;
      console.log('blocker (uncommitted work) resolved by a human commit -> re-test only');
    }

    if (skipDevHop) {
      const base2 = report.replace(/-report\.md$/, '');
      clog('tester', '\n===> RE-TEST');
      if (hop(['tester', '-i', `${base2}-plan.md`], cwd, rid) !== 0) exit(1, 'tester hop failed');
      if (verdict(inCwd(newestReport(join(base, 'docs/plans')))).startsWith('PASS')) {
        console.log('PASS (re-test only).');
        await committerStep(base2, report, cwd, rid);
        return;
      }
      console.log('still FAIL - continuing fix rounds');
      continue;
    }

    clog('developer', `\n===> FIX round ${round} (${report})`);
    if (hop(['developer', '-i', report,
      'fix ONLY the items in the bug-log of the input report (it starts with FAIL). Touch no files beyond what the bug-log names. Tests in same commit.'], cwd) !== 0) {
      exit(1, 'developer fix hop failed');
    }

    const baseNm = report.replace(/-report\.md$/, '');
    clog('tester', `\n===> RE-TEST (round ${round})`);
    if (hop(['tester', '-i', `${baseNm}-plan.md`], cwd, rid) !== 0) exit(1, 'tester hop failed');

    if (verdict(inCwd(newestReport(join(base, 'docs/plans')))).startsWith('PASS')) {
      console.log(`PASS after ${round} fix round(s).`);
      await committerStep(baseNm, report, cwd, rid);
      return;
    }
    console.log(`still FAIL after round ${round} - looping`);
  }
  exit(1, `FAIL persists after ${MAX_FIX_ROUNDS} rounds - escalate: re-plan the task manually.`);
}

// ---------- SANDBOX ----------
// sandbox dirs must never be committed; add /work/ to .gitignore once
function ensureWorktreeIgnored() {
  if (!existsSync('.gitignore')) writeFileSync('.gitignore', '/work/\n.pipeline/\n.pipeline-last-run.log\n');
  else if (!/^\/?work\/?$/m.test(readFileSync('.gitignore', 'utf8'))) appendFileSync('.gitignore', '\n/work/\n');
}

function ensureWorktree(name) {
  const wt = join('work', name);
  git(['worktree', 'prune']);
  const wanted = ('/' + wt.replace(/[\\/]/g, '/')).replace('//', '/');
  const listed = git(['worktree', 'list']).stdout.toString().split('\n')
    .some((l) => l.replace(/[\\/]/g, '/').includes(wanted));
  if (listed && existsSync(wt)) return wt;
  const br = `feat/${name}`;
  const base = git(['rev-parse', '--verify', 'develop']).status === 0 ? 'develop' : 'HEAD';
  // three states: reuse existing worktree; branch already exists (e.g. an
  // earlier run died after worktree add) -> re-attach WITHOUT -b; brand new.
  const hasBranch = git(['rev-parse', '--verify', br]).status === 0;
  const args = hasBranch ? ['worktree', 'add', wt, br] : ['worktree', 'add', wt, '-b', br, base];
  const r = gitRun(args);
  if (r.status !== 0) exit(1, `worktree add failed (branch ${br}, base ${base})`);
  // deps: the TOOL provisions the sandbox (junction lacks .bin - proven)
  if (!existsSync(join(wt, 'node_modules', '.bin'))) {
    spawnSync('git', ['add', '-A'], { cwd: wt, stdio: 'pipe' });
    spawnSync('git', ['reset', '-q', '--', '.'], { cwd: wt, stdio: 'pipe' });
    for (const stub of ['eslint.cmd', 'tsc.cmd', 'vitest.cmd', 'vite.cmd']) {
      try { rmSync(join(wt, stub), { force: true }); } catch {}
    }
    console.log('deps: pnpm install --frozen-lockfile in sandbox ...');
    // shell:true on Windows: pnpm is a .cmd shim (spawnSync without shell = ENOENT)
    const pi = spawnSync('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], { cwd: wt, stdio: 'inherit', shell: true });
    if (pi.status !== 0 || pi.error) {
      console.error('FLOW STOP: pnpm install failed (' + (pi.error?.code || 'exit ' + pi.status) + ') - fix deps in ' + wt + ' by hand');
      process.exit(1);
    }
  }
  return wt;
}

const [, , arg1] = process.argv;
function latestSandbox() {
  const b = join('.pipeline', 'runs');
  if (!existsSync(b)) return null;
  const ids = readdirSync(b).sort();
  for (let i = ids.length - 1; i >= 0; i--) {
    const p = join(b, ids[i], 'trace.jsonl');
    if (!existsSync(p)) continue;
    const lines = readFileSync(p, 'utf8').split('\n').filter(Boolean);
    for (let j = lines.length - 1; j >= 0; j--) {
      try {
        const o = JSON.parse(lines[j]);
        if (o.event === 'circle_start' && o.name && o.sandbox) {
          const wt = join('work', o.name);
          if (existsSync(wt)) return wt;
        }
      } catch {}
    }
  }
  return null;
}

if (arg1 === '--fix' || arg1 === '-fix') {
  const wt = latestSandbox();
  const wd = wt ?? process.cwd();
  console.log(wt ? `fix target (sandbox): ${wd}` : 'fix target: main checkout (no live sandbox found)');
  await fixLoop({ cwd: wd });
  process.exit(0);
}

console.log('\x1b[32m===> FLOW\x1b[0m');
console.log('SANDBOX MODE: hops run in their own git worktree copy; your main tree stays clean.');
console.log('Cleanup after merge: git worktree remove work/<name>. Opt-out: --no-wt.');
let task = arg1, opts = {};
for (let i = 2; i < process.argv.length; i++) if (process.argv[i] === '--no-wt') opts.sandbox = false;
if (opts.sandbox === undefined) opts.sandbox = true;
if (!task || !existsSync(task)) exit(1, 'usage: pnpm flow tasks\\<date>-<name>.md [--no-wt]   |   pnpm flow:fix');

const name = task.replace(/^.*[\\/]/, '').replace(/\.md$/, '').replace(/-plan$/, '');
const plan = 'docs/plans/' + name + '-plan.md';
const report = 'docs/plans/' + name + '-report.md';

const rid = trace.newRun(name);
let wt = process.cwd();
if (opts.sandbox) { ensureWorktreeIgnored(); wt = ensureWorktree(name); }
trace.ev(rid, { event: 'circle_start', task, name, sandbox: opts.sandbox });
if (opts.sandbox) {
  console.log('sandbox: ' + wt);
  // make the task doc visible inside the sandbox (it may be untracked)
  const { copyFileSync, mkdirSync } = await import('node:fs');
  const dst = join(wt, task);
  if (!existsSync(dst)) {
    mkdirSync(join(wt, task, '..'), { recursive: true });
    spawnSync(process.execPath, ['-e', `require('fs').copyFileSync(${JSON.stringify(task)}, ${JSON.stringify(dst)})`]);
  }
}

const inWt = (p) => join(wt, p);

clog('planner', '\n===> PLANNER');
if (hop(['planner', '-i', task], wt, rid) !== 0) exit(1, 'planner hop failed');
console.log(`\n>> plan written (in sandbox): ${inWt(plan)}`);
if (!isY(await ask('Read the plan. Continue to developer? (Y/N): '))) exit(0, 'flow stopped at plan gate (sandbox preserved: work/' + name + ')'); trace.ev(rid, { event: 'gate', gate: 'plan', result: 'N' });

clog('developer', '\n===> DEVELOPER');
trace.ev(rid, { event: 'gate', gate: 'plan', result: 'Y' });
if (hop(['developer', '-i', plan, 'implement the plan from the input file'], wt, rid) !== 0) exit(1, 'developer hop failed');

console.log('\n>> working tree after developer (sandbox):');
spawnSync('git', ['status', '--short'], { stdio: 'inherit', cwd: wt });
spawnSync('git', ['diff', '--stat'], { stdio: 'inherit', cwd: wt });
if (!isY(await ask('Continue to tester? (Y/N): '))) exit(0, 'flow stopped before tester'); trace.ev(rid, { event: 'gate', gate: 'diff', result: 'N' });

clog('tester', '\n===> TESTER');
trace.ev(rid, { event: 'gate', gate: 'diff', result: 'Y' });
if (hop(['tester', '-i', plan], wt, rid) !== 0) exit(1, 'tester hop failed');

console.log('\x1b[32m\n===> VERDICT\x1b[0m');
console.log(readFileSync(inWt(report), 'utf8').split('\n').slice(0, 3).join('\n'));
trace.ev(rid, { event: 'verdict', result: verdict(inWt(report)).startsWith('FAIL') ? 'FAIL' : 'PASS' });
if (verdict(inWt(report)).startsWith('FAIL')) exit(1, '\nFAIL detected - auto fix loop:  pnpm flow:fix');
console.log('PASS.');
await committerStep(name, report, wt, rid);
