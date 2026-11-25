// scripts/run-agent.mjs  role router for the multi-agent pipeline.
// Resolution (ADR-0008): RUN_MODEL env > role frontmatter model > pipeline.yaml table.
// (rail #2 Copilot: > copilot-table agents-pipeline.copilot.yaml > built-in defaults)
// Spawn: chosen CLI (env PIPELINE_CLI = claude | copilot — ADR-0002) headless in cwd.
// Rail #2 (copilot, 2026-11-17 combat probe): copilot -p OK --silent id=claude-sonnet-5.5
//   billing = premium requests; telemetry via --usage-output-file -> hop_usage.
// Key safety: never prints OLLAMA_API_KEY (the token rides env, never logged).
// No npm dependencies. Node >= 20.

import { readFileSync, existsSync, openSync, closeSync, rmSync, mkdirSync } from 'node:fs';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadEnv } from './env.mjs';
import { getProfile } from './profile.mjs';
import { ev, snap, promptSnap, hopTail, reportDigest, readLatestUsage } from './trace.mjs';
loadEnv();    // reads repo .env (PIPELINE_CLI, OLLAMA_*, RUN_MODEL)  system env wins

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exit = (code, msg) => { if (msg) console.error(msg); process.exit(code); };

// --- load routing table (agents-pipeline.yaml, flat "role: model" under "roles:") ---
function routingTableFrom(cfg) {
  if (!existsSync(cfg)) exit(3, `config error: ${cfg} not found`);
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
function routingTable() {
  return routingTableFrom(path.join(root, 'agents-pipeline.yaml'));
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


// --- rail #2: copilot model table (agents-pipeline.copilot.yaml, same flat format) ---
function copilotTable() {
  const cfg = path.join(root, 'agents-pipeline.copilot.yaml');
  if (!existsSync(cfg)) return null;
  return routingTableFrom(cfg);
}
const COPILOT_DEFAULTS = {
  planner: 'claude-opus-5.5',         // long context for plans (1M on Medium?1M)
  developer: 'gpt-5.3-codex',         // code specialist
  tester: 'claude-sonnet-5.5',        // verified hop id (probe #1, combat)
  committer: 'claude-haiku-5.5',      // mechanical, cheap
};

// --- resolve model ---
// role colors (ANSI): planner=green, developer=dark orange, tester=cyan
const RESET = '\x1b[0m';
const ROLE_COLOR = { planner: '\x1b[32m', developer: '\x1b[38;5;208m', tester: '\x1b[36m', committer: '\x1b[35m' };
// QUIP BANK (night idea 18.11, вшито 19.11 после правок юзера = «как есть»):
// light second slot under the spinner; rotates ~7s; lives ONLY while the
// hop is alive; gates keep dry facts. Data (tail/timer) untouched.
const QUIPS = {
  planner:   ['consulting the magic 8-ball', 'drawing the blueprint', 'reading the future in a task card'],
  developer: ['forging the hammer', 'untangling spaghetti', 'borrowing code from the future', 'convincing the compiler (it is not listening)'],
  tester:    ['poking the bear', 'counting green checkmarks', 'trust nothing, verify everything'],
  committer: ['stamping papers', 'cleaning fingerprints off the repo'],
};
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
// ADR-0002 #1: the unwalled `opencode` rail is REMOVED from the factory
// default - the default is `claude` (walled). opencode stays as an explicit
// opt-in rail; unknown rails die with a config error (honest, not silent).
if (!process.env.PIPELINE_CLI) process.env.PIPELINE_CLI = 'claude';
const cliEarly = process.env.PIPELINE_CLI;
const table = cliEarly === 'copilot' ? (copilotTable() || COPILOT_DEFAULTS) : routingTable();
// FIX 17.11: agents/<role>.md frontmatter `model:` is a RAIL #1 fact
// (deepseek/glm ids live on Ollama). On rail #2 the contract model must
// LOSE to the copilot table - otherwise copilot gets "glm-5.3-flash"
// and dies on an unknown id (first combat hop caught exactly this).
const model = process.env.RUN_MODEL
  || (cliEarly === 'copilot' ? null : contractModel(role))
  || table[role]
  || exit(3, `config error: no model for role "${role}" (rail: ${cliEarly})`);

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

// mkdir law (17.11): fresh worktrees lack docs/plans ( artifacts are untracked )
// -> pre-create the artifact directory before the hop spawns (combat: plan fell into session-state)
if (out) {
  try { mkdirSync(path.dirname(path.join(process.cwd(), out)), { recursive: true }); } catch {}
}const prompt = `${getRoleFile(role)}\n\nCONTEXT:\n${ctx}${inFileTxt}${outDirective}`;

// --- spawn CLI ---
const cli = process.env.PIPELINE_CLI; // ADR-0002: default set above (claude); no silent opencode
// claude: prompt rides on STDIN (argv only flags) -> multi-line, dash-proof,
// immune to the ~8k Windows cmdline limit.
// copilot (COMBAT 17.11): stdin transport DEAD - the CLI answers
// "No prompt provided. Run in an interactive terminal or provide a prompt
// with -p or via standard in." while -p is present and stdin is piped.
// -> rail #2 default = ARGV mode (prompt on -p, Windows ~8k limit applies;
//    honest-stop guard below). PIPELINE_COPILOT_PROMPT_MODE=stdin is kept
//    as opt-in for future CLI builds.
const useStdin = cli === 'claude' || cli === 'copilot';
const mcpConfigRaw = process.env.PIPELINE_MCP_CONFIG || path.join(root, '.mcp.json');
const mcpConfigPath = existsSync(mcpConfigRaw) ? path.resolve(mcpConfigRaw) : null;
const mcpMode = mcpConfigPath ? ['--mcp-config', mcpConfigPath] : [];

// copilot tool rules: claude grammar -> copilot grammar (probe: id kebab,
// rules like shell(npm:*) per CLI help; file tools read/edit/write).
function copilotToolList(role, allowedToolsRaw) {
  return allowedToolsRaw.split(',').map((raw) => raw.trim()).filter(Boolean)
    .map((x) => {
      const b = x.match(/^Bash\((.+)\)$/);
      if (b) return 'shell(' + b[1] + ')';        // Bash(pnpm:*)->shell(pnpm:*)
      const l = x.toLowerCase();
      if (l === 'read') return 'read';
      if (l === 'edit') return 'edit';
      if (l === 'write') return 'write';
      return null;                                 // Grep/Glob/Web* -> rail-2 backlog
    }).filter(Boolean);
}
// GLOBAL deny for EVERY role on rail #2 (same law as claude DENY); colon-star
// exact-syntax verified against help "shell(git:*)".
function copilotDenyList() {
  return ['shell(git commit:*)', 'shell(git push:*)', 'shell(git merge:*)',
          'shell(git checkout:*)', 'shell(git reset:*)', 'shell(git rebase:*)'];
}
function mcpMode2() {
  return mcpConfigPath ? ['--additional-mcp-config', mcpConfigPath] : [];
}

const cmds = {
  // ADR-0002 conseq.: a rail without a tool wall does not ship. The
  // unwalled `opencode` rail is DELETED (config error if requested).
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
  // RAIL #2 (copilot CLI v1.0.112): headless batch; prompt via stdin;
  // budget = --max-ai-credits (env override) + engine HOP_TIMEOUT/kill-switch;
  // built-in github MCP disabled (hops are local); repo .mcp.json joins via
  // --additional-mcp-config (no trustedFolders law); telemetry JSON captured.
  copilot: [
    '-p',   // prompt rides on stdin (see useStdin note; argv mode flips below)
    '--model', model,
    '--silent',                      // stdout = agent text only (verdict law)
    '--no-custom-instructions',      // AGENTS.md auto-load OFF: contracts flow by file
    '--disable-builtin-mcps',        // no built-in github MCP on hops
    '--allow-tool',   // filled per-role below (contractTools -> copilot grammar)
    '--deny-tool', ...(copilotDenyList()),
    '--usage-output-file', path.join(process.cwd(), '.pipeline-last-usage.json'),
    ...(process.env.PIPELINE_MAX_AI_CREDITS ? ['--max-ai-credits', process.env.PIPELINE_MAX_AI_CREDITS] : []),
    ...mcpMode2(),                   // --additional-mcp-config <abs .mcp.json>
  ],
  claude: ['-p', '--model', model,
    // budget cap: each hop gets a finite number of agentic turns (each turn
    // ~= one model call + tools). Override via PIPELINE_MAX_TURNS env.
    '--max-turns', String(parseInt(process.env.PIPELINE_MAX_TURNS || '60', 10)),
    '--allowedTools', 'Read,Edit,Write,Bash(pnpm:*),Bash(git status:*),Bash(git diff:*),Bash(git log:*)',
    ...(process.env.PIPELINE_OUT_FORMAT === 'json' ? ['--output-format', 'json'] : []),
    ...mcpMode],   // -p = print mode; prompt rides on stdin
};
// MCP: repos declare servers in an .mcp.json (or custom path via env) - passed
// to the CLI; ABSOLUTE path required (hops run in sandbox worktree cwds).
// Role gates which MCP tools may be called via the SAME tools: frontmatter.
const argv = cmds[cli] || exit(3, `config error: unknown PIPELINE_CLI "${cli}" — rails: claude | copilot (ADR-0002)`);
// rail #2 argv transport: protect against silent cmd.exe truncation
// v6: direct copilot.exe spawn -> CreateProcess limit ~32k (cmd.exe 8k gone)
if (cli === 'copilot' && prompt.length > 30000) {
  exit(3, `rail 2: prompt too long for argv transport (${prompt.length} chars; CreateProcess limit ~32k). Split the task/context or add a plan file instead of a big inline input.`);
}
// copilot prompt-mode: stdin (default) vs argv (escape hatch if the CLI build
// rejects a value-less -p). In argv mode the prompt joins -p on the cmdline:
// safe for small contracts only (Windows ~8k limit).
if (cli === 'copilot' && (process.env.PIPELINE_COPILOT_PROMPT_MODE || 'argv') === 'argv') {
  const i = argv.indexOf('-p');
  argv.splice(i, 1, '-p', prompt);
}
// insert --allowedTools (per-role or default) and global --disallowedTools
const roleTools = contractTools(role);
const DEFAULT_TOOLS = 'Read,Edit,Write,Bash(pnpm:*),Bash(git status:*),Bash(git diff:*),Bash(git log:*)';
// PASPORT-DRIVEN TOOLS (1.2): role tool tokens written in the pnpm world
// are rewritten to the project's own PM run-style from the passport;
// pnpm world unchanged (identity), npm/yarn projects get their grammar.
function rewriteTools(tools, profile) {
  if (!tools || !profile || profile.package_manager === 'pnpm') return tools;
  const pm = profile.package_manager;
  const bin = (profile.install || '').split(/\s+/)[0] || pm;
  const out = tools.split(',').map((raw) => {
    const b = raw.trim().match(/^(Bash\()pnpm\s*:\*(\))$/);
    if (b) return `${b[1]}${pm}:${b[2]}`;               // Bash(pnpm:*) -> Bash(uv:*)
    const s = raw.trim().match(/^(Bash\()pnpm (lint|typecheck|test|build):\*(\))$/);
    if (s) {
      const cmd = profile[s[2]] && profile[s[2]] !== 'unknown' && !String(profile[s[2]]).startsWith('pnpm')
        ? profile[s[2]] : `${pm} run ${s[2]}`;
      const word = String(cmd).split(/\s+/)[0];
      // uv-family runs real tools through the PM runner: `uv run pytest ...`
      const runPrefix = /^(uv|poetry|pip)$/.test(bin) && !/^pnpm|^UNKNOWN/i.test(String(cmd))
        ? `,Bash(${bin} run ${word}:*)` : '';
      return `${s[1]}${cmd}:\*${s[3]}${runPrefix}`;      // Bash(pnpm test:*) -> Bash(pytest:*),Bash(uv run pytest:*)
    }
    return raw.trim();
  }).join(',');
  return out;
}
const allowedTools = rewriteTools(roleTools || DEFAULT_TOOLS, getProfile(process.cwd()));
const DENY = 'Bash(git commit:*),Bash(git push:*),Bash(git merge:*),Bash(git checkout:*),Bash(git reset:*),Bash(git rebase:*)';
if (cli === 'claude') {
  const i = argv.indexOf('--allowedTools');
  if (i !== -1) argv[i + 1] = allowedTools;
  argv.push('--disallowedTools', DENY);
}
if (cli === 'copilot') {
  // rebuild --allow-tool list from the role's frontmatter (fresh, not defaults)
  const list = copilotToolList(role, allowedTools);
  const a = argv.indexOf('--allow-tool');
  if (a !== -1) {
    let end = a + 1;
    while (end < argv.length && !/-{2}/.test(argv[end])) end++;
    argv.splice(a, end - a, '--allow-tool', ...list);
  }
}
const envs = {
  copilot: {},   // auth lives in the CLI login state (copilot login / browser); no tokens here
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
// SECRETS-PRESENCE LAW (ADR-0007 #2): a hop that needs a secret stops
// honestly BEFORE spawning - never a confusing provider 401.
if (cli === 'claude' && !process.env.OLLAMA_API_KEY)
  exit(3, 'missing secret: OLLAMA_API_KEY is not set (.env / shell). ' +
    'A rail-#1 hop without it would die as a provider 401 - honest stop instead (ADR-0007).');
if (cli === 'claude') env.ANTHROPIC_AUTH_TOKEN = process.env.OLLAMA_API_KEY;

const printable = `${cli} ${argv.join(' ').slice(0, 120)}... [model=${model}]`;
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
const LOG_PATH = path.join(process.cwd(), '.pipeline-last-run.log');

function runClaudeLive(argv, env, prompt) {
  return new Promise((resolve) => {
    const logFd = openSync(LOG_PATH, 'w');
    // Windows v6 (combat 17.11): copilot.exe is a REAL binary (VS Code shim
    // at Copilot CLI path), so spawn it DIRECTLY - no cmd.exe wrapper.
    // cmd.exe broke multiline argv at newlines (hop #1 hang, probe #4 proof);
    // CreateProcess handles multiline args and ~32k cmdline limit.
    const binName = (cli === 'copilot') ? 'copilot' : 'claude';
    const binArgs = argv;
    // Tier-1 phase banner: one line per hop, role-colored, states rail+cwd
    console.log(`${ROLE_COLOR[role] || ''}[run-agent] \u25b6 ${role.toUpperCase()} \u00b7 ${model} \u00b7 rail ${cli} \u00b7 ${path.basename(process.cwd())}${RESET}`);
    const p = spawn(binName, binArgs, { cwd: process.cwd(), env, stdio: ['pipe', logFd, logFd] });
    if (cli !== 'copilot' || process.env.PIPELINE_COPILOT_PROMPT_MODE === 'stdin') {
      p.stdin.write(prompt);
      p.stdin.end();
    } else {
      // stdin.close v5 (combat 17.11): with -p on argv we still OPENED the
      // stdin pipe and never closed it -> copilot saw a piped stdin without
      // EOF and blocked forever (probe #1 worked because PowerShell's pipe
      // closed itself). Closing the pipe sends EOF immediately.
      p.stdin.end();
    }
    const HOP_TIMEOUT = parseInt(process.env.PIPELINE_HOP_TIMEOUT || '900', 10) * 1000;
    let done = false;
    p.on('exit', () => { done = true; });
    let quietStarted = false;
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
        const TTYOUT = process.stdout.isTTY === true;
      if (!TTYOUT) {
        // SANDBOX-UNIVERSAL SPINNER LAW: redraws only on a real TTY. In pipes,
        // CI logs, captured consoles - no \r redraws are possible, so the
        // curtain is banned: one start line, then silence until the exit line.
        if (!quietStarted) {
          quietStarted = true;
          process.stdout.write(`[run-agent] waiting for claude (role ${role}) ...\n`);
        }
        return;
      }
      if (!done) {
        // Tier-1 render: spinner frames + short last-activity tail
        const frames = ['\u25d1','\u25d2','\u25d3','\u25cc','\u25d0','\u25ce'];
        const f = frames[Math.floor((Date.now() - T0) / 400) % frames.length];
        let tail = '';
        try {
          const txt = readFileSync(LOG_PATH, 'utf8').slice(-3000);
          const ls = txt.split('\\r\\n').join('\n').split('\n').filter((x) => x.trim());
          // round-10: provider spam ([claude-code:*]) is NOT activity - skip
          // it; show the last REAL line (tool_use, output, artifacts)
          const activity = ls.filter((x) => !/^\[claude-code:/.test(x.trim()));
          if (activity.length) tail = activity[activity.length - 1].replace(/\x1b\[[0-9;]*m/g, '').slice(0, 58);
          else if (ls.length) tail = 'working - no model activity yet';
        } catch {}
        const eta = Math.round((Date.now() - T0) / 1000);
        // quip slot: SAME line as spinner/tail (single-line render, zero
        // jumping - the 19.11 win32 two-line artifact is banned). Rotation
        // ~7s, lives only while the hop is alive; tail trims to fit width.
        const bank = QUIPS[role];
        const quip = bank && bank.length ? bank[Math.floor((Date.now() - T0) / 7000) % bank.length] : '';
        const width = (process.stdout.columns || 80) - 2;
        const tailBudget = Math.max(16, width - `[run-agent] x ${role} ${eta}s `.length - (quip ? ` | quip: "${quip}"`.length : 0) - 4);
        const tailShort = tail ? tail.slice(0, tailBudget) : '';
        process.stdout.write(`\r${ROLE_COLOR[role] || ''}[run-agent] ${f} ${role} ${eta}s ${tailShort ? '\u2502 last: ' + tailShort : ''}${quip ? ` \u2502 quip: "${quip}"` : ''}${RESET}\u0020\u0020\u0020\x1b[K`);
      }
    }, 700);
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
const runIsAsync = cli === 'claude' || cli === 'copilot';

let RID = process.env.PIPELINE_RUN_ID || null;
if (!RID) {
  // direct `pnpm agent` hop: mint a standalone run so telemetry/trace work too
  try { RID = await import('./trace.mjs').then((m) => m.newRun('direct-' + role)); } catch { RID = null; }
}
const cwdNow = process.cwd();
let branch = '';
try { branch = spawnSync('git', ['branch', '--show-current'], { cwd: cwdNow }).stdout.toString().trim(); } catch {}
if (RID) {
  ev(RID, { event: 'hop_start', role, model, cwd: cwdNow, branch });
  promptSnap(RID, role, prompt);
}
const T0 = Date.now();
console.log(rc(`[run-agent] waiting for ${cli} (output also in .pipeline-last-run.log)`));
// priority: -o > auto-name from -i (freshest) > env (falls back; stale env must
// never beat the auto name derived from the current input)
if (runIsAsync) {
  const code = await runClaudeLive(argv, env, prompt);
  if (RID) {
    snap(RID, out);
    ev(RID, { event: 'hop_end', role, model, cwd: cwdNow, branch, exit: code ?? 1, duration_ms: Date.now() - T0, artifact: (out && existsSync(out)) ? out : null, note: (code === 130) ? 'kill-switch' : (code === 124 ? 'timeout' : undefined) });
    hopTail(RID, role, LOG_PATH);                                   // v3: keep stdout tail for forensics
    // KNOWLEDGE GAP WRITER (board 21.11, round-8 R7-2): the reader side (doctor/
    // adlc) shipped before the writer. Hops flag gaps by writing lines
    // "KNOWLEDGE GAP: <what>" in their result text (role contracts say to);
    // the engine turns each into a trace event (deduped, capped at 3).
    // round-8: parses the WHOLE log - both the plain-text result (default
    // output) and any "type":"result" JSON - so the marker works with or
    // without PIPELINE_OUT_FORMAT=json.
    try {
      const txt = readFileSync(LOG_PATH, 'utf8');
      const seen = new Set();
      for (const m of txt.matchAll(/KNOWLEDGE GAP:\s*(.+)/gi)) {
        const what = m[1].toString().slice(0, 160).trim();
        const key = what.toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        ev(RID, { event: 'knowledge_gap', role, what });
        if (seen.size >= 3) break;
      }
      // round-8 D4-style honesty: keep the JSON path for the structured usage
      // read below, but never let the gap scan fail the hop.
    } catch { /* no GAP extraction is never fatal - it is a hint, not a gate */ }
    reportDigest(RID, role, out && existsSync(out) ? out : null);  // v3: gates + bug digest
    if (code === 0) {                                                // v3 token telemetry
      // Path A: stdout result JSON (--output-format json) - has usage + total_cost_usd
      let used = null;
      try {
        const txt = readFileSync(LOG_PATH, 'utf8');
        const lines = txt.split('\n').filter((l) => l.includes('"type":"result"'));
        const last = lines.length ? JSON.parse(lines[lines.length - 1]) : null;
        if (last?.usage && (last.usage.input_tokens || last.usage.output_tokens)) {
          used = { input_tokens: last.usage.input_tokens || 0, output_tokens: last.usage.output_tokens || 0, cache_read: last.usage.cache_read_input_tokens || 0, msgs: last.num_turns || 1, cost_usd: last.total_cost_usd };
          if (last.api_error_status) ev(RID, { event: 'hop_api_error', role, status: last.api_error_status });
        }
      } catch (err) { console.error('[run-agent] telemetry parse failed: ' + (err && err.message || err)); }
      // Path C: rail #2 - copilot --usage-output-file JSON (probe #1 shape)
      if (!used && cli === 'copilot') {
        try {
          const up = path.join(cwdNow, '.pipeline-last-usage.json');
          if (existsSync(up)) {
            const j = JSON.parse(readFileSync(up, 'utf8'));
            const mm = (j.modelMetrics && Object.values(j.modelMetrics)[0]) || null;
            if (mm?.usage) {
              used = { input_tokens: mm.usage.inputTokens || 0, output_tokens: mm.usage.outputTokens || 0, cache_read: mm.usage.cacheReadTokens || 0, msgs: (mm.usage.reasoningTokens || 0) ? 2 : 1, cost_usd: j.totalPremiumRequestCost };
              ev(RID, { event: 'hop_rail2_cost', role, model, premium_requests: j.totalPremiumRequestCost, nano_aiu: j.totalNanoAiu });
            }
          }
      } catch (err) { console.error('[run-agent] telemetry parse failed: ' + (err && err.message || err)); }
      }
      // Path B: transcript fallback (ccusage's own source)
      if (!used) used = readLatestUsage(cwdNow, T0 - 2000);
      if (used) {
        const u = used;
        ev(RID, { event: 'hop_usage', role, model, msgs: u.msgs, input_tokens: u.input_tokens, output_tokens: u.output_tokens, cache_read: u.cache_read, cost_usd: u.cost_usd != null ? u.cost_usd : null, source: u.cost_usd != null ? 'stdout' : 'transcript' });
        console.log(rc(`[run-agent] tokens ${role}: in ${u.input_tokens + (u.cache_read || 0)} / out ${u.output_tokens} (${u.msgs} api msgs)${u.cost_usd != null ? ' · $' + u.cost_usd.toFixed(4) : ''}`));
      }
    }
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
console.log(rc(`[run-agent] role=${role} model=${model} cli=${cli} done`));
