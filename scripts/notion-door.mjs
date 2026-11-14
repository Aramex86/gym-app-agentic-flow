// scripts/notion-door.mjs - mechanical door: ONE task card per run, no LLM.
// Modes:
//   node notion-door.mjs [--dry]         pull ONE oldest To Do card
//   node notion-door.mjs --id <page-uuid> [--dry]   resolve a card BY ID (flow: notion:<id>)
// Notion data: NOTION_INTEGRATION_TOKEN in env (never in files). NOTION_DB env optional.
// Laws: agents own To Do/In Progress; Done is human-only. Pure REST + file write.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DRY = process.argv.includes('--dry');
const idArgIdx = process.argv.indexOf('--id');
const pageIdArg = idArgIdx >= 0 ? process.argv[idArgIdx + 1] : null;
const token = process.env.NOTION_INTEGRATION_TOKEN;
if (!token) { console.error('door: NOTION_INTEGRATION_TOKEN not set (env only, never in files)'); process.exit(1); }
const db = process.env.NOTION_DB || '2029eadc-774a-4f0b-9f7d-7bfdd9f84b2e';
const H = { 'Authorization': 'Bearer ' + token, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' };
const api = async (path, opts = {}) => {
  const r = await fetch('https://api.notion.com/v1' + path, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  const j = await r.json();
  if (j.object === 'error') throw new Error(`notion ${j.code}: ${j.message}`);
  return j;
};
const text = (v) => (v?.type === 'mention' ? v.mention?.plain_text : v?.plain_text) ?? '';
const propText = (row, name) => {
  const p = row.properties?.[name];
  if (!p) return '';
  return p.type === 'title' ? p.title.map(text).join('') : p.type === 'rich_text' ? p.rich_text.map(text).join('') : p.type === 'select' ? (p.select?.name || '') : '';
};
const slugOf = (name) => ((name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'notion-card');
const bodyOf = async (pageId) => {
  try {
    const blocks = await api(`/blocks/${pageId}/children`);
    let out = '';
    for (const b of (blocks.results || [])) {
      const t = b[b.type];
      const line = t?.rich_text?.map(text).join('') ?? '';
      if (!line.trim()) continue;
      out += (b.type === 'bulleted_list_item' ? '- ' : b.type === 'numbered_list_item' ? '1. ' : '') + line + '\n';
    }
    return out;
  } catch (e) { return '(door: page body not readable: ' + e.message + ')\n'; }
};
const writeTask = (slug, md) => {
  const taskPath = join('tasks', slug + '.md');
  if (DRY) { console.log('DRY: would create ' + taskPath); return taskPath; }
  mkdirSync('tasks', { recursive: true });
  if (existsSync(taskPath)) { console.error(`door: tasks/${slug}.md already exists - skip`); return taskPath; }
  writeFileSync(taskPath, md);
  return taskPath;
};
const flip = async (pageId, lane = 'In Progress') => {
  if (DRY) { console.log('DRY: would flip card -> ' + lane); return; }
  try {
    await api(`/pages/${pageId}`, { method: 'PATCH', body: JSON.stringify({ properties: { Status: { select: { name: lane } } } }) });
    console.error('door: card -> ' + lane);
  } catch (e) { console.error('door: status flip skipped: ' + e.message); }
};

try {
  if (pageIdArg) {
    // ---- BY-ID (user says task address, door does retrieval) ----
    const page = await api(`/pages/${pageIdArg}`);
    const props = page.properties || {};
    const titleEntry = Object.entries(props).find(([, v]) => v.type === 'title') || [];
    const name = ((titleEntry[1]?.title || []).map(text).join('') || 'notion-' + pageIdArg.slice(0, 8)).replace(/\s+/g, ' ').trim();
    const slug = slugOf(name);
    const md = `TODO: ${name}\n\nSource: Notion card ${pageIdArg}\n${await bodyOf(pageIdArg)}\nAcceptance: implemented as described; gates green (lint/typecheck/test/build); tests in same commit; tokens only; no secrets.\n`;
    const taskPath = writeTask(slug, md);
    await flip(pageIdArg);
    console.log(taskPath);                       // stdout line 1/last = path for flow
    process.exit(0);
  }

  // ---- DEFAULT: pull ONE oldest To Do card ----
  const q = await api(`/databases/${db}/query`, { method: 'POST', body: JSON.stringify({ filter: { property: 'Status', select: { equals: 'To Do' } } }) });
  const todos = (q.results || []).slice().sort((a, z) => (a.created_time || '').localeCompare(z.created_time || ''));
  if (!todos.length) { console.log('door: no To Do cards - board is clear'); process.exit(0); }
  const card = todos[0];
  const name = (propText(card, 'Name') || 'notion-card').replace(/\s+/g, ' ').trim();
  const src = propText(card, 'Source'), risk = propText(card, 'Risk'), tech = propText(card, 'Tech');
  const md = `TODO: ${name}\n\nSource: Notion card ${card.id} (${new Date(card.created_time).toISOString().slice(0, 10)})\n${src ? 'Source label: ' + src + '\n' : ''}${tech ? 'Tech: ' + tech + '\n' : ''}${risk ? 'Risk note: ' + risk + '\n' : ''}\n${await bodyOf(card.id)}\nAcceptance: implemented as described; gates green (lint/typecheck/test/build); tests in same commit; tokens only; no secrets.\n`;
  const taskPath = writeTask(slugOf(name), md);
  await flip(card.id);
  console.log(taskPath);
  process.exit(0);
} catch (e) { console.error('door: ' + e.message); process.exit(1); }
