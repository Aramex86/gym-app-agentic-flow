// scripts/cli-preflight.mjs — CLI PREFLIGHT LAW (master 25.11, queued 26.11 build)
// A rail without its CLI cannot run a hop. Stop BEFORE the first model token
// is spent, with ONE honest line naming the exact install command.
// Silent auto-install is DENIED (zero-network default; the human approves
// environment mutations). PIPELINE_AUTO_INSTALL_CLIS is a separate future
// decision and is deliberately NOT implemented here.

import { spawnSync } from "node:child_process";

export const CLI_INSTALL = {
  claude: "@anthropic-ai/claude-code",
  copilot: "@github/copilot-cli",
};

export function missingCliMessage(cli, detail) {
  const pkg = CLI_INSTALL[cli] || "(unknown rail)";
  return (
    `MISSING CLI: ${cli} — install: npm i -g ${pkg}` +
    (detail ? ` (${detail})` : "") +
    "\nFactory stopped before the first hop — no tokens were spent." +
    "\nRails: claude | copilot (PIPELINE_CLI; ADR-0002)."
  );
}

/** null = CLI reachable; otherwise the exact honest-stop line. */
export function checkRailCli(cli, opts = {}) {
  if (!CLI_INSTALL[cli])
    return `config error: unknown PIPELINE_CLI "${cli}" — rails: claude | copilot (ADR-0002)`;
  let r;
  try {
    // win32: node cannot spawn .cmd shims without a shell; POSIX: no shell.
    // opts.bin exists for the self-test: a known rail with a missing binary.
    r = spawnSync(opts.bin || cli, ["--version"], {
      stdio: "pipe",
      timeout: opts.timeoutMs || 15_000,
      shell: process.platform === "win32",
    });
  } catch (e) {
    return missingCliMessage(cli, String(e && e.message || e));
  }
  if (r.error) return missingCliMessage(cli, String(r.error.code || r.error.message));
  if (r.status !== 0) return missingCliMessage(cli, `exit ${r.status}`);
  return null;
}
