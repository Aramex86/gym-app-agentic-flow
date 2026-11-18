# MODELS & ENV — how the factory runs its models

> The single reference for rails, models and env. Everything else cites this page.
> Laws it serves: secrets env-only · budget ($100/mo) · tools never touch lockfiles.

## 1. THE ONE SWITCH: `PIPELINE_CLI` (in `.env`, gitignored)

```text
PIPELINE_CLI=claude    -> RAIL #1: Ollama Cloud     (token $-billing)
PIPELINE_CLI=copilot   -> RAIL #2: GitHub Copilot enterprise (premium-request billing)
```

Choose per circle, not per install: set in `.env` before `pnpm flow`, or
override for one run: `$env:PIPELINE_CLI='copilot'` (PowerShell session env).

## 2. ENV MATRIX (all vars, one table)

| var | rail | default | meaning |
|---|---|---|---|
| `PIPELINE_CLI` | both | `claude` | rail switch: claude / copilot |
| `OLLAMA_BASE_URL` | #1 | `https://ollama.com/` | Ollama Cloud endpoint |
| `OLLAMA_API_KEY` | #1 | — | rail #1 token (env only, never files) |
| `RUN_MODEL` | both | — | one-run override: forces model for NEXT hop |
| `PIPELINE_MAX_TURNS` | both | `60` | max agent turns per hop |
| `HOP_TIMEOUT` | both | `900` | hop wall-clock limit, seconds |
| `PIPELINE_MCP_CONFIG` | both | unset | path to MCP config; `_no-mcp_.json` = eyes OFF |
| `PIPELINE_COPILOT_PROMPT_MODE` | #2 | `argv` | copilot transport (argv only — stdin is dead) |
| `GITHUB_TOKEN` | git | — | your push token (agent never touches git) |

Windows: set session vars in PowerShell before the run
(`$env:PIPELINE_CLI='copilot'`), not in shell profile — keep the machine stateless.

## 3. WHO RUNS WHAT: role model tables (yaml, per project)

The model per ROLE comes from the role table yaml — edit the yaml, not code:

```text
agents-pipeline.yaml         # rail #1 table (e.g. deepseek-v4.1-flash planner,
                             # glm developer/tester — cheap $-billing)
agents-pipeline.copilot.yaml # rail #2 table:
                             #   planner   claude-opus-5.5    (heavy, opus = only here)
                             #   developer gpt-5.3-codex
                             #   tester    claude-sonnet-5.5  (default sonnet plan too)
                             #   committer claude-haiku-5.5
```

Precedence per hop: `RUN_MODEL` env > yaml role table > engine defaults.

## 4. BILLING (budget law $100/mo ≈ $3.3/day)

```text
RAIL #1: token billing. Circle ≈ $3-7 (plan $1.1-2.9 · dev $0.7-2.2 · test ~$0.7).
RAIL #2: premium REQUESTS per hop. Sonnet/codex/haiku hop = 1 premium each ·
         opus planner hop = 15 premium (83% of an 18-premium circle).
Rules: plans go sonnet or rail-1 deepseek · opus only for complex tasks
       (≤2-3/month) · every circle prints its cost line for the ledger.
```

## 5. HEALTH CHECK (30 seconds, before trusting a rail)

```powershell
# rail #2 probe (writes usage json: premium cost, tokens, model)
copilot -p "Reply with exactly: OK" --silent --usage-output-file probe.json

# rail #1 probe: any model name answers hello through run-agent
node scripts/run-agent.mjs claude -p "Reply with exactly: OK" --silent
```

`probe*.json` is gitignored. No answer / empty usage file = hop never reached
the model — check env, then transport.

## 6. KNOWN TRANSPORT FACTS (learned in battle — do not rediscover)

```text
#2 copilot: stdin transport DEAD — argv only; direct copilot.exe spawn
            (cmd.exe wrapper cuts multiline argv at newlines); prompt fuse
            30,000 chars; --usage-output-file is the telemetry channel.
#2 MCP:     workspace .mcp.json SKIPPED while folder untrusted — keep
            eyes-off via _no-mcp_.json until the trust law lands.
#1 claude CLI: claude --version 2.1.322; kill-switch .pipeline-stop = exit 130.
```
