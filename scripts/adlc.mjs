// scripts/adlc.mjs — 2.5 AUTO-ADLC (queue #2, built 25.11, round-7 A-fixes):
// the trace → issues loop, ported locally (LangSmith pattern, zero deps,
// no models). Reads every `.pipeline/runs/*/trace.jsonl`, then:
//   1. CLUSTER   — hop failures grouped by signature (role|exit+note/tail)
//   2. KNOWLEDGE — knowledge_gap events, surfaced FIRST (board 21.11;
//                  written by run-agent from a hop's "KNOWLEDGE GAP:" lines)
//   3. CLOSED    — a failure class that a LATER run exercised on the SAME
//                  role and PASSED → auto-exhibit candidate (never auto-written)
//   4. REGRESSION— the same class was ok in an older run and is failing again
// One artifact: .pipeline/adlc-issues.md (--json for machines). Read-only;
// the loop closes the way every loop here does: issues become task-card hints.
// Usage: node scripts/adlc.mjs [--json]

import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// round-10 §10: env load moved INSIDE the isMain gate — importing adlc.mjs
// does not touch the importer's process.env (zero side effects, verbatim).
const argv1 = String(process.argv[1] || "").replace(/\\/g, "/");
const isMain = argv1.endsWith("adlc.mjs");

// round-9 §2: lazy base — after env load, honors .env; no import side effects either way.
const runsBase = () => join(process.env.PIPELINE_TRACE_BASE || process.cwd(), ".pipeline", "runs");
const isJSON = process.argv.includes("--json");

function signature(e) {
  // round-7 A1: read ONLY fields the events actually carry.
  // hop_end:      {role, exit, note('kill-switch'|'timeout'), artifact}
  // hop_api_error:{role, status}
  const role = e.role || "?";
  const exit = e.exit ?? e.status ?? "?";
  const tag = e.note ? `|${e.note}` : e.status ? `|api` : ``;
  return `${role}|exit=${exit}${tag}`;
}

function analyze() {
  const clusters = new Map(); // sig -> {runs:Set, last, sample}
  const timeline = []; // {rid, name, date, ok, roles:Set, failSigs:[sig]}
  const gaps = [];
  const runs = existsSync(runsBase()) ? readdirSync(runsBase()).filter((d) => d.includes("__")).sort() : [];
  for (const rid of runs) {
    const p = join(runsBase(), rid, "trace.jsonl");
    if (!existsSync(p)) continue;
    const events = [];
    for (const l of readFileSync(p, "utf8").split("\n").map((x) => x.trim())) {
      if (!l) continue;
      try {
        const o = JSON.parse(l);
        if (o && typeof o === "object") events.push(o);
      } catch { /* line-tolerant, like the doctor (D9) */ }
    }
    // round-7 A5: name = everything AFTER the FIRST '__' (task names may
    // contain '_', trace tags can't — the separator is exactly '__').
    const sep = rid.indexOf("__");
    const name = sep >= 0 ? rid.slice(sep + 2) : rid;
    const date = rid.slice(0, 13); // '2026-11-25T09' — the hour
    const hopEnds = events.filter((e) => e.event === "hop_end");
    const failSigs = new Set();
    const roles = new Set(hopEnds.map((h) => h.role).filter(Boolean));
    for (const e of hopEnds.filter((h) => typeof h.exit === "number" && h.exit !== 0)) {
      const sig = signature(e);
      failSigs.add(sig);
      if (!clusters.has(sig)) clusters.set(sig, { runs: new Set(), last: rid, sample: e });
      const c = clusters.get(sig);
      c.runs.add(rid);
      c.last = rid;
    }
    for (const e of events.filter((u) => u.event === "hop_api_error")) {
      const sig = signature(e);
      if (!clusters.has(sig)) clusters.set(sig, { runs: new Set(), last: rid, sample: e });
      const c = clusters.get(sig);
      c.runs.add(rid);
      c.last = rid;
      failSigs.add(sig);
    }
    for (const g of events.filter((e) => e.event === "knowledge_gap"))
      gaps.push({ run: name, role: g.role || "?", what: g.what || "?", date });
    timeline.push({ rid, name, date, ok: events.some((e) => e.event === "circle_end" && e.verdict === "PASS"), roles, failSigs: [...failSigs] });
  }
  return { clusters, timeline, gaps };
}

function build() {
  const { clusters, timeline, gaps } = analyze();
  const idx = new Map(timeline.map((t, i) => [t.rid, i]));

  // round-7 A3: closed = a LATER run that (a) exercised the SAME ROLE and (b)
  // ended ok with the signature absent. "The last run didn't run that role"
  // is NOT "fixed" anymore. The role-exercise predicate is the noise filter:
  // a one-off failure that its own role later passed is still a candidate.
  const closed = [];
  for (const [sig, c] of clusters) {
    const lastIdx = idx.get(c.last) ?? -1;
    const role = (sig.split("|")[0] || "?");
    for (let i = lastIdx + 1; i < timeline.length; i++) {
      const t = timeline[i];
      if (t.roles.has(role) && t.ok && !t.failSigs.includes(sig)) {
        closed.push({ sig, runCount: c.runs.size, last: c.last, validatedBy: t.date, sample: c.sample });
        break;
      }
    }
  }

  // regressions: a run BEFORE the class's last failing run was ok — whatever
  // the gap size (the strict 3-run window from round-7 A4 is superseded).
  const regressions = [];
  for (const [sig, c] of clusters) {
    const runIdx = idx.get(c.last) ?? -1;
    if (runIdx <= 0) continue;
    if (timeline.slice(0, runIdx).some((t) => t.ok && !t.failSigs.includes(sig)))
      regressions.push({ sig, runCount: c.runs.size, sample: c.sample });
  }

  let md = `# ADLC issues\n\n${new Date().toISOString()} · 2.5 auto-adlc (trace → issues, read-only, no models)\n`;
  md += `\nScanned ${timeline.length} run(s) · clusters ${clusters.size} · knowledge gaps ${gaps.length}\n\n`;

  if (gaps.length) {
    md += `## Knowledge gaps (doctor/ADLC read these FIRST — board 21.11)\n\n`;
    for (const g of gaps) md += `- ${g.date} · **${g.role}** → ${g.what} (run ${g.run})\n`;
    md += `\n`;
  }
  if (clusters.size) {
    md += `## Failure clusters (by signature)\n\n`;
    const sorted = [...clusters.entries()].sort((a, b) => b[1].runs.size - a[1].runs.size);
    for (const [sig, c] of sorted)
      md += `- ×${c.runs.size} in runs \`${[...c.runs].slice(0, 3)}${c.runs.size > 3 ? ` …+${c.runs.size - 3} earlier` : ""}\` — \`${sig}\`\n`;
    md += `\n`;
  }
  if (regressions.length) {
    md += `## Regressions (was green, broke again)\n\n`;
    for (const r of regressions) md += `- \`${r.sig}\` (×${r.runCount})\n`;
    md += `\n`;
  }
  if (closed.length) {
    md += `## Closed failures — auto-exhibit candidates\n\n`;
    md += `These failure classes were re-exercised on the same role by a LATER run that passed — each earns an ST-xx exhibit (write the exhibit, then the class can never return silently):\n\n`;
    for (const c of closed)
      md += `- \`ST-suggest · ${c.sig}\` (×${c.runCount} runs, ok-verified ${c.validatedBy})\n`;
    md += `\n`;
  }
  if (!clusters.size && !gaps.length) md += "No failures and no knowledge gaps on record. Nothing to learn from yet — the best kind of data.\n";
  return { md, clusters, timeline, gaps, closed, regressions };
}

let R = null;
if (isMain) {
  await import("./env.mjs").then((m) => m.loadEnv()); // env load INSIDE the gate (round-10 §10)
  R = build();
}
if (R) {
  mkdirSync(join(runsBase(), ".."), { recursive: true });
  writeFileSync(join(runsBase(), "..", "adlc-issues.md"), R.md);
  // round-8 R7-4: NO process.exit on the import path - an import returns
  // control like budget.mjs (the D6/A6 letter AND substance).
  if (isJSON) console.log(JSON.stringify({
    runs: R.timeline.length,
    clusters: [...R.clusters.keys()],
    gaps: R.gaps,
    closed: R.closed.map((c) => c.sig),
    regressions: R.regressions.map((r) => r.sig),
  }, null, 2));
  else {
    console.log(`adlc · ${R.timeline.length} runs · ${R.clusters.size} cluster(s) · ${R.gaps.length} knowledge gap(s) · ${R.closed.length} closed class(es)${R.regressions.length ? ` · ${R.regressions.length} REGRESSION(S)` : ""}`);
    if (!R.clusters.size && !R.gaps.length) console.log("  nothing to learn from yet - the factory is quiet");
    console.log(`full report: .pipeline/adlc-issues.md`);
  }
}
// round-8 R7-4: no exit at all on the import path - control returns like budget.mjs.
if (isMain) process.exit(0);
