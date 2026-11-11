// scripts/run-agent.mjs — role router for the multi-agent pipeline.
// Resolution: RUN_MODEL env > role frontmatter model > pipeline.yaml table.
// Spawn: chosen CLI (env PIPELINE_CLI = opencode | claude) headless in cwd.
// Key safety: never prints OLLAMA_API_KEY (masked as ***).
// No npm dependencies. Node >= 20.

import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exit = (code, msg) => { if (msg) console.error(msg); process.exit(code); };

// --- load routing table (agents-pipeline.yaml, flat "role: model" under "roles:") ---
function routingTable() {
  const cfg = path.join(root, 'agents-pipeline.yaml');
  if (!existsSync(cfg)) exit(3, `config error: agents-pipeline.yaml not found in ${root}`);
  const raw = readFileSync(cfg, 'utf8');
  const roles = {};
  let inRoles = false;
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    if (t === 'roles:') { inRoles = true; continue; }
    if (t.endsWith(':')) { inRoles = false; continue; }
    if (inRoles && t.includes(':')) {
      const [role, model] = t.split(':').map(s => s.trim());
      if (role && model) roles[role] = model;
    }
  }
  return roles;
}

// --- role contract (.agents/<role>.md): frontmatter "model: ..." ---
function contractModel(role) {
  const p = path.join(root, 'agents', `${role}.md`);
  if (!existsSync(p)) return null;
  const head = readFileSync(p, 'utf8').slice(0, 600);
  const m = head.match(/^model:\s*(\S+)/m);
  return m ? m[1] : null;
}

function getRoleFile(role) {
  const p = path.join(root, 'agents', `${role}.md`);
  if (!existsSync(p)) exit(3, `config error: no contract agents/${role}.md`);
  const raw = readFileSync(p, 'utf8');
  // strip frontmatter (--- ... ---) — instructions only, meta is parsed separately
  const m = raw.match(/^---\n[\s\S]*?\n---\n?/);
  return m ? raw.slice(m[0].length) : raw;
}

// --- resolve model ---
const [role = '', ...ctxParts] = process.argv.slice(2);
if (!role) exit(3, 'usage: node scripts/run-agent.mjs <role> "<context>"');
const table = routingTable();
const model = process.env.RUN_MODEL || contractModel(role) || table[role]
  || exit(3, `config error: no model for role "${role}"`);

// --- assemble prompt: contract body + context ---
const ctx = ctxParts.join(' ');
const inFile = process.env.AGENT_IN;    // optional: task/plan file path
const inFileTxt = inFile && existsSync(inFile) ? `\n\nINPUT FILE (${inFile}):\n${readFileSync(inFile, 'utf8')}` : '';
const prompt = `${getRoleFile(role)}\n\nCONTEXT:\n${ctx}${inFileTxt}`;

// --- spawn CLI ---
const cli = process.env.PIPELINE_CLI || 'opencode';
const cmds = {
  opencode: ['run', prompt, '--model', `ollama-cloud/${model}`],
  claude: ['-p', prompt, '--model', model],
};
const argv = cmds[cli] || exit(3, `config error: unknown PIPELINE_CLI "${cli}" (opencode | claude)`);
const envs = {
  opencode: {},
  claude: {
    ANTHROPIC_BASE_URL: process.env.OLLAMA_BASE_URL || 'https://ollama.com',
    ANTHROPIC_AUTH_TOKEN: '***', // real value injected below, never logged
  },
};
const env = { ...process.env, ...envs[cli] };
if (cli === 'claude') env.ANTHROPIC_AUTH_TOKEN = process.env.OLLAMA_API_KEY || '';

const printable = `${cli} ${argv.join(' ').replace(/(sk|ntn|ntn_)\S+/g, '***').slice(0, 120)}... [model=${model}]`;
console.log(`[run-agent] ${printable}`);

const out = process.env.AGENT_OUT;      // expected artifact; verified after run
const r = spawnSync(cli, argv, { cwd: root, env, stdio: 'inherit', timeout: 10 * 60_000 });

if (r.error) exit(2, `spawn failed: ${r.error.message}`);
if (r.status !== 0) exit(r.status ?? 1, `[run-agent] CLI exited ${r.status}`);

if (out) {
  const abs = path.join(root, out);
  if (!existsSync(abs)) exit(2, `machine gate: expected artifact missing: ${out}`);
  console.log(`[run-agent] artifact ok: ${out}`);
}
console.log(`[run-agent] role=${role} model=${model} done`);
