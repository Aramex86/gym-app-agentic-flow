#!/usr/bin/env node
/**
 * notion-door.mjs — the ONLY board writer besides the human.
 *
 * Modes:
 *   node scripts/notion-door.mjs notion:<card-id>   → take card by id
 *   node scripts/notion-door.mjs --id <card-id>     → same, explicit flag
 *   node scripts/notion-door.mjs --next             → FIFO first To Do card
 *   node scripts/notion-door.mjs --dry notion:<id>  → resolve, no status move
 *
 * Output contract (parsed by flow.mjs):
 *   door resolved: <relative path to tasks file>

 * LAWS:
 * - Board status moves ONLY here (door) or by the human. Agents never.
 * - Token from env NOTION_INTEGRATION_TOKEN only, never in files.
 * - Card Description is authoritative content (GOAL/SCOPE/BEHAVIOR).
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// .env is the single source of truth: load once, system env wins.
for (const line of (existsSync(join(process.cwd(), '.env'))
  ? readFileSync(join(process.cwd(), '.env'), 'utf8').split(/\r?\n/)
: [])) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && m[1] !== '' && process.env[m[1]] === undefined)
    process.env[m[1]] = m[2].replace(/^[\"']|[\"']$/g, '').trim();
}

const DB_ID = '2029eadc-774a-4f0b-9f7d-7bfdd9f84b2e';
const TOKEN = process.env.NOTION_INTEGRATION_TOKEN || '';
const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

function die(msg) {
  console.error(`door failed: ${msg}`);
  process.exit(1);
}

async function notion(path, method, body) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-json */ }
  if (!res.ok) {
    if (res.status === 401) die('notion unauthorized: API token is invalid');
    die(`notion API ${res.status}: ${text.slice(0, 300)}`);
  }
  return json;
}

/** case-insensitive property lookup by name */
function findProp(props, ...names) {
  const lower = names.map((n) => n.toLowerCase());
  for (const [key, value] of Object.entries(props)) {
    if (lower.includes(key.toLowerCase())) return value;
  }
  return null;
}

function richText(v) {
  if (!v) return '';
  const arr = v.rich_text || v.title || [];
  return arr.map((x) => x.plain_text || '').join('');
}

function statusName(props) {
  const v = findProp(props, 'status', 'state');
  if (!v) return '';
  return v.status ? v.status.name : (v.select ? v.select.name : '');
}

function riskName(props) {
  const v = findProp(props, 'risk');
  return v && v.select ? v.select.name : '';
}

function slugify(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

async function queryDatabase(filter = null) {
  return notion(`/databases/${DB_ID}/query`, 'POST', {
    page_size: 50,
    ...(filter ? { filter } : {}),
  });
}

async function setInProgress(pageId, current, props = {}) {
  if (current.toLowerCase().includes('progress')) {
    console.log('door: card already In Progress');
    return;
  }
  // Status may be type status OR select depending on the board schema
  const statusKind = props['Status'] && props['Status'].type === 'status' ? 'status' : 'select';
  await notion(`/pages/${pageId}`, 'PATCH', {
    properties: { Status: { [statusKind]: { name: 'In Progress' } } },
  });
  console.log('door: card -> In Progress');
}

function writeTaskFile(card) {
  const props = card.properties;
  const title = richText(findProp(props, 'task', 'title', 'name') || {}) || 'unnamed-task';
  const desc = richText(findProp(props, 'description', 'desc', 'notes') || {});
  const risk = riskName(props);
  const slug = slugify(title);
  const relPath = join('tasks', `${slug}.md`);

  const lines = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`Source: Notion door · card ${card.id} · risk: ${risk || 'n/a'}`);
  lines.push('');
  if (desc.trim()) {
    lines.push(desc.trim());
  } else {
    lines.push('_(card body is empty — ask the human for scope before planning)_');
  }
  lines.push('');

  writeFileSync(relPath, lines.join('\n'), 'utf8');
  return relPath;
}

async function main() {
  if (!TOKEN) die('NOTION_INTEGRATION_TOKEN not set (env only, never in files)');
  const argv = process.argv.slice(2);
  const dry = argv.includes('--dry');
  const args = argv.filter((a) => a !== '--dry');

  let pageId = null;
  let mode = 'id';

  if (args[0] && args[0].startsWith('notion:')) {
    pageId = args[0].slice('notion:'.length);
  } else if (args[0] === '--next') {
    mode = 'next';
  } else if (args[0] === '--id' && args[1]) {
    pageId = args[1];
  } else if (args[0] && /^[0-9a-f-]{32,36}$/i.test(args[0])) {
    pageId = args[0];
  } else {
    die('usage: notion:<card-id> | --id <card-id> | --next [--dry]');
  }

  let card = null;
  if (mode === 'next') {
    const data = await queryDatabase();
    const todo = data.results.find((r) => statusName(r.properties) === 'To Do');
    if (!todo) die('no To Do cards for FIFO');
    card = todo;
    console.log(`door: FIFO first = ${richText((findProp(card.properties, 'task', 'title', 'name') || {}))}`);
  } else {
    // accept both dashed and undashed uuid forms
    if (!pageId.includes('-') && pageId.length === 32) {
      pageId = `${pageId.slice(0, 8)}-${pageId.slice(8, 12)}-${pageId.slice(12, 16)}-${pageId.slice(16, 20)}-${pageId.slice(20)}`;
    }
    card = await notion(`/pages/${pageId}`, 'GET');
  }

  const props = card.properties;
  const title = richText(findProp(props, 'task', 'title', 'name') || {});
  const status = statusName(props);
  console.log(`door: card = "${title}" (${status || 'no status'})`);

  const relPath = writeTaskFile(card);

  if (!dry) {
    await setInProgress(card.id, status, props);
  } else {
    console.log('door: dry — status untouched');
  }

  // Contract line for flow.mjs — the last stdout line
  console.log(`door resolved: ${relPath.replace(/\\/g, '/')}`);
}

main().catch((e) => die(e.message || String(e)));
