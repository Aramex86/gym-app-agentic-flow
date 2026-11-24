// scripts/flow.mjs - the pipeline Flow: full circle + fix loop + committer step.
// SANDBOX MODE (default): every circle runs in its own git worktree copy of
// the repo -> hops never touch your main working tree; results land on a
// dedicated feat/<name> branch in the work/ dir. Cleanup after merge:
//   node scripts/flow.mjs --cleanup <name>   (one command; Windows-proof)
// Opt-out: pnpm flow tasks\<x>.md --no-wt (run everything in main checkout).
// Usage:
//   pnpm flow tasks\<date>-<name>.md     planner->[Y]->developer->[Y]->tester->[committer Y]
//   pnpm flow:fix                        newest FAIL report -> fix rounds (max 3) -> PASS
// Plain Node. No PowerShell, no ExecutionPolicy issues.

import {
  existsSync,
  readFileSync,
  readdirSync,
  appendFileSync,
  writeFileSync,
  copyFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve, isAbsolute, basename as pathBasename } from "node:path";
import readline from "node:readline/promises";
import * as trace from "./trace.mjs";
import { getProfile } from "./profile.mjs";
import { loadEnv } from "./env.mjs";
import { guard as budgetGuard } from "./budget.mjs";
import { copyFileSync as _copy } from "node:fs"; // (also used dynamically elsewhere)
import * as changedTests from "./changed-tests.mjs";

loadEnv(); // repo .env (PIPELINE_CLI, OLLAMA_*, PIPELINE_BUDGET_USD) - system env wins

const exit = (code, msg) => {
  if (msg) console.error(msg);
  process.exit(code);
};
const isY = (s) => /^\s*y(es)?\s*$/i.test(s || "");

async function ask(question) {
  if (input.readableEnded) return ""; // EOF (piped/scripted runs) -> treat as N
  const rl = readline.createInterface({ input, output });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

const git = (args, opts = {}) =>
  spawnSync("git", args, { stdio: "pipe", ...opts });
const gitRun = (args, cwd) => spawnSync("git", args, { stdio: "inherit", cwd });

function hop(args, cwd, rid) {
  const script = join(process.cwd(), "scripts", "run-agent.mjs");
  // ADR-0006/0007 honesty: the ledger and the trace must live in ONE place.
  // Inherit the caller's PIPELINE_TRACE_BASE when set (one base, not two);
  // otherwise the repo cwd is the base.
  const base = process.env.PIPELINE_TRACE_BASE || process.cwd();
  const r = spawnSync(process.execPath, [script, ...args], {
    stdio: "inherit",
    cwd,
    env: {
      ...process.env,
      PIPELINE_RUN_ID: rid,
      PIPELINE_TRACE_BASE: base,
    },
  });
  if (r.status)
    trace.ev(rid, { event: "hop_failed", role: args[0], exit: r.status });
  return r.status ?? 1;
}

const newestReport = (dir = "docs/plans") => {
  const p = join(dir);
  if (!existsSync(p)) return null;
  const files = readdirSync(p)
    .filter((f) => f.endsWith("-report.md"))
    .map((f) => join(dir, f));
  return files[files.length - 1] ?? null;
};

const verdict = (file, cwd) => {
  // Law v3: verdict scan is WHOLE-FILE, top-down, own-line only.
  // A verdict line is SHORT (<= 48 chars: `PASS`, `FAIL`, maybe a short
  // tail like "PASS - all gates green"), so a long narrative sentence
  // containing the word FAIL ("FAILED checks: none ...") can never be
  // mistaken for a verdict. First own-line hit wins; legacy 5-line
  // word-search stays as fallback for old report shapes. Default FAIL
  // keeps the honest-stop law intact (unreadable report = not a pass).
  const lines = readFileSync(file, "utf8").split("\n");
  const own = lines
    .map((l) => l.trim())
    .find((l) => /^(PASS|FAIL)\b/.test(l) && l.length <= 48);
  if (own) return own.match(/^(PASS|FAIL)/)[1].toUpperCase();
  const head = lines.slice(0, 5).join("\n");
  return (head.match(/\b(PASS|FAIL)\b/i)?.[1] || "FAIL").toUpperCase();
};

const ROLE_COLOR = {
  planner: "\x1b[32m",
  developer: "\x1b[38;5;208m",
  tester: "\x1b[36m",
  committer: "\x1b[35m",
};
const clog = (role, text) =>
  console.log((ROLE_COLOR[role] || "") + text + "\x1b[0m");

const MAX_FIX_ROUNDS = 3;

// ---------- COMMITTER STEP ----------
// after PASS: show the copy-ready commit; on Y the TOOL runs git add+commit
// inside the sandbox (or main checkout with --no-wt). The committer role
// itself never touches git; a human Y executes it.
function parseCommitMd(text) {
  const msg = text.match(/^COMMIT MESSAGE:\s*(.+)$/m)?.[1]?.trim();
  const pr = text.match(/^PR TITLE:\s*(.+)$/m)?.[1]?.trim();
  const add = (text.match(/^ADD LIST:\n([\s\S]*?)\nPR TITLE:/m)?.[1] || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const body = (text.match(/^PR BODY:\n([\s\S]*)$/m)?.[1] || "").trim();
  return { msg, pr, add, body };
}
async function committerStep(_name, report, cwd, rid) {
  // derive the name from the report's BASENAME (the report may be passed as
  // an absolute path -> name would otherwise contain directories)
  const name = pathBasename(String(report))
    .replace(/\.md$/, "")
    .replace(/-report$/, "");
  console.log("\n===> COMMITTER (copy-ready)");
  if (hop(["committer", "-i", report], cwd, rid) !== 0) {
    console.log("(committer hop failed - commit by hand)");
    return;
  }
  const cm = `docs/plans/${name}-commit.md`;
  if (!existsSync(join(cwd, cm))) {
    console.log("(no commit artifact produced)");
    return;
  }
  const text = readFileSync(join(cwd, cm), "utf8");
  const { msg, pr, add, body } = parseCommitMd(text);
  if (!msg || !add.length) {
    console.log(text);
    console.log("(not parseable - commit by hand)");
    return;
  }
  // terminal = first source: the whole commit proposal lives HERE (the file
  // stays as trace evidence); read it, then one Y/N decides.
  console.log("\n--- COMMIT PROPOSAL (read me) ---");
  console.log("COMMIT: " + msg);
  console.log("FILES:\n  " + add.join("\n  "));
  console.log("PR TITLE: " + (pr || msg));
  if (body) console.log("\nPR BODY:\n" + body);
  if (!isY(await ask("\nAccept and commit? (Y/N): "))) {
    console.log("skipped - commit by hand");
    trace.ev(rid, { event: "gate", gate: "commit", result: "N" });
    return;
  }
  trace.ev(rid, { event: "gate", gate: "commit", result: "Y" });
  const wtRef =
    String(cwd) === process.cwd()
      ? "(--no-wt)"
      : String(cwd).replace(/\\/g, "/").startsWith("/")
        ? cwd
        : join(process.cwd(), cwd);
  const pending = git(["status", "--porcelain", ...add], { cwd })
    .stdout.toString()
    .trim();
  if (!pending) {
    console.log(
      "files already committed - nothing to commit (skipping git steps)",
    );
    return;
  }
  const a = spawnSync("git", ["add", ...add], { stdio: "inherit", cwd });
  if (a.status !== 0) exit(1, "git add failed");
  // IDENTITY LAW: the committer commits as the REPO identity, pinned
  // explicitly at the command line (-c) - enterprise rails can hijack
  // authorship via inherited/global config (17.11 combat: amend
  // --reset-author caught it). Missing identity = honest stop, never
  // invent, never inherit silently.
  const identName = git(["config", "user.name"]).stdout?.toString().trim();
  const identMail = git(["config", "user.email"]).stdout?.toString().trim();
  if (!identName || !identMail)
    exit(
      1,
      "IDENTITY LAW: set repo git config user.name + user.email before the committer (identity is pinned per commit, never inherited silently)",
    );
  const c = spawnSync(
    "git",
    [
      "-c",
      `user.name=${identName}`,
      "-c",
      `user.email=${identMail}`,
      "commit",
      "-m",
      msg,
    ],
    { stdio: "inherit", cwd },
  );
  if (c.status !== 0) exit(1, "git commit failed");
  clog("committer", `\nCommitted: ${msg}`);
  // COPY-TO-MAIN LAW: artifacts (plan/report/commit) are untracked in the
  // sandbox - removing the worktree would take them with it (the 18.11 loss).
  // The TOOL copies docs/plans back to the main checkout after the Y-commit.
  if (String(cwd) !== process.cwd()) {
    const plansSrc = join(cwd, "docs", "plans");
    if (existsSync(plansSrc)) {
      mkdirSync(join(process.cwd(), "docs", "plans"), { recursive: true });
      let n = 0;
      for (const f of readdirSync(plansSrc)) {
        copyFileSync(join(plansSrc, f), join(process.cwd(), "docs", "plans", f));
        n++;
      }
      if (n)
        console.log(`copy-to-main: ${n} docs/plans artifact(s) copied to the main checkout`);
    }
  }
  console.log("\n" + "=".repeat(60));
  console.log("FINISH (human):");
  console.log(
    "  1) git push -u origin HEAD   (or: git push origin " +
      (git(["branch", "--show-current"], { cwd }).stdout.toString().trim() ||
        "feat/<name>") +
      ")",
  );
  console.log("  2) PR: gh pr create --base develop --head feat/<name>");
  console.log("  3) review -> merge (human only)");
  console.log(
    "  4) " +
      (cwd !== process.cwd()
        ? "node scripts/flow.mjs --cleanup <name>   (one command; Windows-proof)"
        : "(no worktree in this run)"),
  );
  console.log("=".repeat(60));

  console.log(`After merge, cleanup: node scripts/flow.mjs --cleanup ${pathBasename(cwd)}`);
}

// ---------- FIX LOOP ----------
async function fixLoop(opts) {
  const cwd = opts.cwd ?? process.cwd();
  const base = resolve(cwd); // absolute from here on: no double-joins
  const inCwd = (p) => (isAbsolute(p) ? p : join(base, p));
  const rid = opts.rid;
  for (let round = 1; round <= MAX_FIX_ROUNDS; round++) {
    const report = newestReport(join(base, "docs/plans"));
    if (!report) exit(1, "no *-report.md found in docs/plans");
    const repPath = inCwd(report);
    const v = verdict(repPath);
    if (v.startsWith("PASS"))
      exit(0, `PASS already. Nothing to fix. (${report})`);

    // "uncommitted work" blocker: if the human has since committed (clean
    // tree in the sandbox) the blocker is stale -> skip dev, re-test only.
    let skipDevHop = false;
    if (
      /not committed|uncommitted|committed anywhere/i.test(
        readFileSync(repPath, "utf8"),
      )
    ) {
      const st = spawnSync("git", ["status", "--porcelain"], { cwd })
        .stdout.toString()
        .trim();
      if (st) {
        const short = spawnSync("git", ["status", "--short"], { cwd })
          .stdout.toString()
          .trim();
        console.error("\n" + "=".repeat(62));
        console.error(
          "HUMAN STEP REQUIRED - the report says the work is uncommitted.",
        );
        console.error(`(sandbox: ${cwd} on branch feat/<task>)`);
        console.error("=".repeat(62));
        console.error("Auto-fix cannot commit for you (agents never commit).");
        console.error("\nFiles waiting in the sandbox working tree:\n");
        console.error("  " + short.replace(/\n/g, "\n  "));
        console.error("\nYour move (scoped to the deliverables only):");
        console.error("   1) git add <the task files listed above>");
        console.error(
          '   2) git commit -m "feat(<task>): <what was built> (tests in same commit)"',
        );
        console.error(
          "   3) re-run:  node scripts/flow.mjs --fix   <- skips the fix hop, just re-tests",
        );
        console.error("=".repeat(62));
        process.exit(1);
      }
      skipDevHop = true;
      console.log(
        "blocker (uncommitted work) resolved by a human commit -> re-test only",
      );
    }

    if (skipDevHop) {
      const base2 = report.replace(/-report\.md$/, "");
      clog("tester", "\n===> RE-TEST");
      if (hop(["tester", "-i", `${base2}-plan.md`], cwd, rid) !== 0)
        exit(1, "tester hop failed");
      if (
        verdict(inCwd(newestReport(join(base, "docs/plans")))).startsWith(
          "PASS",
        )
      ) {
        console.log("PASS (re-test only).");
        await committerStep(base2, report, cwd, rid);
        return;
      }
      console.log("still FAIL - continuing fix rounds");
      continue;
    }

    clog("developer", `\n===> FIX round ${round} (${report})`);
    if (
      hop(
        [
          "developer",
          "-i",
          report,
          "fix ONLY the items in the bug-log of the input report (it starts with FAIL). Touch no files beyond what the bug-log names. Tests in same commit.",
        ],
        cwd,
      ) !== 0
    ) {
      exit(1, "developer fix hop failed");
    }

    const baseNm = report.replace(/-report\.md$/, "");
    clog("tester", `\n===> RE-TEST (round ${round})`);
    if (hop(["tester", "-i", `${baseNm}-plan.md`], cwd, rid) !== 0)
      exit(1, "tester hop failed");

    if (
      verdict(inCwd(newestReport(join(base, "docs/plans")))).startsWith("PASS")
    ) {
      console.log(`PASS after ${round} fix round(s).`);
      await committerStep(baseNm, report, cwd, rid);
      const rid3 = rid ?? null;
      if (rid3 && existsSync(join("scripts", "report.mjs")))
        spawnSync(process.execPath, ["scripts/report.mjs", rid3], {
          stdio: "inherit",
        });
      return;
    }
    console.log(`still FAIL after round ${round} - looping`);
  }
  exit(
    1,
    `FAIL persists after ${MAX_FIX_ROUNDS} rounds - escalate: re-plan the task manually.`,
  );
}

// ---------- SANDBOX ----------
// sandbox dirs must never be committed; add /work/ to .gitignore once
function ensureWorktreeIgnored() {
  if (!existsSync(".gitignore"))
    writeFileSync(".gitignore", "/work/\n.pipeline/\n.pipeline-last-run.log\n");
  else if (!/^\/?work\/?$/m.test(readFileSync(".gitignore", "utf8")))
    appendFileSync(".gitignore", "\n/work/\n");
}

function ensureWorktree(name) {
  const wt = join("work", name);
  git(["worktree", "prune"]);
  const wanted = ("/" + wt.replace(/[\\/]/g, "/")).replace("//", "/");
  const listed = git(["worktree", "list"])
    .stdout.toString()
    .split("\n")
    .some((l) => l.replace(/[\\/]/g, "/").includes(wanted));
  if (listed && existsSync(wt)) return wt;
  const br = `feat/${name}`;
  const base =
    git(["rev-parse", "--verify", "develop"]).status === 0 ? "develop" : "HEAD";
  // three states: reuse existing worktree; branch already exists (e.g. an
  // earlier run died after worktree add) -> re-attach WITHOUT -b; brand new.
  const hasBranch = git(["rev-parse", "--verify", br]).status === 0;
  const args = hasBranch
    ? ["worktree", "add", wt, br]
    : ["worktree", "add", wt, "-b", br, base];
  const r = gitRun(args);
  if (r.status !== 0)
    exit(1, `worktree add failed (branch ${br}, base ${base})`);
  // deps: the TOOL provisions the sandbox (junction lacks .bin - proven)
  if (!existsSync(join(wt, "node_modules", ".bin"))) {
    spawnSync("git", ["add", "-A"], { cwd: wt, stdio: "pipe" });
    spawnSync("git", ["reset", "-q", "--", "."], { cwd: wt, stdio: "pipe" });
    for (const stub of ["eslint.cmd", "tsc.cmd", "vitest.cmd", "vite.cmd"]) {
      try {
        rmSync(join(wt, stub), { force: true });
      } catch {}
    }
    console.log(`deps: ${getProfile(process.cwd()).install} in sandbox ...`);
    // passport-driven (1.2): the install command comes from the project
    // passport (docs/factory-profile.md), pnpm default otherwise.
    const installParts = (getProfile(process.cwd()).install || "").split(/\s+/);
    const pi = installParts.length
      ? spawnSync(installParts[0], installParts.slice(1), {
          cwd: wt,
          stdio: "inherit",
          shell: true,
        })
      : { status: 1, error: { code: "no-install-command" } };
    if (pi.status !== 0 || pi.error) {
      console.error(
        "FLOW STOP: pnpm install failed (" +
          (pi.error?.code || "exit " + pi.status) +
          ") - fix deps in " +
          wt +
          " by hand",
      );
      process.exit(1);
    }
  }
  return wt;
}

const [, , arg1] = process.argv;
function latestSandbox() {
  const b = join(".pipeline", "runs");
  if (!existsSync(b)) return null;
  const ids = readdirSync(b).sort();
  for (let i = ids.length - 1; i >= 0; i--) {
    const p = join(b, ids[i], "trace.jsonl");
    if (!existsSync(p)) continue;
    const lines = readFileSync(p, "utf8").split("\n").filter(Boolean);
    for (let j = lines.length - 1; j >= 0; j--) {
      try {
        const o = JSON.parse(lines[j]);
        if (o.event === "circle_start" && o.name && o.sandbox) {
          const wt = join("work", o.name);
          if (existsSync(wt)) return wt;
        }
      } catch {}
    }
  }
  return null;
}


// BUDGET CIRCUIT BREAKER (ADR-0004, queue item 4): cap = a choice via
// PIPELINE_BUDGET_USD; unset = unlimited. Set -> month-to-date spend from
// the ledger is checked BEFORE --fix and before any hop spawns; exhausted =
// honest stop with the budget sheet as the receipt.
const _bg = budgetGuard();
if (_bg)
  exit(1, "\n" + _bg + "\n(budget sheet: node scripts/budget.mjs)");
if (arg1 === "--cleanup" || arg1 === "-cleanup") {
  // ONE command to end a finished circle (Windows-proof; human runs it
  // AFTER the PR is merged). Replaces the 4-step manual dance.
  const name = argv[argv.indexOf("--cleanup") + 1];
  const workDir = join(process.cwd(), "work");
  const picked = name || (() => {
    if (!existsSync(workDir)) return null;
    const list = readdirSync(workDir).filter((d) => !d.startsWith("."));
    return list.length === 1 ? list[0] : null;
  })();
  if (!picked)
    exit(3, "--cleanup needs a sandbox name (or exactly ONE sandbox left in work/).\nusage: node scripts/flow.mjs --cleanup 2026-11-24-map-refresh");
  const wt = join(workDir, picked);
  if (existsSync(wt)) rmSync(wt, { recursive: true, force: true }); // kills node_modules/dist leftovers too
  spawnSync("git", ["worktree", "prune"], { stdio: "ignore", cwd: process.cwd() });
  const br = "feat/" + picked;
  const del = spawnSync("git", ["branch", "-d", br], { stdio: "pipe", cwd: process.cwd() });
  console.log(`removed work/${picked} (dir + worktree state)`);
  if (del.status === 0)
    console.log(`branch ${br} deleted (-d only works if already merged — safe).`);
  else {
    const hint = (del.stderr ? del.stderr.toString() : "").trim().split("\n")[0];
    console.log(`branch ${br} left in place: ${hint || "not deleted"}.\nAfter the PR is merged: git pull origin develop && git branch -d ${br}`);
  }
  exit(0);
}
if (arg1 === "--fix" || arg1 === "-fix") {
  const wt = latestSandbox();
  const wd = wt ?? process.cwd();
  console.log(
    wt
      ? `fix target (sandbox): ${wd}`
      : "fix target: main checkout (no live sandbox found)",
  );
  await fixLoop({ cwd: wd });
  process.exit(0);
}

console.log("\x1b[32m===> FLOW\x1b[0m");
console.log(
  "SANDBOX MODE: hops run in their own git worktree copy; your main tree stays clean.",
);
console.log(
  "Cleanup after merge: node scripts/flow.mjs --cleanup <name>. Opt-out: --no-wt.",
);
let task = arg1,
  opts = {};
for (let i = 2; i < process.argv.length; i++)
  if (process.argv[i] === "--no-wt") opts.sandbox = false;
if (opts.sandbox === undefined) opts.sandbox = true;
if (task && /^notion:/.test(task)) {
  // user says the task address (notion:<id>) -> the door resolves it BY ID
  const nid = task.slice("notion:".length).trim();
  const r = spawnSync("node", ["scripts/notion-door.mjs", "--id", nid], {
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (r.status !== 0) exit(1, "door failed - see above");
  const out = r.stdout
    .toString()
    .trim()
    .split("\n")
    .map((l) => l.replace(/^door resolved:\s*/, ""))
    .filter((l) => l.startsWith("tasks/"));
  task = out.pop();
  console.log("door resolved: " + task);
}
if (arg1 === "--next") {
  // FIFO: the door itself picks the first To Do card (ids are machine-internal)
  const r = spawnSync("node", ["scripts/notion-door.mjs", "--next"], {
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (r.status !== 0) exit(1, "door failed - see above");
  const outn = r.stdout
    .toString()
    .trim()
    .split("\n")
    .map((l) => l.replace(/^door resolved:\s*/, ""))
    .filter((l) => l.startsWith("tasks/"));
  task = outn.pop();
  console.log("door resolved: " + task);
}
// PROFILE GATE (researcher law, phase-4 1.5): the factory cannot start
// without the project passport - no hops, no worktree, no cost, honest hint.
if (!existsSync(join(process.cwd(), "docs", "factory-profile.md")))
  exit(
    1,
    "\nPROFILE GATE: no docs/factory-profile.md in this project.\nRun:  node scripts/run-agent.mjs researcher -o docs/factory-profile.md \"build the project passport\"\nFactory starts ONLY with a project passport.",
  );
if (!task || !existsSync(task))
  exit(
    1,
    "usage: node scripts/flow.mjs tasks\\<date>-<name>.md   |   node scripts/flow.mjs notion:<card-id> [--no-wt]   |   node scripts/flow.mjs --fix",
  );

const name = task
  .replace(/^.*[\\/]/, "")
  .replace(/\.md$/, "")
  .replace(/-plan$/, "");
const plan = "docs/plans/" + name + "-plan.md";
const report = "docs/plans/" + name + "-report.md";

const rid = trace.newRun(name);
let wt = process.cwd();
if (opts.sandbox) {
  ensureWorktreeIgnored();
  wt = ensureWorktree(name);
}
trace.ev(rid, { event: "circle_start", task, name, sandbox: opts.sandbox });
if (opts.sandbox) {
  console.log("sandbox: " + wt);
  // make the task doc visible inside the sandbox (it may be untracked)
  const { copyFileSync, mkdirSync } = await import("node:fs");
  const dst = join(wt, task);
  if (!existsSync(dst)) {
    mkdirSync(join(wt, task, ".."), { recursive: true });
    spawnSync(process.execPath, [
      "-e",
      `require('fs').copyFileSync(${JSON.stringify(task)}, ${JSON.stringify(dst)})`,
    ]);
  }
  // MCP: .mcp.json is untracked -> never lands in a fresh worktree by itself.
  // Copy it in, or run-agent (running from the sandbox) silently loses MCP.
  const mcpSrc = join(process.cwd(), ".mcp.json");
  if (existsSync(mcpSrc)) {
    const dstM = join(wt, ".mcp.json");
    if (!existsSync(dstM)) copyFileSync(mcpSrc, dstM);
    console.log("mcp config copied into sandbox");
  }
  // ADR-0007 #1: the sandbox gets its COMPLETE env - .env travels like
  // .mcp.json (gitignored on both sides). Missing secrets then honest-stop
  // at run-agent, never surface as 401 mysteries.
  const envSrc = join(process.cwd(), ".env");
  if (existsSync(envSrc)) {
    copyFileSync(envSrc, join(wt, ".env"));
    console.log(".env copied into sandbox");
  }
  // PASSPORT travels with the sandbox (1.2 law): hops run from wt, and
  // getProfile reads docs/factory-profile.md from CWD — without this copy
  // every hop silently defaults to the pnpm world (PM grammar rewrite lost).
  const passSrc = join(process.cwd(), "docs", "factory-profile.md");
  if (existsSync(passSrc)) {
    mkdirSync(join(wt, "docs"), { recursive: true });
    copyFileSync(passSrc, join(wt, "docs", "factory-profile.md"));
    console.log("passport copied into sandbox");
  }
}

const inWt = (p) => join(wt, p);

clog("planner", "\n===> PLANNER");
if (hop(["planner", "-i", task], wt, rid) !== 0) exit(1, "planner hop failed");
console.log(`\n>> plan written (in sandbox): ${inWt(plan)}`);
const planGate = await ask("Read the plan. Continue to developer? (Y/N): ");
trace.ev(rid, { event: "gate", gate: "plan", result: isY(planGate) ? "Y" : "N" });
if (!isY(planGate))
  exit(0, "flow stopped at plan gate (sandbox preserved: work/" + name + ")");

clog("developer", "\n===> DEVELOPER");
if (
  hop(
    ["developer", "-i", plan, "implement the plan from the input file"],
    wt,
    rid,
  ) !== 0
)
  exit(1, "developer hop failed");

console.log("\n>> working tree after developer (sandbox):");
spawnSync("git", ["status", "--short"], { stdio: "inherit", cwd: wt });
spawnSync("git", ["diff", "--stat"], { stdio: "inherit", cwd: wt });
const diffGate = await ask("Continue to tester? (Y/N): ");
trace.ev(rid, { event: "gate", gate: "diff", result: isY(diffGate) ? "Y" : "N" });
if (!isY(diffGate))
  exit(0, "flow stopped before tester");

clog("tester", "\n===> TESTER");
if (hop(["tester", "-i", plan], wt, rid) !== 0) exit(1, "tester hop failed");

console.log("\x1b[32m\n===> VERDICT\x1b[0m");
console.log(
  readFileSync(inWt(report), "utf8").split("\n").slice(0, 3).join("\n"),
);
// single verdict event: emitted AFTER verification so the trace carries
// exactly one, machine-confirmed verdict (dedupe per round-3 N4).
// FAIL circles are RECORDED (round-4 N4): a verdict FAIL is a trace fact
// with its own circle_end - the most expensive circles leave a full receipt.
if (verdict(inWt(report)).startsWith("FAIL")) {
  trace.ev(rid, { event: "verdict", result: "FAIL" });
  trace.ev(rid, { event: "circle_end", task, name, verdict: "FAIL" });
  exit(1, "\nFAIL detected - auto fix loop:  node scripts/flow.mjs --fix");
}
console.log("PASS.");
// ---- MACHINE-VERIFIED VERDICT LAW (dual review 23.11, R3; ADR-0002/0007)
// A tester verdict is a MODEL CLAIM. The engine re-runs the passport's
// gates (lint/typecheck/test, those that are known) and accepts the PASS
// only if every re-run is green. Failures = honest stop, verdict demoted.
const verifyVerdict = (wt, rid) => {
  const P = getProfile(wt, undefined);
  const gates = ["lint", "typecheck", "test", "build"].filter(
    (g) => P[g] && P[g] !== "unknown" && String(P[g]).length < 400,
  );
  // TARGETED-TEST LAW (master 24.11): the verdict re-run tests ONLY the
  // files this circle changed (coverage suites get slower with every PR).
  // Full `test` stays as the nightly/statistics run, not a circle gate.
  let targetedNote = "";
  try {
    const { parseDiff, mapToTests, targetedGate } = changedTests;
    const base = (() => {
      for (const b of ["develop", "main"]) {
        const m = spawnSync("git", ["rev-parse", "--verify", b], { cwd: wt, stdio: "pipe" });
        if (m.status === 0) return b;
      }
      return "HEAD~1";
    })();
    const mb = spawnSync("git", ["merge-base", "HEAD", base], { cwd: wt, stdio: "pipe" });
    if (mb.status === 0) {
      const df = spawnSync("git", ["diff", "--name-only", mb.stdout.toString().trim(), "HEAD"], { cwd: wt, stdio: "pipe" });
      if (df.status === 0) {
        const { tests, structural } = mapToTests(parseDiff(df.stdout.toString()));
        const cmd = targetedGate(P, tests, structural);
        if (cmd) {
          P.test = cmd; // swap the full suite for the targeted run
          targetedNote = `${tests.length} targeted test file(s)`;
        } else if (!structural && tests.length === 0) {
          targetedNote = "no code files changed";
        }
      }
    }
  } catch (e) {
    targetedNote = "targeted law skipped: " + (e && e.message || e);
  }
  const vTimeout = Math.max(
    30,
    parseInt(process.env.PIPELINE_VERIFY_TIMEOUT || "600", 10) || 600,
  );
  const results = [];
  for (const g of gates) {
    const t0 = Date.now();
    const r = spawnSync(P[g], [], {
      cwd: wt,
      shell: true,
      timeout: vTimeout * 1000,
      stdio: "inherit", // round-4: the human SEES the failing gate, not just its exit
    });
    const dur = Date.now() - t0;
    const exitCode = r.status ?? (r.signal ? "timeout" : 1);
    results.push({ gate: g, cmd: P[g], exit: exitCode, duration_ms: dur });
    trace.ev(rid, { event: "verdict_verification", gate: g, cmd: P[g], exit: exitCode, duration_ms: dur });
  }
  const failed = results.find((r) => r.exit !== 0);
  return { ok: !failed && results.length > 0, results, failed, gateCount: gates.length, empty: gates.length === 0 };
};
if (process.env.PIPELINE_VERIFY_GATES !== "0") {
  clog("tester", "\n===> VERDICT VERIFICATION (machine re-runs the gates)");
  const v = verifyVerdict(wt, rid);
  for (const r of v.results)
    clog("tester", `  ${r.exit === 0 ? "✓" : "✗"} ${r.gate} (${r.cmd}) exit=${r.exit} ${Math.round(r.duration_ms / 1000)}s`);
  if (v.empty) {
    // round-3 N4: a skipped verification is a TRACE fact, not a console line
    trace.ev(rid, { event: "verdict_verification_skipped", reason: "no known gates in passport" });
    clog("tester", "  (passport exposes no known gates - claim accepted, logged in trace)");
  } else if (!v.ok) {
    // demote the verdict: the machine contradicts the model's claim
    trace.ev(rid, { event: "verdict", result: "FAIL", reason: "verdict_verification_failed", gate: v.failed.gate });
    trace.ev(rid, { event: "circle_end", task, name, verdict: "FAIL" });
    exit(
      1,
      `\nVERDICT VERIFICATION FAILED: ${v.failed.gate} exit=${v.failed.exit}\n` +
        `tester said PASS, the machine disagrees - honest stop.\n` +
        `fix, or PIPELINE_VERIFY_GATES=0 to opt out (logged).`,
    );
  } else
    trace.ev(rid, { event: "verdict", result: "PASS", verified: true, gates: v.results.length });
} else {
  trace.ev(rid, { event: "verdict_verification_skipped", reason: "PIPELINE_VERIFY_GATES=0" });
  trace.ev(rid, { event: "verdict", result: "PASS", verified: false });
  clog("tester", "  (PIPELINE_VERIFY_GATES=0 - verdict accepted unverified, logged in trace)");
}
await committerStep(name, report, wt, rid);
// circle_end: the run is complete (round-3: the event existed in trace.mjs
// but was never emitted).
trace.ev(rid, { event: "circle_end", task, name, verdict: "PASS" });
// HTML report: zero model tokens, best-effort (silently skipped if missing)
if (existsSync(join("scripts", "report.mjs"))) {
  spawnSync(process.execPath, ["scripts/report.mjs", rid], {
    stdio: "inherit",
  });
  console.log("html report: .pipeline/reports/" + rid + ".html");
}
