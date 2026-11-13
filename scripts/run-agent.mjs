// scripts/run-agent.mjs  role router for the multi-agent pipeline.
// Resolution: RUN_MODEL env > role frontmatter model > pipeline.yaml table.
// Spawn: chosen CLI (env PIPELINE_CLI = opencode | claude) headless in cwd.
// Key safety: never prints OLLAMA_API_KEY (masked as ***).
// No npm dependencies. Node >= 20.

import { readFileSync, existsSync, openSync, closeSync, rmSync } from 'node:fs';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadEnv } from './env.mjs';
import { ev, snap, promptSnap } from './trace.mjs';
loadEnv();    // reads repo .env (PIPELINE_CLI, OLLAMA_*, RUN_MODEL)  system env wins

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

// --- role contract: frontmatter "tools: ..." (per-role allowlist) ---
function contractTools(role) {
  const p = path.join(root, 'agents', `${role}.md`);
  if (!existsSync(p)) return null;
  const head = readFileSync(p, 'utf8').slice(0, 600);
  const m = head.match(/^tools:\s*(.+)$/m);
  return m ? m[1].trim() : null;
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
  // strip frontmatter (--- ... ---, CRLF-safe): machine reads meta separately
  const raw = readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n[\s\S]*?\n---\n?/);
  return m ? raw.slice(m[0].length) : raw.replace(/^\r?\n/, '');
}


// --- resolve model ---
// role colors (ANSI): planner=green, developer=dark orange, tester=cyan
const RESET = '\x1b[0m';
const ROLE_COLOR = { planner: '\x1b[32m', developer: '\x1b[38;5;208m', tester: '\x1b[36m', committer: '\x1b[35m' };
const rc = (text) => (ROLE_COLOR[role] || '') + text + RESET;

// args: <role> [-i input] [-o output] "context..."   (env AGENT_IN/OUT still honored as fallback)
const rawArgs = process.argv.slice(2);
const role = rawArgs[0] || '';
let inFlag, outFlag; const ctxParts = [];
for (let k = 1; k < rawArgs.length; k++) {
  if (rawArgs[k] === '-i') inFlag = rawArgs[++k];
  else if (rawArgs[k] === '-o') outFlag = rawArgs[++k];
  else ctxParts.push(rawArgs[k]);
}
if (!role) exit(3, 'usage: node scripts/run-agent.mjs <role> [-i in-file] [-o out-file] "context"');
const table = routingTable();
const model = process.env.RUN_MODEL || contractModel(role) || table[role]
  || exit(3, `config error: no model for role "${role}"`);

// priority: -o > auto-name from -i > env (stale env must never beat the auto name)

// --- assemble prompt: contract body + context ---
const ctx = ctxParts.join(' ');
// derive AGENT_OUT from the input name unless given: planner -> -plan.md, tester -> -report.md
const stem = (p) => p && p.replace(/\.[^.]+$/, '').split(/[\\/]/).pop();
const inName = stem(inFlag || process.env.AGENT_IN);
// strip a trailing "-plan" from the input name first: an input -plan.md
// yields -report.md (NOT -plan-report.md)  matches the tester contract X-report.md
const baseName = inName ? inName.replace(/-plan$/, '').replace(/-report$/, '') : undefined;
const autoOut = role === 'planner' && baseName ? `docs/plans/${baseName}-plan.md`
              : role === 'tester'  && baseName ? `docs/plans/${baseName}-report.md`
              : role === 'committer' && baseName ? `docs/plans/${baseName}-commit.md` : undefined;
const inFile = inFlag || process.env.AGENT_IN;    // optional: task/plan file path
const inFileTxt = inFile && existsSync(inFile) ? `\n\nINPUT FILE (${inFile}):\n${readFileSync(inFile, 'utf8')}` : '';
const out = outFlag || autoOut || process.env.AGENT_OUT;  // expected artifact; verified after run

const outDirective = out ? `\nOUTPUT PATH (write the artifact EXACTLY here - do not add dates or rename):\n${out}` : '';
const prompt = `${getRoleFile(role)}\n\nCONTEXT:\n${ctx}${inFileTxt}${outDirective}`;

// --- spawn CLI ---
const cli = process.env.PIPELINE_CLI || 'opencode';
// claude: prompt rides on STDIN (argv only flags)  multi-line/dash-proof
const useStdin = cli === 'claude';
const cmds = {
  opencode: ['run', prompt, '--model', `ollama-cloud/${model}`],
  // NOTE: custom model IDs go by ENV  --model on argv is strictly validated
  // and aborts with [claude-code:unrecognized_model] for non-Anthropic ids
  // NOTE: --model belongs on ARGV: model-via-env (ANTHROPIC_MODEL) hits the
  // sdk switch validation and aborts [claude-code:unrecognized_model],
  // while --model on argv is accepted (verified with Ollama Cloud).
  // SECURITY (tools-per-role): the per-hop allowlist comes from the role's
  // frontmatter `tools:` (contractTools above); the DEFAULT stays the old
  // fat list for roles without a tools: line. On top, a GLOBAL deny list
  // removes git mutations for EVERY role: agents never commit/push/merge -
  // the wall is now enforced by the CLI, not only by the contract text.
  // INCIDENT 2026-11-12: an orphaned flow hop burned ~2k minimax calls.
  // Hard caps now bound every hop -> bounded usage per hop, always.
  claude: ['-p', '--model', model,
    // budget cap: each hop gets a finite number of agentic turns (each turn
    // ~= one model call + tools). Override via PIPELINE_MAX_TURNS env.
    '--max-turns', String(parseInt(process.env.PIPELINE_MAX_TURNS || '60', 10)),
    '--allowedTools', 'Read,Edit,Write,Bash(pnpm:*),Bash(git status:*),Bash(git diff:*),Bash(git log:*)'],   // -p = print mode; prompt rides on stdin
};
const argv = cmds[cli] || exit(3, `config error: unknown PIPELINE_CLI "${cli}" (opencode | claude)`);
// insert --allowedTools (per-role or default) and global --disallowedTools
const roleTools = contractTools(role);
const DEFAULT_TOOLS = 'Read,Edit,Write,Bash(pnpm:*),Bash(git status:*),Bash(git diff:*),Bash(git log:*)';
const allowedTools = roleTools || DEFAULT_TOOLS;
const DENY = 'Bash(git commit:*),Bash(git push:*),Bash(git merge:*),Bash(git checkout:*),Bash(git reset:*),Bash(git rebase:*)';
if (cli === 'claude') {
  const i = argv.indexOf('--allowedTools');
  if (i !== -1) argv[i + 1] = allowedTools;
  argv.push('--disallowedTools', DENY);
}
const envs = {
  opencode: {},
  claude: {
    ANTHROPIC_BASE_URL: process.env.OLLAMA_BASE_URL || 'https://ollama.com',
    ANTHROPIC_AUTH_TOKEN: '***', // real value injected below, never logged
    // NO ANTHROPIC_API_KEY here: an empty key makes claude send a broken
    // x-api-key header; provider /v1/models check then fails with 401.
    // Verified working (Ollama docs): only BASE_URL + AUTH_TOKEN.
    // NO model selection via env (see NOTE at cmds above).
    ANTHROPIC_DEFAULT_OPUS_MODEL: model,
    ANTHROPIC_DEFAULT_SONNET_MODEL: model,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: model,   // all tiers -> same model, no 404s
    CLAUDE_CODE_DISABLE_UNKNOWN_MODEL_WINDOW_ENFORCEMENT: '1',
  },
};
const env = { ...process.env, ...envs[cli] };
if (cli === 'claude') env.ANTHROPIC_AUTH_TOKEN = process.env.OLLAMA_API_KEY || '';

const printable = `${cli} ${argv.join(' ').replace(/(sk|ntn|ntn_)\S+/g, '***').slice(0, 120)}... [model=${model}]`;
console.log(rc(`[run-agent] ${printable}`));

// SECURITY VISIBILITY: tools shown to the human as a readable list (the
// one-liner above is truncated; decisions need the full picture).
if (cli === 'claude') {
  // one compact line per group: fs tools, bash commands, git commands.
  // The global deny list is NOT printed every hop (constant; auditable in
  // run-agent source) - only a quiet hint that it is active.
  const fs = [], bash = [], gitc = [];
  for (const raw of allowedTools.split(',')) {
    const x = raw.trim();
    const gb = x.match(/^Bash\(git ([a-z]+):/);
    if (gb) { gitc.push(gb[1]); continue; }
    const cb = x.match(/^Bash\(([^)]+):/);
    if (cb) { bash.push(cb[1]); continue; }
    if (x) fs.push(x);
  }
  if (roleTools) {
    console.log(rc(`[run-agent] tools (${role}, from agents/${role}.md):`));
    if (fs.length) console.log(rc(`[run-agent]   files : ${fs.join(' ')}`));
    if (bash.length) console.log(rc(`[run-agent]   bash  : ${bash.join(', ')}`));
    if (gitc.length) console.log(rc(`[run-agent]   git   : ${gitc.join(', ')} (read-only)`));
  } else {
    console.log(rc(`[run-agent] tools (${role}, DEFAULT - no tools: in agents/${role}.md):`));
    if (fs.length) console.log(rc(`[run-agent]   files : ${fs.join(' ')}`));
    if (bash.length) console.log(rc(`[run-agent]   bash  : ${bash.join(', ')}`));
    if (gitc.length) console.log(rc(`[run-agent]   git   : ${gitc.join(', ')} (read-only)`));
  }
  console.log(rc(`[run-agent]   git mutations: denied globally (commit/push/merge/checkout/reset/rebase)`));
}

// --- claude runner: async spawn + heartbeat "working Ns" + log capture ---
// print-mode output is silent until done; the timer line proves liveness.
// Full CLI output lands in .pipeline-last-run.log (repo root) for inspection.
function runClaudeLive(argv, env, prompt) {
  return new Promise((resolve) => {
    const logPath = path.join(root, '.pipeline-last-run.log');
    const logFd = openSync(logPath, 'w');
    const p = spawn('claude', argv, { cwd: process.cwd(), env, stdio: ['pipe', logFd, logFd] });
    p.stdin.write(prompt);
    p.stdin.end();
    const HOP_TIMEOUT = parseInt(process.env.PIPELINE_HOP_TIMEOUT || '900', 10) * 1000;
    let done = false;
    p.on('exit', () => { done = true; });
    const hb = setInterval(() => {
      // kill-switch: create .pipeline-stop in the repo root -> this hop is
      // terminated within 3s. No more hunting orphan processes by hand.
      if (existsSync(path.join(root, '.pipeline-stop'))) {
        done = true;
        p.kill('SIGKILL');
        try { rmSync(path.join(root, '.pipeline-stop')); } catch {}
        clearInterval(hb);
        closeSync(logFd);
        console.error(`\n[run-agent] KILLED by .pipeline-stop (kill-switch used on ${role})`);
        resolve(130);
        return;
      }
      if (!done && Date.now() - T0 > HOP_TIMEOUT) {
        done = true;
        p.kill('SIGKILL');
        clearInterval(hb);
        closeSync(logFd);
        console.error(`\n[run-agent] HOP TIMEOUT (${HOP_TIMEOUT / 1000}s) - killed ${role}. Raise PIPELINE_HOP_TIMEOUT if the role needs longer.`);
        resolve(124);
        return;
      }
      if (!done) process.stdout.write(`\r${ROLE_COLOR[role] || ''}[run-agent] ${role}  ${model}  working ${Math.round((Date.now() - T0) / 1000)}s${RESET}   `);
    }, 3000);
    p.on('exit', (code) => {
      clearInterval(hb);
      closeSync(logFd);
      process.stdout.write('\n');
      resolve(code);
    });
    p.on('error', (e) => {
      clearInterval(hb);
      closeSync(logFd);
      console.error(`[run-agent] spawn failed: ${e.message}`);
      resolve(-1);
    });
  });
}
const runIsAsync = cli === 'claude';

const RID = process.env.PIPELINE_RUN_ID || null;
if (RID) {
  const cwdNow = process.cwd();
  let branch = '';
  try { branch = spawnSync('git', ['branch', '--show-current'], { cwd: cwdNow }).stdout.toString().trim(); } catch {}
  ev(RID, { event: 'hop_start', role, model, cwd: cwdNow, branch });
  promptSnap(RID, role, prompt);
}
const T0 = Date.now();
console.log(rc('[run-agent] waiting for claude (output also in .pipeline-last-run.log)'));
// priority: -o > auto-name from -i (freshest) > env (falls back; stale env must
// never beat the auto name derived from the current input)
if (runIsAsync) {
  const code = await runClaudeLive(argv, env, prompt);
  if (RID) {
    snap(RID, out);
    ev(RID, { event: 'hop_end', role, model, cwd: cwdNow, branch, exit: code ?? 1, duration_ms: Date.now() - T0, artifact: (out && existsSync(out)) ? out : null, note: (code === 130) ? 'kill-switch' : (code === 124 ? 'timeout' : undefined) });
  }
  if (code === -1) process.exit(2);
  if (code !== 0) exit(code ?? 1, `[run-agent] CLI exited ${code} (log: .pipeline-last-run.log)`);
} else {
  const r = spawnSync(cli, argv, { cwd: process.cwd(), env, stdio: 'inherit', timeout: 10 * 60_000 });
  if (r.error) exit(2, `spawn failed: ${r.error.message}`);
  if (r.status !== 0) exit(r.status ?? 1, `[run-agent] CLI exited ${r.status}`);
}

if (out) {
  const abs = path.join(root, out);
  if (!existsSync(path.join(process.cwd(), out))) exit(2, `machine gate: expected artifact missing: ${out}`);
  console.log(rc(`[run-agent] artifact ok: ${out}`));
}
console.log(rc(`[run-agent] role=${role} model=${model} done`));
