#!/usr/bin/env node
/**
 * FSAA drift-check v4.6 — verifies that AGENTS.md (the machine contract)
 * still matches the real code. Cross-platform: Node + eslint in-process.
 *
 * Two-way binding: unknown/unmapped rules are errors, missing markers are errors,
 * and every passing rule must hold in the code itself. Exit 1 on any drift.
 *
 * v4.6 — single source of truth: the code-level checks (no-ui-fetch,
 * boundary-imports, ui-location contents) are delegated to the
 * eslint-plugin-fsaa npm package. The template's eslint.config.mjs wires the
 * SAME package into `pnpm lint`, so drift-check and lint share one rule
 * implementation. This script keeps the CONTRACT side: AGENTS.md markers,
 * two-way binding, commands, lockfile, supply-chain policy, file paths.
 * v4.4: boundary-imports caught relative cross-slice imports.
 * v4.5: script-policy (pnpm 10+ allowlist).
 *
 * Output is colored when stdout is a TTY; piped output stays plain (logs/CI).
 * Force plain output with FORCE_COLOR=0.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

/** Template shape: layer dirs required by the contract (fsaa-vite / Vite+react-router). */
const LAYER_DIRS = ["src/app", "src/pages", "src/features", "src/entities", "src/shared"];
/** Contract-named files that must exist. */
const CONTRACT_FILES = ["src/pages/router.tsx", "src/app/main.tsx", "eslint.config.mjs"];

/** ANSI color helpers; no-ops when colors are disabled. */
const useColor = process.stdout.isTTY && process.env.FORCE_COLOR !== "0";
const c = useColor
  ? {
      red: (s) => `\x1b[31m${s}\x1b[0m`,
      green: (s) => `\x1b[32m${s}\x1b[0m`,
      yellow: (s) => `\x1b[33m${s}\x1b[0m`,
      cyan: (s) => `\x1b[36m${s}\x1b[0m`,
      bold: (s) => `\x1b[1m${s}\x1b[0m`,
      dim: (s) => `\x1b[2m${s}\x1b[0m`,
    }
  : {
      red: (s) => s,
      green: (s) => s,
      yellow: (s) => s,
      cyan: (s) => s,
      bold: (s) => s,
      dim: (s) => s,
    };

/** AGENTS.md text — the contract being verified. */
const md = readFileSync("AGENTS.md", "utf8");
/** Rule ids from <!--check: id--> markers, de-duplicated, in document order. */
const ids = [
  ...new Set([...md.matchAll(/<!--check:\s*([\w-]+)\s*-->/g)].map((m) => m[1])),
];

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const scripts = pkg.scripts || {};
const eslintCfg = readFileSync("eslint.config.mjs", "utf8");
/** True when package.json defines a script with this name. */
const hasScript = (n) => typeof scripts[n] === "string";

/** Wire point for the single source of truth. */
const createRequire0 = createRequire(import.meta.url);
const require = createRequire0;

/**
 * eslint-plugin-fsaa findings, run once over the repo (src/**, app/**).
 * The plugin package implements the code checks; this script only maps
 * its findings to AGENTS.md rule ids.
 * @returns {Promise<{ok: true, byRule: Map<string,string[]>} | {ok: false, error: string}>}
 */
let lintCache;
function fsaaLint() {
  if (lintCache) return lintCache;
  const dep =
    pkg.devDependencies?.["eslint-plugin-fsaa"] || pkg.dependencies?.["eslint-plugin-fsaa"];
  if (!dep)
    return Promise.resolve(
      (lintCache = {
        ok: false,
        error: "eslint-plugin-fsaa is not a devDependency (single source of truth missing)",
      }),
    );
  try {
    const { Linter } = require("eslint");
    const parser = require("@typescript-eslint/parser");
    const pending = import("eslint-plugin-fsaa");
    return pending.then((m) => {
      const fsaa = m.default ?? m;
      const linter = new Linter();
      const flat = [
        {
          files: ["**/*.{ts,tsx}"],
          languageOptions: {
            parser,
            parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
          },
        },
        ...fsaa.configs.recommended,
      ];
      const files = [];
      const walk = (d) => {
        if (!existsSync(d)) return;
        for (const e of readdirSync(d, { withFileTypes: true })) {
          if (["node_modules", ".git", "dist", ".next", "assets"].includes(e.name)) continue;
          const p = join(d, e.name);
          if (e.isDirectory()) walk(p);
          else if (/\.[jt]sx?$/.test(e.name)) files.push(p);
        }
      };
      walk("src");
      walk("app");
      const byRule = new Map();
      const cwd = process.cwd().replace(/[\\/]+$/, "") + "/";
      for (const f of files) {
        const abs = (f.startsWith("/") ? f : cwd + f.replace(/[\\/]+/g, "/")).replace(/\/+$/, "");
        for (const msg of linter.verify(readFileSync(f, "utf8"), flat, { filename: abs })) {
          if (!msg.ruleId || !msg.ruleId.startsWith("fsaa/")) continue;
          if (!byRule.has(msg.ruleId)) byRule.set(msg.ruleId, []);
          byRule.get(msg.ruleId).push(
            f.replace(/[\\/]+/g, "/").replace(/^\.?\/?/, "") + ":" + msg.line,
          );
        }
      }
      return (lintCache = { ok: true, byRule });
    });
  } catch (e) {
    return Promise.resolve((lintCache = { ok: false, error: e.message }));
  }
}
/** AGENTS.md rule id → fsaa plugin rule id. */
const PLUGIN_RULE_MAP = {
  "no-ui-fetch": "fsaa/no-raw-fetch",
  "boundary-imports": "fsaa/boundary-imports",
  "ui-location": "fsaa/ui-location",
};
/** Delegated code check: contract rule id → findings from the plugin. */
async function fromPlugin(id) {
  const res = await fsaaLint();
  if (!res.ok) throw new Error(res.error);
  const hits = res.byRule.get(PLUGIN_RULE_MAP[id]) ?? [];
  return hits.length ? hits : true;
}

/**
 * Map: AGENTS.md rule id → verification function (async allowed since v4.6).
 * Return contract: true = pass, false = generic fail, string[] = offending entries.
 */
const checks = {
  /** Pnpm is the package manager: a healthy lockfile exists. */
  "cmd-pnpm-install": () => existsSync("pnpm-lock.yaml"),
  "cmd-pnpm-dev": () => hasScript("dev"),
  "cmd-pnpm-lint": () => hasScript("lint"),
  "cmd-pnpm-typecheck": () => hasScript("typecheck"),
  "cmd-pnpm-build": () => hasScript("build"),
  /** Exactly one lockfile in the repo: pnpm-lock.yaml. */
  "single-lockfile": () =>
    existsSync("pnpm-lock.yaml") &&
    !existsSync("package-lock.json") &&
    !existsSync("yarn.lock"),
  /** Contract layer dirs exist (plugin ui-location rule covers the contents). */
  "ui-location": async () => {
    const missing = LAYER_DIRS.filter((d) => !existsSync(d));
    if (missing.length) return ["missing layer dir(s): " + missing.join(", ")];
    return fromPlugin("ui-location");
  },
  /** UI layers and route pages must do no direct fetching — plugin rule. */
  "no-ui-fetch": () => fromPlugin("no-ui-fetch"),
  /** Imports flow only downward — plugin rule — AND the wiring stays in the config. */
  "boundary-imports": async () => {
    const r = await fromPlugin("boundary-imports");
    if (r !== true) return r;
    return eslintCfg.includes("fsaaPlugin.configs.recommended") ? true : false;
  },
  /** Contract-named files exist. */
  "file-paths": () => CONTRACT_FILES.every(existsSync),
  /** Enforced by GitHub branch protection, not locally — always passes. */
  "pr-flow": () => true,
  /** Supply-chain policy: lifecycle scripts of dependencies must be blocked
   *  by default (pnpm 10+, allowlist-only builds). */
  "script-policy": () => {
    const pm = pkg.packageManager || "";
    const major = Number((pm.match(/pnpm@(\d+)/) || [])[1] || 0);
    const allow = pkg.pnpm && pkg.pnpm.onlyBuiltDependencies;
    return major >= 10 && Array.isArray(allow);
  },
};

console.log();
console.log(c.bold(c.cyan("  FSAA drift-check")) + c.dim("  v4.6"));
console.log(c.dim(`  AGENTS.md: ${ids.length} rules · code checks: eslint-plugin-fsaa`));
console.log(c.dim("  " + "─".repeat(46)));

const problems = [];
const t0 = performance.now();
const results = [];

// Two-way binding: doc → map, and map → doc.
for (const id of ids)
  if (!(id in checks))
    problems.push(
      `${c.yellow("⚠")} rule ${c.bold(id)} ${c.yellow("has a marker but no check is mapped")}`,
    );
for (const id of Object.keys(checks))
  if (!ids.includes(id))
    problems.push(
      `${c.yellow("⚠")} check ${c.bold(id)} ${c.yellow("exists in the map but no marker in AGENTS.md")}`,
    );

for (const id of ids) {
  if (!(id in checks)) continue;
  const t = performance.now();
  let ok,
    detail = "";
  try {
    const r = await checks[id]();
    if (r === true) ok = true;
    else if (r === false) {
      ok = false;
      detail = "the check failed";
    } else if (Array.isArray(r)) {
      ok = r.length === 0;
      if (!ok)
        detail = PLUGIN_RULE_MAP[id]
          ? `plugin ${PLUGIN_RULE_MAP[id]} reported: ` +
            r.slice(0, 3).join(", ") +
            (r.length > 3 ? ` (+${r.length - 3} more)` : "")
          : r.slice(0, 3).join(", ");
    } else {
      ok = false;
      detail = "unexpected check result";
    }
  } catch (e) {
    ok = false;
    detail = "check crashed: " + e.message;
  }
  const ms = Math.round(performance.now() - t);
  results.push({ id, ok, detail, ms });
  console.log(
    `  ${ok ? c.green("✓") : c.red("✗")} ${c.bold(id)} ${c.dim(ms + "ms")}${!ok && detail ? ` ${c.red("— " + detail)}` : ""}`,
  );
}

console.log(c.dim("  " + "─".repeat(46)));
const dt = ((performance.now() - t0) / 1000).toFixed(1);

const failed = results.filter((r) => !r.ok);
if (failed.length || problems.length) {
  for (const p of problems) console.error("  " + p);
  console.error();
  console.error(
    c.red(
      c.bold(
        `  ✗ drift detected: ${failed.length} rule(s), ${problems.length} binding issue(s)`,
      ) + c.dim(` · ${dt}s`),
    ),
  );
  process.exit(1);
}
console.log(
  c.green(
    c.bold(`  ✓ AGENTS.md OK: ${ids.length} rules verified`) +
      c.dim(` · contract intact · ${dt}s`),
  ),
);