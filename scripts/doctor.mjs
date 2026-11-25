// scripts/doctor.mjs — AGENT ROLE №6 offboard (board 20.11, built 25.11,
// round-6 hardening 25.11): read-only diagnosis of the FACTORY itself from
// .pipeline/runs/*/trace.jsonl. ONE artifact: .pipeline/diagnosis-report.md.
// Repairs are NEVER done here — a finding becomes a task-card hint, repaired
// by a normal circle. Zero deps, no models.
// Usage: node scripts/doctor.mjs [--json] [--fail-on-error]
//   exit contract: 0 = no error-severity findings; 1 = at least one error
//   (so CI CAN gate on the doctor when asked to).

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
// round-9 §2: LAZY base — reads .env-load time env (budget/trace pattern), not the eager module-top const.
const runsBase = () => join(process.env.PIPELINE_TRACE_BASE || ROOT, ".pipeline", "runs");


// round-6 D10: CLI only — an accidental import must not run the diagnosis.
const argv1 = String(process.argv[1] || "").replace(/\\/g, "/");
const isMain = argv1.endsWith("doctor.mjs");

// round-7 D10: the whole diagnosis is behind the isMain gate (budget pattern):
// importing doctor.mjs has ZERO side effects - no reads, no writes, no exit.
const main = () => {
const runs = existsSync(runsBase()) ? readdirSync(runsBase()).filter((d) => d.includes("__")) : [];

const findings = [];
const F = (sev, title, detail) => findings.push({ sev, title, detail });
// severity taxonomy (round-6 D3): error = the circle/deliverable broke
// (exit 1/2 = deliverable or machine-gate failure, 124 = timeout); warn =
// hygiene, cost blindness, human kill (130); info = decisions and pointers.
const SEV = (exit) => (exit === 1 || exit === 2 || exit === 124 ? "error" : "warn");

for (const rid of runs) {
  const p = join(runsBase(), rid, "trace.jsonl");
  if (!existsSync(p)) continue;
  // round-6 D9: line-tolerant parse (like budget.mjs readEvents) — a trace
  // truncated by a crash mid-append must NOT hide the whole run.
  const events = [];
  let badLines = 0;
  for (const l of readFileSync(p, "utf8").split("\n").map((x) => x.trim())) {
    if (!l) continue;
    try {
      const o = JSON.parse(l);
      if (o && typeof o === "object") events.push(o);
      else badLines++;
    } catch { badLines++; }
  }
  if (badLines) F("warn", "corrupted trace lines (crash-truncated run?)", `${rid}: ${badLines} unparseable line(s) — the run is diagnosed from the readable rest`);
  if (!events.length) continue;

  // round-6 D2: hop_end(exit≠0) is THE failure source; hop_failed is a
  // duplicate event of the same failure — dedupe on role+exit.
  const hopEnds = events.filter((e) => e.event === "hop_end");
  const seen = new Set();
  for (const e of hopEnds.filter((h) => typeof h.exit === "number" && h.exit !== 0)) {
    const key = `${e.role}|${e.exit}`;
    if (seen.has(key)) continue;
    seen.add(key);
    F(SEV(e.exit), "hop failure",
      `${rid} · role=${e.role || "?"} model=${e.model || "?"} exit=${e.exit}${e.duration_ms ? ` ${Math.round(e.duration_ms / 1000)}s` : ""}`);
  }

  // gates: N decisions mean the human stopped the circle there — log, not blame
  const nGates = events.filter((e) => e.event === "gate" && e.result === "N");
  if (nGates.length) F("info", "human stopped at the gate", `${rid} · ${nGates.map((g) => g.gate).join(", ")}`);

  // verdict honesty
  const demoted = events.filter((e) => e.event === "verdict" && e.reason === "verdict_verification_failed");
  if (demoted.length) F("error", "verdict contradicted by the machine", `${rid} · gate=${demoted[0].gate || "?"} — fix loop required`);
  const skips = events.filter((e) => e.event === "verdict_verification_skipped");
  if (skips.length && !skips.some((s) => (s.reason || "").includes("no known gates")))
    F("warn", "verification skipped (opt-out)", `${rid} · ${skips[0].reason || "PIPELINE_VERIFY_GATES=0"}`);

  // round-7 D4: cost-blind PER HOP — but rail #2 tracks cost in premium
  // requests via a companion hop_rail2_cost event; check for it before
  // blaming the telemetry path (the round-6 per-hop fix over-flagged).
  const rail2Costs = new Set(events.filter((e) => e.event === "hop_rail2_cost" && typeof e.premium_requests === "number").map((e) => e.role)); // round-8 R7-7: only a NUMERIC companion proves tracking (a null premium_requests is genuinely blind)
  for (const e of events.filter((u) => u.event === "hop_usage" && (u.input_tokens || 0) > 0 && typeof u.cost_usd !== "number" && !rail2Costs.has(u.role)))
    F("warn", "cost-blind hop (ledger shows n/a)", `${rid} · role=${e.role || "?"} in=${e.input_tokens} out=${e.output_tokens} — telemetry path broken?`);

  // round-6 D5: heterogeneous roles have heterogeneous durations — compare
  // each hop to the median of ITS OWN ROLE (planner is fast, developer is not).
  for (const role of [...new Set(hopEnds.map((h) => h.role).filter(Boolean))]) {
    const durs = hopEnds.filter((h) => h.role === role && h.duration_ms > 0).map((h) => h.duration_ms).sort((a, b) => a - b);
    if (durs.length < 2) continue;
    const median = durs[Math.floor(durs.length / 2)];
    for (const h of hopEnds.filter((x) => x.role === role && x.duration_ms > 0))
      if (median > 0 && h.duration_ms > median * 5 && h.duration_ms > 120_000)
        F("info", "time outlier hop", `${rid} · ${role}: ${Math.round(h.duration_ms / 1000)}s vs ${Math.round(median / 1000)}s median (same role) — check PIPELINE_MAX_TURNS/timeout`);
  }
}

// stale sandboxes (round-6 D6): real staleness = the feat/<name> branch is
// already MERGED into develop/main — then the sandbox is pure trash. An
// unmerged branch is a live circle: info, never warn. Never deletes here.
const workDir = join(ROOT, "work");
if (existsSync(workDir)) {
  for (const box of readdirSync(workDir).filter((d) => !d.startsWith("."))) {
    const br = `feat/${box}`;
    let merged = false;
    let missing = false; // round-8 D6: locale-safe + ref-aware
    for (const base of ["develop", "main"]) {
      const g = spawnSync("git", ["merge-base", "--is-ancestor", br, base], { cwd: ROOT, stdio: "pipe", env: { ...process.env, LC_ALL: "C", LANG: "C" } });
      if (g.status === 0) { merged = true; break; }
      if (g.status === 128) {
        // exit 128 = SOME ref is missing; confirm it is the FEAT branch, not the base
        const brCheck = spawnSync("git", ["rev-parse", "--verify", "--quiet", br], { cwd: ROOT, stdio: "pipe" });
        if (brCheck.status !== 0) { missing = true; break; } // feat branch gone -> merged-deleted trash
      }
    }
    if (merged || missing)
      F("warn", "merged sandbox left in work/", `${box} — branch ${br} ${missing ? "no longer exists (merged-then-deleted / squash-merged)" : "is already merged"}; clean with: node scripts/flow.mjs --cleanup ${box}`);
    else
      F("info", "sandbox with an UNMERGED branch", `${box} — ${br} is not merged: a circle in flight or an abandoned one. Inspect before any cleanup.`);
  }
}

// engine drift: visible or loud — never silent (round-6 D1: ESM-safe spawn,
// and a failure to execute is itself a finding). Only in INSTALLED repos:
// the check expects a project passport; the engine repo itself has none
// (running it bare would blame the contract for missing project files).
if (
  existsSync(join(ROOT, "AGENTS.md")) &&
  existsSync(join(ROOT, "scripts", "check-agents-md.mjs")) &&
  existsSync(join(ROOT, "docs", "factory-profile.md"))
) {
  const r = spawnSync(process.execPath, ["scripts/check-agents-md.mjs"], { cwd: ROOT, stdio: "pipe", timeout: 120_000, shell: false });
  if (r.error) F("warn", "drift-check could not be executed", String(r.error));
  else if ((r.status ?? 1) !== 0) F("warn", "AGENTS.md drift suspected", "run: node scripts/check-agents-md.mjs (non-zero exit)");
} else if (existsSync(join(ROOT, "AGENTS.md")) && existsSync(join(ROOT, "scripts", "check-agents-md.mjs"))) {
  F("info", "drift-check skipped: no docs/factory-profile.md", "project runs on pnpm-defaults; the drift-check only runs in installed factories");
}

// ---------- report ----------
const sevOrder = { error: 0, warn: 1, info: 2 };
findings.sort((a, b) => sevOrder[a.sev] - sevOrder[b.sev]);
const errs = findings.filter((f) => f.sev === "error").length;
const warns = findings.filter((f) => f.sev === "warn").length;
const inf = findings.filter((f) => f.sev === "info").length;

mkdirSync(join(runsBase(), ".."), { recursive: true });
writeFileSync(join(runsBase(), "..", "diagnosis-report.md"),
  `# Diagnosis report\n\n${new Date().toISOString()} · factory doctor (read-only, no models)\n\n` +
  `Scanned ${runs.length} run(s) · findings ${findings.length} (errors ${errs}, warnings ${warns}, info ${inf})\n\n` +
  (findings.length ? findings.map((f) => `- **${f.sev.toUpperCase()}** · ${f.title}\n  - ${f.detail}\n`).join("\n") : "Nothing abnormal. The factory is silent — the best kind of silence.\n"));

  const isJSON = process.argv.includes("--json");
  if (isJSON) console.log(JSON.stringify({ runs: runs.length, errors: errs, warnings: warns, info: inf, findings }, null, 2));
  else {
    console.log(`doctor · ${runs.length} runs · ${errs} error(s), ${warns} warn(s), ${inf} info`);
    if (!findings.length) console.log("  nothing abnormal - the factory is silent");
    const icon = (s) => ({ error: "✗", warn: "⚠", info: "·" }[s]);
    for (const f of findings) console.log(`  ${icon(f.sev)} ${f.sev.toUpperCase()} ${f.title}\n     ${f.detail}`);
    console.log(`\nfull report: .pipeline/diagnosis-report.md`);
  }
  return errs; // round-8 R7-5: the exit code is computed INSIDE main()
};

if (isMain) {
  // env + breaker note (informational; the doctor spawns no hops)
  const env = await import("./env.mjs").then((m) => m.loadEnv);
  env();
  try {
    const { guard } = await import("./budget.mjs");
    const bg = guard();
    if (bg) console.error("[doctor] note: budget says: " + bg.split("\n")[0]);
  } catch { /* budget unavailable is never a doctor-fatal */ }
  const errs = main();
  process.exit(process.argv.includes("--fail-on-error") && errs ? 1 : 0);
}
// import path: control returns like budget.mjs - no exit at all
