// scripts/auto-diag.mjs — hospital automation (master, 25.11):
// the doctor walks in at the FIRST circle of the day; the ADLC reviews the
// history after EVERY 5th circle. No human commands, zero tokens (both are
// read-only, no models). Opt-out: PIPELINE_AUTO_DIAG=0.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** round-10 §2: ONE FAIL-aware predicate — due when the stamp is neither
 *  today's success nor today's FAIL (a broken doctor gives up for the day). */
export function doctorDue(markerPath, today) {
  if (!existsSync(markerPath)) return true;
  try {
    const c = readFileSync(markerPath, "utf8").trim();
    return c !== today && c !== today + " FAIL";
  } catch { return true; }
}

/** The ADLC is due on every Nth circle (default 5). */
export function adlcDue(runsCount, every = 5) {
  return runsCount >= 5 && runsCount % every === 0;
}

/** Today stamp ('YYYY-MM-DD'): UTC — close enough for a "first circle of the
 *  day" heuristic; the stamp only avoids re-running the doctor every circle. */
export function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

/** Stamp the doctor's pass for today (marker = a one-line date). */
export function stampDoctor(markerPath, today, ok = true) {
  try { writeFileSync(markerPath, (ok ? today : today + " FAIL") + "\n"); } catch { /* never breaks a circle */ }
}

/** Auto-diagnostics runner used by flow.mjs. Never throws into a circle.
 *  phase: 'pre' (a circle is starting) or 'post' (a circle just ended).
 *  round-9 §7: a FAILING doctor is stamped too (with a FAIL tail) so a broken
 *  doctor cannot re-run into every circle forever; stderr is surfaced.
 *  round-9 §8: the timeout derives from PIPELINE_HOP_TIMEOUT (seconds). */
export function maybeRunAutoDiag({ root, phase }) {
  try {
    if ((process.env.PIPELINE_AUTO_DIAG || "1") === "0") return "";
    const base = process.env.PIPELINE_TRACE_BASE || root;
    const runsDir = join(base, ".pipeline", "runs");
    const runsCount = existsSync(runsDir) ? readdirSync(runsDir).filter((d) => d.includes("__")).length : 0;
    const tSec = parseInt(process.env.PIPELINE_AUTO_DIAG_TIMEOUT || "120", 10); // round-10 §4: small default, never the hop timeout
    const tMs = (tSec > 0 ? tSec : 120) * 1000;
    let line = "";
    if (phase === "pre") {
      const marker = join(base, ".pipeline", ".doctor-last");
      const today = todayStamp();
      if (doctorDue(marker, today)) {
        const r = spawnSync(process.execPath, ["scripts/doctor.mjs"], { cwd: root, stdio: "pipe", timeout: tMs, env: process.env, shell: false });
        if (r.status === 0 && !r.error) stampDoctor(marker, today, true);
        else stampDoctor(marker, today, false); // round-9 §7: give up for today
        line = r.status === 0 && !r.error
          ? ((r.stdout || "").toString().split("\n")[0] || "").trim()
          : `doctor FAILED (exit=${r.status ?? "?"}${r.error ? " " + r.error.code : ""}) — no auto-diag today` +
            ((r.stderr || "").toString().split("\n")[0] ? " · " + (r.stderr || "").toString().split("\n")[0].trim().slice(0, 120) : "");
        console.log(`[auto-diag] ${line}`);
      }
    }
    if (phase === "post" && adlcDue(runsCount)) {
      const r = spawnSync(process.execPath, ["scripts/adlc.mjs"], { cwd: root, stdio: "pipe", timeout: tMs, env: process.env, shell: false });
      line = ((r.stdout || "").toString().split("\n")[0] || "").trim();
      console.log(line ? `[auto-diag] ${line}` : `[auto-diag] adlc FAILED (exit=${r.status ?? "?"})` +
        ((r.stderr || "").toString().split("\n")[0] ? " · " + (r.stderr || "").toString().split("\n")[0].trim().slice(0, 120) : "")); // round-10 §3: stderr on adlc too
    }
    return line;
  } catch { /* diagnostics must never become the thing that breaks a circle */ return ""; }
}
