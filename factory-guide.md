# AGENT FACTORY GUIDE - component reference
(what every part of the pipeline does, how it works, and where to look)

Reader: a human (you or a colleague) who wants to understand the machine.
All commands are run from the product repo root.

## 0. The one-page picture

```
tasks/<X>.md            front door: a human writes the task
      │
      ▼  (Flow orchestrates; every hop = Claude Code CLI headless run
      │    with model + tools restricted per role)
 planner  ──plans──▶  docs/plans/X-plan.md
      │
 developer ──implements──▶ code + tests (branch feat/<X> in a worktree)
      │
      ▼  fixture commit (by Flow, not by agent)
 tester ──gates + checklist──▶ docs/plans/X-report.md
      │  FAIL ──▶ fix loop (developer fixes by bug-log, re-test) xN
      ▼ PASS
 committer ──▶ docs/plans/X-commit.md   ──▶ human Y ──▶ Flow runs git add+commit
      │
      ▼  (human-only, always)
    push / PR / merge to develop

eval.mjs replay of a circle against an answer key = the EXAM.
trace.mjs = the flight recorder of every hop in every run.
```

## 1. Roles (agents/*.md)

A role file is a CONTRACT: `model`, `worktree` mode, `tools:` (exact allowlist),
input artifact, output artifact, and behavior rules. The engine reads the
`tools:` line (frontmatter, first 600 chars) and passes it to the CLI as
`--allowedTools`; a global `--disallowedTools` wall denies git mutations
(commit/push/merge/checkout/reset/rebase) to EVERY role - the tool executes
the only allowed commit, and only after a human Y.

| file | role | in → out |
|------|------|----------|
| planner.md | turns task text into an executable plan | tasks/X.md → docs/plans/X-plan.md |
| developer.md | implements ONLY the plan, runs gates, commits nothing | X-plan.md → code/tests in worktree |
| tester.md | runs gates, verifies checklist vs git history, writes bug-log voice | X-plan.md → docs/plans/X-report.md |
| committer.md | writes commit message + ADD LIST + PR title/body; never touches git | X-report.md → docs/plans/X-commit.md |
| e2e.md | Playwright spec run after a PASS (Level 1: deterministic specs) | X-plan.md → docs/plans/X-e2e-report.md |

Tester contract laws (learned from real failures):
- commit verification via git history, working tree is not evidence.
- a gate that could not be executed = `pass*` + manual equivalent + note.
  NEVER a FAIL for "could not execute".
- never fabricate tool shims (e.g. *.cmd at root) - that's a scope violation.
- FAIL = stop; every FAIL cites actual command output.

## 2. run-agent.mjs - the engine (one hop)

What it does: ONE role, ONE working cycle. Builds env (OLLAMA_BASE_URL →
ANTHROPIC_*), writes the prompt (stdin), spawns `claude -p --model <role model>`
headless, enforces limits, captures output to the artifact.

Guards (all hops):
- `--max-turns <N>` (PIPELINE_MAX_TURNS, default 60) - no runaway tool loops.
- `PIPELINE_HOP_TIMEOUT` (default 900s) - auto-kill on wall clock.
- kill-switch: create file `.pipeline-stop` in repo root → hop killed ≤3s,
  file self-deletes, exit 130. Works even when the run is stuck.
- tools-per-role from `tools:` frontmatter + global deny wall (see above).
- at hop start it PRINTS the effective allow/deny lists (visibility).

Artifact resolution (priority): `-o` arg → autoOut per role env → error exit 2.
Usage as the Flow also uses it:
```
node scripts/run-agent.mjs tester -i docs/plans/<name>-plan.md
```

## 3. flow.mjs - the orchestrator (pipeline of hops)

What it does: the director. For a task slug:
1. ensureWorktree - fresh sandbox `work/<slug>` on branch `feat/<slug>` from
   develop (removes stale dirs/zombies first; reuses an existing one).
2. deps provisioning - if `node_modules/.bin` missing → runs
   `pnpm install --frozen-lockfile --prefer-offline` (offline store; honest
   stop if it fails - no hops without deps).
3. planner → plan artifact gate.
4. developer → (no agent commits).
5. tester → verdict PASS/FAIL.
   FAIL → fix loop: developer fixes ONLY bug-log items → tool commits
   (scoped: `git add -A` then `git reset` of docs/plans, tasks, forbidden
   paths) → re-test. Max rounds from config; then HUMAN STEP box.
6. committer → shows commit artifact → HUMAN Y → the TOOL executes scoped
   git add + commit. Push/PR/merge always human-only.
7. every hop/verdict/round is traced (see trace.mjs).

Commands:
```
pnpm flow                run a task        (reads tasks/<slug>.md)
pnpm flow:fix            fix/re-test       (targets last or given sandbox)
pnpm flow:fix work\<slug> explicit sandbox target (reads trace for self-targeting)
```

## 4. trace.mjs - the black box

What it does: chronological JSONL log of everything, per run:
`.pipeline/runs/<ts>__<slug>/trace.jsonl` + copies of every prompt
(`prompts/<role>.md`) and every artifact (`artifacts/`).

Events: run_start, circle_start, hop_start {role, model, cwd, branch},
hop_end {exit, duration_ms, artifact, note: kill-switch|timeout},
verdict {result}, fix_round {n}, fixture_commit, gate_pass/gate_fail.

hop cwd shows WHERE it ran: path contains `work\` = sandbox; without = main.

```
node scripts/trace.mjs show [run-id]   human table of a run
node scripts/trace.mjs watch           live tail (run in a second terminal)
```

## 5. eval.mjs - the exam (golden tasks + scoreboard)

What it does: replays a task through the whole line, grades mechanically
against the ANSWER KEY embedded in the golden task file.

Golden task file structure:
- frontmatter = answer key: name / expected.files_exist[] / verdict /
  budget {fix_rounds, time_s} / forbidden_paths[]
- body = the task itself (5-10 lines, small, self-contained)
- two kinds: REGRESSION (feature already in develop - expected PASS, cheap,
  verifies the machine) and CAPABILITY (feature absent - measures model skill).

Run behavior: FRESH sandbox every time (remove + re-add from develop, branch
recreated), deps provisioned by the tool (pnpm install), full circle, fix loop
bounded by the key, then grading:
- verdict: report's first word parsed (`\b(PASS|FAIL)\b`, hash-tolerant)
- files: all expected files exist in sandbox
- scope: COMMIT diff from develop vs forbidden_paths (working-tree residue is
  ignored - that's the tool's own excluded drift, printed as a note)
- fixes: rounds used ≤ budget; time ≤ budget
- appends a JSONL row + pretty block to `evals/results/scoreboard.md`

```
node scripts/eval.mjs evals/golden-<name>.md
```

## 6. env.mjs - the config loader

Loads `OLLAMA_BASE_URL` + `OLLAMA_API_KEY` from repo `.env` (or machine env)
and exports `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` for the CLI.
Dependency-free on purpose; masks key values in any log output.
NEVER put secrets in tasks/roles/prompts - they travel to the model cloud
in plaintext. Keys live in env only.

## 7. map.mjs - repo-map (OPTIONAL, not adopted)

Walks src/ and writes `docs/context/repo-map.md` (exports per module + full
text of AGENTS.md/pipeline.yaml/package.json). Deferred until planner loses
its way on external tasks (Notion-door era). Kept in flow-kit/optional.

## 8. Sandbox rules (worktrees)

- sandboxes are cheap, disposable workshops: `work/<slug>`, branch feat/<slug>.
- fresh for evals; reused for circles (fix loop inside one).
- never `git switch` to a sandbox branch from the main checkout.
- don't keep editors/terminals cd'd into work\* - they block Windows deletion.
- gates need real binaries: the tool provisions node_modules (pnpm install
  --prefer-offline), never junctions.

## 9. Escalation ladder when something is red

Read in order; every red belongs to exactly one layer:
1. answer key (expect files=0/budget=0) → fix the golden file
2. sandbox creation (already exists / not empty) → remove zombies, close editors
3. environment (gates "not recognized", install denied) → deps provisioning
4. verdict semantics (grade vs report disagree) → check report's first word vs
   scope/files lines; suspect the parser first, not the code
5. code (gates executed and red) → real bug-log; hand to developer
Full decode manual: docs/eval-reading-guide.md.

## 10. What is human-only (never change this)

- merge to develop / push / PR open+merge - HUMAN ONLY, agents never merge.
- the commit itself: tool executes git add+commit ONLY after human Y on the
  committer artifact.
- DONE on the board (Notion) - human only; agents own To Do/In Progress/In Review.

## 11. Where the docs live in the repo

```
scripts/*.mjs        the machine (run-agent flow eval trace env)
agents/*.md          contracts
agents-pipeline.yaml model table + routing
tasks/               front door
evals/               exam tasks + results/scoreboard.md
docs/plans/          per-task artifacts (plan/report/commit)
.pipeline/runs/      traces (gitignored)
work/                sandboxes (gitignored)
```

Version: 2026-11-14, after first PASS in the scoreboard.
