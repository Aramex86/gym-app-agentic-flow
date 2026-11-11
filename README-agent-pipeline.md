# README - Agent Pipeline ("Flow")

Deterministic multi-agent development loop for this repo: a task file goes
in, a chain of role-hops produces a plan, code, tests, a verdict and a
copy-ready commit. One router + one orchestrator, zero npm dependencies,
models routed per role via two files. Plain Node only - works identically
in cmd and PowerShell (no ExecutionPolicy concerns).

## File map

| File | Role |
|---|---|
| `AGENTS.md` | dispatcher: hard rules for every agent (FSAA layers, no direct main) |
| `agents/<role>.md` | role contract: frontmatter (`model`, `tools`, `in`, `out`) + FLOW CONTRACT + PROJECT RULES |
| `agents/committer.md` | committer role: produces COMMIT MESSAGE / ADD LIST / PR TITLE / PR BODY |
| `agents-pipeline.yaml` | routing table: `role: model` + gates; the ONLY place models live |
| `scripts/run-agent.mjs` | router: resolves model, assembles the prompt (injects the exact OUTPUT PATH), spawns CLI, artifact gate, colored heartbeat |
| `scripts/flow.mjs` | orchestrator: full circle (`pnpm flow`), fix loop (`pnpm flow:fix`), committer Y-commit |
| `scripts/env.mjs` | dep-free `.env` loader (system env wins) |
| `.env` (gitignored) | `PIPELINE_CLI`, `OLLAMA_BASE_URL`, `OLLAMA_API_KEY` - env only, never in files |
| `.pipeline-last-run.log` | full CLI output of the last hop (gitignored, local) |

Run artifacts (`docs/plans/`) are gitignored: plans and reports are run
state, not product. Full concept doc: `docs/flow-concept.md`.

## The Flow (one command)

``` text
pnpm flow tasks\<date>-<name>.md
```

Planner -> [read plan, Y] -> Developer (+ auto `git status`/diff stat) ->
[Y] -> Tester -> verdict -> Committer. On `Accept and commit? (Y/N): Y` the
tool runs `git add <report paths>` + `git commit` - the only git write it
can ever do, and strictly after an explicit human Y. Push/PR/merge stay
hand-run.

FAIL handling:

``` text
pnpm flow:fix
```
- CODE-class FAIL -> developer bug-fix hop + re-tester, up to 3 rounds.
- "uncommitted work" blocker -> HUMAN STEP screen (prints `git status
  --short` + the 3 steps). After you commit, `pnpm flow:fix` skips the fix
  hop and just re-tests; if everything was already committed the committer
  reports `files already committed` and skips git steps.

## Roles

| Role | Model (table) | Writes | Gate duty |
|---|---|---|---|
| planner (green) | kimi-k3.1 | `docs/plans/<name>-plan.md` | checkable plan, FSAA mapping, never asks mid-turn |
| developer (orange) | glm-5.3-flash | code + tests | SCOPE: only plan files; runs finish gates honestly |
| tester (cyan) | glm-5.3-flash | `<name>-report.md` | PASS/FAIL verdict; bug-log in human voice (What happened / Why it matters / How to fix / Evidence); commit-verify via git history, not the working tree |
| committer (magenta) | glm-5.3-flash | `<name>-commit.md` | never touches git; the tool commits after human Y |
| reviewer (future) | deepseek-v4.1-flash | review file on PRs | scaffold only for now |

Role files have two fixed sections: `== FLOW CONTRACT ==` (identical across
projects) and `== PROJECT RULES ==` (this project's layout - the project
owner writes it).

## Model routing

Resolution order: `RUN_MODEL` env (one-shot) > `agents/<role>.md`
frontmatter `model:` > `agents-pipeline.yaml`. Changing a role's model is
one line in the table. Check frontmatter first when debugging "which model
ran". Provider: Ollama Cloud over the Anthropic-compatible API - the CLI is
only ever fed `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN`; any other
`ANTHROPIC_*` model var re-triggers SDK validation and aborts. Model ids are
bare (no `:cloud`) and go on argv, never via env.

## Liveness

While a hop runs, the terminal shows a colored
`[run-agent] <role>  <model>  working Ns` (3s ticks). Full CLI output lands
in `.pipeline-last-run.log`.

## Permissions (claude headless)

`--allowedTools 'Read,Edit,Write,Bash(pnpm:*),Bash(git status:*),Bash(git diff:*),Bash(git log:*)'`
- write/edit for artifacts, pnpm for the finish gates, read-only git for
tester/committer. Without an explicit allowlist, headless prompts hang/deny
and the plan ends up printed to stdout instead of written to a file.

## Gates

- **Machine** (free, automatic): artifact existence (exit 2 if missing; the
  OUTPUT PATH is injected into the prompt so models cannot invent names),
  CLI exit codes, `pnpm lint && typecheck && test` run by the role, AGENTS.md
  drift-check.
- **Human** (mandatory): Y/N after the plan; diff review; committer Y (the
  ONLY automated git write); push/PR; merge to `develop`/`main` is
  human-only. `pnpm-lock.yaml`, `package.json`, `.github/` are no-touch
  zones (contract rule, not convention).

## Adopting Flow in a new project (the Flow is project-agnostic)

The engine (scripts/run-agent.mjs, scripts/flow.mjs, package.json "flow"
scripts) carries no project knowledge. Project specifics live ONLY in:

- `AGENTS.md` - project rules (layer layout, import boundaries, no-touch zones)
- `agents/<role>.md` - role contract with two fixed sections:
      == FLOW CONTRACT ==   (identical across projects: output contract,
                            finish gates, no mid-turn questions)
      == PROJECT RULES ==   (this project's layout: FSAA paths, tokens,
                            naming, domain rules - written by the owner)
- `agents/where-ui-goes.md` (or equivalent) - the layer map the planner cites.

Onboarding a new repo = copy scripts + AGENTS.md skeleton + role skeletons,
fill AGENTS.md and each role's PROJECT RULES block, add models to
agents-pipeline.yaml. No engine changes.

## Running rules (learned the hard way)

- Clean worktree at circle start; branch per task (stacked branches ok:
  `feat/app-shell` -> `feat/history-table` on top; PRs land in order).
- Developer SCOPE rule lives in `agents/developer.md`; the developer drifts
  to pipeline infra when a plan is under-specified - keep acceptance tight.
- PowerShell 5.1 reads UTF-8 files without BOM as ANSI (a multi-byte dash
  can decode into a quote char and break parsing) and blocks external files
  (Zone.Identifier) - so the whole toolchain is plain Node scripts.
- Tester distinguishes code checks (working tree) from process checks
  (git history: `git show --stat HEAD` - a clean tree after a commit is not
  a defect). Bug-log entries are stories: What happened / Why it matters /
  How to fix (and WHO: developer/planner/HUMAN) / evidence one-liner.
- Task slugs should not end with the word "plan" (suffix collisions).

## Scaling

New agent = new `agents/<role>.md` (copy a role, adjust frontmatter +
instructions) + one line in `agents-pipeline.yaml`. The router needs no
changes.

## Troubleshooting cheat-sheet

| Symptom | Fix |
|---|---|
| `[claude-code:unrecognized_model]` with exit 1 | model sent via env - must be on argv; check `agents/<role>.md` frontmatter |
| 401 Invalid bearer token | key in `.env` wrong/absent; `ANTHROPIC_API_KEY` must NOT be set at all |
| plan printed to stdout, no file | `--allowedTools` missing `Write` |
| gates blocked, model asks for approval | add `Bash(pnpm:*)` to `--allowedTools` |
| artifact missing (exit 2) | read `.pipeline-last-run.log` - model refused/erred; rerun |
| `files already committed` | normal: you committed; just push/PR |
| committer not parseable | check `agents/committer.md` flat output format |
