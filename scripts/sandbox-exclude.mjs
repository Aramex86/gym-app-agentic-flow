// scripts/sandbox-exclude.mjs — SANDBOX-EXCLUDE LAW (master 24.11, built 27.11)
// Old work/<x>/ sandboxes must never enter the test assembly: a full vitest
// sweep saw 259 files instead of 36 and produced false reds.
// Zero deps, pure function. The DECLARATION lives in the passport
// (`test-exclude: work/**`, the researcher writes it), the ENFORCEMENT is
// this check plus the drift-check marker in AGENTS.md, and the CLEANUP is
// `flow --cleanup <name>` after the PR is merged.
//   ok = false carries the exact law hint; never a silent pass.

export function checkSandboxExclude(root, fs) {
  const read = (f) => {
    try { return fs.readFileSync(fs.join(root, f), "utf8"); } catch { return ""; }
  };
  const exists = (f) => fs.existsSync(fs.join(root, f));
  const hasWork = exists("work");
  if (!hasWork) return { ok: true, note: "no work/ sandboxes present" };

  // Real test assembly: config exclude OR the passport-declared scoped
  // runner (e.g. `vitest run --dir src`) keeps stale sandboxes out.
  const configFiles = [
    "vite.config.ts", "vite.config.js", "vite.config.mjs",
    "vitest.config.ts", "vitest.config.js", "vitest.config.mjs",
    "jest.config.ts", "jest.config.js",
  ];
  const configs = configFiles.map(read).join("\n");
  let pkg = {};
  try { pkg = JSON.parse(read("package.json") || "{}"); } catch {}
  const scripts = pkg.scripts || {};
  const runner = String(scripts.test || "") + " " + String(scripts["test:targeted"] || "");
  const scoped = /\s--dir\s+src\b/.test(runner) || /work\/\*\*/.test(configs);
  if (!scoped) {
    return {
      ok: false,
      note: "work/ exists but the test assembly does not exclude it — add exclude: ['work/**'] to the vitest config or scope the test script with --dir src (SANDBOX-EXCLUDE law)",
    };
  }
  return { ok: true, note: "test assembly excludes work/**" };
}

/** CLI: node scripts/sandbox-exclude.mjs [root] — honest line, exit 0/1. */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const invoked = process.argv[1] && process.argv[1].replace(/\\/g, "/").toLowerCase() === fileURLToPath(import.meta.url).replace(/\\/g, "/").toLowerCase();
if (invoked) {
  const root = process.argv[2] || process.cwd();
  const r = checkSandboxExclude(root, { readFileSync, existsSync, join });
  console.log(`[sandbox-exclude] ${r.ok ? "ok" : "FAIL"}: ${r.note}`);
  process.exit(r.ok ? 0 : 1);
}
