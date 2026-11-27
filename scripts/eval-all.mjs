// scripts/eval-all.mjs — EVAL:RUN-ALL (Phase-4 easy #1, master 27.11).
// ONE command, ONE honest verdict across the kit's checks. No models, no
// network — the checks themselves are zero-token scripts.
//
// AGREED SEAM (master 27.11):
//   runAll(runner, checks) -> { ok, checks, exit, summary }
//   runner(cmd, args) -> { status, stdout, stderr }
//   CLI: node scripts/eval-all.mjs [--runner <module>]
// Two runners = a real seam: the real spawnSync and an injected adapter.
// skip is NOT a failure and is reported honestly.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

/** The kit's default check set. `skip` = declared, honest, not a failure. */
export function defaultChecks(root = ".") {
  const golden = join(root, "evals", "golden-factory.md");
  return [
    { id: "self-tests", args: ["scripts/self-tests.mjs"] },
    { id: "doctor", args: ["scripts/doctor.mjs", "--fail-on-error"] },
    { id: "adlc", args: ["scripts/adlc.mjs"] },
    { id: "eval", args: ["scripts/eval.mjs", "evals/golden-factory.md"], skip: !existsSync(golden) },
  ];
}

/** Run every check through the injected runner; aggregate honestly. */
export function runAll(runner, checks) {
  const rows = [];
  for (const c of checks || []) {
    if (c.skip) {
      rows.push({ id: c.id, status: "skip", note: "declared skip (honest)" });
      continue;
    }
    let r;
    try {
      r = runner(process.execPath, c.args) || {};
    } catch (e) {
      r = { status: -1, stderr: String(e && e.message || e) };
    }
    const status = Number(r.status);
    const tail = String(r.stderr || r.stdout || "").trim().split("\n").slice(-1)[0] || "";
    rows.push({
      id: c.id,
      status: status === 0 ? "pass" : "fail",
      exit: status,
      note: status === 0 ? "green" : tail.slice(0, 120),
    });
  }
  const failed = rows.filter((r) => r.status === "fail");
  const skipped = rows.filter((r) => r.status === "skip");
  const ok = failed.length === 0;
  const line = `eval-all: ${rows.length - failed.length - skipped.length}/${rows.length - skipped.length} green` +
    ` · ${failed.length} fail · ${skipped.length} skip` +
    (failed.length ? ` — FAIL ${failed.map((f) => `${f.id}(exit=${f.exit})`).join(", ")}` : "");
  return { ok, checks: rows, exit: ok ? 0 : 1, summary: line };
}

/** Real adapter: spawnSync, inherited stdio to a pipe so we can summarize. */
export function spawnRunner(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  return { status: r.status ?? -1, stdout: r.stdout || "", stderr: r.stderr || "" };
}

// --- CLI ---
const thisFile = fileURLToPath(import.meta.url);
const invoked = process.argv[1] && process.argv[1].replace(/\\/g, "/").toLowerCase() === thisFile.replace(/\\/g, "/").toLowerCase();
if (invoked) {
  const idx = process.argv.indexOf("--runner");
  let runner = spawnRunner;
  if (idx !== -1) {
    const p = process.argv[idx + 1];
    if (!p) { console.error("eval-all: --runner needs a module path"); process.exit(3); }
    try {
      const m = await import(pathToFileURL(p).href);
      runner = m.default || m.runner;
      if (typeof runner !== "function") throw new Error("module has no default runner function");
    } catch (e) {
      console.error("eval-all: runner load failed: " + (e && e.message || e));
      process.exit(3);
    }
  }
  const result = runAll(runner, defaultChecks(process.cwd()));
  for (const row of result.checks) console.log(`  ${row.status.toUpperCase()} ${row.id} ${row.note}`);
  console.log(result.summary);
  process.exit(result.exit);
}
