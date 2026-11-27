// scripts/profile.mjs — the PASSPORT reader (phase-4 item 1.2).
// One source of truth for toolchain facts: docs/factory-profile.md
// (written by the researcher role). Every consumer of a package
// manager or command reads THIS instead of a hardcoded 'pnpm'.
//
// LAW: absence of a passport = pnpm defaults (backward compatibility —
// existing pnpm projects keep working exactly as before). The returned
// object carries `_source` ('profile' | 'default') so callers can log
// which path they got.
//
// Flat frontmatter parsing, zero dependencies (same style as eval.mjs): 
//   key: value lines between the first pair of --- markers.

import { readFileSync, existsSync } from 'node:fs';
import { join as pathJoin } from 'node:path';

const DEFAULTS = {
  schema: '0',
  ecosystem: 'node',
  package_manager: 'pnpm',
  install: 'pnpm install --frozen-lockfile --prefer-offline',
  lint: 'pnpm lint',
  typecheck: 'pnpm typecheck',
  test: 'pnpm test',
  build: 'pnpm build',
  lockfile: 'pnpm-lock.yaml',
  // SANDBOX-EXCLUDE + targeted law + ui-libs: hyphenated keys MUST be
  // readable (Numbers research gap 25.11: they were written but invisible).
  'test-exclude': 'work/**',
  'test-targeted': 'unknown',
  'ui-libs': 'unknown',
  commit_rules: 'plain',
  structure: 'free',
  unknown: [],
};

export function getProfile(root, fs) {
  const f = fs || { readFileSync, existsSync, join: pathJoin };
  const out = { ...DEFAULTS, _source: 'default' };
  const p = f.join(root, 'docs', 'factory-profile.md');
  if (!f.existsSync(p)) return out;
  try {
    const raw = f.readFileSync(p, 'utf8');
    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] || '';
    for (const line of fm.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][\w-]*):\s*(.*?)\s*$/);
      if (m && m[2] !== '' && m[1] in out) {
        const key = m[1];
        let val = m[2];
        if (key === 'unknown') continue; // human list, engine ignores
        // a passport value of unknown/UNKNOWN = the field is not knowable:
        // PASSED THROUGH as 'unknown' (never silently defaulted to the pnpm
        // world) so the matching gate/install fails VISIBLY there.
        out[key] = val;
        out._source = 'profile';
      }
    }
  } catch { /* unreadable passport = defaults */ }
  return out;
}
