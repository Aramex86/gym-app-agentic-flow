# Flow - Agentic Development Pipeline: Concept Documentation

Version 1.3 (2026-11-13) - repo: gym-app-agentic-flow
Author: Veaceslav Bezusco - built live with Hermes (kimi/glm/minimax on Ollama Cloud)

---

## 1. Vision

Traditional coding with AI = one chat, one model, no memory of process.
Flow replaces this with a **deterministic development pipeline**: a task file
goes in, a chain of role-hops produces a plan, code, tests, a verdict and a
copy-ready commit - with the human holding every irreversible decision.

Core principles:

1. **Files are the interface.** Agents do not talk in chat; they read task
   files and write artifacts (plans, reports, commit specs). Every hop is
   replayable from the filesystem.
2. **Routing by contract, not by typing.** Each role declares its model,
   tools, inputs, outputs; a router resolves which model runs.
3. **Machine gates are free.** Artifact existence, exit codes, lint/
   typecheck/test - verified automatically after every hop.
4. **Human gates are mandatory.** Read the plan (Y/N), review the diff,
   accept the commit (Y), push, PR, merge. Agents NEVER merge to main; the
   only automated git write is add+commit executed by the TOOL after an
   explicit human Y on the committer step.
5. **Honest verdicts.** The tester is a separate role with its own contract;
   "PASS without running the gates" is a failure, not an outcome.
6. **The engine is project-agnostic.** Project knowledge lives in project
   files (AGENTS.md, PROJECT RULES in role files). Adopting Flow in a new
   repo = writing those files, not changing the engine.

---

## 2. Architecture

```
 chat / board door
        |
        v
 tasks/<date>-<name>.md          <-- intake: task file (context + acceptance)
        |
        v
 +--------------------------------------------------------------+
 |            pnpm flow  (scripts/flow.mjs, plain Node)         |
 |--------------------------------------------------------------|
 |  PLANNER hop   (green)  -> docs/plans/<name>-plan.md         |
 |  [human Y/N]                                                 |
 |  DEVELOPER hop  (orange) -> code + tests (feat branch)       |
 |  [diff review Y/N]                                           |
 |  TESTER hop     (cyan)   -> docs/plans/<name>-report.md      |
 |                          first line: PASS / FAIL             |
 |  [FAIL -> pnpm flow:fix, max 3 rounds]                       |
 |  COMMITTER      (magenta)-> <name>-commit.md                 |
 |  [Y -> tool: git add + commit; push/PR stay human]           |
 +--------------------------------------------------------------+
        |
        v
 human: push -> PR -> merge                    <-- git is the bus
```

Components:

| Piece | File | Responsibility |
|---|---|---|
| Router | `scripts/run-agent.mjs` | model resolution, prompt assembly (injects exact OUTPUT PATH), CLI spawn, artifact gate, colored heartbeat |
| Orchestrator | `scripts/flow.mjs` | circle, class-aware fix loop, committer Y-commit |
| Routing table | `agents-pipeline.yaml` | `role: model` map + gates; the ONLY place models live |
| Role contracts | `agents/<role>.md` | frontmatter + FLOW CONTRACT (cross-project) + PROJECT RULES (per-project) |
| Committer spec | `agents/committer.md` | flat machine-parseable commit.md format |
| Project map | `AGENTS.md`, `agents/where-ui-goes.md` | project rules: layers, boundaries, no-touch zones |
| Runner env | `scripts/env.mjs` + repo `.env` | PIPELINE_CLI, OLLAMA_BASE_URL, OLLAMA_API_KEY (env only) |
| Run log | `.pipeline-last-run.log` | full CLI output of the last hop (gitignored) |

---

## 3. The Circle, step by step

```
pnpm flow tasks\2026-11-11-compact-toggle.md
```

1. **Planner hop** - contract + task file + context in one prompt; the
   runner injects the exact OUTPUT PATH (models must not invent artifact
   names). Planner writes the plan.
2. **Human gate 1** - read the plan; `Y` continues, `N` => re-hop.
3. **Developer hop** - implements exactly the plan's files on a feature
   branch (SCOPE rule: never pipeline files, package.json, pnpm-lock).
4. **Diff review** - flow prints `git status --short` + `--stat`.
5. **Tester hop** - independent role: acceptance checklist + finish gates +
   drift-check; report starts with the verdict line; bug-log is written in
   human voice (What happened / Why it matters / How to fix / Evidence).
6. **Verdict** - PASS => Committer step. FAIL => `pnpm flow:fix`.
7. **Committer** - generates COMMIT MESSAGE / ADD LIST / PR TITLE / PR BODY;
   on your `Y` the tool executes git add+commit (nothing else); if the files
   were already committed by hand it reports `files already committed` and
   skips.
8. **e2e hop (planned)** - Playwright specs after PASS, before committer;
   verdict `VERDICT: PASS/FAIL` first line, screenshots on failure, BLOCKED
   verdict (human adds deps) if Playwright is not installed.

The fix loop: newest `*-report.md` -> class-aware handling -> up to 3
rounds -> escalation to re-planning (see section 4).

---

## 4. Classes of FAIL (how the loop knows what to do)

| Class | Trigger | Behavior |
|---|---|---|
| CODE | any code defect in the report | developer fix hop + re-tester, <= 3 rounds, then escalate to re-planning |
| PROCESS ("uncommitted work") | report says deliverables are not in any commit | tree dirty: HUMAN STEP screen (lists files + the 3 steps); tree clean (you committed): the blocker is stale -> skip the fix hop, straight to re-test |
| METHODOLOGY | tester checks a committed state against the working tree | fixed by contract: commit-verification reads git history (`git show --stat HEAD`), never `git status` (a clean tree is normal) |

This separation is what keeps the fix loop useful instead of spinning.

---

## 4b. Sandboxes - every circle runs in its own worktree

`pnpm flow` (v7) creates `work/<name>` as a git worktree on branch
`feat/<name>` based on develop; ALL hops run with `cwd` set to it. Effects:

- the main working tree is never touched - a broken hop can only dirty a
  disposable copy (the pnpm-lock scope-drift incident class is now contained);
- artifacts (plans/reports/commit specs) land in the sandbox;
- the committer Y commits inside the sandbox on its own branch; push/PR stay
  human, cleanup is `git worktree remove work/<name>`;
- parallel circles become possible (two planners A/B'd on one task) - the
  floor for evals and the future sub-agent layer;
- `/work/` is gitignored automatically; opt-out flag `--no-wt`.

## 4b1. Finishing a circle (push / PR / cleanup - human)

The sandbox works directly on its branch `feat/<name>` (shared .git), so the
commit accepted at the committer gate is already the PR source. After the
circle: `git push -u origin feat/<name>` -> PR -> merge (human) -> and only
then `git worktree remove work\<name> --force` + `git branch -d feat/<name>`.
No extra branch is ever created. The flow prints this FINISH box after the
gate, so the procedure is on-screen at all times.

## 4c1. Trace - the black box (answers "what happened and where")

Each run writes `.pipeline/runs/<run-id>/` into the MAIN repo (sandbox-
independent): `trace.jsonl` events (circle/hop_start/hop_end/gate/verdict,
each hop with `cwd` + `branch`), `prompts/` (exact prompt text), `artifacts/`
(copies of plans/reports/commits). Two views:

- `trace.mjs show` - the finished-run table;
- `trace.mjs watch` - a live event stream from any terminal, main checkout
  or not; this is the visibility layer while agents work inside worktrees.

Proven value in the first live smoke: `hop_end {artifact: null}` with the
plan already visible in the main tree exposed a CLI spawn that bypassed the
sandbox (`cwd: root`); after the fix artifacts land in `work/<name>` only.

## 4c. Usage guards - why an orphan hop cannot burn a provider again

After the 2026-11-12 incident (a background hop burned ~2k requests) every
hop is bounded:

| Guard | Default | Meaning |
|---|---|---|
| `--max-turns` (PIPELINE_MAX_TURNS) | 60 | hard agentic-turn budget per hop |
| PIPELINE_HOP_TIMEOUT | 900s | hung hop kills itself |
| `.pipeline-stop` flag | kill-switch | running hop terminated within 3s, verified live |

Facts learned: a parked console (waiting for Y) burns nothing - burning
requires an ACTIVELY running hop; a dashboard counter is a rolling window,
not a live indicator; background node processes survive project/app switches
unless killed - the caps bound their worst case.

---

## 5. Roles and contracts

| Role | Model (table) | Reads | Writes | Trait |
|---|---|---|---|---|
| planner (green) | kimi-k3.1 | task, project map | `<name>-plan.md` | FSAA mapping per component; Assumptions for ambiguity |
| developer (orange) | glm-5.3-flash | plan | code + tests | SCOPE hard rule; finish gates honestly |
| tester (cyan) | glm-5.3-flash | plan + code | `<name>-report.md` | verdict first line; bug stories; history-based commit check |
| committer (magenta) | glm-5.3-flash | report + git history (read-only) | `<name>-commit.md` | never touches git |
| reviewer (future) | deepseek-v4.1-flash | PR diff | review file | scaffold: PR review role |
| e2e (violet) | glm-5.3-flash | plan | `<name>-e2e-report.md` | Playwright specs; never fixes code |

Console identity: each role prints in its own color; the live timer shows
`<role>  <model>  working Ns`.

Role files are split into `== FLOW CONTRACT ==` (identical across projects:
output contract, no mid-turn questions, finish rules) and
`== PROJECT RULES ==` (this project's FSAA paths, token discipline, naming -
owned by the project owner).

---

## 6. Model routing (3 levels)

```
RUN_MODEL env (one-shot; e.g. swap a slow reasoner)
  > agents/<role>.md frontmatter `model:`
  > agents-pipeline.yaml table
```

Verified live against Ollama Cloud (Anthropic-compatible endpoint):

- headless claude CLI receives ONLY `ANTHROPIC_BASE_URL` +
  `ANTHROPIC_AUTH_TOKEN`; any other ANTHROPIC_* model var re-triggers SDK
  validation and aborts;
- model id on ARGV (`--model <id>`), ids bare (no `:cloud` suffix);
- changing a role's model = one line in the table, zero code changes.

---

## 7. Gates

| Gate | Nature | Check |
|---|---|---|
| artifact exists | machine | run-agent exit 2 if missing (OUTPUT PATH injected into prompt) |
| CLI exit code | machine | non-zero => hop failed |
| finish gates | machine | `pnpm lint && typecheck && test` by the role itself |
| drift-check | machine | `node scripts/check-agents-md.mjs` (12/12 rules) |
| plan gate | HUMAN | read the plan, Y/N |
| diff gate | HUMAN | review status/diff |
| commit gate | HUMAN | committer Y -> tool runs git add+commit |
| push/PR/merge | HUMAN | human-only; agents never merge to main |
| no-touch zones | HUMAN | pnpm-lock.yaml, package.json, .github/ |

---

## 8. Artifacts and naming

```
tasks/<name>.md             ->  docs/plans/<name>-plan.md     (planner)
docs/plans/<name>-plan.md   ->  .../<name>-report.md         (tester)
docs/plans/<name>-report.md ->  .../<name>-commit.md         (committer)
```

Auto-derivation trims a trailing `-plan` from the input slug; priority:
`-o` flag > auto-name > env (a stale env can never cheat the gate). The
OUTPUT PATH is injected into the prompt. Artifacts are gitignored (run
state, not product); task slugs should not end with "plan".

---

## 9. Evidence: what has run live (2026-11-10/11)

| Circle | Task | Route | Result |
|---|---|---|---|
| 1 | Plan JSON contract v0.1 | planner minimax -> Y -> dev glm -> tester | PASS (20/20 tests) |
| 2 | AppShell | planner glm (compact) -> dev (117s) -> tester | PASS (23 tests) |
| 3 | History table | circle -> FAIL -> fix loop (RPE regex, dead class) -> split commits | PASS after fix |
| 4 | Home page data | flow circle -> tester | PASS (drift-check 12/12) |
| 5 | Compact mode toggle | planner kimi -> dev -> tester | PASS - **one-shot, no fix rounds** |

During the loops the pipeline itself was upgraded (router, orchestrator,
honest tester, committer) following the same discipline as product tasks.

---

## 10. Lessons learned (each cost a hop; each is now a rule)

- PowerShell 5.1 reads UTF-8 scripts without BOM as ANSI: one multi-byte
  dash can decode into a quote char and break parsing => `.ps1` avoided
  entirely; the toolchain is plain Node.
- Files arriving from chats carry Zone.Identifier => `Unblock-File`.
- Headless CLI cannot answer permission prompts => per-hop allow-lists
  (`Read,Edit,Write`, `Bash(pnpm:*)`, read-only git); without `Write` the
  plan lands on stdout, not on disk.
- A model that ends its turn with a question exits non-zero with no
  artifact => "never ask mid-turn" is part of the flow contract.
- Models invent artifact names unless the exact path is injected =>
  OUTPUT PATH directive.
- The tester must run gates itself and never claim green without evidence;
  it must also verify committed work via git history, not the working tree.
- Scope drift is real: the developer refactors pipeline infra instead of
  the plan unless SCOPE is a hard rule in its contract.
- Stale env vars produced a fake `artifact ok` once => priority: flag >
  auto-name > env.

---

## 11. Roadmap

- [x] Router, artifact gates, honest tester verdicts
- [x] One-command circle (`pnpm flow`) + class-aware fix loop (`pnpm flow:fix`)
- [x] Committer role -> copy-ready commit, Y-gated add+commit
- [x] Role colors; project-agnostic adoption; concept docs v1.2
- [x] Sandbox worktrees per circle; usage guards (max-turns, timeout, kill-switch)
- [x] Trace black box: show + watch; sandbox targeting for flow:fix
- [ ] e2e hop (Playwright specs after PASS)
- [ ] Security package: secrets-scan, injection rules in contracts, gate re-check
- [ ] repo-map generator (skeleton ready)
- [ ] Security package: secrets-scan, injection rules in contracts, gate re-check
- [ ] Reviewer role (deepseek) on PRs
- [ ] Board door: poll Notion cards -> generate task files automatically
- [ ] Parallel hops and per-task model routing (complexity tier)
- [ ] Run dashboard: hop timings, PASS/FAIL stats, cost per role
- [ ] Multi-project adoption: FSAA skeleton as a reusable template
