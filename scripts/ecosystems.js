// scripts/ecosystems.js — DETECTOR REGISTRY for the researcher role.
//
// DATA, not a code ladder: adding a language/ecosystem later = adding one
// entry to DETECTORS (its matcher + templates). The engine (researcher role,
// flow, consumers in item 1.2) never compares ecosystem strings.
//
// LAWS:
// - detection reads FACTS (lockfile names, manifest keys) — it NEVER guesses:
//   anything it cannot find lands in the returned `unknown` array verbatim,
//   so the human fills the passport instead of the engine inventing commands.
// - fs helpers are injected (testability + zero side effects at import).
// Registry entry shape:
//   name:      ecosystem id (goes into the passport `ecosystem:` line)
//   match(fs): true when the root belongs to this ecosystem (fact check)
//   detect(fs, root): returns { package_manager, install, lint, typecheck,
//     test, build, lockfile, unknown[] } — missing values = unknown[],
//     commands are NEVER invented.
const TEMPLATES = {
  npm:   { install: 'npm ci',                       run: (s) => `npm run ${s}` },
  pnpm:  { install: 'pnpm install --frozen-lockfile --prefer-offline', run: (s) => `pnpm ${s}` },
  yarn:  { install: 'yarn install --frozen-lockfile', run: (s) => `yarn ${s}` },
  uv:    { install: 'uv sync --frozen' },
  poetry:{ install: 'poetry install --no-root' },
  pip:   { install: 'pip install -r requirements.txt' },
};

const COMMAND_KEYS = ['lint', 'typecheck', 'test', 'build'];

// python: lockfile → PM (uv/poetry/pipenv); bare requirements.txt = pip.
// Check commands are only FACTS of tool-sections in pyproject.toml:
// [tool.pytest.ini_options] → pytest, [tool.mypy] → mypy, [tool.ruff] → ruff.
// No section = honest unknown (never invented). Build: uv has one (uv build).
const PY_TOOL_FACTS = [
  [/\[tool\.pytest\.ini_options\]/, 'test', 'pytest'],
  [/\[tool\.mypy\]/, 'typecheck', 'mypy'],
  [/^\[tool\.ruff\]/m, 'lint', 'ruff check .'],
];
export const DETECTORS = {
  python: {
    name: 'python',
    match: (fs, root) => fs.existsSync(fs.join(root, 'pyproject.toml')) || fs.existsSync(fs.join(root, 'requirements.txt')),
    lockfiles: { 'uv.lock': 'uv', 'poetry.lock': 'poetry', 'Pipfile.lock': 'pipenv' },
    detect: (fs, root) => {
      const unknown = [];
      let pm = null;
      for (const [file, manager] of Object.entries(DETECTORS.python.lockfiles)) {
        if (fs.existsSync(fs.join(root, file))) { pm = manager; break; }
      }
      if (!pm && fs.existsSync(fs.join(root, 'requirements.txt'))) pm = 'pip';
      if (!pm) unknown.push('package_manager (no lockfile/requirements - honest UNKNOWN, not guessed)');
      const out = { package_manager: pm || 'UNKNOWN' };
      if (pm) out.install = TEMPLATES[pm].install; else unknown.push('install (no known lockfile -> never guessed)');
      const prPath = fs.join(root, 'pyproject.toml');
      if (fs.existsSync(prPath)) {
        let pp = '';
        try { pp = fs.readFileSync(prPath, 'utf8'); } catch { unknown.push('pyproject.toml (unreadable)'); }
        for (const [re, key, cmd] of PY_TOOL_FACTS) if (re.test(pp)) out[key] = cmd;
        if (/uv_build|uv\s+build/.test(pp) && pm === 'uv') out.build = 'uv build';
      } else if (pm) unknown.push('pyproject.toml (absent)');
      for (const key of COMMAND_KEYS) if (!(key in out)) unknown.push(key);
      out.unknown = unknown;
      return out;
    },
  },
  node: {
    name: 'node',
    match: (fs, root) => fs.existsSync(fs.join(root, 'package.json')),
    // lockfile → package manager (fact by filename presence)
    lockfiles: { 'pnpm-lock.yaml': 'pnpm', 'package-lock.json': 'npm', 'yarn.lock': 'yarn' },
    detect: (fs, root) => {
      const unknown = [];
      let pm = null;
      for (const [file, manager] of Object.entries(DETECTORS.node.lockfiles)) {
        if (fs.existsSync(fs.join(root, file))) { pm = manager; break; }
      }
      if (!pm) unknown.push('package_manager (no lockfile found - honest UNKNOWN, not guessed)');
      const out = { package_manager: pm || 'UNKNOWN' };
      if (pm) out.install = TEMPLATES[pm].install; else unknown.push('install (no lockfile -> never guessed)');
      const pkgPath = fs.join(root, 'package.json');
      let scripts = {};
      try { scripts = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).scripts || {}; } catch { unknown.push('package.json (unreadable)'); }
      for (const key of COMMAND_KEYS) {
        if (typeof scripts[key] === 'string' && scripts[key].trim()) out[key] = TEMPLATES[pm] ? TEMPLATES[pm].run(key) : `UNKNOWN-runner(${key})`;
        else unknown.push(key);
      }
      out.unknown = unknown;
      return out;
    },
  },
};

/** detect(root, fs) — first ecosystem whose matcher holds; null = honest "unknown world". */
export function detect(root, fs) {
  for (const d of Object.values(DETECTORS)) {
    if (d.match(fs, root)) return { ecosystem: d.name, ...d.detect(fs, root) };
  }
  return null;
}

// CLI mode (researcher hop step 1): node scripts/ecosystems.js → facts JSON
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const { existsSync, readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const r = detect(process.cwd(), { existsSync, readFileSync, join });
  console.log(JSON.stringify(r ?? { detect: null, unknown: ['ecosystem'] }, null, 2));
}
