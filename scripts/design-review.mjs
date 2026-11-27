// scripts/design-review.mjs — ONE screen -> component map (Design Review hop)
// Source-agnostic: any design tool's export dir with screen.png + optional
// markup/tokens. Zero-token skeleton generation before the hop.
// Usage: node scripts/design-review.mjs <screen-dir> [hop-args...]
// E.g. node scripts/design-review.mjs tasks/my-task/design/progress

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

const dir = process.argv[2];
if (!dir || !existsSync(dir)) {
  console.error('usage: node scripts/design-review.mjs <screen-dir> [--model ...]');
  process.exit(3);
}
const root = resolve('.');
const screen = basename(resolve(dir));
const sk = spawnSync(process.execPath, ['scripts/screen-skeleton.mjs', dir], { cwd: root, encoding: 'utf8' });
if (sk.status !== 0) { console.error(sk.stderr || 'skeleton failed'); process.exit(sk.status || 2); }
const skelDir = join(root, '.pipeline', 'design-skeletons');
mkdirSync(skelDir, { recursive: true });
const skelFile = join(skelDir, screen + '.txt');
writeFileSync(skelFile, sk.stdout);
const out = `docs/design-decomposition/${screen}.md`;
const args = ['design-reviewer', '-i', skelFile, '-o', out,
  `SCREEN_DIR: ${resolve(dir)}\nRead the image first. Produce the component map per your contract.`,
  ...process.argv.slice(3)];
console.log(`screen: ${screen} | skeleton: ${sk.stdout.length} chars (zero tokens) | output: ${out}`);
const r = spawnSync(process.execPath, ['scripts/run-agent.mjs', ...args], { cwd: root, stdio: 'inherit', env: process.env });
process.exit(r.status ?? 1);
