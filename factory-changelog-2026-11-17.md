# Factory changelog — 2026-11-17

> Day theme: **Rail #2 — Copilot provider (close of Phase-3)** + docs layer refresh.

## RAIL #2 LIVE (combat)

- Probe chain: `copilot` CLI 1.0.112 installed via VS Code extension prompt -> enterprise login `veaceslav-bezusco @ orange.ghe.com`.
- Billing confirmed: **1 premium request** per probe (not tokens); credits telemetry live (`Session: 0.18 AIC` for hello).
- Model catalog (VS Code picker, verbatim): Recommended Claude Sonnet 5.5 (default) · GPT-6.1 Sol · GPT-6 Astra · GPT-6 Luna · Claude Opus 5.5; New: Gemini 4 Carbon · GPT-6.1 Terra; Other: Claude Sonnet 5 · Claude Haiku 5.5 · GPT-6 Sol · GPT-5.3-Codex · MAI-Code-1.1-Flash · Gemini 4 Argon; `claude-fable-5.1/5.2` present but tier-locked (grayed).
- Fact-check correction: "Claude Fable 5.2" EXISTS in the catalog — the 16.11 viral-post review was half-right (model real, tier unavailable).

## ENGINE — run-agent.mjs v6 (4 combat bugfixes)

- ST-1: copilot stdin transport dead (`-p` requires a value; `--fleet`-only piped stdin is a doc trap) -> argv mode default.
- ST-2: open stdin pipe = eternal block (copilot waits EOF on "piped stdin") -> `p.stdin.end()` right after spawn (write-then-end only in explicit stdin mode).
- ST-3: cmd.exe wrapper cuts multiline argv at newlines (probe #4: generic "Hello! I'm ready to help") -> **direct spawn of copilot.exe** (VS Code shim binary, Get-Command proven); CreateProcess carries multiline argv and ~32k limit (guard raised 7500 -> 30000).
- ST-4: stale `.pipeline-stop` kills fresh hop -> engine self-cleans after kill (documented behavior).
- Model resolution law: agents/*.md `model:` lines are RAIL-#1 facts; on rail #2 the copilot table wins (first hop died on `glm-5.3-flash` id reaching copilot).
- Guards on rail #2: `--deny-tool shell(git commit/push/merge/checkout/reset/rebase:*)` = NEVER wall; per-role grants from `tools:` frontmatter mapped to copilot grammar (`Bash(x:*)` -> `shell(x:*)`; read/edit/write).
- Telemetry: `--usage-output-file` -> `.pipeline-last-usage.json` -> `hop_usage` event (+ `hop_rail2_cost`: premium requests + nanoAiu). Third telemetry path alongside stdout-JSON/transcript.
- CLI cosmetics: waiting line now prints `${cli}`.

## FIRST COMBAT HOP (rail #2 green)

- `node scripts\run-agent.mjs tester -i tasks\truth-disclaimer.md`
- model=claude-sonnet-5.5 · cli=copilot · 168s · `artifact ok` · **verdict: PASS** (own-line verdict law works on rail #2)
- Gates observed: lint 0 · typecheck 0 · build 0 · 806 passed (79 fails only in gitignored `work/*` sandbox copies; `src/` clean; drift-check note in report).
- Tokens line: in 1,226,618 / out 5,569 (cache arithmetic of copilot usage JSON noted for telemetry normalization).

## SWITCH MECHANISM (law)

- Rail = **repository property** (`.env: PIPELINE_CLI`); session env overrides for one run; banner prints `cli` per hop.
- `agents-pipeline.yaml` (rail #1) + `agents-pipeline.copilot.yaml` (rail #2: planner claude-opus-5.5 / developer gpt-5.3-codex / tester claude-sonnet-5.5 / committer claude-haiku-5.5).

## DOCS LAYER (delivered today)

- `factory-roadmap.md` (phases board; **PHASE 3 → CLOSED 17.11**) + this changelog + rail map `rail-routing-architecture-v1.html` + architecture map v3 (both archify-finalized, 4 gates).

## BACKLOG (from today, not blockers)

- MCP on rail #2 (stitch http + notion npx): disabled for transport smoke (`$env:PIPELINE_MCP_CONFIG='_no-mcp_.json'`); decide later: env-placeholder expansion for copilot, or "read-eyes live on rail #1 only" law.
- Copilot `--silent` buffers output -> hop is blind until finish (forensic tool of choice: `~/.copilot/logs/*`; backlog: `--stream on` probe / heartbeat log-tail).
- Copilot usage JSON token arithmetic differs from ollama rail — telemetry normalization in v7.
