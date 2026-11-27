// scripts/ui.mjs — Factory Console (Stage 1: Observe), ADR-0009/0010.
// Layer: factory engine UI (NOT an FSAA src/ file — ADR-0009 places the
// console inside the factory kit; ADR-0010 whitelists exactly this file).
// One zero-dependency Node HTTP server; all HTML/CSS/JS is inlined below.
// Stage 1 Observe = read-only EXCEPT writing .pipeline/gates/<run>.answer
// (the one write the task card grants; Stage 2 consumes it as the stdin-bridge
// contract). The server is an instrument panel, not a control plane: it never
// starts a circle, never merges, never pushes, never spawns a paid hop.
//   Usage:       node scripts/ui.mjs         (DEFAULT_PORT, UI_PORT overrides)
//   Env:         UI_PORT (0..65535; 0 = ephemeral), PIPELINE_TRACE_BASE,
//                PIPELINE_BUDGET_USD
// Agents never run this interactively (ADR-0010); scripts/self-tests.mjs
// ST-42/ST-43 spawn it on an ephemeral port — that is the sanctioned path.
import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HOST = '127.0.0.1';
const DEFAULT_PORT = 1921;
const KIT = dirname(dirname(fileURLToPath(import.meta.url))); // factory root (scripts/..) — role capabilities live here, NOT in the trace base
const BASE = () => process.env.PIPELINE_TRACE_BASE || process.cwd();
const runsDir = () => join(BASE(), '.pipeline', 'runs');
const gatesDir = () => join(BASE(), '.pipeline', 'gates');
const BODY_LIMIT = 8 * 1024;
const REPORT_CAP = 200 * 1024;
const ROLES = ['planner', 'developer', 'tester', 'committer'];

// ----------------------------------------------------------------- helpers --
// portOf: UI_PORT unset/empty -> 1921; 0 is VALID (ephemeral, used by the ST
// harness); anything non-integer or out of 0..65535 -> honest exit 2.
const portOf = () => {
  const raw = process.env.UI_PORT;
  if (raw == null || raw === '') return DEFAULT_PORT;
  const p = Number(raw);
  if (!Number.isInteger(p) || p < 0 || p > 65535) {
    console.error('ui console: UI_PORT="' + raw + '" is not a valid port (0-65535) — unset it or pick e.g. UI_PORT=1930');
    process.exit(2);
  }
  return p;
};
// capOf (ADR-0004): the cap is a CHOICE — unset/invalid/<=0 = unlimited.
const capOf = () => {
  const v = parseFloat(process.env.PIPELINE_BUDGET_USD);
  return Number.isFinite(v) && v > 0 ? v : null;
};
const dayNow = () => new Date().toISOString().slice(0, 10);
const monthNow = () => new Date().toISOString().slice(0, 7);
const err400 = (message) => { const e = new Error(message); e.status = 400; return e; };

// listRuns: run ids (dirs) that carry a trace.jsonl, sorted lexicographically
// (same selection rule as tui.mjs/report.mjs). Never throws.
function listRuns() {
  try {
    return readdirSync(runsDir())
      .filter((d) => existsSync(join(runsDir(), d, 'trace.jsonl')))
      .sort();
  } catch { return []; }
}
const latestRun = () => {
  const r = listRuns();
  return r.length ? r[r.length - 1] : null;
};

// parseTraceLine: one jsonl line -> {seq, ts, event, payload} (payload = event
// minus ts/event) | an '(invalid)' record | null for blank lines. Malformed
// input is never dropped silently: raw text kept (300 chars).
function parseTraceLine(line, index) {
  const seq = index + 1;
  const t = line.trim();
  if (!t) return null;
  try {
    const ev = JSON.parse(t);
    if (!ev || typeof ev !== 'object' || Array.isArray(ev) || !ev.event) throw new Error('not an event');
    const payload = { ...ev };
    delete payload.ts;
    delete payload.event;
    return { seq, ts: ev.ts || null, event: ev.event, payload };
  } catch {
    return { seq, ts: null, event: '(invalid)', payload: { raw: line.slice(0, 300) } };
  }
}

// readTrace: full parsed event list of a run. Tolerates any file chaos -> [].
function readTrace(rid) {
  try {
    return readFileSync(join(runsDir(), rid, 'trace.jsonl'), 'utf8')
      .split('\n')
      .map((l) => l.trim()).filter(Boolean)
      .map(parseTraceLine)
      .filter(Boolean);
  } catch { return []; }
}

// Event ts is ISO/UTC (trace.mjs writes new Date().toISOString()) — string
// slices ARE the UTC day/month, no timezone math needed.
const dayOf = (ev) => String(ev?.ts || '').slice(0, 10);
const monthOf = (ev) => String(ev?.ts || '').slice(0, 7);

// ledger(month): month-to-date spend across ALL runs (ADR-0004 honesty:
// a hop_usage without a numeric cost_usd marks the ledger unknown — label
// appends ' +n/a', never a synthesized number).
function ledger(month) {
  const m = month || monthNow();
  let usd = 0, premium = 0, unknown = false;
  for (const rid of listRuns()) {
    for (const ev of readTrace(rid)) {
      if (monthOf(ev) !== m) continue;
      if (ev.event === 'hop_usage') {
        if (typeof ev.payload.cost_usd === 'number') usd += ev.payload.cost_usd;
        else unknown = true;
      } else if (ev.event === 'hop_rail2_cost') {
        premium += Number(ev.payload.premium_requests) || 0;
      }
    }
  }
  return { usd: Math.round(usd * 100) / 100, premium, unknown };
}

// statsToday(day): per §7.4 — errors count hop_end with exit!==0 ONLY
// (hop_failed must not double-count); warnings = knowledge_gap +
// hop_api_error + gate result N; runsToday counts each run once.
function statsToday(day) {
  const d = day || dayNow();
  let runsToday = 0, errors = 0, warnings = 0;
  for (const rid of listRuns()) {
    const evs = readTrace(rid);
    if (!evs.some((ev) => dayOf(ev) === d)) continue;
    runsToday += 1;
    for (const ev of evs) {
      if (dayOf(ev) !== d) continue;
      if (ev.event === 'hop_end' && Number(ev.payload.exit) !== 0) errors += 1;
      if (ev.event === 'knowledge_gap' || ev.event === 'hop_api_error') warnings += 1;
      if (ev.event === 'gate' && ev.payload.result === 'N') warnings += 1;
    }
  }
  return { runsToday, errors, warnings };
}

// roleTools: the role's ALLOWED tools parsed from agents/<role>.md frontmatter
// (tool: line). WHY: plan §7.4 + §11.5 — the trace records no observed tool
// calls; this is a capability display, not an observation. Resolved from KIT
// (scripts/..) because the trace base may be a foreign project/temp dir;
// BASE is the fallback. Bash(...) -> "Bash", mcp__* -> "mcp".
function roleTools(role) {
  if (!role || !/^[a-z-]+$/.test(role)) return [];
  for (const p of [join(KIT, 'agents', role + '.md'), join(BASE(), 'agents', role + '.md')]) {
    let txt;
    try { txt = readFileSync(p, 'utf8'); } catch { continue; }
    const m = txt.match(/^tools:\s*(.+)$/m);
    if (!m) continue;
    const out = [];
    for (const part of m[1].split(',')) {
      let t = part.trim();
      if (!t) continue;
      if (t.startsWith('Bash(')) t = 'Bash';
      else if (t.startsWith('mcp__')) t = 'mcp';
      if (t && !out.includes(t)) out.push(t);
    }
    return out;
  }
  return [];
}

// tailFor: last n lines of the run's logs/<role>-tail.log (written by the
// engine's hopTail forensics), or null when none.
function tailFor(rid, role, n = 12) {
  try {
    const lines = readFileSync(join(runsDir(), rid, 'logs', role + '-tail.log'), 'utf8')
      .replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim());
    return lines.length ? lines.slice(-n).join('\n') : null;
  } catch { return null; }
}

// statusOf: 'running' iff some role's latest hop_start has no matching later
// hop_end/hop_failed. No flow.lock exists in this repo — none is invented.
function statusOf(events) {
  const open = {};
  for (const ev of events) {
    const role = ev.payload.role;
    if (!role) continue;
    if (ev.event === 'hop_start') open[role] = true;
    else if (ev.event === 'hop_end' || ev.event === 'hop_failed') open[role] = false;
  }
  return Object.values(open).some(Boolean) ? 'running' : 'idle';
}

// hopsOf: 4 fixed role slots HOP-01..04 (ordered planner/developer/tester/
// committer). Latest hop_start + latest hop_end per role decide the state:
// queued (no start) / active / complete (exit 0) / failed (exit !== 0).
function hopsOf(rid, events) {
  return ROLES.map((role, i) => {
    let start = null, end = null;
    for (const ev of events) {
      if (ev.payload.role !== role) continue;
      if (ev.event === 'hop_start') start = ev;
      else if (ev.event === 'hop_end') end = ev;
    }
    const status = !start ? 'queued'
      : !end ? 'active'
      : (Number(end.payload.exit) === 0 ? 'complete' : 'failed');
    return {
      id: 'HOP-' + String(i + 1).padStart(2, '0'),
      role,
      model: (end && end.payload.model) || (start && start.payload.model) || null,
      status,
      durationMs: end ? (Number(end.payload.duration_ms) || null) : null,
      artifact: end ? (end.payload.artifact || null) : null,
      tail: (start || end) ? tailFor(rid, role) : null,
      tools: roleTools(role),
    };
  });
}

// diffOf: git diff --numstat in the latest hop_start.cwd (read-only, 2s
// timeout). WHY: plan §7.4 — untracked files are NOT counted, so the UI shows
// an honest 0/n-a, never a fabricated diff; any failure -> null.
function diffOf(events) {
  const withCwd = events.filter((ev) => typeof ev.payload.cwd === 'string' && ev.payload.cwd);
  if (!withCwd.length) return null;
  const cwd = withCwd[withCwd.length - 1].payload.cwd;
  try {
    const r = spawnSync('git', ['diff', '--numstat'], { cwd, encoding: 'utf8', timeout: 2000 });
    if (r.status !== 0 || !r.stdout) return null;
    let added = 0, removed = 0;
    for (const line of r.stdout.split('\n')) {
      const m = line.match(/^(\d+|-)\t(\d+|-)\t/);
      if (!m) continue;
      added += m[1] === '-' ? 0 : Number(m[1]);
      removed += m[2] === '-' ? 0 : Number(m[2]);
    }
    return { added, removed };
  } catch { return null; }
}

// gateOf: Stage 1 cannot know a gate is WAITING (the trace has no such event
// — plan §10), so the screen question is the fixed commit question and the
// last recorded gate event is shown as context. answer = exact Y/N file.
const GATE_question = 'Accept and commit? (Y/N)';
function gateOf(rid, events) {
  let last = null;
  for (const ev of events) {
    if (ev.event === 'gate') last = { gate: ev.payload.gate ?? null, result: ev.payload.result ?? null };
  }
  let answer = null;
  let answerPath = rid ? '.pipeline/gates/' + rid + '.answer' : null;
  if (rid) {
    try {
      const txt = readFileSync(join(gatesDir(), rid + '.answer'), 'utf8').trim();
      if (txt === 'Y' || txt === 'N') answer = txt;
    } catch { /* no answer yet */ }
  }
  return { question: GATE_question, last, answer, answerPath };
}

// ------------------------------------------------------- payload builders --
// statePayload: the §7.2 snapshot — run, status, month cost, budget, daily
// stats, 4 hop slots, gate (question/last/answer/path), diff. Computed per
// request; traces are small, this stays cheap for a local 1 s poll.
function statePayload() {
  const run = latestRun();
  const events = run ? readTrace(run) : [];
  const led = ledger(monthNow());
  const cap = capOf();
  let label = led.usd > 0 ? '$' + led.usd.toFixed(2)
    : led.premium > 0 ? 'premium×' + led.premium : 'n/a';
  if (led.unknown && label !== 'n/a') label += ' +n/a';
  const budget = cap == null
    ? { cap: null, value: 'unlimited', delta: 'NO CAP' }
    : { cap, value: '$' + led.usd.toFixed(2) + (led.unknown ? ' +n/a' : ''),
        delta: 'of $' + cap + ' (' + Math.min(999, Math.round((led.usd / cap) * 100)) + '%)' };
  return {
    ts: new Date().toISOString(),
    run,
    status: statusOf(events),
    monthCost: { usd: led.usd, premium: led.premium, unknown: led.unknown, label },
    budget,
    stats: statsToday(dayNow()),
    hops: hopsOf(run, events), // no run -> the 4 honest 'queued' slots
    gate: gateOf(run, events),
    diff: run ? diffOf(events) : null,
  };
}

// tracePayload(rid, since): slice of the run's events. `since` is a 0-based
// count, clamped to [0,total]; next = total so the client resumes there. No
// run -> the honest empty shape, never fake rows.
function tracePayload(rid, since) {
  if (!rid) return { run: null, lines: [], next: 0, total: 0 };
  const events = readTrace(rid);
  const total = events.length;
  const s = Number.isFinite(since) ? Math.trunc(since) : 0;
  const from = Math.max(0, Math.min(total, s));
  return { run: rid, lines: events.slice(from), next: total, total };
}

// reportPayload(name): three whitelisted reports (plan §7.2). eval carries a
// pass/fail summary parsed from scoreboard.jsonl (verdict PASS && files_ok &&
// scope_ok; there is NO skip field — none is invented). Text capped 200 KB.
const REPORTS = {
  diagnosis: { title: 'Diagnosis report', path: '.pipeline/diagnosis-report.md' },
  adlc: { title: 'ADLC issues', path: '.pipeline/adlc-issues.md' },
  eval: { title: 'Eval scoreboard', path: 'evals/results/scoreboard.md' },
};
function reportPayload(name) {
  const meta = REPORTS[name];
  if (!meta) return null;
  let exists = false;
  let text = null;
  try {
    text = readFileSync(join(BASE(), meta.path), 'utf8');
    exists = true;
    if (text.length > REPORT_CAP) text = text.slice(0, REPORT_CAP) + '\n…(truncated at 200 KB)';
  } catch { /* missing report is an honest 'not generated yet' */ }
  let summary = null; // plan §7.2: null except for eval
  if (name === 'eval') {
    try {
      const rows = readFileSync(join(BASE(), 'evals', 'results', 'scoreboard.jsonl'), 'utf8')
        .split('\n').filter((l) => l.trim())
        .map((l) => { try { return JSON.parse(l); } catch { return null; } })
        .filter(Boolean);
      const passN = rows.filter((r) => r.verdict === 'PASS' && r.files_ok && r.scope_ok).length;
      summary = { runs: rows.length, pass: passN, fail: rows.length - passN };
    } catch { /* no scoreboard yet -> summary stays null */ }
  }
  return { name, title: meta.title, path: meta.path, exists, text, summary };
}

// writeAnswer: the ONE write the Stage 1 console performs (§7.3). Content is
// EXACTLY 'Y\n' or 'N\n' — Stage 2 parses that byte-exact line from the
// stdin bridge. Validates answer first, then run-id shape (path-traversal
// wall), then existence. Throws with .status so the route maps 400/404.
function writeAnswer(run, answer) {
  if (answer !== 'Y' && answer !== 'N') throw err400('answer must be exactly Y or N');
  if (!run || !/^[A-Za-z0-9_.-]+$/.test(run) || run.includes('..')) throw err400('invalid run id');
  if (!listRuns().includes(run)) throw { status: 404, message: 'unknown run: ' + run };
  mkdirSync(gatesDir(), { recursive: true });
  const path = join(gatesDir(), run + '.answer');
  writeFileSync(path, answer + '\n'); // WHY: plan §7.3 — one char + newline, byte-exact for the Stage 2 stdin bridge
  return path;
}

// ------------------------------------------------------------------- HTTP --
const sendJson = (res, code, obj) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(obj));
};
const sendHtml = (res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(HTML);
};

// reportRoute: unknown name -> 400 (never a guessed report).
function reportRoute(res, url) {
  const name = url.searchParams.get('name');
  if (!REPORTS[name]) return sendJson(res, 400, { error: 'unknown report name (diagnosis|adlc|eval)' });
  return sendJson(res, 200, reportPayload(name));
}

// gateRoute: POST /api/gate {answer:'Y'|'N', run?} — 8 KB body cap, JSON
// only; validation errors from writeAnswer map to their .status (400/404).
function gateRoute(req, res) {
  let body = '';
  let over = false;
  req.on('data', (c) => {
    body += c;
    if (body.length > BODY_LIMIT) over = true;
    if (body.length > 65536) req.destroy();
  });
  req.on('end', () => {
    if (over) return sendJson(res, 400, { error: 'body too large (8 KB limit)' });
    let parsed;
    try { parsed = JSON.parse(body || '{}'); } catch { return sendJson(res, 400, { error: 'invalid JSON body' }); }
    try {
      const rid = parsed.run || latestRun();
      const answer = parsed.answer;
      writeAnswer(rid, answer);
      return sendJson(res, 200, { ok: true, answer, path: '.pipeline/gates/' + rid + '.answer' });
    } catch (e) {
      return sendJson(res, (e && e.status) || 400, { error: (e && e.message) || 'gate write failed' });
    }
  });
}

// handler: exact Stage-1 routing (plan §7.2/§8 Step 6). Unknown run in
// /api/trace -> 404 (not an empty lie); wrong method on a known path -> 405.
function handler(req, res) {
  const url = new URL(req.url, 'http://' + HOST);
  try {
    if (req.method === 'GET' && url.pathname === '/') return sendHtml(res);
    if (req.method === 'GET' && url.pathname === '/api/state') return sendJson(res, 200, statePayload());
    if (req.method === 'GET' && url.pathname === '/api/trace') {
      const run = url.searchParams.get('run') || latestRun();
      if (run && !listRuns().includes(run)) return sendJson(res, 404, { error: 'unknown run' });
      return sendJson(res, 200, tracePayload(run, Number(url.searchParams.get('since') || 0)));
    }
    if (req.method === 'GET' && url.pathname === '/api/report') return reportRoute(res, url);
    if (req.method === 'POST' && url.pathname === '/api/gate') return gateRoute(req, res);
    if (['/api/state', '/api/trace', '/api/report', '/api/gate'].includes(url.pathname))
      return sendJson(res, 405, { error: 'method not allowed' });
    return sendJson(res, 404, { error: 'not found' });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

// Importing this module must NOT start the server (ST-42/ST-43 source-law and
// boot laws depend on a bare import doing nothing); the argv[1]-vs-module
// path comparison mirrors trace.mjs's own CLI guard.
const isMain = (() => {
  const a = process.argv[1] ? resolve(process.argv[1]).replace(/\\/g, '/').toLowerCase() : '';
  const self = fileURLToPath(import.meta.url).replace(/\\/g, '/').toLowerCase();
  return a === self;
})();
if (isMain) {
  const port = portOf();
  const server = createServer(handler);
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error('ui console: port ' + port + ' is busy — set UI_PORT=<port> (e.g. UI_PORT=1930 node scripts/ui.mjs)');
      process.exit(1);
    }
    console.error('ui console: ' + ((err && err.message) || err));
    process.exit(1);
  });
  server.listen(port, HOST, () => {
    const p = server.address().port; // WHY: UI_PORT=0 is legal — honest listen prints the ACTUAL bound port
    console.log('factory console → http://' + HOST + ':' + p);
    console.log('base: ' + BASE() + ' · Stage 1 Observe · gate answers: .pipeline/gates/<run>.answer');
  });
}

// ---------------------------------------------------------- inlined UI ------
// Zero external assets: no fonts, no images, no stylesheets, no @import, no
// url(http) — the whole document lives in CSS + CLIENT + HTML below (ADR-0005,
// ADR-0010 single-file law). every color/space/font value goes through :root.
const CSS = `:root{
  --bg-canvas:#0b0b0c; --bg-header:#0e0e10; --surface-panel:#131315;
  --surface-inset:#0f0f11; --surface-chip:#1a1a1d; --surface-elevated:#1c1c20;
  --border-subtle:#26262a; --border-accent:#f2a93b;
  --text-primary:#e8e8ea; --text-muted:#85858c; --text-inverse:#151515;
  --accent:#f2a93b; --status-complete:#5eead4; --status-active:#f2a93b;
  --status-queued:#6b6b72; --status-error:#f87171; --diff-add:#5eead4; --diff-remove:#f87171;
  --role-planner:#8ab4f8; --role-developer:#f2a93b; --role-tester:#a78bfa; --role-committer:#94a3b8;
  --font-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  --radius-panel:4px; --radius-pill:999px;
}
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--bg-canvas);color:var(--text-primary);font-family:var(--font-mono);font-size:13px;line-height:1.45}
.console-shell{max-width:1300px;margin:0 auto;padding:16px 24px 24px}
.eyebrow{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--text-muted)}
.muted{color:var(--text-muted)}
.header-bar{display:flex;align-items:center;gap:14px;background:var(--bg-header);border:1px solid var(--border-subtle);border-radius:var(--radius-panel);padding:12px 16px;flex-wrap:wrap}
.brand-mark{width:34px;height:34px;border:1px solid var(--border-accent);color:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;border-radius:var(--radius-panel);flex:none}
.brand-mark.small{width:26px;height:26px;font-size:14px}
.brand-name{font-weight:700;letter-spacing:.22em}
.brand-sub{font-size:11px;color:var(--text-muted);letter-spacing:.14em}
.hdr-block{min-width:110px}
.hdr-block .val{font-size:12px;overflow:hidden;text-overflow:ellipsis;max-width:280px;white-space:nowrap}
.hdr-block.right{text-align:right}
.spacer{flex:1}
.status-pill{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--border-subtle);border-radius:var(--radius-pill);padding:4px 12px;text-transform:uppercase;font-size:11px;letter-spacing:.14em;background:var(--surface-inset)}
.status-pill .dot{width:8px;height:8px;border-radius:50%;background:var(--status-queued)}
.status-pill.running{border-color:var(--status-active);color:var(--status-active)}
.status-pill.running .dot{background:var(--status-active);animation:pulse 1.6s infinite}
.stat-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:12px}
.stat-card{background:var(--surface-panel);border:1px solid var(--border-subtle);border-bottom:2px solid var(--border-subtle);border-radius:var(--radius-panel);padding:10px 14px 12px}
.stat-card .idx,.stat-card .lbl{font-size:10px;letter-spacing:.16em;color:var(--text-muted);text-transform:uppercase}
.stat-card .idx{float:right}
.stat-card .val{font-size:26px;margin-top:4px;color:var(--text-primary);font-variant-numeric:tabular-nums}
.stat-card .delta{font-size:10px;color:var(--text-muted);letter-spacing:.1em;margin-top:2px}
.workspace,.bottom-dock{display:grid;grid-template-columns:2fr 1fr;gap:12px;margin-top:12px;align-items:stretch}
.panel{background:var(--surface-panel);border:1px solid var(--border-subtle);border-radius:var(--radius-panel);display:flex;flex-direction:column;min-height:0}
.workspace .panel{height:520px}
.panel-header{display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--border-subtle);flex:none}
.panel-title{font-size:12px;letter-spacing:.14em}
.trail{margin-left:auto;font-size:10px;letter-spacing:.14em;color:var(--text-muted)}
.timeline-columns,.hop-row{display:grid;grid-template-columns:minmax(150px,1.4fr) 1.4fr 1fr 1fr 1.2fr;gap:8px;padding:8px 14px;align-items:center;min-width:0}
.trace-panel .timeline-columns{grid-template-columns:80px 1fr}
.timeline-columns{font-size:10px;letter-spacing:.14em;color:var(--text-muted);border-bottom:1px solid var(--border-subtle);text-transform:uppercase;flex:none}
.hop-scroll{flex:1;overflow:auto;min-height:0}
.hop-row{width:100%;background:transparent;border:0;border-bottom:1px solid var(--border-subtle);border-left:3px solid transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.hop-row:hover{background:var(--surface-inset)}
.hop-row.selected{border-left:3px solid var(--accent);background:var(--surface-inset)}
.role-id{display:flex;align-items:center;gap:8px;min-width:0}
.role-badge{border:1px solid var(--border-subtle);border-radius:2px;padding:2px 6px;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted);flex:none}
.role-badge.role-planner{color:var(--role-planner);border-color:var(--role-planner)}
.role-badge.role-developer{color:var(--role-developer);border-color:var(--role-developer)}
.role-badge.role-tester{color:var(--role-tester);border-color:var(--role-tester)}
.role-badge.role-committer{color:var(--role-committer);border-color:var(--role-committer)}
.hop-id{font-size:10px;color:var(--text-muted);letter-spacing:.08em}
.cell{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
.hop-status{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted)}
.hop-status::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--status-queued);flex:none}
.hop-status.status-complete{color:var(--status-complete)}
.hop-status.status-complete::before{background:var(--status-complete)}
.hop-status.status-active{color:var(--status-active)}
.hop-status.status-active::before{background:var(--status-active);animation:pulse 1.6s infinite}
.hop-status.status-error,.hop-status.status-failed{color:var(--status-error)}
.hop-status.status-error::before,.hop-status.status-failed::before{background:var(--status-error)}
.tool-chip{display:inline-block;border:1px solid var(--border-subtle);background:var(--surface-chip);border-radius:2px;padding:1px 6px;font-size:10px;margin:1px 3px 1px 0;color:var(--text-muted)}
.hop-detail{margin:0;padding:10px 14px 12px 17px;background:var(--surface-inset);border-bottom:1px solid var(--border-subtle);font-size:11px}
.hop-detail .detail-lbl{font-size:10px;color:var(--text-muted);letter-spacing:.14em;margin-top:6px}
.hop-detail .detail-art,.hop-detail .detail-tail{margin:2px 0 0;color:var(--text-primary);white-space:pre-wrap;word-break:break-word}
.detail-tail{font-family:var(--font-mono);font-size:11px;max-height:180px;overflow:auto}
.timeline-footer{display:flex;gap:16px;align-items:center;padding:8px 14px;border-top:1px solid var(--border-subtle);font-size:10px;color:var(--text-muted);letter-spacing:.14em;flex:none;text-transform:uppercase}
.legend .sw{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px}
.legend .sw-complete{background:var(--status-complete)}
.legend .sw-active{background:var(--status-active)}
.legend .sw-queued{background:var(--status-queued)}
.footer-toggle{background:transparent;border:0;color:var(--text-muted);font:inherit;font-size:10px;letter-spacing:.14em;cursor:pointer;padding:2px 0;text-transform:uppercase}
.footer-toggle:hover{color:var(--accent)}
.trace-lines{flex:1;overflow:auto;font-size:11px;min-height:0}
.trace-line{display:grid;grid-template-columns:40px 70px 140px 1fr;gap:8px;padding:3px 14px;border-bottom:1px solid var(--border-subtle)}
.trace-line .seq,.trace-line .t{color:var(--text-muted);font-variant-numeric:tabular-nums}
.trace-line .ev{text-transform:uppercase;letter-spacing:.06em}
.trace-line .pl{color:var(--text-muted);white-space:pre-wrap;word-break:break-word;min-width:0}
.trace-line.event-gate .ev{color:var(--accent)}
.trace-line.event-gate .pl{color:var(--accent)}
.trace-line.event-usage .ev{color:var(--status-complete)}
.trace-line.event-verdict .ev{color:var(--role-tester)}
.trace-line.event-verdict .pl{color:var(--text-primary)}
.trace-line.event-error .ev,.trace-line.event-error .pl{color:var(--status-error)}
.trace-line.event-invalid .ev,.trace-line.event-invalid .pl{color:var(--status-error)}
.trace-cursor{padding:6px 14px;font-size:11px;color:var(--accent);border-top:1px solid var(--border-subtle);letter-spacing:.08em;flex:none}
.trace-cursor .block{display:inline-block;animation:blink 1s steps(2,start) infinite}
.live-indicator{display:inline-flex;gap:6px;align-items:center;font-size:10px;letter-spacing:.14em;color:var(--status-complete)}
.live-indicator .dot{width:7px;height:7px;border-radius:50%;background:var(--status-complete);animation:pulse 1.6s infinite}
.live-indicator.off{color:var(--status-queued)}
.live-indicator.off .dot{background:var(--status-queued);animation:none}
.gate-prompt{border:1px solid var(--border-accent)}
.gate-key{border:1px solid var(--border-accent);padding:4px 10px;text-align:center;border-radius:var(--radius-panel);color:var(--accent);flex:none}
.gate-key .gk-big{font-size:13px;font-weight:700;letter-spacing:.2em}
.gate-key .gk-small{font-size:9px;color:var(--text-muted);letter-spacing:.2em}
.gate-body{padding:12px 14px}
.gate-note{margin:0;font-size:11px;color:var(--text-muted)}
.gate-row{display:flex;gap:10px;align-items:baseline;margin-top:10px;font-size:12px}
.gate-actions{display:flex;gap:10px;margin-top:12px}
.gate-status{margin-top:10px;font-size:11px;color:var(--text-muted);min-height:16px;white-space:pre-wrap;word-break:break-word}
.btn{border:1px solid var(--border-subtle);background:transparent;color:var(--text-primary);font:inherit;padding:8px 14px;border-radius:var(--radius-panel);cursor:pointer;letter-spacing:.1em;font-size:12px}
.btn:hover:not(:disabled){border-color:var(--accent);color:var(--accent)}
.btn:disabled{opacity:.4;cursor:not-allowed}
.approve-btn{background:var(--accent);border-color:var(--accent);color:var(--text-inverse)}
.approve-btn:hover:not(:disabled){background:var(--accent);color:var(--text-inverse);filter:brightness(1.15)}
.report-drawer .panel-header .btn{margin-left:auto;padding:4px 10px;font-size:11px}
.drawer-content{flex:1;overflow:auto;min-height:0}
.drawer-link{display:block;width:100%;text-align:left;background:transparent;border:0;border-bottom:1px solid var(--border-subtle);color:var(--text-primary);font:inherit;font-size:12px;padding:9px 14px;cursor:pointer}
.drawer-link:hover{background:var(--surface-inset);color:var(--accent)}
.drawer-summary{color:var(--status-complete);font-size:10px;letter-spacing:.06em}
.drawer-report{white-space:pre-wrap;word-break:break-word;max-height:300px;overflow:auto;background:var(--surface-inset);border:1px solid var(--border-subtle);padding:8px;margin:8px 14px;font-size:10px;color:var(--text-primary)}
.help-fab{position:fixed;right:18px;bottom:18px;width:36px;height:36px;border-radius:50%;border:1px solid var(--border-accent);background:var(--surface-elevated);color:var(--accent);font:inherit;font-weight:700;cursor:pointer;z-index:10}
.help-fab:hover{filter:brightness(1.15)}
.help-pop{position:fixed;right:18px;bottom:62px;max-width:340px;background:var(--surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-panel);padding:10px 12px;font-size:11px;color:var(--text-primary);display:none;z-index:10}
.help-pop.open{display:block}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes blink{50%{opacity:0}}
@media (prefers-reduced-motion: reduce){
  .status-pill.running .dot,.hop-status.status-active::before,.trace-cursor .block,.live-indicator .dot{animation:none}
}
@media (max-width: 1000px){
  .workspace,.bottom-dock{grid-template-columns:1fr}
  .workspace .panel{height:420px}
}`;

// CLIENT — the browser half. Template-literal law (plan §8 Step 4): the client
// script must not use backticks or ${...} or the server-side HTML template
// would break, so every dynamic value below is '...' + value concatenation,
// and every dynamic DOM value goes through textContent (XSS wall, §10).
const CLIENT = `'use strict';
// Factory Console client (Stage 1 Observe). Polls /api/state + /api/trace,
// renders the panel, POSTs the human gate answer. All data values flow
// through textContent — never innerHTML (honest + XSS-safe).
var TONE = {
  gate: 'event-gate', verdict: 'event-verdict', hop_usage: 'event-usage',
  hop_rail2_cost: 'event-usage', hop_api_error: 'event-error',
  hop_failed: 'event-error', '(invalid)': 'event-invalid'
};
var state = { inFlight: false, since: 0, total: 0, lastRun: null, run: null,
  autoScroll: true, expandedRole: null, touched: false, lastHops: null };
var REPORT_META = [
  { name: 'diagnosis', label: 'diagnosis-report.md' },
  { name: 'adlc', label: 'adlc-issues.md' },
  { name: 'eval', label: 'eval-all · scoreboard' }
];

function $(id) { return document.getElementById(id); }
function el(tag, cls, text) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function setText(id, value) { var n = $(id); if (n) n.textContent = value; }
function pad2(n) { return String(n).padStart(2, '0'); }
function fmtDur(ms) {
  if (ms == null) return 'n/a';
  return ms >= 1000 ? (ms / 1000).toFixed(1) + 's' : ms + 'ms';
}

// StatusPill: uppercase RUNNING/IDLE (+ pulse dot via CSS class swap).
function setStatus(status) {
  $('status-pill').className = 'status-pill ' + (status === 'running' ? 'running' : 'idle');
  setText('status-label', status === 'running' ? 'RUNNING' : 'IDLE');
}
// Clock: monospace UTC HH:MM:SS (ts strings are already UTC).
function tickClock() { setText('clock', new Date().toISOString().slice(11, 19)); }
// LiveIndicator: dot + LIVE/OFFLINE; OFFLINE keeps the last frame on the wall.
function setLive(ok) {
  $('live-indicator').classList.toggle('off', !ok);
  setText('live-label', ok ? 'LIVE' : 'OFFLINE');
}

// renderState: header, stat strip, gate card, diff summary — the full §7.2
// snapshot onto the fixed slots. Missing values are honest 'n/a'.
function renderState(st) {
  state.run = st.run;
  setText('run-id', st.run || 'n/a');
  setStatus(st.status);
  setText('month-cost', st.monthCost ? st.monthCost.label : 'n/a');
  setText('stat-runs', String(st.stats.runsToday));
  setText('stat-errors', String(st.stats.errors));
  setText('stat-warnings', String(st.stats.warnings));
  setText('stat-budget', st.budget.value);
  setText('stat-budget-delta', st.budget.delta);
  setText('diff-summary', st.diff ? '+' + st.diff.added + ' / \\u2212' + st.diff.removed : '+n/a / \\u2212n/a');
  var gs = null;
  if (!st.run) gs = 'no run \\u2014 nothing to answer';
  else if (st.gate && st.gate.answer) gs = 'ANSWERED ' + st.gate.answer + ' · ' + st.gate.answerPath;
  if (gs !== null) setText('gate-status', gs);
  $('btn-approve').disabled = !st.run;
  $('btn-deny').disabled = !st.run;
  renderHops(st.hops || []);
}

// renderHops: always rebuild the 4 role slots; expandedRole survives polls;
// default selection = first active hop, else last non-queued (until the
// human clicks — then their choice wins).
function renderHops(hops) {
  state.lastHops = hops;
  if (!state.touched) {
    var act = hops.filter(function (h) { return h.status === 'active'; })[0];
    var lastNQ = null;
    for (var i = hops.length - 1; i >= 0; i--) if (hops[i].status !== 'queued') { lastNQ = hops[i]; break; }
    state.expandedRole = act ? act.role : (lastNQ ? lastNQ.role : null);
  }
  var list = $('hop-list');
  list.textContent = '';
  hops.forEach(function (h) {
    var btn = el('button', 'hop-row' + (state.expandedRole === h.role ? ' selected' : ''));
    btn.type = 'button';
    btn.setAttribute('aria-expanded', state.expandedRole === h.role ? 'true' : 'false');
    var roleCell = el('span', 'role-id');
    roleCell.appendChild(el('span', 'role-badge role-' + h.role, h.role));
    roleCell.appendChild(el('span', 'hop-id', h.id));
    btn.appendChild(roleCell);
    btn.appendChild(el('span', 'cell model', h.model || 'n/a'));
    btn.appendChild(el('span', 'hop-status status-' + h.status, h.status));
    btn.appendChild(el('span', 'cell dur', h.status === 'active' ? '…' : fmtDur(h.durationMs)));
    var tools = el('span', 'cell tools');
    if (h.tools && h.tools.length) {
      // capability chips: the role's ALLOWED tools, not observed calls
      h.tools.forEach(function (t) { tools.appendChild(el('span', 'tool-chip', t)); });
    } else tools.appendChild(el('span', 'tool-chip', '\\u2014'));
    btn.appendChild(tools);
    btn.addEventListener('click', function () {
      state.touched = true;
      state.expandedRole = state.expandedRole === h.role ? null : h.role;
      renderHops(state.lastHops);
    });
    list.appendChild(btn);
    if (state.expandedRole === h.role) {
      var det = el('div', 'hop-detail');
      det.appendChild(el('div', 'detail-lbl', 'ARTIFACT PATH'));
      det.appendChild(el('div', 'detail-art', h.artifact || 'n/a'));
      det.appendChild(el('div', 'detail-lbl', 'TAIL'));
      var tailText = h.tail != null ? h.tail
        : (h.status === 'active' ? 'Waiting for live output…' : 'No tail recorded for this hop.');
      det.appendChild(el('pre', 'detail-tail', tailText));
      list.appendChild(det);
    }
  });
}

// renderTrace: append-only feed. Tone map (gate/usage/verdict/error), trim to
// 500 rows, auto-scroll unless the human scrolled up; caret shows the next seq.
function renderTrace(lines) {
  var box = $('trace-lines');
  (lines || []).forEach(function (ln) {
    var row = el('div', 'trace-line ' + (TONE[ln.event] || 'event-default'));
    row.appendChild(el('span', 'seq', pad2(ln.seq)));
    row.appendChild(el('span', 't', ln.ts ? String(ln.ts).slice(11, 19) : '--:--:--'));
    row.appendChild(el('span', 'ev', ln.event === '(invalid)' ? '(invalid line ' + ln.seq + ')' : ln.event));
    var pl = ln.event === '(invalid)' ? ((ln.payload && ln.payload.raw) || '') : JSON.stringify(ln.payload || {});
    if (pl.length > 400) pl = pl.slice(0, 400) + '…';
    row.appendChild(el('span', 'pl', pl));
    box.appendChild(row);
  });
  while (box.children.length > 500) box.removeChild(box.firstChild);
  if (state.autoScroll) box.scrollTop = box.scrollHeight;
  setText('trace-cursor', '#' + pad2(state.total + 1));
}

// renderReports: drawer rows built once at boot; clicking a row fetches its
// report and expands a <pre>. eval row gains the green pass/fail summary.
// Missing report = 'not generated yet…' — never a fake doc.
function renderReports() {
  var box = $('report-list');
  box.textContent = '';
  REPORT_META.forEach(function (m) {
    var wrap = el('div', 'drawer-item');
    var row = el('button', 'drawer-link', m.label);
    row.type = 'button';
    var pre = null;
    row.addEventListener('click', function () {
      if (pre) { wrap.removeChild(pre); pre = null; return; }
      pre = el('pre', 'drawer-report', 'loading…');
      wrap.appendChild(pre);
      fetch('/api/report?name=' + m.name).then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        return r.json();
      }).then(function (rep) {
        pre.textContent = rep.exists ? rep.text
          : 'not generated yet (run node scripts/doctor.mjs / adlc.mjs / eval.mjs)';
        if (rep.summary) {
          row.textContent = m.label;
          row.appendChild(el('span', 'drawer-summary',
            ' pass ' + rep.summary.pass + '/' + rep.summary.runs + ' · fail ' + rep.summary.fail));
        }
      }).catch(function (e) { pre.textContent = 'ERROR: ' + e; });
    });
    wrap.appendChild(row);
    box.appendChild(wrap);
  });
}

// bindGate: APPROVE/DENY POST /api/gate {answer}. Feedback lands in
// #gate-status and is confirmed (or corrected) by the next 1 s state poll.
// No run -> both buttons disabled server-side and client-side.
function bindGate() {
  var send = function (answer) {
    var btn = answer === 'Y' ? $('btn-approve') : $('btn-deny');
    btn.disabled = true;
    fetch('/api/gate', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answer: answer }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        btn.disabled = false;
        setText('gate-status', res.ok
          ? 'ANSWERED ' + res.j.answer + ' · ' + res.j.path
          : 'ERROR: ' + ((res.j && res.j.error) || 'gate write failed'));
      })
      .catch(function (e) { btn.disabled = false; setText('gate-status', 'ERROR: ' + e); });
  };
  $('btn-approve').addEventListener('click', function () { send('Y'); });
  $('btn-deny').addEventListener('click', function () { send('N'); });
}

// poll: 1 s cadence; the inFlight guard never lets two polls overlap. On a
// fetch failure the panel goes OFFLINE and keeps its last frame.
async function poll() {
  if (state.inFlight) return;
  state.inFlight = true;
  try {
    var rs = await fetch('/api/state');
    if (!rs.ok) throw new Error('state http ' + rs.status);
    renderState(await rs.json());
    await fetchTrace();
    setLive(true);
  } catch (e) {
    setLive(false); // outage: keep the last frame, mark OFFLINE
  } finally {
    state.inFlight = false;
  }
}

// fetchTrace: since-count pagination — first poll since=0, then since=next,
// appending only new lines. A different run resets the feed honestly.
async function fetchTrace() {
  var tj = await (await fetch('/api/trace?since=' + state.since)).json();
  if (tj.run !== state.lastRun) {
    state.lastRun = tj.run;
    state.since = 0;
    $('trace-lines').textContent = '';
    tj = await (await fetch('/api/trace?since=0')).json();
  }
  state.since = tj.next != null ? tj.next : tj.total;
  state.total = tj.total || 0;
  renderTrace(tj.lines || []);
}

function boot() {
  tickClock();
  setInterval(tickClock, 1000);
  bindGate();
  renderReports();
  $('drawer-toggle').addEventListener('click', function () {
    var opening = $('drawer-content').hidden;
    $('drawer-content').hidden = !opening;
    $('drawer-toggle').textContent = opening ? 'Hide artifacts ▴' : 'Show artifacts ▾';
  });
  $('help-fab').addEventListener('click', function () {
    var open = $('help-pop').classList.toggle('open');
    $('help-fab').setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  // scroll-up > 20px switches AUTO-SCROLL off; the footer button toggles back.
  $('trace-lines').addEventListener('scroll', function () {
    var b = $('trace-lines');
    if (state.autoScroll && b.scrollHeight - b.scrollTop - b.clientHeight > 20) {
      state.autoScroll = false;
      setText('auto-scroll', 'OFF');
    }
  });
  $('auto-scroll-toggle').addEventListener('click', function () {
    state.autoScroll = !state.autoScroll;
    setText('auto-scroll', state.autoScroll ? 'ON' : 'OFF');
    if (state.autoScroll) { var b = $('trace-lines'); b.scrollTop = b.scrollHeight; }
  });
  poll();
  setInterval(poll, 1000);
}
boot();`;

// HTML — verbatim console screen structure (Stage 1 copy): header bar, stat
// strip 01-04, 2-column workspace (hop timeline / trace feed), 2-column
// bottom dock (gate card / report drawer), help FAB.
const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Factory Console</title>
<style>${CSS}</style>
</head>
<body>
<div class="console-shell">
  <header class="header-bar">
    <div class="brand-mark">F</div>
    <div class="hdr-block">
      <div class="brand-name">FACTORY</div>
      <div class="brand-sub">console</div>
    </div>
    <div class="hdr-block">
      <div class="eyebrow">CURRENT RUN</div>
      <div class="val" id="run-id">n/a</div>
    </div>
    <div id="status-pill" class="status-pill idle"><span class="dot"></span><span id="status-label">IDLE</span></div>
    <div class="spacer"></div>
    <div class="hdr-block right">
      <div class="eyebrow">MONTH COST</div>
      <div class="val" id="month-cost">n/a</div>
    </div>
    <div class="hdr-block right">
      <div class="eyebrow">UTC</div>
      <div class="val" id="clock">--:--:--</div>
    </div>
  </header>

  <section class="stat-strip">
    <div class="stat-card"><div class="idx">01</div><div class="lbl">RUNS TODAY</div><div class="val" id="stat-runs">n/a</div></div>
    <div class="stat-card"><div class="idx">02</div><div class="lbl">ERRORS</div><div class="val" id="stat-errors">n/a</div></div>
    <div class="stat-card"><div class="idx">03</div><div class="lbl">WARNINGS</div><div class="val" id="stat-warnings">n/a</div></div>
    <div class="stat-card"><div class="idx">04</div><div class="lbl">BUDGET USED</div><div class="val" id="stat-budget">n/a</div><div class="delta" id="stat-budget-delta">NO CAP</div></div>
  </section>

  <section class="workspace">
    <div class="panel timeline-panel">
      <div class="panel-header">
        <div><div class="eyebrow">EXECUTION</div><div class="panel-title">HOP TIMELINE</div></div>
        <div class="trail" id="hop-count">04 HOPS</div>
      </div>
      <div class="timeline-columns">
        <span>ROLE / ID</span><span>MODEL</span><span>STATUS</span><span>DURATION</span><span>TOOLS_USED</span>
      </div>
      <div class="hop-scroll" id="hop-list"></div>
      <div class="timeline-footer legend">
        <span><span class="sw sw-complete"></span>COMPLETE</span>
        <span><span class="sw sw-active"></span>ACTIVE</span>
        <span><span class="sw sw-queued"></span>QUEUED</span>
      </div>
    </div>
    <div class="panel trace-panel">
      <div class="panel-header">
        <div><div class="eyebrow">STREAM</div><div class="panel-title">TRACE FEED</div></div>
        <div class="trail"><span id="live-indicator" class="live-indicator"><span class="dot"></span><span id="live-label">LIVE</span></span></div>
      </div>
      <div class="timeline-columns"><span>EVENT</span><span>PAYLOAD</span></div>
      <div class="trace-lines" id="trace-lines" aria-live="polite"></div>
      <div class="trace-cursor"><span id="trace-cursor">#01</span> <span class="block">▌</span></div>
      <div class="timeline-footer">
        <button type="button" class="footer-toggle" id="auto-scroll-toggle">AUTO-SCROLL <span id="auto-scroll">ON</span></button>
        <span>NEWEST BOTTOM ↓</span>
      </div>
    </div>
  </section>

  <section class="bottom-dock">
    <div class="panel gate-prompt">
      <div class="panel-header">
        <div class="gate-key"><div class="gk-big">GATE</div><div class="gk-small">Y / N</div></div>
        <div><div class="eyebrow">HUMAN CHECKPOINT</div><div class="panel-title" id="gate-title">Accept and commit? (Y/N)</div></div>
      </div>
      <div class="gate-body">
        <p class="gate-note">human decision — machine only adds eyes</p>
        <div class="gate-row"><span class="eyebrow">DIFF SUMMARY</span><span id="diff-summary">+n/a / −n/a</span></div>
        <div class="gate-actions">
          <button type="button" class="btn approve-btn" id="btn-approve">APPROVE Y</button>
          <button type="button" class="btn deny-btn" id="btn-deny">DENY N</button>
        </div>
        <div id="gate-status" class="gate-status"></div>
      </div>
    </div>
    <div class="panel report-drawer">
      <div class="panel-header">
        <div class="brand-mark small">R</div>
        <div><div class="eyebrow">ARTIFACTS</div><div class="panel-title">REPORT DRAWER</div></div>
        <button type="button" class="btn" id="drawer-toggle">Show artifacts ▾</button>
      </div>
      <div class="drawer-content" id="drawer-content" hidden><div id="report-list"></div></div>
    </div>
  </section>
</div>
<button type="button" id="help-fab" class="help-fab" aria-expanded="false">?</button>
<div id="help-pop" class="help-pop">Stage 1 Observe — read-only console. APPROVE/DENY writes .pipeline/gates/&lt;run&gt;.answer. Stage 2 wires the live gate stdin.</div>
<script>${CLIENT}</script>
</body>
</html>`;
