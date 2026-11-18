// scripts/env.mjs - project env factory (load once, system env wins).
import { readFileSync } from 'node:fs';

let loaded = false;

export function loadEnv() {
  if (loaded) return process.env;
  try {
    for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && m[1] !== '' && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
      }
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  loaded = true;
  return process.env;
}
