// scripts/trace.mjs - the pipeline black box: append-only per-run trace.
// Layout: .pipeline/runs/<run-id>/
//   trace.jsonl            append-only JSON event lines
//   prompts/<role>.md      exact prompt sent on each hop
//   artifacts/             input/output files of each hop
// Usage:
//   node scripts/trace.mjs show [run-id]     show the latest (or given) run as a table
import { mkdirSync, appendFileSync, copyFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getProfile } from './profile.mjs';

const base = () => join(process.env.PIPELINE_TRACE_BASE || process.cwd(), '.pipeline', 'runs');

export function newRun(tag = '') {
  const d = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const id = (d + (tag ? '__' + tag : '')).replace(/[^A-Za-z0-9_-]/g, '_');
  const dir = join(base(), id);
  mkdirSync(join(dir, 'prompts'), { recursive: true });
  mkdirSync(join(dir, 'artifacts'), { recursive: true });
  ev(id, { event: 'run_start' });
  return id;
}

export const ev = (id, obj) => {
  try { appendFileSync(join(base(), id, 'trace.jsonl'), JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n'); } catch (e) { console.error('[trace] event write failed: ' + (e && e.message || e)); }
};

export const promptSnap = (id, role, text) => {
  if (!id || !text) return;
  try {
    const d = join(base(), id, 'prompts');
    mkdirSync(d, { recursive: true });
    appendFileSync(join(d, role + '.md'), text + '\n');
  } catch (e) { console.error('[trace] event write failed: ' + (e && e.message || e)); }
};

export const snap = (id, rel) => {
  if (!id || !rel || !existsSync(rel)) return;
  try {
    copyFileSync(rel, join(base(), id, 'artifacts', String(rel).replace(/[\\/]/g, '__')));
    if (existsSync(join('docs/plans', String(rel).split(/[\\/]/).pop())))
      copyFileSync(join('docs/plans', String(rel).split(/[\\/]/).pop()), join(base(), id, 'artifacts', String(rel).split(/[\\/]/).pop()));
  } catch (e) { console.error('[trace] event write failed: ' + (e && e.message || e)); }
};


// ---- v3 forensics: per-hop stdout tail + report digest --------------------
// hopTail: keep the last N lines of the hop's own .pipeline-last-run.log
// inside the run dir, so "why did this hop die" needs no re-run.
export const hopTail = (id, role, logPath, n = 40) => {
  if (!id) return;
  try {
    if (!existsSync(logPath)) return;
    const lines = readFileSync(logPath, 'utf8').split('\n');
    const tail = lines.slice(-n).join('\n');
    if (!tail.trim()) return;
    const d = join(base(), id, 'logs');
    mkdirSync(d, { recursive: true });
    appendFileSync(join(d, role + '-tail.log'), tail + '\n');
    ev(id, { event: 'hop_tail_saved', role, lines: Math.min(lines.length, n) });
  } catch (e) { console.error('[trace] event write failed: ' + (e && e.message || e)); }
};

// passport-driven gate regex (1.2): gate lines are recognized by the
// project's OWN commands (from the passport), pnpm world by default.
const _P = getProfile(process.cwd(), { readFileSync, existsSync: (p) => { try { readFileSync(p); return true; } catch { return false; } }, join: (...a) => a.join('/') });
const _cmds = [_P.lint, _P.typecheck, _P.test, _P.build].filter((c) => c && c !== 'unknown').map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const GATE_RE = new RegExp('(' + _cmds.join('|') + ')|check-agents-md|vitest', 'i');
const BUG_RE = /(^|\n)#+\s*Bug\s+\d+[^\n]*/gi;
// reportDigest: parse the role's artifact for machine gate lines and Bug
// headers; store as structured events so "why did the run fail" is visible
// directly in `trace show`, without opening the report.
export const reportDigest = (id, role, rel) => {
  if (!id || !rel || !existsSync(rel)) return;
  const txt = readFileSync(rel, 'utf8');
  const gates = txt.split('\n').filter((l) => GATE_RE.test(l)).slice(0, 12);
  const bugs = [...new Set([...txt.matchAll(BUG_RE)].map((m) => m[0].replace(/^\n+/, "").slice(0, 90)))].slice(0, 10);
  if (!gates.length && !bugs.length) return;
  const d = join(base(), id, 'logs');
  mkdirSync(d, { recursive: true });
  appendFileSync(join(d, role + '-digest.log'), JSON.stringify({ gates, bugs }, null, 1) + '\n');
  ev(id, { event: 'report_digest', role, gates, bugs });
};


// ---- token/cost telemetry (v1) -------------------------------------------
// Path A: claude CLI --output-format json puts usage on stdout.
// Path B (fallback): every CLI run appends a transcript to
//   ~/.claude/projects/<escaped-cwd>/<session>.jsonl with usage per message.
// The projects dir is overridable (PIPELINE_CLAUDE_PROJECTS) for smokes.
// usage: parse newest transcript written after `sinceTs` and sum the
// assistant rows' usage {input_tokens, output_tokens, cache_read tokens}.
export function readLatestUsage(cwd, sinceMs) {
  try {
    const projDir = join(process.env.PIPELINE_CLAUDE_PROJECTS ||
      join(process.env.USERPROFILE || process.env.HOME || '', '.claude', 'projects'), '');
    // claude-code naming: EVERY separator becomes its own dash, case KEPT:
    // 'C:\WorkDev\app' -> 'C--WorkDev-app' (no collapsing of consecutive seps!)
    const esc = cwd.replace(/\\/g, '-').replace(/[:/]/g, '-').replace(/\s/g, '-');
    let dir = join(projDir, esc);
    if (!existsSync(dir)) {
      // case-insensitive fallback (Windows projects dirs keep original case)
      try {
        const hit = readdirSync(projDir).find((n) => n.toLowerCase() === esc.toLowerCase());
        if (!hit) return null;
        dir = join(projDir, hit);
      } catch { return null; }
    }
    let best = null, bestM = 0;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.jsonl')) continue;
      const p = join(dir, f);
      const m = statSync(p).mtimeMs;
      if (m > bestM) { bestM = m; best = p; }
    }
    if (!best || bestM < sinceMs) return null;
    let inTok = 0, outTok = 0, cacheRead = 0, msgs = 0;
    for (const line of readFileSync(best, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let row; try { row = JSON.parse(line); } catch { continue; }
      const u = row?.message?.usage;
      if (u) {
        msgs += 1;
        inTok += u.input_tokens || 0;
        outTok += u.output_tokens || 0;
        cacheRead += u.cache_read_input_tokens || 0;
      }
    }
    if (!msgs) return null;
    return { transcript: best, msgs, input_tokens: inTok, output_tokens: outTok, cache_read: cacheRead };
  } catch { return null; }
}

export function watch(intervalMs = 4000) {
  const b = base();
  const seen = new Set();
  const tick = () => {
    for (const id of runs()) {
      readFileSync(join(b, id, 'trace.jsonl'), 'utf8').split('\n').filter(Boolean).forEach((l, i) => {
        const key = id + ':' + i;
        if (seen.has(key)) return;
        seen.add(key);
        try {
          const r = JSON.parse(l);
          console.log('[' + id.slice(-14) + '] ' + r.event + (r.role ? ' ' + r.role : '') + (r.gate ? ' ' + r.gate + ': ' + (r.result ?? '') : '') + (r.duration_ms ? ' ' + Math.round(r.duration_ms / 1000) + 's' : '') + (r.cwd ? ' @ ' + r.cwd : ''));
        } catch (e) { console.error('[trace] artifact copy failed: ' + (e && e.message || e)); }
      });
    }
  };
  tick();
  setInterval(tick, intervalMs);
}

export function runs() {
  const b = base();
  return existsSync(b) ? readdirSync(b).sort().filter((d) => existsSync(join(b, d, 'trace.jsonl'))) : [];
}

export function show(idIn) {
  const ids = runs();
  const id = idIn && ids.includes(idIn) ? idIn : ids[ids.length - 1];
  if (!id) { console.log('no runs yet (.pipeline/runs is empty)'); return; }
  console.log(`RUN ${id}`);
  const rows = readFileSync(join(base(), id, 'trace.jsonl'), 'utf8').split('\n').filter(Boolean)
    .flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
  for (const r of rows) {
    const e = r.event;
    if (e === 'hop_end') {
      console.log(`  HOP ${r.role}  ${r.model || ''} -> exit ${r.exit}  ${Math.round((r.duration_ms || 0) / 1000)}s  ${r.artifact || '-'}${r.tools_used ? '  tools_used=' + r.tools_used.join(',') : ''}${r.note ? '  (' + r.note + ')' : ''}`);
    } else if (e === 'gate') {
      console.log(`  GATE ${r.gate}: ${r.result}`);
    } else if (e === 'verdict') {
      console.log(`  VERDICT ${r.result}${r.fix_rounds != null ? ' (fix rounds: ' + r.fix_rounds + ')' : ''}${r.total_s != null ? ', total ' + Math.round(r.total_s) + 's' : ''}`);
    } else if (e === 'fix_round') {
      console.log(`  FIX ROUND ${r.n} (class: ${r.cls})`);
    } else if (e === 'circle_start') {
      console.log(`  CIRCLE ${r.task}  sandbox=${r.sandbox ? 'work/' + r.name : 'main (--no-wt)'}`);
    } else if (e === 'circle_end') {
      console.log(`  CIRCLE END  ${r.result || ''}${r.total_s != null ? ', total ' + Math.round(r.total_s) + 's' : ''}`);
    } else if (e === 'usage_guard') {
      console.log(`  GUARD ${r.kind}: ${r.detail}`);
    }
  }
}

// CLI: node scripts/trace.mjs [show|watch] [run-id]
import { isMainThread, workerData } from 'node:worker_threads';
const thisFile = fileURLToPath(import.meta.url);
const invoked = process.argv[1] && process.argv[1].replace(/\\/g, '/').toLowerCase() === thisFile.replace(/\\/g, '/').toLowerCase();
if (invoked) {
  const cmd = process.argv[2] || 'show';
  if (cmd === 'watch') watch();
  else show(process.argv[3]);
}
