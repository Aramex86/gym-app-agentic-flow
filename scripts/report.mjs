// scripts/report.mjs - HTML report of a pipeline run (from trace.jsonl + scoreboard)
// Usage: node scripts/report.mjs [run-id]     -> .pipeline/reports/<id>.html + open hint
// Zero deps, zero model calls: pure local rendering of the black-box log.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';

const base = () => join(process.env.PIPELINE_TRACE_BASE || process.cwd(), '.pipeline', 'runs');
const argId = process.argv[2] || null;
let id = null, dir = null;
if (argId) { dir = join(base(), argId); id = existsSync(dir) ? argId : null; }
else {
  const all = existsSync(base()) ? readdirSync(base()).filter((n) => existsSync(join(base(), n, 'trace.jsonl'))).sort() : [];
  id = all.at(-1); dir = id ? join(base(), id) : null;
}
if (!dir) { console.error('no runs found under ' + base()); process.exit(1); }
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const events = readFileSync(join(dir, 'trace.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const meta = events.find((e) => e.event === 'circle_start') || events[0];
const hops = {}; let verdict = null, fixRounds = 0;
const usage = [];
for (const e of events) {
  if (e.event === 'hop_start') { hops[e.role] = hops[e.role] || {}; for (const k of ['model','cwd','branch','ts','start']) if (e[k]) hops[e.role][k] = e[k]; }
  if (e.event === 'hop_end') { hops[e.role] = hops[e.role] || {}; for (const k of ['exit','duration_ms','artifact','note']) if (e[k] !== undefined) hops[e.role][k] = e[k]; }
  if (e.event === 'verdict') verdict = e;
  if (e.event === 'fix_round') fixRounds = e.n;
  if (e.event === 'hop_usage') usage.push(e);
}
const usageRows = usage.length ? '<tr><th>role</th><th>model</th><th>in</th><th>out</th><th>cached</th><th>api msgs</th><th>cost</th><th>source</th></tr>' + usage.map((u) =>
  `<tr><td>${esc(u.role)}</td><td>${esc(u.model)}</td><td>${(u.input_tokens).toLocaleString('en-US')}</td><td>${(u.output_tokens).toLocaleString('en-US')}</td><td>${(u.cache_read || 0).toLocaleString('en-US')}</td><td>${u.msgs ?? ''}</td><td>${u.cost_usd != null ? '$' + u.cost_usd.toFixed(4) : 'n/a'}</td><td>${esc(u.source)}</td></tr>`).join('') : '<tr><td colspan="8">no usage telemetry (PIPELINE_OUT_FORMAT=json not set for this run)</td></tr>';

const logDir = join(dir, 'logs');
const logs = existsSync(logDir) ? readdirSync(logDir).map((f) => {
  const txt = readFileSync(join(logDir, f), 'utf8');
  let digest = null;
  if (f.endsWith('-digest.log')) { try { digest = JSON.parse(txt); } catch (e) { console.error('[report] digest parse skipped: ' + (e && e.message || e)); } }
  return { f, txt, digest };
}) : [];

const digestHtml = logs.filter((l) => l.digest).map((l) => `
  <h3>digest: ${esc(l.f.replace('-digest.log', ''))}</h3>
  <ul class="list">${(l.digest.gates || []).map((g) => `<li>${esc(String(g).replace(/^- [ -]*/, '').replace(/`/g, '').trim())}</li>`).join('')}</ul>
  ${(l.digest.bugs || []).length ? '<ol class="bugs">' + l.digest.bugs.map((b) => `<li>${esc(String(b).replace(/^#+[ ]*/i, ''))}</li>`).join('') + '</ol>' : '<p class="ok">no bugs in digest</p>'}`).join('');

const tailHtml = logs.filter((l) => !l.digest).map((l) => `
  <details><summary>stdout tail: ${esc(l.f.replace('-tail.log', ''))}</summary>
  <pre class="tail">${esc(l.txt.trimEnd())}</pre></details>`).join('');


const commitHtml = (() => {
  const cFiles = existsSync(join(dir, 'artifacts')) ? readdirSync(join(dir, 'artifacts')).filter((f) => f.endsWith('-commit.md')) : [];
  if (!cFiles.length) return '';
  const txt = readFileSync(join(dir, 'artifacts', cFiles[0]), 'utf8');
  const msg = txt.match(/^COMMIT MESSAGE:\s*(.+)$/m)?.[1]?.trim();
  const pr = txt.match(/^PR TITLE:\s*(.+)$/m)?.[1]?.trim();
  const add = (txt.match(/^ADD LIST:\n([\s\S]*?)\nPR TITLE:/m)?.[1] || '').split('\n').map((l) => l.trim().replace(/^- /, '')).filter(Boolean);
  const body = (txt.match(/^PR BODY:\n([\s\S]*)$/m)?.[1] || '').trim();
  const bodyHtml = body.split('\n').filter((l) => l.trim()).map((line) =>
    /^[-*] /.test(line) ? `<li>${esc(line.replace(/^[-*] /, ''))}</li>`
    : /^\d+\. /.test(line) ? `<li>${esc(line.replace(/^\d+\. /, ''))}</li>`
    : `<p>${esc(line)}</p>`).join('');
  return `<h2>Commit proposal</h2><p class="meta"><span class="verdict ok">${esc(msg || '')}</span></p>
  <ul class="list">${add.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
  <p class="meta">PR title: ${esc(pr || msg || '')}</p><div>${bodyHtml}</div>`;
})();

const artifactNames = existsSync(join(dir, 'artifacts')) ? readdirSync(join(dir, 'artifacts')) : [];
const promptNames = existsSync(join(dir, 'prompts')) ? readdirSync(join(dir, 'prompts')) : [];

let scoreHtml = '';
const sb = join(process.env.PIPELINE_TRACE_BASE || process.cwd(), 'evals', 'results', 'scoreboard.jsonl');
if (existsSync(sb)) {
  const rows2 = readFileSync(sb, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  scoreHtml = `<h2>Scoreboard (all runs)</h2><table><tr><th>date</th><th>task</th><th>verdict</th><th>files</th><th>scope</th><th>fix</th><th>sec</th><th>tokens</th><th>cost</th></tr>` +
    rows2.map((r) => `<tr class="${r.verdict === 'PASS' ? 'ok' : 'bad'}"><td>${esc(r.date)}</td><td>${esc(r.task)}</td><td>${r.verdict}</td><td>${r.files_ok ? 'ok' : 'X'}</td><td>${r.scope_ok === undefined ? '-' : (r.scope_ok ? 'ok' : 'X')}</td><td>${r.fix_rounds ?? 0}</td><td>${r.seconds ?? ''}</td><td>${r.tokens ? (r.tokens.input.toLocaleString('en-US') + '/' + r.tokens.output.toLocaleString('en-US')) : '-'}</td><td>${r.cost_usd != null ? '$' + r.cost_usd : '-'}</td></tr>`).join('') + '</table>';
}

const hopRows = Object.entries(hops).map(([role, h]) => `<tr><td>${esc(role)}</td><td>${esc(h.model || '')}</td><td>${h.start ? esc(h.start.slice(11, 19)) : ''}</td><td>${h.ms ? (h.ms / 1000).toFixed(1) + 's' : ''}</td><td>${esc(h.note || '')}</td><td>${esc(h.artifact || '')}</td><td>${h.cwd ? esc(h.cwd.includes('work') ? 'SANDBOX' : 'main') : ''}</td></tr>`).join('');

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Run ${esc(id)}</title>
<style>
details{margin:8px 0}details summary{cursor:pointer;color:var(--dim);padding:4px 0}details[open] summary{color:var(--acc)}
 :root{--bg:#0d1220;--fg:#dcdff5;--dim:#8a92b2;--card:#141a2e;--edge:#27304d;--ok:#34d399;--bad:#f87171;--acc:#7aa2ff}
 *{box-sizing:border-box}body{margin:0;padding:24px;font:14px/1.55 ui-sans-serif,system-ui;background:var(--bg);color:var(--fg)}
 h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:26px 0 8px;color:var(--acc)}h3{font-size:13px;margin:16px 0 4px;color:var(--dim)}
 .meta{color:var(--dim);margin-bottom:16px}.verdict{display:inline-block;padding:2px 10px;border-radius:8px;font-weight:600}
 .verdict.ok{background:#0c2e22;color:var(--ok)}.verdict.bad{background:#2e0c0c;color:var(--bad)}
 table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid var(--edge);padding:6px 9px;text-align:left}
 th{background:var(--card);color:var(--dim);font-weight:600}tr.ok td{color:var(--ok)}tr.bad td{color:var(--bad)}
 pre{background:var(--card);border:1px solid var(--edge);border-radius:8px;padding:12px;overflow:auto;font-size:12px;color:#aab3d6}
 .chiprow{margin:6px 0}.chip{display:inline-block;background:var(--card);border:1px solid var(--edge);border-radius:6px;padding:2px 8px;margin:2px;font-size:12px}
 .bugs li{color:var(--bad)}.ok{color:var(--ok)}p.ok{margin:6px 0}
 .cards{display:flex;gap:12px;flex-wrap:wrap;margin:14px 0}.card{background:var(--card);border:1px solid var(--edge);border-radius:10px;padding:10px 14px;min-width:150px}
 .card b{display:block;font-size:18px}.card span{color:var(--dim);font-size:12px}
</style></head><body>
<h1>Run report: ${esc(id)}</h1>
<p class="meta">${meta?.task ? 'task: ' + esc(meta.task) + ' · ' : ''}${meta?.name ? 'name: ' + esc(meta.name) + ' · ' : ''}${meta?.ts ? esc(meta.ts) : ''}</p>
<p>Verdict: <span class="verdict ${verdict?.result === 'PASS' ? 'ok' : 'bad'}">${esc(verdict?.result || 'n/a')}</span>
 ${verdict?.total_s ? ` · total ${verdict.total_s.toFixed(0)}s` : ''} · fix rounds ${verdict?.fix_rounds ?? fixRounds}</p>
<div class="cards">
 <div class="card"><b>${verdict?.total_s ? (verdict.total_s / 60 < 1 ? Math.round(verdict.total_s) + 's' : Math.round(verdict.total_s / 60 * 10) / 10 + 'm') : '-'}</b><span>total time</span></div>
 <div class="card"><b>${usage.reduce((a, u) => a + (u.input_tokens || 0), 0).toLocaleString('en-US')}</b><span>tokens in</span></div>
 <div class="card"><b>${usage.reduce((a, u) => a + (u.output_tokens || 0), 0).toLocaleString('en-US')}</b><span>tokens out</span></div>
 <div class="card"><b>${usage.some((u) => u.cost_usd != null) ? '$' + usage.reduce((a, u) => a + (u.cost_usd || 0), 0).toFixed(4) : 'n/a'}</b><span>cost</span></div>
</div>
<h2>Hops</h2><table><tr><th>role</th><th>model</th><th>start</th><th>dur</th><th>note</th><th>artifact</th><th>where</th></tr>${hopRows}</table>
<h2>Token usage</h2><table>${usageRows}</table>
${digestHtml}${tailHtml}
<details><summary>Artifacts & prompts in run dir</summary><div class="chiprow">${promptNames.map((p) => `<span class="chip">prompt: ${esc(p)}</span>`).join('')} ${artifactNames.map((p) => `<span class="chip">artifact: ${esc(p)}</span>`).join('')}</div></details>
${scoreHtml}
<p class="meta">generated locally from .pipeline/runs - zero model tokens spent on this report</p>
</body></html>`;

const outDir = join(process.env.PIPELINE_TRACE_BASE || process.cwd(), '.pipeline', 'reports');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, id + '.html');
writeFileSync(out, html);
console.log('report written: ' + out);
