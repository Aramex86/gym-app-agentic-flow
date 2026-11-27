// scripts/tool-journal.mjs — TOOL AUDIT JOURNAL (master 27.11, Phase-4 2.8).
// Post-hop transcript -> rows of tool calls (allowed/error) in tools.jsonl.
// Pure function at the agreed seam:
//   auditTools(rows, opts) -> { rows, summary }
// Two adapters: the CLI parses a real JSONL transcript; tests pass literal
// rows. Zero deps. No secrets: error rows carry only tool_use_id + tool.

/** Redact anything that looks like a key/token from a logged input. */
const redact = (v) => {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      out[k] = /key|token|secret|password|auth/i.test(k) ? "[redacted]" : redact(val);
    }
    return out;
  }
  return v;
};
const brief = (v, n = 240) => {
  const s = JSON.stringify(redact(v));
  return s.length > n ? s.slice(0, n) + "…" : s;
};

export function auditTools(rows, opts = {}) {
  const out = [];
  const byId = new Map();
  for (const r of rows || []) {
    const content = r?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const item of content) {
      if (!item || typeof item !== "object") continue;
      if (item.type === "tool_use" && item.id) {
        byId.set(item.id, item.name || "?");
        out.push({
          kind: "allowed",
          tool: item.name || "?",
          tool_use_id: item.id,
          input: brief(item.input),
          role: opts.role || "?",
          at: r.timestamp || null,
        });
      } else if (item.type === "tool_result" && item.tool_use_id) {
        if (item.is_error) {
          out.push({
            kind: "error",
            tool: byId.get(item.tool_use_id) || "?",
            tool_use_id: item.tool_use_id,
            role: opts.role || "?",
            at: r.timestamp || null,
          });
        }
      }
    }
  }
  const allowed = out.filter((x) => x.kind === "allowed").length;
  const errors = out.filter((x) => x.kind === "error").length;
  const byTool = {};
  for (const x of out) byTool[x.tool] = (byTool[x.tool] || 0) + 1;
  return { rows: out, summary: { allowed, errors, byTool } };
}

/** CLI adapter: node scripts/tool-journal.mjs <transcript.jsonl> <out.jsonl> */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function journalFromTranscript(text, opts = {}) {
  const rows = String(text || "").split("\n").map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
  return auditTools(rows, opts);
}

/** Append journal rows into a run folder (one tools.jsonl per run). */
export function appendJournal(runDir, rows) {
  if (!rows.length) return 0;
  const p = `${String(runDir).replace(/[\\/]+$/, "")}/tools.jsonl`;
  const body = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
  if (existsSync(p)) appendFileSync(p, body);
  else writeFileSync(p, body);
  return rows.length;
}

const thisFile = fileURLToPath(import.meta.url);
const invoked = process.argv[1] && process.argv[1].replace(/\\/g, "/").toLowerCase() === thisFile.replace(/\\/g, "/").toLowerCase();
if (invoked) {
  const [inp, out] = process.argv.slice(2);
  if (!inp || !out) { console.error("usage: node scripts/tool-journal.mjs <transcript.jsonl> <out.jsonl>"); process.exit(3); }
  try {
    const result = journalFromTranscript(readFileSync(inp, "utf8"), { role: process.env.TOOL_JOURNAL_ROLE || "?" });
    const body = result.rows.map((r) => JSON.stringify(r)).join("\n");
    writeFileSync(out, body ? body + "\n" : "");
    console.log(`tool-journal: ${result.summary.allowed} allowed · ${result.summary.errors} error · ${result.rows.length} rows → ${out}`);
  } catch (e) {
    console.error("tool-journal failed: " + (e && e.message || e));
    process.exit(1);
  }
}
