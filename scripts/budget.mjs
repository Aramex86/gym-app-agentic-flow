// scripts/budget.mjs — the money ledger & circuit breaker (ADR-0004).
// Zero deps. Aggregates per-run spend from .pipeline/runs/*/trace.jsonl
// (hop_usage events, month = event ts). Cap: PIPELINE_BUDGET_USD env —
// when UNSET the budget is UNLIMITED (law: cap is a choice, not a default);
// when SET it is a circuit breaker: spend >= cap -> the caller stops BEFORE
// spawning hops, with the budget sheet as the receipt.
//
// Usage:
//   node scripts/budget.mjs                      # sheet for current month
//   node scripts/budget.mjs --month 2026-11      # explicit month
//   node scripts/budget.mjs --json               # machine output
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const runsBase = () => join(process.env.PIPELINE_TRACE_BASE || process.cwd(), '.pipeline', 'runs');
const month = () => process.argv.includes('--month') ? process.argv[process.argv.indexOf('--month') + 1] : new Date().toISOString().slice(0, 7);
const capOf = () => { const v = parseFloat(process.env.PIPELINE_BUDGET_USD); return Number.isFinite(v) && v > 0 ? v : null; };

// trace lines may be multi-line garbage in places: parse only full objects
export const readEvents = (file) => {
  const out = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t.startsWith('{') || !t.endsWith('}')) continue;
    try { out.push(JSON.parse(t)); } catch {}
  }
  return out;
};

// Aggregate one month. Returns per-run rows + totals + verdicts.
export const sheet = (m = month()) => {
  const rows = [];
  try {
    for (const d of readdirSync(runsBase()).sort()) {
      const p = join(runsBase(), d, 'trace.jsonl');
      if (!existsSync(p)) continue;
      const evs = readEvents(p);
      if (!evs.length) continue;
      const inMonth = evs.filter((e) => String(e.ts || '').slice(0, 7) === m);
      if (!inMonth.length) continue;
      const circle = inMonth.find((e) => e.event === 'circle_start');
      const row = {
        rid: d, task: circle ? (circle.name || circle.task || '') : '(direct hops)',
        hops: 0, fails: 0, verdicts: [], inTok: 0, outTok: 0, usd: 0,
        premium: 0, costUnknown: false,
      };
      for (const e of inMonth) {
        if (e.event === 'hop_end') { row.hops++; if (e.exit !== 0) row.fails++; }
        if (e.event === 'hop_usage') { row.inTok += e.input_tokens || 0; row.outTok += e.output_tokens || 0; if (typeof e.cost_usd === 'number') row.usd += e.cost_usd; else row.costUnknown = true; }
        if (e.event === 'hop_rail2_cost') { row.premium += e.premium_requests || 0; }
        if (e.event === 'verdict') row.verdicts.push(e.result);
      }
      if (inMonth.some((e) => e.event === 'hop_end' || e.event === 'hop_usage' || e.event === 'hop_rail2_cost')) rows.push(row);
    }
  } catch (err) {
    return { runs: [], err: String(err && err.message || err) };
  }
  const totals = rows.reduce((a, r) => ({
    inTok: a.inTok + r.inTok, outTok: a.outTok + r.outTok,
    usd: a.usd + r.usd, premium: a.premium + r.premium,
    costUnknown: a.costUnknown || r.costUnknown, runs: a.runs + 1,
  }), { inTok: 0, outTok: 0, usd: 0, premium: 0, costUnknown: false, runs: 0 });
  return { runs: rows, totals, cap: capOf(), month: m };
};

// The circuit breaker. Call BEFORE spawning hops. Returns null (go) or an
// honest-stop message. A cap with incomplete cost telemetry = honest stop
// too (we cannot enforce what we cannot see).
export const guard = (m = month()) => {
  const cap = capOf();
  if (cap == null) return null; // unlimited by default — the cap is a choice
  const s = sheet(m);
  if (s.err) return `budget guard: ledger unreadable (${s.err}) - honest stop.`;
  if (s.totals.costUnknown)
    return 'budget guard: cost telemetry incomplete (hops with cost=n/a) - ' +
      `cannot enforce the $${cap} cap honestly. Set PIPELINE_OUT_FORMAT=json on rail #1, or unset the cap.`;
  if (s.totals.usd >= cap)
    return `budget circuit breaker: month-to-date $${s.totals.usd.toFixed(2)} >= cap $${cap} - ` +
      `honest stop. Receipt: node scripts/budget.mjs`;
  return null;
};

// CLI: print the sheet
const isMain = process.argv[1] && process.argv[1].endsWith('budget.mjs');
if (isMain) {
  const s = sheet();
  const cap = s.cap == null ? 'UNLIMITED (PIPELINE_BUDGET_USD unset)' : `$${s.cap}`;
  if (process.argv.includes('--json')) { console.log(JSON.stringify(s, null, 1)); process.exit(0); }
  console.log(`# Budget sheet — ${s.month} — cap: ${cap}\n`);
  for (const r of s.runs) {
    console.log(`${r.usd ? ('$' + r.usd.toFixed(2)) : (r.premium ? `premium×${r.premium}` : 'n/a')}  ${r.rid.slice(0, 18)}  “${r.task}”  hops ${r.hops}${r.fails ? ` ✗${r.fails}` : ''}  ${r.verdicts.join(',') || '-'}  in ${(r.inTok).toLocaleString('en-US')} / out ${(r.outTok).toLocaleString('en-US')}`);
  }
  console.log(`\nΣ ${s.totals.runs} runs · $${s.totals.usd.toFixed(2)} · premium ${s.totals.premium} · in ${(s.totals.inTok).toLocaleString('en-US')} / out ${(s.totals.outTok).toLocaleString('en-US')}${s.totals.costUnknown ? ' · ⚠ some hops report cost n/a' : ''}`);
  if (s.err) console.log(`(ledger error: ${s.err})`);
  console.log(`\n“what was done for the budget” = the rows above: each circle's task, verdict and its token bill.`);
  process.exit(0);
}
