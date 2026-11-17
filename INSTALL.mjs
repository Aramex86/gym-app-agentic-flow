// INSTALL.mjs — copy the factory into a target project.
// Usage: node <kit>/INSTALL.mjs <project-path> [--name "My Project"]
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

(async () => {
  const target = path.resolve(process.argv[2] || '');
  if (!target || !existsSync(target)) { console.error('usage: node INSTALL.mjs <project-path>'); process.exit(2); }
  const kit = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  const ask = async (q, dflt) => {
    if (stdin.readableEnded) return dflt;
    const rl = readline.createInterface({ input: stdin, output: stdout });
    try { const a = (await rl.question(q)).trim(); return a || dflt; } finally { rl.close(); }
  };
  const name = await ask('project name (for docs banners): ', path.basename(target));
  console.log(`[INSTALL] target: ${target}`);
  for (const dir of ['scripts','agents','docs']) {
    mkdirSync(path.join(target, dir), { recursive: true });
    cpSync(path.join(kit, dir), path.join(target, dir), { recursive: true });
  }
  for (const f of ['AGENTS.md','agents-pipeline.yaml','agents-pipeline.copilot.yaml','.mcp.json','mcp/mcp.json','README-INSTALL.md','factory-roadmap.md']) {
    const src = path.join(kit, f);
    if (existsSync(src)) cpSync(src, path.join(target, f));
  }
  const gi = path.join(target, '.gitignore');
  const block = ['\.pipeline/','work/','probe*.json','run-agent.bak.mjs','run-agent-patched.mjs'].join('\n') + '\n';
  if (!existsSync(gi)) writeFileSync(gi, block);
  else {
    const cur = readFileSync(gi, 'utf8');
    if (!cur.includes('run-agent.bak.mjs')) appendFileSync(gi, block);
  }
  if (!existsSync(path.join(target, 'factory-roadmap.md'))) {
    copy: cpSync(path.join(kit,'factory-roadmap.md'), path.join(target,'factory-roadmap.md'));
  }
  if (!existsSync(path.join(target, '.env'))) {
    writeFileSync(path.join(target, '.env'), [
      '# rail switch: claude (Rail #1 $-billing) | copilot (Rail #2 premium)',
      'PIPELINE_CLI=claude',
      '# rail #1 (Ollama Cloud):',
      'OLLAMA_BASE_URL=https://ollama.com/',
      'OLLAMA_API_KEY=',
      '# board door (optional; Notion integration token, env-only):',
      'NOTION_KEY=',
      'NOTION_INTEGRATION_TOKEN=',
      '', '' ].join('\n'));
    console.log('[INSTALL] .env sample written - FILL SECRETS BY HAND, never commit it');
  }
  console.log(`[INSTALL] done: ${name}`);
  console.log('[INSTALL] next: fill .env -> pnpm flow tasks\<x\>.md');
})();
