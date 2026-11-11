// scripts/flow.mjs - the pipeline Flow: full circle (+ fix loop), plain Node.
// Usage:
//   pnpm flow tasks\<date>-<name>.md     full circle: planner->[Y]->developer->[Y]->tester->verdict
//   pnpm flow:fix                        newest FAIL report -> developer fix -> re-tester (max 3)
// No PowerShell involved -> no ExecutionPolicy / Unblock-File issues.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const exit = (code, msg) => { if (msg) console.error(msg); process.exit(code); };
const isY = (s) => /^\s*y(es)?\s*$/i.test(s || '');

async function ask(question) {
  const rl = readline.createInterface({ input, output });
  try { return (await rl.question(question)).trim(); } finally { rl.close(); }
}

function hop(args) {
  const r = spawnSync('node', ['scripts/run-agent.mjs', ...args], { stdio: 'inherit' });
  return r.status ?? 1;
}

const newestReport = () => {
  const dir = 'docs/plans';
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith('-report.md'))
    .map((f) => join(dir, f));
  return files[files.length - 1] ?? null; // artifacts are written in run order
};

const verdict = (file) => (readFileSync(file, 'utf8').split('\n')[0] || '').trim().toUpperCase();

// role colors (must match run-agent): planner green, developer dark orange, tester cyan
const ROLE_COLOR = { planner: '\x1b[32m', developer: '\x1b[38;5;208m', tester: '\x1b[36m' };
const clog = (role, text) => console.log((ROLE_COLOR[role] || '') + text + '\x1b[0m');
const MAX_FIX_ROUNDS = 3;

async function fixLoop() {
  for (let round = 1; round <= MAX_FIX_ROUNDS; round++) {
    const report = newestReport();
    if (!report) exit(1, 'no *-report.md found in docs/plans');
    const v = verdict(report);
    if (v.startsWith('PASS')) exit(0, `PASS already. Nothing to fix. (${report})`);

    // class "human/process" blocker: uncommitted work. If the human has
    // since committed (clean tree), the blocker is stale -> skip the dev
    // fix hop, go straight to re-test (zero human steps left).
    let skipDevHop = false;
    if (/not committed|uncommitted|committed anywhere/i.test(readFileSync(report, 'utf8'))) {
      const st = spawnSync('git', ['status', '--porcelain']).stdout.toString().trim();
      if (st) {
        const short = spawnSync('git', ['status', '--short']).stdout.toString().trim();
        console.error('\n' + '='.repeat(62));
        console.error('HUMAN STEP REQUIRED - the report says the work is uncommitted.');
        console.error('=' .repeat(62));
        console.error('Auto-fix cannot commit for you (agents never commit).');
        console.error('\nFiles waiting in your working tree:\n');
        console.error('  ' + short.replace(/\n/g, '\n  '));
        console.error('\nYour move (scoped to the deliverables only, no infra noise):');
        console.error('   1) git add <the task files listed above>');
        console.error('   2) git commit -m "feat(<task>): <what was built> (tests in same commit)"');
        console.error('   3) re-run:  pnpm flow:fix   <- it will skip the fix hop and just re-test');
        console.error('='.repeat(62));
        process.exit(1);
      }
      skipDevHop = true;
      console.log('blocker (uncommitted work) resolved by a human commit -> re-test only');
    }
    if (skipDevHop) {
      const base2 = report.replace(/-report\.md$/, '');
      console.log('\n===> RE-TEST');
      if (hop(['tester', '-i', `${base2}-plan.md`]) !== 0) exit(1, 'tester hop failed');
      const v3 = verdict(newestReport());
      if (v3.startsWith('PASS')) {
        console.log('\nPASS (re-test only).');
        console.log('Your move: push/PR (human only).');
        return;
      }
      console.log('still FAIL - continuing fix rounds');
      continue;
    }
    clog('developer', `\n===> FIX round ${round} (${report})`);
    if (hop(['developer', '-i', report,
      'fix ONLY the items in the bug-log of the input report (it starts with FAIL). Touch no files beyond what the bug-log names. Tests in same commit.']) !== 0) {
      exit(1, 'developer fix hop failed');
    }

    const base = report.replace(/-report\.md$/, '');
    clog('tester', `\n===> RE-TEST (round ${round})`);
    if (hop(['tester', '-i', `${base}-plan.md`]) !== 0) exit(1, 'tester hop failed');

    const v2 = verdict(newestReport());
    if (v2.startsWith('PASS')) {
      console.log(`\nPASS after ${round} fix round(s).`);
      console.log('Your move: add/commit/push/PR (human only).');
      return;
    }
    console.log(`still FAIL after round ${round} - looping`);
  }
  exit(1, `FAIL persists after ${MAX_FIX_ROUNDS} rounds - escalate: re-plan the task manually.`);
}

const [, , arg1] = process.argv;

if (arg1 === '--fix' || arg1 === '-fix') { await fixLoop(); process.exit(0); }

const task = arg1;
if (!task || !existsSync(task)) {
  exit(1, 'usage: pnpm flow tasks\\<date>-<name>.md   |   pnpm flow:fix');
}

const name = task.replace(/^.*[\\/]/, '').replace(/\.md$/, '').replace(/-plan$/, '');
const plan = `docs/plans/${name}-plan.md`;
const report = `docs/plans/${name}-report.md`;

clog('planner', '\n===> PLANNER');
if (hop(['planner', '-i', task]) !== 0) exit(1, 'planner hop failed');

console.log(`\n>> plan written to ${plan}`);
if (!isY(await ask('Read the plan. Continue to developer? (Y/N): '))) exit(0, 'flow stopped at plan gate');

clog('developer', '\n===> DEVELOPER');
if (hop(['developer', '-i', plan, 'implement the plan from the input file']) !== 0) exit(1, 'developer hop failed');

console.log('\n>> working tree after developer:');
spawnSync('git', ['status', '--short'], { stdio: 'inherit' });
spawnSync('git', ['diff', '--stat'], { stdio: 'inherit' });
if (!isY(await ask('Continue to tester? (Y/N): '))) exit(0, 'flow stopped before tester');

clog('tester', '\n===> TESTER');
if (hop(['tester', '-i', plan]) !== 0) exit(1, 'tester hop failed');

console.log('\x1b[32m\n===> VERDICT\x1b[0m');
console.log(readFileSync(report, 'utf8').split('\n').slice(0, 3).join('\n'));
const v = verdict(report);
if (v.startsWith('FAIL')) exit(1, '\nFAIL detected - auto fix loop:  pnpm flow:fix');
console.log('\nPASS -> your move: add/commit/push/PR (human only). Artifacts stay local.');
