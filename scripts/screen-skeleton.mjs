// scripts/screen-skeleton.mjs — SOURCE-AGNOSTIC screen digest (zero tokens, zero deps)
// Input: ONE directory containing one screen: screen.png (required) plus any
// markup (html/svg) and token files (DESIGN.md / *.css / tokens.json).
// Output: a small text skeleton (zones/elements/tokens) so a hop reads 3-5KB
// instead of 28KB of Tailwind config. NO vendor names, NO special cases for
// any design tool — adapters are by FILE TYPE, not by brand.
// Usage: node scripts/screen-skeleton.mjs <dir> > skeleton.txt

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const dir = process.argv[2];
if (!dir || !existsSync(dir)) {
  console.error('usage: node scripts/screen-skeleton.mjs <screen-dir>');
  process.exit(3);
}
const files = readdirSync(dir).filter((f) => statSync(join(dir, f)).isFile());
const images = files.filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
if (!images.length) {
  console.error(`NO IMAGE: ${dir} — a screen needs screen.png (source-agnostic law).`);
  process.exit(2);
}
const strip = (s, re) => s.replace(re, ' ');
const txt = (f) => {
  try { return readFileSync(join(dir, f), 'utf8'); } catch { return ''; }
};
const markup = files.filter((f) => /\.(html?|svg|xml)$/i.test(f));
const tokenFiles = files.filter((f) => /design\.md$|tokens?\.json$|\.css$/i.test(f));

const out = [];
out.push(`SCREEN: ${dir.split(/[\\/]/).filter(Boolean).pop()}`);
out.push(`IMAGE(S): ${images.join(', ')} — the hop can open these with Read.`);
out.push('One screen per hop. Source-agnostic: visual + optional markup/tokens.');

// Zones: HTML/SVG comments are the most reliable semantic labels across
// tools that export markup; no vendor grammar involved.
const zones = [];
for (const f of markup) {
  const raw = txt(f);
  for (const m of raw.matchAll(/<!--\s*([^>]{2,120}?)\s*-->/g)) {
    const label = m[1].replace(/<[^>]*>/g, '').trim();
    if (label && !zones.includes(label)) zones.push(label);
  }
}
out.push('\nZONES (semantic labels found in markup):');
out.push(zones.length ? zones.map((z) => `- ${z}`).join('\n') : '- (none — read the image)');

// Elements: tag + class hints, heavy style/script/FONT config removed.
const elements = [];
for (const f of markup) {
  const clean = strip(strip(txt(f), /<style\b[\s\S]*?<\/style>/gi), /<script\b[\s\S]*?<\/script>/gi);
  for (const m of clean.matchAll(/<(header|main|section|article|nav|aside|figure|table|button|form|canvas)\b([^>]*)>/gi)) {
    const cls = (m[2].match(/class="([^"]{0,160})"/) || [])[1] || '';
    const hint = `${m[1].toLowerCase()}${cls ? '.' + cls.trim().split(/\s+/).slice(0, 5).join('.') : ''}`;
    if (!elements.includes(hint)) elements.push(hint);
    if (elements.length >= 40) break;
  }
}
out.push('\nELEMENT HINTS (first 40, style/script stripped):');
out.push(elements.length ? elements.map((e) => `- ${e}`).join('\n') : '- (none — read the image)');

// Tokens: names only, never 40 hex values in the hop context.
const tokens = [];
for (const f of tokenFiles) {
  const raw = txt(f);
  for (const m of raw.matchAll(/--([\w-]{3,40})\s*:/g)) {
    const name = '--' + m[1];
    if (!tokens.includes(name)) tokens.push(name);
  }
  for (const m of raw.matchAll(/"([\w.-]{3,40})"\s*:\s*\{/g)) {
    const name = m[1];
    if (/^(color|font|space|size|radius|typography)/i.test(name) && !tokens.includes(name)) tokens.push(name);
  }
}
out.push('\nTOKEN NAMES (map to the project var(--...) system, never hardcode):');
out.push(tokens.length ? tokens.slice(0, 60).map((t) => `- ${t}`).join('\n') : '- (none found)');

const skeleton = out.join('\n');
// Hard cap: a skeleton must stay small even if the source exports a monster.
process.stdout.write(skeleton.length > 12000 ? skeleton.slice(0, 12000) + '\n...[truncated at 12000 chars]' : skeleton);
