#!/usr/bin/env node
// self-tests.mjs - the engine examines itself. Phase-4 item #1 (board law).
// NO model calls, NO network, NO git needed: every exhibit tests the REAL
// engine source (behavioral where the code is extractable, source-law
// assertions where the code is wired into a spawn tree only a live circle
// can reach). Runs anywhere node runs, in seconds.
//
// Usage: node scripts/self-tests.mjs [ST-1] [...]
// Exit:  0 all green · 1 any red · PENDING exhibits never count as red.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = dirname(dirname(fileURLToPath(import.meta.url)));
const AUTODIAG = await import(new URL(`file://${join(KIT, 'scripts', 'auto-diag.mjs').replace(/\\/g, '/')}`));
const src = (p) => {
  const s = readFileSync(join(KIT, p), 'utf8').replace(/\r\n/g, '\n'); // CRLF-immune: win git autocrlf must not red the exhibits
  if (!s) throw new Error(`empty source: ${p}`);
  return s;
};
/** slice source BETWEEN two unique-ish markers, including both ends */
const snap = (text, from, to) => {
  const a = text.indexOf(from);
  if (a < 0) throw new Error(`anchor not found: ${from.slice(0, 40)}`);
  const b = text.indexOf(to, a + from.length);
  if (b < 0) throw new Error(`end anchor not found: ${to.slice(0, 40)}`);
  return text.slice(a, b + to.length);
};
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };

const results = [];
async function exhibit(id, title, fn, opts = {}) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ id, title, ok: true, ms: Date.now() - t0, pending: false });
  } catch (e) {
    const msg = e?.message || String(e);
    const skip = msg.startsWith('SKIP');
    const pending = !!opts.pending;
    results.push({ id, title, ok: false, ms: Date.now() - t0, pending, skip, err: msg + (e.stack ? '\n  ' + String(e.stack).split('\n').slice(1, 5).join('\n  ') : '') });
  }
}

// ------------------------------------------------------------------
// ST-1 VERDICT WINDOW - flow.mjs verdict(): whole-file, top-down,
// own-line only (<=48 chars), first hit wins; 5-line head word-search
// fallback; default FAIL (honest stop). Regression root: 17.11 escape bug.
// ------------------------------------------------------------------
await exhibit('ST-1', 'verdict window (flow own-line law)', () => {
  const s = src('scripts/flow.mjs');
  const fn = snap(s, 'const verdict = (file, cwd) => {', 'return (head.match(/\\b(PASS|FAIL)\\b/i)?.[1] || "FAIL").toUpperCase();\n};');
  const verdict = new Function('readFileSync', `${fn}; return verdict;`)(
    (_f, _e) => CONTENT,
  );
  let CONTENT;
  const call = (lines) => { CONTENT = lines.join('\n'); return verdict('docs/plans/x-report.md'); };

  // a) top-down: first own-line hit wins (FAIL before PASS)
  assert(call(['FAIL - nope', 'PASS - all green']) === 'FAIL', 'a: top-down first-hit lost');
  // b) narrative sentence (>48) containing FAIL is NOT a verdict
  assert(call(['l'.repeat(80) + ' FAIL', 'PASS - all gates green']) === 'PASS', 'b: long line leaked into verdict');
  // c) fallback: word-search only in the first 5 lines
  assert(call(['Verdict: PASS', '', '', '', '', 'PASS - line6']) === 'PASS', 'c: fallback missed head word');
  // d) fallback does NOT scan beyond head: own-line absent (PASS too deep
  //    inside a >48 narrative) -> honest FAIL
  assert(call(['', '', '', '', '', 'x'.repeat(60) + ' PASS deep']) === 'FAIL', 'd: fallback scanned past head');
  // e) unreadable/empty report = FAIL (honest stop law)
  assert(call([]) === 'FAIL', 'e: empty report not FAIL');
  // f) short own-line tail allowed: "PASS - all gates green"
  assert(call(['PASS - all gates green']) === 'PASS', 'f: short tail rejected');
  // g) narrative FAIL within the head, no own-line verdict anywhere -> FAIL
  assert(call(['ok', 'x'.repeat(60) + ' FAIL', 'nothing here']) === 'FAIL', 'g: narrative FAIL ignored by fallback');
  // h) \b boundary: "PASSED 3 gates" is NOT an own-line verdict (word-boundary law:
  //    the 17.11 escape bug made \b eat itself -> "PASSED..." would flip the verdict)
  assert(call(['PASSED 3 gates', 'FAIL - real bug']) === 'FAIL', 'h: PASSED-prefix line hijacked verdict');
});

// ------------------------------------------------------------------
// ST-2 DOOR STDOUT CONTRACT - notion-door ends stdout with exactly
// `door resolved: <path>`; flow.mjs parses that pipe: strip prefix,
// keep only lines starting tasks/, LAST one wins (pop).
// ------------------------------------------------------------------
await exhibit('ST-2', 'door stdout contract (pipe both sides)', () => {
  const door = src('scripts/notion-door.mjs');
  // exactly one console.log writer of the contract line (docstring mentions excluded)
  assert((door.match(/console\.log\(`door resolved:/g) || []).length === 1, 'door: contract writer not unique');
  // ...and it is the LAST console.log of main (after any status moves)
  const lastLog = door.lastIndexOf('console.log');
  assert(door.slice(lastLog).startsWith("console.log(`door resolved:"), 'door: resolved line not last stdout');
  assert(door.indexOf('console.log(`door resolved:') > door.indexOf('door: dry'), 'door: contract before dry branch?');

  // flow side: parse logic exercised as extracted code, both call sites
  const flow = src('scripts/flow.mjs');
  const parse = (block) => new Function('r', `let task=''; ${block}; return task;`);
  const fakeR = (lines) => ({ stdout: { toString: () => lines.join('\n') } });
  const expect = (block, lines, want) => {
    const got = parse(block)(fakeR(lines));
    assert((got ?? '') === want, `parse produced ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  };
  const b1 = snap(flow, 'const out = r.stdout', 'task = out.pop();');
  const b2start = flow.indexOf('const outn = r.stdout');
  const b2 = flow.slice(b2start, flow.indexOf('task = outn.pop();', b2start) + 'task = outn.pop();'.length);
  assert(b2.includes('outn.pop()'), 'next-mode block missing (flow --next parse not found)');
  for (const [tag, block] of [['id-mode', b1], ['next-mode', b2]]) {
    expect(block, ['door: card = "X" (To Do)', 'door resolved: tasks/a.md'], 'tasks/a.md');
    // junk noise must not become the task; only tasks/ lines pass
    expect(block, ['door resolved: tasks/a.md', 'door: noise tasks/wrong', 'door resolved: tasks/b.md'], 'tasks/b.md');
    // empty parse -> empty task -> usage stop (honest)
    expect(block, ['door: card = "X"'], '');
  }
  // stale-residue guard: pop() semantics = LAST resolved, not first
  assert(b2.length > 0, 'next-mode block missing');
});

// ------------------------------------------------------------------
// ST-3 .mcp.json -> SANDBOX - MCP config is untracked: flow copies it
// into a fresh worktree (never silent-loss), WITHOUT overwriting an
// existing one, and only when the source exists.
// ------------------------------------------------------------------
await exhibit('ST-3', '.mcp.json copied into sandbox (no overwrite)', () => {
  const flow = src('scripts/flow.mjs');
  const block = snap(flow, '// MCP: .mcp.json is untracked', 'console.log("mcp config copied into sandbox");');
  assert(block.includes('existsSync(mcpSrc)'), 'guard: must check source exists');
  assert(block.includes("if (!existsSync(dstM))") , 'no-overwrite law missing (existing sandbox config must win)');
  assert(block.includes('copyFileSync(mcpSrc, dstM)'), 'copy action missing');
  assert(block.includes('console.log("mcp config copied into sandbox")'), 'no copy evidence line');
});

// ------------------------------------------------------------------
// ST-4 TOOL WALL - git mutations denied for EVERY role on BOTH rails;
// tester keeps its Write right (report) while the wall stands.
// ------------------------------------------------------------------
await exhibit('ST-4', 'tool wall (git mutations denied) + tester Write right', () => {
  const run = src('scripts/run-agent.mjs');
  for (const verb of ['commit', 'push', 'merge', 'checkout', 'reset', 'rebase'])
    assert(run.includes(`Bash(git ${verb}:*)`) || run.includes(`'shell(git ${verb}:*)'`),
      `claude DENY lacks git ${verb}`);
  for (const verb of ['commit', 'push', 'merge'])
    assert(run.includes(`'shell(git ${verb}:*)'`), `rail #2 DENY lacks git ${verb}`);
  // tester right: contract frontmatter grants Write (report writing)
  const tester = src('agents/tester.md');
  const toolsLine = tester.split('\n').find((l) => l.startsWith('tools:'));
  assert(!!toolsLine && /\bWrite\b/.test(toolsLine), 'tester.md frontmatter lost the Write right');
  // committer is mechanical: the TOOL runs git, never the hop (flow side)
  const flow = src('scripts/flow.mjs');
  const csFlat = snap(flow, 'async function committerStep', 'FINISH (human)').replace(/\s/g, '');
  assert(csFlat.includes('spawnSync("git"'), 'TOOL must hold the git spawn');
  assert(csFlat.includes('"commit","-m",msg'), 'TOOL commit lost');
  assert(csFlat.includes('hop(["committer","-i",report]'), 'committer hop missing (proposal only)');
});

// ------------------------------------------------------------------
// ST-5 ARTIFACT CONTRACT - run-agent derives the expected artifact per
// role (planner -plan / tester -report with -plan stripped / committer
// -commit) and the machine gate exits 2 when it is missing after a hop.
// ------------------------------------------------------------------
await exhibit('ST-5', 'artifact contract + machine gate (missing = exit 2)', () => {
  const run = src('scripts/run-agent.mjs');
  assert(run.includes("role === 'planner' && baseName ? `docs/plans/${baseName}-plan.md`"), 'planner autoOut lost');
  assert(run.includes("role === 'tester'  && baseName ? `docs/plans/${baseName}-report.md`"), 'tester autoOut lost');
  assert(run.includes(".replace(/-plan$/, '')"), '-plan strip lost (tester would get -plan-report)');
  assert(run.includes('exit(2, `machine gate: expected artifact missing: ${out}`)'), 'machine gate no longer exits 2');
  // mkdir law: artifact dir pre-created before the hop spawns
  assert(run.includes('mkdirSync(path.dirname(path.join(process.cwd(), out)'), 'mkdir law lost');
});

// ------------------------------------------------------------------
// ST-6 RAILS - model resolution (ADR-0008): frontmatter is the rail-#1
// FACT and MUST lose to the copilot table on rail #2 (first combat
// incident 17.11: unknown glm id on rail #2).
// ------------------------------------------------------------------
await exhibit('ST-6', 'rail routing: frontmatter loses to copilot table', () => {
  const run = src('scripts/run-agent.mjs');
  const sel = snap(run, 'const model = process.env.RUN_MODEL', 'rail: ${cliEarly})`);');
  assert(sel.includes("cliEarly === 'copilot' ? null : contractModel(role)"), 'frontmatter must NOT resolve on rail #2 (ADR-0008 rail-2 rule)');
  assert(sel.includes('table[role]'), 'rail table lost');
  // both rails reachable: PIPELINE_CLI switch exists (default = claude, ADR-0002)
  assert(run.includes('if (!process.env.PIPELINE_CLI) process.env.PIPELINE_CLI = \'claude\''), 'claude-default rail switch lost (ADR-0002)');
});

// ------------------------------------------------------------------
// ST-7 DOCS/PLANS COPY-TO-MAIN LAW - artifact copy back to main after
// merge. QUEUED (board 4.6): the law is not implemented yet. The
// exhibit is honest PENDING: it turns green the day flow.mjs learns
// copy-to-main (TDD style - red now, green when built).
// ------------------------------------------------------------------
await exhibit('ST-7', 'copy-to-main law: artifacts survive worktree removal', () => {
  const flow = src('scripts/flow.mjs');
  assert(flow.includes('copy-to-main'), 'law not implemented in flow.mjs');
  const block = snap(flow, 'COPY-TO-MAIN LAW', 'copied to the main checkout');
  assert(block.includes('String(cwd) !== process.cwd()'), 'copy must fire only out of the sandbox');
  assert(block.includes('copyFileSync'), 'the TOOL must do the copy (agents never move artifacts)');
  assert(block.includes('readdirSync(plansSrc)'), 'full docs/plans copy, not cherry-pick');
});

// ------------------------------------------------------------------
// ST-8 IDENTITY LAW - repo-local user.name/email set BEFORE committer
// (enterprise rails hijack authorship, 17.11: amend --reset-author
// caught the hijack). Documented in README-INSTALL, NOT enforced by
// the engine yet -> honest PENDING; green the day flow.mjs asserts
// git config user identity before the committer Y.
// ------------------------------------------------------------------
await exhibit('ST-8', 'identity law: committer pinned to repo identity', () => {
  const flow = src('scripts/flow.mjs');
  const block = snap(flow, 'IDENTITY LAW', 'git commit failed');
  assert(block.includes('user.name') && block.includes('user.email'), 'identity lookup lost');
  assert(block.includes('-c') && block.includes('user.name=${identName}'), 'commit must PIN identity via -c (hijack-proof)');
  assert(block.includes('IDENTITY LAW: set repo git config'), 'honest missing-identity stop lost');
  // the commit itself is spawned by the TOOL, never by an agent hop
  const flat = block.replace(/\s/g, '');
  assert(flat.includes('spawnSync("git"'), 'TOOL must hold the identity-pinned commit');
  assert(flat.includes('"-c",`user.name=${identName}`') && flat.includes('"-c",`user.email=${identMail}`'), '-c pinning lost');
});

// ------------------------------------------------------------------
// BEHAVIORAL SANDBOX HELPERS - real run-agent, fake CLI binary.
// Works where PATH-stub executables work (Linux/macOS); on Windows
// spawn without shell cannot run a fake .cmd -> honest SKIP there.
// ------------------------------------------------------------------
import { mkdtempSync, writeFileSync as wf, existsSync as ex, mkdirSync as mkdirSync2, chmodSync, readdirSync, copyFileSync as copyFile } from 'node:fs';
import { spawn, spawnSync as ss } from 'node:child_process';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
const SKIP = process.platform === 'win32';

const makeSandbox = (cliName, stub) => {
  const root = mkdtempSync(join(tmpdir(), 'factory-st-'));
  const bin = join(root, 'bin');
  mkdirSync2(bin);
  wf(join(bin, cliName), stub, { mode: 0o755 });
  chmodSync(join(bin, cliName), 0o755);
  // the run-agent tree: scripts + agents (contract frontmatter is read live)
  for (const d of ['scripts', 'agents']) {
    mkdirSync2(join(root, d));
    for (const f of readdirSync(join(KIT, d)))
      if (f.endsWith('.mjs') || f.endsWith('.md')) copyFile(join(KIT, d, f), join(root, d, f));
  }
  mkdirSync2(join(root, 'tasks'));
  return root;
};
const runAgent = async (root, extraEnv = {}, args = ['tester', '-i', 'tasks/x.md'], cwd = root) => {
  const env = {
    ...process.env,
    PATH: join(root, 'bin') + ':' + process.env.PATH,
    PIPELINE_CLI: 'copilot',
    RUN_MODEL: 'stub-model',
    STUB_ARTIFACT: '1',
    ...extraEnv,
  };
  const child = spawn(process.execPath, [join(root, 'scripts', 'run-agent.mjs'), ...args], { cwd, env });
  const stdout = [], stderr = [];
  child.stdout.on('data', (d) => stdout.push(d.toString()));
  child.stderr.on('data', (d) => stderr.push(d.toString()));
  const code = await new Promise((res) => child.on('exit', res));
  return { code, out: stdout.join('') + '\n[stderr]\n' + stderr.join(''), child };
};

const COPILOT_STUB = `#!/bin/sh
# records argv, proves stdin EOF state, optional delay, writes the artifact
printf '%s\n' "$@" > "$STUB_DIR/argv.txt"
n=\$(dd if=/dev/stdin count=1 2>/dev/null | wc -c || echo err)
printf '%s' "\$n" > "\$STUB_DIR/eof.txt"
if [ -n "\$STUB_DELAY" ]; then sleep "\$STUB_DELAY"; fi
if [ -n "\$STUB_ARTIFACT" ]; then
  mkdir -p docs/plans
  printf 'PASS - stub artifact\n' > docs/plans/x-report.md
fi
exit 0`;

const spawnStubEnv = (root) => {
  const dir = join(root, 'stub-ctl');
  mkdirSync2(dir);
  return {
    dir,
    env: { STUB_DIR: dir },
    argvTxt: () => readFileSync(join(dir, 'argv.txt'), 'utf8'),
    eofTxt: () => (ex(join(dir, 'eof.txt')) ? readFileSync(join(dir, 'eof.txt'), 'utf8') : null),
  };
};

// ------------------------------------------------------------------
// ST-9 RAIL #2 TRANSPORT - direct spawn (no cmd.exe wrapper), argv
// prompt joins -p (multiline survives), stdin reaches EOF instantly,
// honest 30k guard BEFORE any spawn. Combat roots 17.11: cmd multiline
// argv hang + stdin without EOF blocked forever.
// ------------------------------------------------------------------
await exhibit('ST-9', 'rail #2 transport: direct spawn, argv multiline, EOF, 30k guard', async () => {
  if (SKIP) throw new Error('SKIP (win32): fake CLI stub needs POSIX spawn - verified on POSIX runs');
  const root = makeSandbox('copilot', COPILOT_STUB);
  const sdb = spawnStubEnv(root);
  wf(join(root, 'tasks', 'x.md'), 'MULTILINE_BODY_TEST\nsecond line of the task\n');
  const r = await runAgent(root, sdb.env);
  assert(r.code === 0, `run-agent exited ${r.code}: ${r.out.slice(-400)}`);
  assert(r.out.includes('artifact ok'), 'artifact gate did not pass on stub run');
  const argvTxt = sdb.argvTxt();
  assert(argvTxt.includes('-p') && argvTxt.includes('MULTILINE_BODY_TEST') && argvTxt.includes('second line'),
    'multiline prompt LOST in argv transport');
  assert(sdb.eofTxt() === '0', `stdin did not EOF immediately (stub read ${sdb.eofTxt()} bytes)`);
  // 30k honest guard: fires BEFORE spawn (no stub evidence), exit 3
  const big = 'z'.repeat(31000);
  wf(join(root, 'tasks', 'x.md'), big);
  const r2 = await runAgent(root, { ...sdb.env }, ['tester', '-i', 'tasks/x.md']);
  assert(r2.code === 3 && r2.out.includes('prompt too long'), '30k guard missing or silent truncation risk');
});

// ------------------------------------------------------------------
// ST-10 KILL-SWITCH - .pipeline-stop in repo root kills the live hop
// within seconds, exit 130, and the switch file is cleaned up.
// ------------------------------------------------------------------
await exhibit('ST-10', 'kill-switch: .pipeline-stop kills hop (exit 130)', async () => {
  if (SKIP) throw new Error('SKIP (win32): behavioral kill test needs POSIX stub');
  const root = makeSandbox('copilot', COPILOT_STUB);
  const sdb = spawnStubEnv(root);
  wf(join(root, 'tasks', 'x.md'), 'kill me\n');
  const env = { ...process.env, ...sdb.env, PATH: join(root, 'bin') + ':' + process.env.PATH, PIPELINE_CLI: 'copilot', RUN_MODEL: 'stub-model', STUB_DELAY: '25' };
  const child = spawn(process.execPath, [join(root, 'scripts', 'run-agent.mjs'), 'tester', '-i', 'tasks/x.md'], { cwd: root, env });
  const t0 = Date.now();
  await new Promise((r) => setTimeout(r, 1500)); // let the hop go live
  wf(join(root, '.pipeline-stop'), 'stop');
  const code = await new Promise((res) => child.on('exit', res));
  const took = Date.now() - t0;
  assert(code === 130, `kill-switch exit ${code}, want 130`);
  assert(took < 6000, `kill too slow: ${took}ms`);
  assert(!ex(join(root, '.pipeline-stop')), 'switch file not cleaned up');
});

// ------------------------------------------------------------------
// ST-11 HOP TIMEOUT - PIPELINE_HOP_TIMEOUT(seconds) bounds every hop,
// exit 124: an orphan can never burn again (the minimax incident law).
// ------------------------------------------------------------------
await exhibit('ST-11', 'hop timeout bounds live hop (exit 124)', async () => {
  if (SKIP) throw new Error('SKIP (win32): behavioral timeout test needs POSIX stub');
  const root = makeSandbox('copilot', COPILOT_STUB);
  const sdb = spawnStubEnv(root);
  wf(join(root, 'tasks', 'x.md'), 'too slow\n');
  const t0 = Date.now();
  const r = await runAgent(root, { ...sdb.env, STUB_DELAY: '20', PIPELINE_HOP_TIMEOUT: '1' });
  const took = Date.now() - t0;
  assert(r.code === 124, `timeout exit ${r.code}, want 124`);
  assert(r.out.includes('HOP TIMEOUT'), 'honest message lost');
  assert(took < 8000, `timeout enforcement too slow: ${took}ms`);
});

// ------------------------------------------------------------------
// ST-12 STALE WORKTREE - eval never trusts a reused sandbox: unregister
// + force-remove the worktree AND the zombie dir on disk before the run
// (combat: junction-without-.bin and dirty history drag). If the dir
// survives -> honest stop naming the cure (close editors).
// ------------------------------------------------------------------
await exhibit('ST-12', 'stale sandbox: zombie worktree removed, honest stop if held', () => {
  const ev = src('scripts/eval.mjs');
  assert(ev.includes("['worktree', 'prune']"), 'worktree prune lost');
  assert(ev.includes("'remove', '--force', '--force'"), 'double-force unregister lost');
  assert(ev.includes('rmSync(') && ev.includes('recursive: true, force: true'), 'zombie-dir removal lost');
  assert(ev.includes('EVAL WARN') && ev.includes('removed stale sandbox dir'), 'no evidence lines for the removal');
  assert(ev.includes('cannot delete stale sandbox dir - close editors holding it'), 'honest hold-stop lost');
});

// ------------------------------------------------------------------
// ST-13 QUIP BANK - second slot under the spinner: rotates ~7s, lives
// only while the hop is alive, NEVER displaces the tail/timer line.
// ------------------------------------------------------------------
await exhibit('ST-13', 'quip bank: same-line slot, ~7s rotation, no cursor juggling', () => {
  const run = src('scripts/run-agent.mjs');
  assert(run.includes('const QUIPS') && run.includes('untangling spaghetti'), 'quip bank lost');
  for (const role of ['planner', 'developer', 'tester', 'committer'])
    assert(run.includes(`${role}:`), `bank empty for ${role}`);
  assert(run.includes('/ 7000'), '7s rotation law lost');
  assert(run.includes('quip: "${quip}"'), 'quip segment lost');
  // anti-jump law: single-line render, no 1A cursor dance (19.11 win32 artifact)
  assert(!run.includes('\x1b[1A'), 'two-line cursor return RETURNED (jump artifact)');
  // data law: tail + timer keep their own segment; tail trims to width
  assert(run.includes('last: ') && run.includes('/ 400) % frames.length'), 'spinner/tail law drifted');
  assert(run.includes('tailBudget'), 'width-aware tail trim lost');
});

// ------------------------------------------------------------------
// ST-15 ECOSYSTEMS REGISTRY - detectors are DATA; detection reads facts
// only; anything unfindable goes to unknown[] (never guessed).
// ------------------------------------------------------------------
await exhibit('ST-15', 'ecosystems registry: facts only, unknown law, data-not-ladders', async () => {
  const ecosystems = src('scripts/ecosystems.js');
  assert(ecosystems.includes('export const DETECTORS'), 'registry export lost');
  assert(!/===\s*'(?:node|npm|java)'\s*\)/.test(ecosystems), 'detector ladder inside engine (registry must be data)');
  const { DETECTORS, detect } = await import(pathToFileURL(join(KIT, 'scripts', 'ecosystems.js')).href);
  assert(Object.keys(DETECTORS).includes('node'), 'node entry missing from registry');
  // fixture A: npm repo with lint+test, no build script
  const fa = mkdtempSync(join(tmpdir(), 'eco-a-'));
  wf(join(fa, 'package.json'), JSON.stringify({ scripts: { lint: 'eslint .', test: 'vitest run' } }));
  wf(join(fa, 'package-lock.json'), '{}');
  const a = detect(fa, { existsSync: ex, readFileSync: readFileSync, join });
  assert(a.ecosystem === 'node' && a.package_manager === 'npm', 'fixture A: pm misdetected');
  assert(a.install === 'npm ci', 'npm install template lost');
  assert(a.lint === 'npm run lint' && a.test === 'npm run test', 'script commands lost');
  assert((a.unknown || []).includes('build'), 'missing build script must land in unknown[]');
  assert((a.unknown || []).includes('typecheck'), 'missing typecheck script must land in unknown[]');
  // fixture B: pnpm repo
  const fb = mkdtempSync(join(tmpdir(), 'eco-b-'));
  wf(join(fb, 'package.json'), JSON.stringify({ scripts: { build: 'vite build' } }));
  wf(join(fb, 'pnpm-lock.yaml'), 'lockfileVersion: 6.0\n');
  const b = detect(fb, { existsSync: ex, readFileSync: readFileSync, join });
  assert(b.package_manager === 'pnpm' && b.install.includes('pnpm'), 'pnpm detection/template lost');
  // fixture C: no match at all -> null (honest), never a guess
  const fc = mkdtempSync(join(tmpdir(), 'eco-c-'));
  assert(detect(fc, { existsSync: ex, readFileSync: readFileSync, join }) === null, 'no-match must be null, not a guess');
});

// ------------------------------------------------------------------
// ST-16 RESEARCHER CONTRACT - read-only role, single artifact, exact
// finish line; facts come from the detector, never from the model.
// ------------------------------------------------------------------
await exhibit('ST-16', 'researcher contract: read-only + one artifact + finish line', () => {
  const md = src('agents/researcher.md');
  const toolsLine = md.split('\n').find((l) => l.startsWith('tools:'));
  assert(!!toolsLine, 'researcher.md: no tools line');
  assert(toolsLine.includes('Bash(node scripts:*)'), 'researcher must run the detector CLI only');
  assert(!/Bash\((?!node)/.test(toolsLine), 'researcher has non-node Bash rights (read-only law broken)');
  assert((md.match(/^output:\s*docs\/factory-profile\.md$/m) || []).length === 1, 'output path not pinned');
  const writes = (md.match(/factory-profile\.md/g) || []).length;
  assert(writes >= 3, 'artifact path mentions lost');
  assert(!/git (commit|push|merge)/.test(md), 'researcher must not touch git mutations');
  assert(md.includes('NEVER'), 'no-guessing law not stated in the contract');
  assert(md.includes('profile written: docs/factory-profile.md'), 'finish line lost');
});

// ------------------------------------------------------------------
// ST-14 PROFILE GATE - the factory refuses to start without a passport:
// honest exit BEFORE any hop/spawn/cost, with the exact rescue command.
// ------------------------------------------------------------------
await exhibit('ST-14', 'profile gate: no passport = honest stop before hops', async () => {
  const flow = src('scripts/flow.mjs');
  assert(flow.includes('PROFILE GATE'), 'gate missing in flow.mjs (law not built or renamed)');
  // behavioral: real flow, no profile -> stop with hint, zero worktrees
  if (process.platform === 'win32') throw new Error('SKIP (win32): behavioral flow gate verified on POSIX runs');
  const root = mkdtempSync(join(tmpdir(), 'gate-smoke-'));
  for (const d of ['scripts', 'agents']) {
    mkdirSync2(join(root, d));
    for (const f of readdirSync(join(KIT, d)))
      if (/\.(mjs|md|js)$/.test(f)) copyFile(join(KIT, d, f), join(root, d, f));
  }
  mkdirSync2(join(root, 'tasks'));
  wf(join(root, 'tasks', 'x.md'), 't\n');
  const run = () => {
    const r = ss(process.execPath, ['scripts/flow.mjs', 'tasks/x.md'], { cwd: root, encoding: 'utf8' });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  let r = run();
  assert(r.code === 1 && r.out.includes('PROFILE GATE') && r.out.includes('run-agent.mjs researcher'), `no-profile stop wrong: ${r.out.slice(-200)}`);
  assert(!ex(join(root, 'work')), 'gate must fire BEFORE sandbox creation (no work dir)');
  // passport present -> gate passes (flow proceeds to its next law, NOT the gate)
  mkdirSync2(join(root, 'docs'));
  wf(join(root, 'docs', 'factory-profile.md'), '---\nschema: 1\n---\n# passport\n');
  r = run();
  assert(!r.out.includes('PROFILE GATE'), 'gate fired WITH valid passport (blocked wrongly)');
});

// ------------------------------------------------------------------
// ST-17 PM FROM PASSPORT - package manager and commands come from the
// passport, not from habit; no passport = pnpm defaults (backward compat).
// ------------------------------------------------------------------
await exhibit('ST-17', 'passport-driven PM: npm world works, absence = pnpm default', async () => {
  assert(src('scripts/profile.mjs').includes('export function getProfile'), 'profile module missing');
  const { getProfile } = await import(pathToFileURL(join(KIT, 'scripts', 'profile.mjs')).href);
  const fsT = { readFileSync, existsSync: ex, join };
  // fixture: npm passport present
  const fa = mkdtempSync(join(tmpdir(), 'pm-a-'));
  mkdirSync2(join(fa, 'docs'));
  wf(join(fa, 'docs', 'factory-profile.md'), '---\nschema: 1\npackage_manager: npm\ninstall: npm ci\nlint: npm run lint\ntest: npm run test\ntypecheck: npm run typecheck\nbuild: npm run build\nlockfile: package-lock.json\n---\n# x\n');
  const a = getProfile(fa, fsT);
  assert(a.package_manager === 'npm' && a.install === 'npm ci', 'passport npm fields lost');
  assert(a.lint === 'npm run lint' && a._source === 'profile', 'passport commands/flag lost');
  // fixture: no passport -> pnpm defaults (backward compat law)
  const fb = mkdtempSync(join(tmpdir(), 'pm-b-'));
  const b = getProfile(fb, fsT);
  assert(b.package_manager === 'pnpm' && b.install.includes('pnpm install'), 'pnpm defaults lost');
  assert(b.lint === 'pnpm lint' && b._source === 'default', 'default flag lost');
  // engine wiring: the 5 consumers now read the profile (source law)
  const flow = src('scripts/flow.mjs');
  assert(flow.includes('getProfile') && !flow.includes('spawnSync(\n    "pnpm",'), 'flow install still hardcoded pnpm');
  assert(flow.includes('passport copied into sandbox'), 'sandbox passport-copy law lost (silent pnpm default inside hops)');
  assert(src('scripts/eval.mjs').includes('getProfile'), 'eval not passport-driven');
  assert(src('scripts/trace.mjs').includes('getProfile'), 'GATE_RE not passport-driven');
  assert(src('scripts/check-agents-md.mjs').includes('getProfile'), 'lockfile law not passport-driven');
  const run = src('scripts/run-agent.mjs');
  assert(run.includes('getProfile') && run.includes('rewriteTools'), 'allowedTools not passport-driven');
});

// ------------------------------------------------------------------
// ST-18 PYTHON WORLD: uv/poetry/pip facts from lockfiles, tool-section
// command facts only, honest unknown for the rest (JobCopilot crash test).
// ------------------------------------------------------------------
await exhibit('ST-18', 'python detect: uv/poetry/pip lockfile facts, tool-section commands, honest unknown', async () => {
  const reg = await import(pathToFileURL(join(KIT, 'scripts', 'ecosystems.js')).href);
  const fsT = { readFileSync, existsSync: ex, join };
  // uv world (JobCopilot shape): uv.lock + pyproject with uv_build, no py tools
  const fa = mkdtempSync(join(tmpdir(), 'py-a-'));
  wf(join(fa, 'pyproject.toml'), '[project]\nname = "x"\n[build-system]\nrequires = ["uv_build>=0.12.11,<0.13.0"]\n');
  wf(join(fa, 'uv.lock'), '');
  const a = reg.detect(fa, fsT);
  assert(a && a.ecosystem === 'python' && a.package_manager === 'uv', 'uv world missed');
  assert(a.install === 'uv sync --frozen' && a.build === 'uv build', 'uv install/build facts lost');
  assert(a.unknown.includes('lint') && a.unknown.includes('test'), 'honest unknown lost for absent tool sections');
  // poetry + pytest/mypy sections
  const fb = mkdtempSync(join(tmpdir(), 'py-b-'));
  wf(join(fb, 'pyproject.toml'), '[tool.poetry]\n[tool.pytest.ini_options]\n[tool.mypy]\n');
  wf(join(fb, 'poetry.lock'), '');
  const b = reg.detect(fb, fsT);
  assert(b.package_manager === 'poetry' && b.test === 'pytest' && b.typecheck === 'mypy', 'poetry/tool facts lost');
  assert(b.unknown.includes('build'), 'build honesty lost');
  // bare requirements.txt = pip, commands all unknown
  const fc = mkdtempSync(join(tmpdir(), 'py-c-'));
  wf(join(fc, 'requirements.txt'), 'langgraph>=1.2.11\n');
  const c = reg.detect(fc, fsT);
  assert(c.package_manager === 'pip' && c.install === 'pip install -r requirements.txt', 'pip fallback lost');
  // unknown world: no manifest at all -> detect null / package manager never guessed
  const fd = mkdtempSync(join(tmpdir(), 'py-d-'));
  assert(reg.detect(fd, fsT) === null, 'empty world must be null');
});

// ------------------------------------------------------------------
// ST-19 UV FAMILY RUN-PREFIX: `uv run pytest` style invocations are
// covered by allowedTools (the 19.11 tester approval-stop in JobCopilot).
// ------------------------------------------------------------------
await exhibit('ST-19', 'uv/poetry run-prefix tools: Bash(pytest:*),Bash(uv run pytest:*)', async () => {
  const run = src('scripts/run-agent.mjs');
  assert(run.includes('runPrefix') && run.includes('Bash(${bin} run ${word}:*)'), 'run-prefix law lost');
  assert(run.includes('/^(uv|poetry|pip)$/.test(bin)'), 'uv-family list lost');
  assert(run.includes("!/^pnpm|^UNKNOWN/i.test"), 'pnpm/UNKNOWN leak guard lost');
  // identity of the pnpm world: no run-prefix mutation when pm is pnpm
  assert(run.includes("package_manager === 'pnpm'") , 'pnpm identity guard lost');
});

// ------------------------------------------------------------------
// ST-20 TUI V1 LAWS: pure ANSI, zero npm-deps, no full-screen, verdict
// history own-line, budget cap env-driven (default unset), --selfcheck surface,
// non-TTY stdout degraded to one plain frame (harness-safe).
// ------------------------------------------------------------------
await exhibit('ST-20', 'tui v1 laws: no-deps, no-fullscreen, verdict own-line, budget footer', async () => {
  const s = src('scripts/tui.mjs');
  assert(!/from '(?!node:)/.test(s), 'zero-npm-deps law: non-node import found');
  const ansi = s.match(/\\x1b\[[0-9]*[A-Za-z]/g) || [];
  assert(!ansi.includes('\\x1b[2J') && !s.includes("\\x1b[H"), 'no full-screen (no clear-screen/home): law lost');
  assert(s.includes('.slice(-3)') && s.includes('verdict →'), 'verdict history own-line lost');
  assert(s.includes('cap unset') && s.includes('PIPELINE_BUDGET_USD') && s.includes('usd'), 'budget footer (env-driven, no default num) lost');
  assert(s.includes('isTTY') && s.includes('--once'), 'non-TTY plain frame guard lost');
  // live selfcheck against a synthetic fixture (deterministic, no models)
  const base = mkdtempSync(join(tmpdir(), 'st20-'));
  mkdirSync2(join(base, '.pipeline', 'runs', 'stx'), { recursive: true });
  wf(join(base, '.pipeline', 'runs', 'stx', 'trace.jsonl'),
    '{"ts":"2026-11-20T10:00:32Z","event":"verdict","result":"PASS"}\n' +
    '{"ts":"2026-11-20T10:00:30Z","event":"hop_usage","cost_usd":1.1439}\n');
  const r = ss(process.execPath, [join(KIT, 'scripts', 'tui.mjs'), '--selfcheck', '--base', base], { encoding: 'utf8', cwd: base });
  assert(r.status === 0, `tui --selfcheck failed: ${r.stdout || ''} ${r.stderr || ''}`);
  assert((r.stdout || '').includes('cap unset'), 'law broken: default cap must be unset, only PIPELINE_BUDGET_USD sets it');
  // cap is env-configurable, not welded to a number
  const r7 = ss(process.execPath, [join(KIT, 'scripts', 'tui.mjs'), '--selfcheck', '--base', base],
    { encoding: 'utf8', cwd: base, env: { ...process.env, PIPELINE_BUDGET_USD: '7' } });
  assert((r7.stdout || '').includes('/ $7'), 'budget cap env override lost');
  const frame = ss(process.execPath, [join(KIT, 'scripts', 'tui.mjs'), '--once'], { encoding: 'utf8', cwd: base });
  assert(frame.stdout.includes('$1.14'), `ledger missed cost: ${frame.stdout}`);
  assert(frame.stdout.includes('verdict → PASS'), 'verdict line missing in plain frame');
});

// ------------------------------------------------------------------
// ST-21 ADR + GLOSSARY (2.9): decisions live in files, not chat.
// Glossary referenced (never re-explained) by AGENTS.md + planner;
// planner reads map-first (glossary → ADR index → repo map);
// committer files SETTLED → new ADR after Y; ADRs superseded-only.
// ------------------------------------------------------------------
await exhibit('ST-21', 'adr+glossary laws: single source, map-first planner, committer files SETTLED->ADR', async () => {
  const ad = src('docs/adr/README.md');
  const ad1 = src('docs/adr/0001-adopt-adr-process-and-glossary.md');
  const gl = src('docs/context/glossary.md');
  const pl = src('agents/planner.md');
  const cm = src('agents/committer.md');
  const ag = src('AGENTS.md');
  // index + law: superseded-only, template, accepted ADR-0001 exists
  assert(ad.includes('supersede') && ad.includes('NEVER edited') || ad.includes('NEVER edited after acceptance'), 'ADR immutability law lost');
  assert(ex(join(KIT, 'docs', 'adr', '0000-template.md')) && ex(join(KIT, 'docs', 'adr', '0001-adopt-adr-process-and-glossary.md')), 'seed ADRs missing');
  assert(ad1.includes('accepted'), 'ADR-0001 not accepted');
  // glossary is the single source: AGENTS.md references, does not re-explain
  assert(gl.includes('circle') && gl.includes('verdict') && gl.includes('premium'), 'glossary terms lost');
  assert(ag.includes('docs/context/glossary.md') && ag.includes('docs/adr/README.md'), 'AGENTS.md does not reference artifacts');
  assert(!/gate[^s]* — checkpoints? in the flow/.test(ag.slice(0, 2000)), 'AGENTS.md re-explains terminology (must reference)');
  // planner: map-first order glossary → ADR index → repo map
  const readFirst = pl.indexOf('READ FIRST');
  const a = pl.indexOf('glossary.md'), b = pl.indexOf('adr/README.md'), c = pl.indexOf('repo-map.md');
  assert(readFirst === 2 || readFirst > 0, 'planner READ FIRST block missing');
  assert(a < b && b < c, 'planner first-read order broken (glossary -> ADR -> map)');
  // committer: SETTLED -> new ADR file + index + ADD LIST; no-edit law
  assert(cm.includes('SETTLED') && cm.includes('<next>-<slug>.md') && cm.includes('ADD LIST'), 'committer ADR filing step lost');
  assert(cm.includes('superseding pairs only'), 'committer supersede-only law lost');
});

// ------------------------------------------------------------------
// ST-22 MACHINE-VERIFIED VERDICT (dual review 23.11, R3): a tester
// PASS is a model CLAIM - flow re-runs the passport's known gates and
// demotes the verdict on any red exit. Behavioral: real shells.
// ------------------------------------------------------------------
await exhibit('ST-22', 'verdict verification: engine re-runs passport gates, red demotes PASS', async () => {
  const s = src('scripts/flow.mjs');
  assert(s.includes('verifyVerdict') && s.includes('verdict_verification'), 'verification law lost');
  assert(s.includes('PIPELINE_VERIFY_GATES !== "0"'), 'opt-out must be logged, not silent');
  // safe: `fn` is extracted from the kit's OWN engine source (same trust
  // root as ST-1's new-Function slice pattern) - no external input reaches
    // the body string.
  const lawStart = s.indexOf('function verifyVerdict');
  const lawEnd = s.indexOf('\n}', lawStart) + 2; // includes the closing '}'
  const fn = s.slice(lawStart, lawEnd) + '\nverifyVerdict;';
  const mk = (testCmd, lintCmd) => {
    const d = mkdtempSync(join(tmpdir(), 'st22-'));
    mkdirSync2(join(d, 'docs'), { recursive: true });
    wf(join(d, 'docs', 'factory-profile.md'),
      `---\ntest: ${testCmd}\nlint: ${lintCmd}\nbuild: ${testCmd}\ntypecheck: unknown\n---\n`);
    return d;
  };
  const getProfileMod = await import(pathToFileURL(join(KIT, 'scripts', 'profile.mjs')).href);
  // ST-22 must exercise the REAL targeted path, not hide a ReferenceError in
  // verifyVerdict's catch (combat 26.11: "targeted skipped: changedTests is
  // not defined" x3 while ST stayed green = a dishonest exhibit).
  const changedTestsMod = await import(pathToFileURL(join(KIT, 'scripts', 'changed-tests.mjs')).href);
  const deps = {
    getProfile: (root) => getProfileMod.getProfile(root),
    spawnSync: ss,
    trace: { ev: () => {} },
    changedTests: changedTestsMod,
  };
  const mkFn = new Function('getProfile', 'spawnSync', 'trace', 'changedTests', 'process', 'exit', fn.replace('function verifyVerdict', 'var verifyVerdict = function verifyVerdict') + ';\nreturn verifyVerdict;');
  const vv = mkFn(deps.getProfile, deps.spawnSync, deps.trace, deps.changedTests, process, (code, msg) => { throw new Error(`exit(${code}): ${msg || ''}`); });
  // a) green gates -> ok
  const ok = vv(mk('node -e "process.exit(0)"', 'node -e "process.exit(0)"'), 'r1');
  assert(ok.ok && ok.results.length === 3, `green fixture failed: ${JSON.stringify(ok.results)}`);
  // b) red test gate -> demoted, honest result carries the failure
  const bad = vv(mk('node -e "process.exit(3)"', 'node -e "process.exit(0)"'), 'r2');
  assert(bad.ok === false && bad.failed.gate === 'test' && bad.failed.exit === 3,
    `red fixture not caught: ${JSON.stringify(bad)}`);
  // c) unknown-only passport -> empty, claim accepted but logged as empty
  const emp = vv(mk('unknown', 'unknown'), 'r3');
  assert(emp.empty && !emp.ok, 'unknown-only passport must be empty-and-logged');
});

// ------------------------------------------------------------------
// ST-23 BUDGET LEDGER & CIRCUIT BREAKER (ADR-0004, queue item 4):
// cap unset = UNLIMITED (law); guard() fires only with a cap; cost
// telemetry incomplete = honest stop, never fake enforcement.
// ------------------------------------------------------------------
await exhibit('ST-23', 'budget: cap unset=unlimited, ledger sums months, guard stops with receipt', async () => {
  const s = src('scripts/flow.mjs');
  assert(s.includes('budgetGuard') && s.includes('PIPELINE_BUDGET_USD') || s.includes('budget.mjs'), 'circuit breaker not wired into flow');
  const bm = await import(pathToFileURL(join(KIT, 'scripts', 'budget.mjs')).href);
  const capWas = process.env.PIPELINE_BUDGET_USD;
  delete process.env.PIPELINE_BUDGET_USD; // isolate: a shell-exported cap must not leak into the law assert
  assert(!bm.guard(), 'law broken: unlimited budget must not stop hops');
  const trace = (dir, run, lines) => {
    mkdirSync2(join(dir, '.pipeline', 'runs', run), { recursive: true });
    wf(join(dir, '.pipeline', 'runs', run, 'trace.jsonl'), lines.join('\n') + '\n');
  };
  const m = new Date().toISOString().slice(0, 7);
  // fixture 1: fully costed runs -> the breaker can enforce honestly
  const d = mkdtempSync(join(tmpdir(), 'st23-'));
  trace(d, 'a', [
    `{"ts":"${m}-01T10:00:00Z","event":"hop_usage","cost_usd":0.80}`,
    `{"ts":"${m}-01T10:05:00Z","event":"verdict","result":"PASS"}`,
  ]);
  trace(d, 'b', [
    `{"ts":"${m}-02T10:00:00Z","event":"hop_usage","cost_usd":0.30}`,
  ]);
  process.env.PIPELINE_TRACE_BASE = d;
  process.env.PIPELINE_BUDGET_USD = '1';
  const sh = bm.sheet();
  assert(Math.abs(sh.totals.usd - 1.10) < 1e-9 && sh.totals.runs === 2, `ledger sums failed: ${JSON.stringify(sh)}`);
  assert(!sh.totals.costUnknown, 'costed runs must not be flagged incomplete');
  const g = bm.guard();
  assert(g && g.includes('$1.10') && g.includes('honest stop'), `guard did not trip: ${g}`);
  // fixture 2: incomplete cost telemetry -> the cap refuses to enforce silently
  const d2 = mkdtempSync(join(tmpdir(), 'st23b-'));
  trace(d2, 'x', [
    `{"ts":"${m}-02T10:00:00Z","event":"hop_usage","cost_usd":0.30}`,
    `{"ts":"${m}-02T10:04:00Z","event":"hop_usage","cost_usd":null}`,
  ]);
  process.env.PIPELINE_TRACE_BASE = d2;
  process.env.PIPELINE_BUDGET_USD = '100';
  const g2 = bm.guard();
  assert(g2 && g2.includes('n/a'), `missing telemetry must stop honestly: ${g2}`);
  if (capWas !== undefined) process.env.PIPELINE_BUDGET_USD = capWas;
  delete process.env.PIPELINE_TRACE_BASE;
});

// ST-25 TARGETED-TEST LAW (master, 24.11): verdict re-run tests the changed
// files, not the world. Pure exhibits: mapping + honest fallback.
await exhibit('ST-25', 'targeted tests: changed src -> test paths, structural/fallback honest', async () => {
  const ct = await import(pathToFileURL(join(KIT, 'scripts', 'changed-tests.mjs')).href);
  const r1 = ct.mapToTests(['src/a/b.tsx', 'docs/x.md']);
  assert(r1.tests.includes('src/a/b.test.tsx'), 'vitest convention mapped');
  assert(r1.tests.includes('src/a/__tests__/b.test.tsx'), '__tests__ sibling mapped');
  const r2 = ct.mapToTests(['tests/test_b.py'].concat(['src/b.py']));
  assert(r2.tests.includes('tests/test_b.py'), 'changed pytest file included directly');
  const g1 = ct.targetedGate({ 'test-targeted': 'npx vitest run $FILES' }, r1.tests, false);
  assert(g1 && g1.includes('"src/a/b.test.tsx"') && g1.startsWith('npx vitest run'), 'targeted cmd built with $FILES');
  assert(ct.targetedGate({ test: 'pnpm test' }, r1.tests, false) === null, 'no template -> honest full-gate fallback');
  assert(ct.targetedGate({ 'test-targeted': 'npx vitest run $FILES' }, [], false) === null, 'no changes -> no targeted cmd');
  assert(ct.mapToTests(['pnpm-lock.yaml']).structural === true, 'lockfile = structural (full gate wins)');
});

// ST-27 AUTO-ADLC (queue #2): trace → issues loop — clustering, knowledge
// gaps FIRST, closed-failure auto-exhibit candidates. CLI behavior only.
await exhibit('ST-27', 'adlc: clusters failures, surfaces knowledge gaps, proposes exhibit for the closed class', async () => {
  const d = mkdtempSync(join(tmpdir(), 'st27-'));
  const tb = join(d, 'tb');
  const mkr = (rid, body) => {
    const p = join(d, 'tb', '.pipeline', 'runs', rid); // lives in the TRACE base (round-10 §6 fixture)
    mkdirSync2(p, { recursive: true });
    wf(join(p, 'trace.jsonl'), body);
  };
  mkr('2026-11-24T10-00-00__run-a', '{"event":"hop_end","role":"developer","exit":1,"note":"timeout"}\n{"event":"circle_end","verdict":"FAIL"}\n');
  mkr('2026-11-24T11-00-00__run-b', '{"event":"knowledge_gap","role":"planner","what":"tests mapping unknown"}\n{"event":"circle_end","verdict":"PASS"}\n');
  mkr('2026-11-25T09-00-00__run-c', '{"event":"hop_end","role":"developer","exit":0}\n{"event":"circle_end","verdict":"PASS"}\n'); // real shape: passing hops carry no note (round-8 review R7-9)
  const ss = (await import('node:child_process')).spawnSync;
  const r = ss(process.execPath, [join(KIT, 'scripts', 'adlc.mjs')], { cwd: d, stdio: 'pipe', timeout: 30000, env: { ...process.env, PIPELINE_TRACE_BASE: tb } });
  const md = readFileSync(join(tb, '.pipeline', 'adlc-issues.md'), 'utf8');
  assert(r.status === 0, `adlc exits 0, got ${r.status}`);
  assert(md.includes('## Knowledge gaps') && md.includes('tests mapping unknown'), 'knowledge gaps surface FIRST (board 21.11)');
  assert(md.includes('developer|exit=1|timeout'), 'failure clustered on REAL event fields (role|exit+note, round-7 A1)');
  assert(md.includes('ST-suggest'), 'closed class -> auto-exhibit candidate (later run exercised the role, A3)');
  // round-10 §6: with PIPELINE_TRACE_BASE != cwd the report lands in the TRACE base
  mkdirSync2(tb, { recursive: true });
  const r2 = ss(process.execPath, [join(KIT, 'scripts', 'adlc.mjs'), '--json'], { cwd: d, stdio: 'pipe', timeout: 30000, env: { ...process.env, PIPELINE_TRACE_BASE: tb } });
  assert(ex(join(tb, '.pipeline', 'adlc-issues.md')), 'adlc writes into the TRACE base, not cwd (one-base invariant)');
  const j = JSON.parse(r2.stdout.toString());
  assert(j.clusters.length === 1 && j.gaps.length === 1 && j.closed.length === 1, `--json findings honest: ${JSON.stringify(j)}`);
  assert(j.clusters[0].includes('timeout') && j.closed[0].includes('timeout'), '--json carries signatures, not only counts (A7)');
});
// ST-26 DOCTOR AGENT (board item №1, phase 4): read-only diagnosis from
// traces + stale sandbox + drift pointer; ONE artifact, no models, no fixes.
await exhibit('ST-26', 'doctor: hop failures, N-gate, merged/stale sandbox split, single report, --fail-on-error', async () => {
  const d = mkdtempSync(join(tmpdir(), 'st26-'));
  const runs = join(d, '.pipeline', 'runs', '2026-11-25T08-00-00__map-x');
  mkdirSync2(join(d, 'work', 'eval-stale'), { recursive: true });
  mkdirSync2(runs, { recursive: true });
  wf(join(runs, 'trace.jsonl'),
    '{"event":"hop_end","role":"developer","model":"glm","exit":1,"duration_ms":91000}\n' +
    '{"event":"hop_failed","role":"developer","exit":1}\n' + // D2: duplicate source - must NOT double-report
    '{"event":"gate","gate":"plan","result":"N"}\n' +
    'not-json-on-purpose\n');
  // real git repo so the merged/unmerged staleness check is honest
  const ss = (await import('node:child_process')).spawnSync;
  const gi = (a) => ss('git', a, { cwd: d, stdio: 'pipe' });
  gi(['init', '-b', 'develop']); gi(['config', 'user.email', 't@t']); gi(['config', 'user.name', 't']);
  wf(join(d, 'f.txt'), 'x'); gi(['add', '.']); gi(['commit', '-q', '-m', 'init']);
  gi(['branch', 'feat/eval-stale']); // branch == develop HEAD: the "merged sandbox" case
  const r = ss(process.execPath, [join(KIT, 'scripts', 'doctor.mjs')], { cwd: d, stdio: 'pipe', timeout: 30000 });
  const out = r.stdout.toString();
  assert(r.status === 0, `doctor exits honestly, got ${r.status}: ${r.stderr?.toString()}`);
  const failCount = (out.match(/hop failure/g) || []).length;
  assert(failCount === 1, `hop failure counted ONCE (D2 dedupe), got ${failCount}`);
  assert(out.includes('plan'), 'human N-gate recorded as info');
  assert(out.includes('eval-stale') && out.includes('--cleanup eval-stale'), 'merged-or-stale sandbox hinted at --cleanup');
  assert(out.includes('corrupted'), 'corrupted-line tolerance reports, does not drop the run');
  assert(ex(join(d, '.pipeline', 'diagnosis-report.md')), 'ONE artifact: diagnosis-report.md written');
  // CI contract: --fail-on-error exits 1 with an error present
  const r2 = ss(process.execPath, [join(KIT, 'scripts', 'doctor.mjs'), '--fail-on-error'], { cwd: d, stdio: 'pipe', timeout: 30000 });
  assert(r2.status === 1, `--fail-on-error must exit 1 over an error, got ${r2.status}`);
  // and the empty path stays honest-quiet
  const d2 = mkdtempSync(join(tmpdir(), 'st26-'));
  const r3 = ss(process.execPath, [join(KIT, 'scripts', 'doctor.mjs')], { cwd: d2, stdio: 'pipe', timeout: 30000 });
  assert(r3.status === 0 && r3.stdout.toString().includes('nothing abnormal'), 'no runs = honest quiet, exit 0');
  // round-9 §1: the exact case the round-8 ReferenceError broke — --fail-on-error on a CLEAN dir exits 0
  const r4 = ss(process.execPath, [join(KIT, 'scripts', 'doctor.mjs'), '--fail-on-error'], { cwd: d2, stdio: 'pipe', timeout: 30000 });
  assert(r4.status === 0, `--fail-on-error on clean dir exits 0 (round-8 bug guard), got ${r4.status}`);
});

// ST-28 HOSPITAL AUTOMATION (master, 25.11): doctor due once/date-limited,
// adlc due on every 5th circle. Pure-function exhibits.
await exhibit('ST-28', 'auto-diag: doctor due-when-unstamped, adlc due on %5, stamp works', async () => {
    // uses the AUTODIAG module (imported at the file top)
  const d = mkdtempSync(join(tmpdir(), 'st28-'));
  const marker = join(d, '.doctor-last');
  assert(AUTODIAG.doctorDue(marker, '2026-11-25'), 'no stamp -> doctor due');
  AUTODIAG.stampDoctor(marker, '2026-11-25');
  assert(!AUTODIAG.doctorDue(marker, '2026-11-25'), 'same-day stamp -> not due');
  assert(AUTODIAG.doctorDue(marker, '2026-11-26'), 'new day -> due again');
  assert(!AUTODIAG.adlcDue(0) && !AUTODIAG.adlcDue(4), 'under 5 circles -> not due');
  assert(AUTODIAG.adlcDue(5) && !AUTODIAG.adlcDue(7), 'due on exactly the 5th, not between');
  assert(AUTODIAG.adlcDue(10) && !AUTODIAG.adlcDue(12), 'every 5th, adlcDue(5 * n) only');
  // behavioral: maybeRunAutoDiag spawn paths (round-10 §9 fix) — REAL root, real broken base
  const savedBase = process.env.PIPELINE_TRACE_BASE;
  delete process.env.PIPELINE_TRACE_BASE;
  const w = mkdtempSync(join(tmpdir(), 'st28w-'));
  // (a) CLEAN: root = KIT -> the REAL scripts/doctor.mjs resolves -> success stamp
  const line1 = AUTODIAG.maybeRunAutoDiag({ root: KIT, phase: 'pre' });
  const markerKit = join(KIT, '.pipeline', '.doctor-last');
  assert(ex(markerKit) && readFileSync(markerKit, 'utf8').trim() === AUTODIAG.todayStamp(), `clean doctor stamps today (line: ${line1})`);
  const line2 = AUTODIAG.maybeRunAutoDiag({ root: KIT, phase: 'pre' });
  assert(line2 === '', 'same-day stamp -> doctor not re-spawned');
  // (b) BROKEN: PIPELINE_TRACE_BASE = an ACTUAL FILE -> readdirSync ENOTDIR -> doctor exit 1
  const trap = join(w, 'tbfile');
  wf(trap, 'x');
  process.env.PIPELINE_TRACE_BASE = trap;
  const line3 = AUTODIAG.maybeRunAutoDiag({ root: KIT, phase: 'pre' });
  assert(line3.includes('FAILED') && line3.includes('exit=1'), `broken base surfaces FAILED + exit: ${line3}`);
  process.env.PIPELINE_TRACE_BASE = savedBase;
}); 
// ------------------------------------------------------------------
// ST-29 GATE-INPUT LAW (born from the 25.11 combat crash, $2.95): the
// interactive Y-gates flow through `input` (node:process stdin) — the
// import MUST exist or the circle dies at the FIRST gate after paying.
await exhibit('ST-29', 'flow imports stdin for the Y-gate ask() — never dies after a paid hop', () => {
  const s = src('scripts/flow.mjs');
  assert(s.includes('stdin as input'), 'stdin import present (Y-gate stdin bridge)');
  assert(/import \{ stdin as input, stdout as output \} from ['"]node:process['"]/.test(s), 'the import line is the process-stdin one');
  assert(s.includes('input.readableEnded'), 'ask() guards EOF via input.readableEnded');
});

// ST-30 CLI PREFLIGHT LAW (master 25.11, built 26.11): no rail CLI = a
// one-line honest stop BEFORE the first token. Silent auto-install denied.
await exhibit('ST-30', 'CLI preflight: no rail CLI stops with install command before any hop', async () => {
  const pf = await import(pathToFileURL(join(KIT, 'scripts', 'cli-preflight.mjs')).href);
  const missing = pf.checkRailCli('claude', { bin: 'definitely-not-a-cli-xyz-' + Date.now() });
  assert(missing && /MISSING CLI/.test(missing), 'missing rail must produce the honest line');
  assert(/npm i -g/.test(missing), 'the line must name the install command');
  const present = pf.checkRailCli(process.execPath.replace(/\\/g, '/'), {});
  // node --version is not a rail; the missing case above is the law. Assert
  // real claude presence only where installed (no false green on CI):
  if (process.env.PIPELINE_CLI_TEST_PRESENT === '1') {
    const cli = process.env.PIPELINE_CLI || 'claude';
    assert(pf.checkRailCli(cli) === null, `installed ${cli} must pass preflight`);
  }
  const flow = src('scripts/flow.mjs');
  const agent = src('scripts/run-agent.mjs');
  assert(flow.includes('checkRailCli(') && flow.includes('__railPreflighted'), 'flow checks before the first hop, once');
  assert(agent.includes('missingCliMessage('), 'direct hop ENOENT is translated');
  assert(!flow.includes('npm i -g claude') && !agent.includes('execSync'), 'no silent auto-install');
});

// ST-31 DESIGN REVIEW HOP (master 26.11): source-agnostic screen map BEFORE
// the planner — cheap skeleton (zero tokens), one screen, one artifact.
await exhibit('ST-31', 'design review: source-agnostic skeleton + one-screen role + map artifact', async () => {
  const sk = src('scripts/screen-skeleton.mjs');
  const role = src('agents/design-reviewer.md');
  const drv = src('scripts/design-review.mjs');
  assert(!/stitch|figma/i.test(sk), 'skeleton parser must be vendor-agnostic (by file type)');
  assert(/NO IMAGE/.test(sk) && /\.\(png\|jpe\?g\|webp\)/.test(sk), 'image is required source of truth');
  assert(/<!--/.test(sk) && /12000/.test(sk), 'zones extracted via markup comments, hard cap present');
  assert(/ONE SCREEN PER HOP/.test(role), 'one screen per hop law');
  assert(/\[Reuse \| New \| Variant\]/.test(role), 'component map classification');
  assert(/docs\/design-decomposition/.test(role) && /KNOWLEDGE GAP/.test(role), 'one artifact + honest gaps');
  assert(drv.includes('screen-skeleton.mjs') && drv.includes('design-reviewer'), 'driver wires digest -> hop');
  const tbl = src('agents-pipeline.yaml');
  assert(/design-reviewer:/.test(tbl), 'model table has the role');
});

const green = results.filter((r) => r.ok);
const red = results.filter((r) => !r.ok && !r.pending && !r.skip);
const pend = results.filter((r) => !r.ok && r.pending);
const skip = results.filter((r) => r.skip);
const ms = results.reduce((a, r) => a + r.ms, 0);
console.log('\n# Self-tests (engine examines itself, no models)');
const bar = '='.repeat(62);
console.log(bar);
for (const r of results) {
  const mark = r.ok ? '\u2705' : (r.pending ? '\u23f3' : (r.skip ? '\u23ed' : '\u274c'));
  console.log(` ${mark} ${r.id}  ${r.title}  (${r.ms}ms)`);
  if (!r.ok) console.log(`     ${r.err}`);
}
console.log(bar);
console.log(` green: ${green.length}/${results.length}${pend.length ? `  pending: ${pend.length}` : ''}${skip.length ? `  skip: ${skip.length}` : ''}${red.length ? `  RED: ${red.length}` : ''}  · ${(ms / 1000).toFixed(2)}s total`);
if (red.length) {
  console.log(' DRIFT against the laws - engine code moved, exhibits caught it.');
  process.exit(1);
}
