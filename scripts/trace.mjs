// scripts/trace.mjs - the pipeline black box: append-only per-run trace.
// Layout: .pipeline/runs/<run-id>/
//   trace.jsonl            append-only JSON event lines
//   prompts/<role>.md      exact prompt sent on each hop
//   artifacts/             input/output files of each hop
// Usage:
//   node scripts/trace.mjs show [run-id]     show the latest (or given) run as a table
import { mkdirSync, appendFileSync, copyFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  try { appendFileSync(join(base(), id, 'trace.jsonl'), JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n'); } catch {}
};

export const promptSnap = (id, role, text) => {
  if (!id || !text) return;
  try {
    const d = join(base(), id, 'prompts');
    mkdirSync(d, { recursive: true });
    appendFileSync(join(d, role + '.md'), text + '\n');
  } catch {}
};

export const snap = (id, rel) => {
  if (!id || !rel || !existsSync(rel)) return;
  try {
    copyFileSync(rel, join(base(), id, 'artifacts', String(rel).replace(/[\\/]/g, '__')));
    if (existsSync(join('docs/plans', String(rel).split(/[\\/]/).pop())))
      copyFileSync(join('docs/plans', String(rel).split(/[\\/]/).pop()), join(base(), id, 'artifacts', String(rel).split(/[\\/]/).pop()));
  } catch {}
};

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
        } catch {}
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
      console.log(`  HOP ${r.role}  ${r.model || ''} -> exit ${r.exit}  ${Math.round((r.duration_ms || 0) / 1000)}s  ${r.artifact || '-'}${r.note ? '  (' + r.note + ')' : ''}`);
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
