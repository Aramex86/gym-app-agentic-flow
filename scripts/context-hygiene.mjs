// scripts/context-hygiene.mjs — CONTEXT HYGIENE (Phase-4 2.6, master 27.11).
// Pure gate for the text the ENGINE feeds into a hop prompt (in-file / ctx),
// never for tool results inside the CLI (the engine cannot see those —
// pretending otherwise would be a fake module, ADR-0007 honesty).
//   offloadContent(text, opts) -> { text, offloaded, head, tail, fullChars }
// A digest keeps head+tail+OFFLOAD marker; the full body is written to an
// artifact by the adapter (run-agent) so the agent can read it on demand.

/** Honest rough proxy: ~4 chars per token for English/code. */
export function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

export function offloadContent(text, opts = {}) {
  const src = String(text ?? "");
  const maxTokens = Number(opts.maxTokens) > 0 ? Number(opts.maxTokens) : 20000;
  const fullChars = src.length;
  if (estimateTokens(src) <= maxTokens) return { text: src, offloaded: false, fullChars };
  // head+tail budget in chars = 4 * tokens; split 60/40, keep the marker small.
  const budget = Math.max(240, Math.floor(maxTokens * 4 * 0.4));
  const headChars = Math.floor(budget * 0.6);
  const tailChars = budget - headChars;
  const head = src.slice(0, headChars);
  const tail = src.slice(-tailChars);
  const label = opts.label ? ` [${opts.label}]` : "";
  const pathHint = opts.path ? `\nFULL CONTENT: ${opts.path}` : "";
  const digest = `${head}\n…[OFFLOAD${label}: ${fullChars} chars, showing head ${headChars} + tail ${tailChars}, ${estimateTokens(src)} tokens total]…\n${tail}${pathHint}`;
  return { text: digest, offloaded: true, head, tail, fullChars };
}

/** Window use = input tokens + cache_read (both occupy the context window). */
export function windowUsage(usage, opts = {}) {
  const input = Number(usage?.input_tokens) || 0;
  const cache = Number(usage?.cache_read) || 0;
  const window = Number(opts.window) > 0 ? Number(opts.window) : 200000;
  const threshold = Number(opts.threshold) > 0 ? Number(opts.threshold) : 0.9;
  const used = input + cache;
  const pct = used / window;
  return { used, pct, warn: pct >= threshold, window, threshold };
}
