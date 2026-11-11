# README — Agent Pipeline

Deterministic multi-agent development loop for this repo: a task file goes
in, a human-gated chain of role-hops produces code, tests, a verdict and a PR.
One router script, zero npm dependencies, models routed per role via two files.

## File map

| File | Role |
|---|---|
| `AGENTS.md` | dispatcher: hard rules for every agent (FSAA layers, no direct main) |
| `agents/<role>.md` | role contract: frontmatter (`model`, `tools`, `in`, `out`) + instructions + SCOPE rules |
| `agents-pipeline.yaml` | routing table: `role: model` + gates; change a model = edit one line |
| `scripts/run-agent.mjs` | router: resolves model (args > role frontmatter > table), spawns CLI, checks the artifact |
| `scripts/env.mjs` | dep-free `.env` loader (system env wins) |
| `.env` (gitignored) | `PIPELINE_CLI`, `OLLAMA_BASE_URL`, `OLLAMA_API_KEY` — env only, never in files |
| `.pipeline-last-run.log` | full CLI output of the last hop (gitignored, local) |

Docs/plans/reports are run artifacts: `docs/plans/` is gitignored, they stay local.

## Full circle

``` powershell
# 0. fresh branch
git switch develop; git pull; git switch -c feat/<name>

# 1. intake: write tasks/<date>-<name>.md (context + acceptance criteria)

# 2. plan
node scripts/run-agent.mjs planner -i tasks/<date>-<name>.md

# 3. HUMAN GATE: read the plan -> Y / N

# 4. implement
node scripts/run-agent.mjs developer -i docs/plans/<date>-<name>-plan.md "implement the plan from the input file"

# 5. verify
node scripts/run-agent.mjs tester -i docs/plans/<date>-<name>-plan.md

# 6. HUMAN: commit -> push -> PR -> merge (agents never merge to main)
```

`-i/-o` flags: `-o` overrides; otherwise output auto-derives from the input
name — planner → `docs/plans/<name>-plan.md`, tester → `…-report.md`,
developer (code) → no artifact expected. `AGENT_IN`/`AGENT_OUT` env still work.

## Model routing

Resolution order: `RUN_MODEL` env (one-off override) > `agents/<role>.md`
frontmatter `model:` > `agents-pipeline.yaml`. Check frontmatter first when
debugging "which model ran". Provider: Ollama Cloud over Anthropic-compatible
API — the CLI is only ever fed `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN`
(any other `ANTHROPIC_*` model/var re-triggers SDK model validation and aborts).

## Liveness

While a hop runs, the terminal shows `[run-agent] <role> · <model> · working… Ns`
(3s ticks). Full CLI output lands in `.pipeline-last-run.log`.

## Permissions (claude headless)

`--allowedTools 'Read,Edit,Write,Bash(pnpm:*),Bash(git status:*),Bash(git diff:*),Bash(git log:*)'`
— write/edit for artifacts, pnpm for the finish gates, read-only git for the
tester. Without an explicit allowlist, headless prompts hang/deny and the plan
ends up printed to stdout instead of written to a file.

## Gates

- **Machine** (free, automatic): artifact existence (exit 2 if missing), CLI
  exit codes, `pnpm lint && pnpm typecheck && pnpm test` run by the role,
  `AGENTS.md` drift-check.
- **Human** (mandatory): Y/N after the plan; every commit/push/PR; merge to
  `develop`/`main` is human-only. `pnpm-lock.yaml` and `package.json` are
  NEVER touched by agents (contract rule, not convention).

## Scaling

New agent = new `agents/<role>.md` (copy planner.md, adjust frontmatter +
instructions) + one line in `agents-pipeline.yaml`. The router needs no
changes.

## Troubleshooting cheat-sheet

| Symptom | Fix |
|---|---|
| `[claude-code:unrecognized_model]` with exit 1 | model sent via env — must be on argv; check `agents/<role>.md` frontmatter |
| 401 Invalid bearer token | key in `.env` wrong/absent; `ANTHROPIC_API_KEY` must NOT be set at all |
| plan printed to stdout, no file | `--allowedTools` missing `Write` |
| gates blocked, model asks for approval | add `Bash(pnpm:*)` to `--allowedTools` |
| artifact missing (exit 2) | read `.pipeline-last-run.log` — model refused/erred; rerun |
