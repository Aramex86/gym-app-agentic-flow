// scripts/changed-tests.mjs — targeted-test law (master, 24.11):
// the VERDICT VERIFICATION runs tests over the CHANGED files, not the full
// suite (coverage-scale suites make verdict re-runs minutes long as repos
// grow). Full `test` stays for nightly/statistics only.
// Zero deps. Pure functions - tested by ST-25.

/** Parse `git diff --name-only` output into a path list (win/unix tolerant). */
export function parseDiff(out) {
  return String(out || "")
    .split("\n")
    .map((l) => l.trim().replace(/\\/g, "/"))
    .filter((l) => l.length > 0);
}

/** Map changed source paths to plausible test paths (JS + python worlds).
 *  rules:
 *   - a changed file that IS a test file is included directly
 *   - src/foo.ts -> src/foo.test.ts | *.spec.* | __tests__/sibling
 *   - python: tests/test_<base>.py or tests/<base>_test.py
 *   - lockfile/config changes = structural -> callers fall back to the full gate
 * @param {string[]} paths
 * @returns {{tests: string[], structural: boolean}}
 */
export function mapToTests(paths) {
  const tests = new Set();
  let structural = false;
  const isTestPath = (p) => /(^|\/)(__tests__|tests?|.*\.test\.|.*\.spec\.)/.test(p);
  const isStructural = (p) =>
    /(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/.test(p) ||
    /(vite|eslint|tsconfig|vitest|jest)\.config\.(js|mjs|ts|cjs)$/.test(p) ||
    /^\.?[a-z]+\.config\.(js|mjs|ts)$/.test(p);
  for (const p of paths) {
    if (isStructural(p)) { structural = true; continue; }
    const file = p.replace(/^.*[\\/]/, "");
    const base = file.replace(/\.[^.]+$/, "");
    const dir = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
    const stem = p.replace(/\.[^.]+$/, "");
    const ext = p.slice(stem.length + 1); // own extension mirrors only (vitest filters nonexistent)
    if (isTestPath(p)) { tests.add(p); continue; }
    tests.add(`${stem}.test.${ext}`);
    tests.add(`${stem}.spec.${ext}`);
    tests.add(`${dir ? dir + "/" : ""}__tests__/${base}.test.${ext}`);
    if (p.endsWith(".py")) {
      tests.add(`tests/test_${base}.py`);
      tests.add(`tests/${base}_test.py`);
    }
  }
  return { tests: [...tests], structural };
}

/** Build the targeted gate command: only when the passport exposes a
 *  `test-targeted:` template (unknown => null, callers fall back to the
 *  full `test` gate - honest fallback, not silence). $FILES placeholder
 *  gets the found tests, quoted (works under POSIX shell:true). */
export function targetedGate(profile, tests, structural) {
  const tpl = profile && profile["test-targeted"];
  if (!tpl || typeof tpl !== "string" || tpl === "unknown") return null;
  if (structural) return null;   // structural change: full gate is the honest check
  if (!tests.length) return null; // no code files changed -> nothing to target
  const quoted = tests.map((t) => `"${t}"`).join(" ");
  return tpl.includes("$FILES") ? tpl.replace("$FILES", quoted) : `${tpl} ${quoted}`;
}
