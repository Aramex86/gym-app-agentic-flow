// scripts/tui.mjs - TUI V1 (phase 4 item 3). Laws: pure ANSI, zero npm-deps,
// no full-screen (history stays scrollable), verdict history stays own-line.
// Bottom-pinned bar: status line + budget footer, rewritten in place; the
// live tail of .pipeline-last-run.log streams above it and scrolls naturally.
// Usage:
//   node scripts/tui.mjs [--run <rid>] [--log <path>] [--interval ms] [--once]
//   node scripts/tui.mjs --selfcheck [--base <dir>]
// Non-TTY stdout (or --once): single plain frame, no ANSI control codes.
import { readFileSync, existsSync, readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { join } from 'node:path';

const A = process.argv.slice(2);
const argOf = (k, d) => { const i = A.indexOf(k); return i >= 0 && A[i + 1] ? A[i + 1] : d; };
const FLAG = (k) => A.includes(k);
const CWD = process.cwd();
const runsBase = () => join(process.env.PIPELINE_TRACE_BASE || CWD, '.pipeline', 'runs');
const LOG_PATH = argOf('--log', join(CWD, '.pipeline-last-run.log'));
const INTERVAL = Math.max(200, parseInt(argOf('--interval', '700'), 10) || 700);
const MONTH = new Date().toISOString().slice(0, 7);

const pickRun = () => {
  const want = argOf('--run', null);
  try {
    const dirs = readdirSync(runsBase())
      .filter((d) => existsSync(join(runsBase(), d, 'trace.jsonl'))).sort();
    if (want) { const d = dirs.find((x) => x.includes(want)); if (d) return d; return null; }
    return dirs[dirs.length - 1] || null;
  } catch { return null; }
};

// ---- trace -> state --------------------------------------------------------
const readTrace = (rid) => {
  try {
    return readFileSync(join(runsBase(), rid, 'trace.jsonl'), 'utf8').split('\n')
      .filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
};
const monthLedger = () => {
  let usd = 0, premium = 0;
  try {
    for (const d of readdirSync(runsBase()).sort()) {
      for (const e of readTrace(d)) {
        const m = String(e.ts || '').slice(0, 7);
        if (m !== MONTH) continue; // month of the EVENT ts, not the run id
        if (e.event === 'hop_usage' && typeof e.cost_usd === 'number') usd += e.cost_usd;
        if (e.event === 'hop_rail2_cost') premium += (e.premium_requests || 0);
      }
    }
  } catch {}
  return { usd, premium };
};
const stateOf = (rid) => {
  const evs = readTrace(rid);
  const s = { rid, task: '', phase: 'idle', hops: 0, fails: 0, verdicts: [] };
  for (const e of evs) {
    if (e.event === 'circle_start') { s.task = e.name || e.task || ''; s.phase = 'circle'; s.hops = 0; s.fails = 0; s.verdicts = []; }
    if (e.event === 'hop_start') s.phase = `hop ${e.role}`;
    if (e.event === 'hop_end') {
      s.hops++; if (e.exit !== 0) s.fails++;
      s.phase = e.exit === 0 ? `${e.role} done ✓` : `${e.role} FAIL(${e.exit})`;
    }
    if (e.event === 'gate') s.phase = `gate ${e.gate} → ${e.result}`;
    if (e.event === 'verdict') { s.phase = `verdict ${e.result}`; s.verdicts.push(e); }
    if (e.event === 'hop_failed') { s.fails++; s.phase = `hop ${e.role} failed`; }
    if (e.event === 'circle_end') s.phase = 'circle end';
  }
  return s;
};

// ---- log tail (incremental, offset-tracked) --------------------------------
// raw log lines pass through prettify: giant JSON blobs (claude-CLI result
// wall) are compressed to their facts, regular lines stay as-is. Honesty
// law kept: compressed lines carry "…" — the raw file is untouched.
const prettifyLine = (line) => {
  // provider-CLI noise (warnings the run already survived): suppressed from
  // VIEW, raw log untouched
  if (/^\[claude-code:/.test(line.trimStart())) return '';
  if (line.length <= 160 || !line.trimStart().startsWith('{')) return line;
  try {
    const j = JSON.parse(line);
    if (j.subtype === 'success' || j.type === 'result') {
      const dn = (j.permission_denials || []).length;
      const model = Object.keys(j.modelUsage || {})[0];
      const res = String(j.result || '').replace(/\s+/g, ' ').slice(0, 70);
      return `[hop-result] model ${model || '?'} · $${(j.total_cost_usd ?? 0).toFixed(2)} · turns ${j.num_turns ?? '?'} · denials ${dn}${dn ? ' ⚠' : ''} · ${res}…`;
    }
  } catch { /* not one-shot JSON — fall through */ }
  return line.slice(0, 240) + ' …';
};
const tailer = (p) => {
  let off = 0, seen = false;
  return () => {
    try {
      const st = statSync(p);
      if (!seen) {
        seen = true; off = st.size;
        const lines = readFileSync(p, 'utf8').split('\n').map(prettifyLine);
        return lines.slice(-5).filter(Boolean);
      }
      if (st.size < off) off = 0; // log truncated/restarted
      if (st.size === off) return [];
      const fd = openSync(p, 'r');
      const buf = Buffer.alloc(st.size - off);
      readSync(fd, buf, 0, buf.length, off); closeSync(fd);
      off = st.size;
      return buf.toString('utf8').split('\n').filter(Boolean).map(prettifyLine).filter(Boolean);
    } catch { return []; }
  };
};

// ---- render ----------------------------------------------------------------
const plain = () => !process.stdout.isTTY || FLAG('--once');
const fmt2 = (n) => (n < 0.005 ? '0.00' : n.toFixed(2));
const monthCap = () => { const v = parseFloat(process.env.PIPELINE_BUDGET_USD); return isFinite(v) && v > 0 ? v : null; };
const barLines = (s, led, logExists) => {
  const l1 = `⏵ ${s.rid ? s.rid.slice(0, 16) : 'no run yet'} · ${s.task ? `“${s.task}”` : '—'} · ${s.phase} · hop ${s.hops}${s.fails ? ` · ✗${s.fails}` : ''} · rail ${process.env.PIPELINE_CLI || 'claude'}`;
  const cap = monthCap();
  const l2 = cap == null
    ? `Σ month $${fmt2(led.usd)} · premium ${led.premium} · cap unset (PIPELINE_BUDGET_USD) · ${logExists ? 'log live' : 'no log'}`
    : `Σ month $${fmt2(led.usd)} / $${cap} · premium ${led.premium} · ${logExists ? 'log live' : 'no log (idle)'}`;
  return [l1, l2];
};

if (plain()) {
  const rid = pickRun();
  const s = stateOf(rid || 'none');
  if (!rid) { s.rid = null; s.phase = 'no run yet'; s.task = ''; }
  const led = monthLedger();
  const logExists = existsSync(LOG_PATH);
  for (const l of barLines(s, led, logExists)) console.log(l);
  for (const e of (s.verdicts || []).slice(-3)) console.log(`● verdict → ${e.result}`);
  if (logExists && FLAG('--once')) {
    const n = parseInt(argOf('--once', '10'), 10) || 10;
    for (const line of readFileSync(LOG_PATH, 'utf8').split('\n').filter(Boolean).map(prettifyLine).filter(Boolean).slice(-n)) console.log(line);
  }
  process.exit(0);
}

// selfcheck: asserts the bar speaks budget + status (exhibit ST-20)
if (FLAG('--selfcheck')) {
  process.env.PIPELINE_TRACE_BASE = argOf('--base', join(CWD, '.selfcheck-tui'));
  const rid = pickRun();
  const s = stateOf(rid || 'none');
  const led = monthLedger();
  const [l1, l2] = barLines(s, led, false);
  const ok = l2.includes('premium') &&
    typeof s.hops === 'number' && typeof led.usd === 'number' && l1.length > 10;
  console.log(ok ? 'selfcheck OK' : `selfcheck FAIL: ${l1} | ${l2}`);
  process.exit(ok ? 0 : 1);
}

// ---- live loop (TTY) -------------------------------------------------------
const W = process.stdout;
const eol = '\x1b[K';
const up = (n) => `\x1b[${n}A`;
const out = (str) => W.write(str + '\x1b[0m' + eol);
let barUp = false;
const tick = () => {
  const rid = pickRun();
  const s = rid ? stateOf(rid) : { rid: null, phase: 'no run yet', hops: 0, fails: 0, verdicts: [], task: '' };
  const led = monthLedger();
  const logExists = existsSync(LOG_PATH);
  if (!barUp) { W.write('── factory tui v1 · Ctrl+C · full-screen: never ──\n'); barUp = true; }
  else W.write(up(2)); // land on the bar's top line (bar = last 2 lines)
  // verdict history: own lines, appended as events arrive (history law)
  if ((tick._v || 0) < s.verdicts.length) {
    const fresh = s.verdicts.slice(tick._v || 0);
    W.write(up(2)); // verdict lines must land above the bar
    for (const e of fresh) out(`● verdict → ${e.result}\n`);
    tick._v = s.verdicts.length;
  }
  // stream new log lines above the bar
  if (!tick._t) tick._t = tailer(LOG_PATH);
  const fresh = tick._t().slice(-200);
  if (fresh.length) {
    W.write(up(2));
    for (const line of fresh) out(line.slice(0, 2000) + '\n');
  }
  // redraw the 2-line bar in place
  const [l1, l2] = barLines(s, led, logExists);
  out(l1.slice(0, 400) + '\n' + l2.slice(0, 400));
};
console.log('factory tui v1 · Ctrl+C exit · history stays scrollable · full-screen: never');
tick();
const iv = setInterval(tick, INTERVAL);
const bye = () => { clearInterval(iv); W.write('\x1b[0m'); };
process.on('SIGINT', () => { bye(); console.log(''); process.exit(0); });
