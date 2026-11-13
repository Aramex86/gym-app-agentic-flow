#!/usr/bin/env node
// scripts/eval.mjs - run a golden task through the pipeline and grade it.
// Usage: node scripts/eval.mjs evals/golden-<name>.md
// Reads the answer key from the golden file's frontmatter, runs planner ->
// developer -> mechanical fixture commit -> tester in ITS OWN sandbox
// worktree, then appends a row to evals/results/scoreboard.md.
// Human gates are intentionally OFF (an exam runs unattended); the fixture
// commit after the developer hop is done by THIS TOOL, not by an agent.
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, rmSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import * as trace from './trace.mjs';

const exit = (code, msg) => { if (msg) console.error(msg); process.exit(code); };
const root = resolve(process.cwd());

// ---- parse golden frontmatter (flat yaml-ish, no dependencies) ----
const [, , goldenPath] = process.argv;
if (!goldenPath || !existsSync(goldenPath)) exit(3, 'usage: node scripts/eval.mjs evals/golden-<name>.md');
const raw = readFileSync(goldenPath, 'utf8');
const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] || '';
const list = (key) => {
  // supports both inline lists [a, b] and multiline dash-lists (- a \n - b)
  const inline = fm.match(new RegExp(key + ':\\s*\\[([^\\]]*)\\]'));
  if (inline) return inline[1].split(',').map((x) => x.trim()).filter(Boolean);
  const block = fm.match(new RegExp(key + ':\\s*\\n((?:[ \\t]*-[ \\t]*.+\\n?)+)'));
  if (block) return block[1].split('\n').map((l) => l.replace(/^[ \\t]*-[ \\t]*/, '').split('#')[0].trim()).filter(Boolean);
  return [];
};
const num = (key) => parseInt(fm.match(new RegExp(key + ':\\s*(\\d+)'))?.[1] || '0', 10); // nested keys matched by leaf name
const expected = {
  files_exist: list('files_exist'),
  gates: list('gates'),
  verdict: (fm.match(/verdict:\s*(PASS|FAIL)/) || [])[1] || 'PASS',
  budget_fix_rounds: num('fix_rounds') || 0,
  budget_time_s: num('time_s') || 0,
  forbidden: list('forbidden_paths'),
};
const name = (fm.match(/name:\\s*(\\S+)/) || [])[1] || basename(goldenPath, '.md');
console.log(`EVAL ${name} - expect verdict=${expected.verdict}, files=${expected.files_exist.length}, budget=${expected.budget_time_s}s`);

// ---- sandbox worktree (EXAM = clean sheet: always fresh, never reused) ----
const slug = 'eval-' + name;
const wt = join('work', slug);
const g = (args) => spawnSync('git', args, { stdio: 'pipe' }).stdout.toString();
spawnSync('git', ['worktree', 'prune']);
// reuse would drag the dirty history of previous runs into item-17 audits
const rm = spawnSync('git', ['worktree', 'remove', '--force', '--force', join('work', slug)], { stdio: 'pipe' });
if (rm.status !== 0) console.error('EVAL WARN: worktree unregistered or remove failed: ' + (rm.stderr?.toString().trim() || ''));
if (existsSync(wt)) {                                  // zombie dir on disk (unregistered)
  try { rmSync(wt, { recursive: true, force: true }); console.log('removed stale sandbox dir'); }
  catch (err) { console.error('EVAL FAIL: cannot delete stale sandbox dir - close editors holding it (' + (err.code || err.message) + ')'); process.exit(1); }
}
const br = `feat/${slug}`;
const del = spawnSync('git', ['branch', '-D', br], { stdio: 'pipe' });
if (del.status !== 0 && !g(['rev-parse', '--verify', br]).trim()) console.error('EVAL WARN: branch "' + br + '" delete failed: ' + (del.stderr?.toString().trim() || ''));
const base = g(['rev-parse', '--verify', 'develop']).trim() ? 'develop' : 'HEAD';
const r = spawnSync('git', ['worktree', 'add', join('work', slug), '-b', br, base], { stdio: 'inherit' });
if (r.status !== 0) exit(1, `worktree add failed (base ${base})`);
console.log('sandbox: ' + wt);

// deps: fresh worktree lacks node_modules AND .bin shims - a junction is
// not enough (proven by eval #3: junction showed packages but no .bin).
// The TOOL provisions honestly: pnpm install from the offline store.
if (!existsSync(join(wt, 'node_modules', '.bin'))) {
  // remove dev-created fake .cmd stubs at the root (they shadow real bins)
  for (const stub of ['eslint.cmd', 'tsc.cmd', 'vitest.cmd', 'vite.cmd']) {
    try { rmSync(join(wt, stub), { force: true }); } catch {}
  }
  console.log('deps: pnpm install --frozen-lockfile (offline store) ...');
  // shell:true is MANDATORY on Windows: "pnpm" is a .cmd shim, and spawnSync
  // without shell cannot execute .cmd at all (git.exe works, pnpm.cmd doesn't)
  const pi = spawnSync('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], { cwd: wt, stdio: 'inherit', shell: true });
  if (pi.status !== 0 || pi.error) {
    console.error('EVAL STOP: pnpm install failed (' + (pi.error?.code || 'exit ' + pi.status) + ') - run it by hand in ' + wt + ' to see the real error');
    process.exit(1);                                  // honest stop: no hops without deps
  }
}

// ---- task doc into sandbox ----
mkdirSync(join(wt, 'tasks'), { recursive: true });
const taskBody = raw.replace(/^---[\s\S]*?---\\n?/, '');
writeFileSync(join(wt, 'tasks', `${slug}.md`), taskBody);

// ---- run: planner -> developer -> fixture commit -> tester ----
const rid = trace.newRun('eval-' + name);
trace.ev(rid, { event: 'circle_start', task: goldenPath, name: slug, sandbox: true, eval: true });
const t0 = Date.now();
const hop = (role, input, ctx) => {
  trace.ev(rid, { event: 'hop_start', role });
  const r = spawnSync(process.execPath, [join(root, 'scripts', 'run-agent.mjs'), role, '-i', input, ...(ctx ? [ctx] : [])],
    { stdio: 'inherit', cwd: wt, env: { ...process.env, PIPELINE_RUN_ID: rid, PIPELINE_TRACE_BASE: root } });
  trace.ev(rid, { event: 'hop_end', role, exit: r.status, duration_ms: Date.now() - t0 });
  return r.status ?? 1;
};

if (hop('planner', join(wt, 'tasks', `${slug}.md`)) !== 0) exit(1, 'planner hop failed');
const planPath = `docs/plans/${slug}-plan.md`;
if (!existsSync(join(wt, planPath))) exit(1, `plan artifact missing: ${planPath}`);
console.log('plan ok.');

if (hop('developer', planPath, 'implement the plan from the input file') !== 0) exit(1, 'developer hop failed');

// mechanical fixture commit (the TOOL, not an agent - evals skip human gates)
spawnSync('git', ['add', '-A'], { cwd: wt, stdio: 'pipe' });
for (const p of expected.forbidden) spawnSync('git', ['reset', '-q', '--', p], { cwd: wt, stdio: 'pipe' });
spawnSync('git', ['reset', '-q', '--', 'docs/plans', 'tasks', '.pipeline-last-run.log'], { cwd: wt, stdio: 'pipe' });
spawnSync('git', ['commit', '-q', '-m', `eval: fixture commit for ${slug}`], { cwd: wt, stdio: 'pipe' });
trace.ev(rid, { event: 'fixture_commit' });

if (hop('tester', planPath) !== 0) exit(1, 'tester hop failed');

const reportRel = `docs/plans/${slug}-report.md`;
// ---- fix loop (bug-log driven, bounded by the answer key) ----
let fixRounds = 0;
const budgetRounds = expected.budget_fix_rounds;
while (budgetRounds > 0 && fixRounds < budgetRounds) {
  const repRel = `docs/plans/${slug}-report.md`;
  if (!existsSync(join(wt, repRel))) break;
  const head0 = readFileSync(join(wt, repRel), 'utf8').split('\n')[0] || '';
  if (head0.toUpperCase().startsWith('PASS')) break;
  console.log(`EVAL: FAIL -> developer fix round ${fixRounds + 1}/${budgetRounds} (bug-log driven)`);
  if (hop('developer', repRel, 'fix ONLY the items in the bug-log of the input report. Touch no files beyond what the bug-log names. Tests in same commit.') !== 0) break;
  spawnSync('git', ['add', '-A'], { cwd: wt, stdio: 'pipe' });
  for (const p of expected.forbidden) spawnSync('git', ['reset', '-q', '--', p], { cwd: wt, stdio: 'pipe' });
  spawnSync('git', ['reset', '-q', '--', 'docs/plans', 'tasks', '.pipeline-last-run.log'], { cwd: wt, stdio: 'pipe' });
  spawnSync('git', ['commit', '-q', '-m', `eval: fix round ${fixRounds + 1} for ${slug}`], { cwd: wt, stdio: 'pipe' });
  fixRounds++;
  trace.ev(rid, { event: 'fix_round', n: fixRounds });
  if (hop('tester', planPath) !== 0) break;
}

// ---- grade (facts vs answer key) ----
const reportText = existsSync(join(wt, reportRel)) ? readFileSync(join(wt, reportRel), 'utf8') : '';
const first = reportText.split('\n').slice(0, 5).join(' ');
const vm = first.match(/\b(PASS|FAIL)\b/i);
const verdict = vm?.[1]?.toUpperCase() || (reportText ? 'FAIL' : 'MISSING');
const missing = expected.files_exist.filter((f) => !existsSync(join(wt, f)));
const filesOk = missing.length === 0;
// scope = COMMITS of the exam branch (diff from develop), not the working
// tree: the tool intentionally leaves forbidden edits excluded-but-dirty
// after resets, and "dirty" means the tool caught the drift, not committed it
const mergeBase = spawnSync('git', ['merge-base', 'develop', 'HEAD'], { cwd: wt }).stdout.toString().trim();
const changed = spawnSync('git', ['diff', mergeBase ? mergeBase : 'develop', 'HEAD', '--name-only'], { cwd: wt }).stdout.toString().trim().split('\n').filter(Boolean);
const dirt = spawnSync('git', ['status', '--porcelain'], { cwd: wt }).stdout.toString();
if (dirt) console.log('note: sandbox has uncommitted residue (tool-excluded forbidden drift) - see git status');
const violated = changed.filter((f) => expected.forbidden.includes(f));
const scopeOk = violated.length === 0;
const totalS = (Date.now() - t0) / 1000;
const timeOk = expected.budget_time_s === 0 || totalS <= expected.budget_time_s;
const pass = verdict === expected.verdict && filesOk && scopeOk && timeOk && fixRounds <= budgetRounds;

// ---- scoreboard ----
const resultsDir = 'evals/results';
mkdirSync(resultsDir, { recursive: true });
appendFileSync(join(resultsDir, 'scoreboard.jsonl'), JSON.stringify(
  { date: new Date().toISOString().slice(0, 10), task: name, verdict, files_ok: filesOk, scope_ok: scopeOk, fix_rounds: fixRounds, seconds: Math.round(totalS) }) + '\n');

const rows = readFileSync(join(resultsDir, 'scoreboard.jsonl'), 'utf8').split('\n').filter(Boolean)
  .map((l) => JSON.parse(l)).sort((a, z) => (a.task + a.date).localeCompare(z.task + z.date));
const mark = (ok) => ok ? '\u2705' : '\u274c';
const pad = (t, w) => (String(t).length >= w ? String(t) : String(t) + ' '.repeat(w - String(t).length));
const W = { d: 12, t: 28, sec: 8, fx: 6 };
const head = ['# Eval scoreboard', '',
  pad('date', W.d) + ' | ' + pad('task', W.t) + ' | verdict | files  | scope  | fixes | seconds',
  '-'.repeat(W.d) + '-+-' + '-'.repeat(W.t) + '-+-' + '-'.repeat(7) + '-+-' + '-'.repeat(6) + '-+-' + '-'.repeat(6) + '-+-' + '-'.repeat(5) + '-+-' + '-'.repeat(7)];
const body = rows.map((r) => [pad(r.date, W.d), pad(r.task, W.t),
  mark(r.verdict === 'PASS') + ' ' + r.verdict, mark(r.files_ok) + ' ' + (r.files_ok ? 'ok' : 'MISS'),
  mark(r.scope_ok) + ' ' + (r.scope_ok ? 'ok' : 'VIOL.'), pad(String(r.fix_rounds ?? 0), W.fx), pad(r.seconds + 's', W.sec)].join(' | '));
const passN = rows.filter((r) => r.verdict === 'PASS' && r.files_ok && r.scope_ok).length;
const avgS = Math.round(rows.reduce((a, r) => a + (r.seconds || 0), 0) / rows.length);
writeFileSync(join(resultsDir, 'scoreboard.md'), [...head, ...body, '', `runs: ${rows.length}   pass: ${passN}/${rows.length}   avg: ${avgS}s`].join('\n') + '\n');

// ---- human-readable verdict ----
const mmss = (s2) => `${Math.floor(s2 / 60)}:${String(Math.round(s2 % 60)).padStart(2, '0')}`;
const bar = '='.repeat(58);
console.log('\n' + bar);
console.log(` EVAL: ${name}`);
console.log(bar);
console.log(` Verdict    : ${verdict === expected.verdict ? '\u2705 ' : '\u274c '}${verdict}  (expected ${expected.verdict})`);
console.log(` Files      : ${filesOk ? '\u2705 all present' : '\u274c missing: ' + missing.join(', ')}`);
console.log(` Scope      : ${scopeOk ? '\u2705 clean' : '\u274c touched forbidden: ' + violated.join(', ')}`);
console.log(` Fix rounds : ${fixRounds} / ${budgetRounds}`);
console.log(` Time       : ${timeOk ? '\u2705 ' : '\u274c '}${mmss(totalS)} (budget ${mmss(expected.budget_time_s || 0)})`);
console.log(` Report     : work/${slug}/docs/plans/${slug}-report.md`);
console.log(` Board      : evals/results/scoreboard.md`);
console.log(bar + '\n');
trace.ev(rid, { event: 'verdict', result: pass ? 'PASS' : 'FAIL', eval: true, total_s: totalS, fix_rounds: fixRounds });
