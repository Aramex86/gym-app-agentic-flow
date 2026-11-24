# Agentic Factory Kit

Two-rail multi-agent coding factory: **board door -> task -> planner -> [Y] -> developer -> [Y] -> tester -> committer -> [Y] -> commit**. Node-only, zero npm deps. Works with Ollama Cloud (rail #1) and GitHub Copilot enterprise (rail #2).

**Models & env — the single reference:** `docs/MODELS-AND-ENV.md` (rails, env matrix, role yaml tables, billing, probes).

## INSTALL (any project)

```powershell
# 1. clone the kit next to your project
git clone https://github.com/Aramex86/agentic-factory-kit.git
# 2. install into your project (copies scripts/, agents/, yamls, .mcp.json, .gitignore block)
node agentic-factory-kit/INSTALL.mjs <path-to-your-project>
# 3. pick your rail + tokens (env only, never in files)
#    rail #1: OLLAMA_BASE_URL + OLLAMA_API_KEY   (.env)
#    rail #2: copilot login (CLI manages; no tokens needed)
# 4. feed from your Notion board via the door, or author tasks\*.md by hand
pnpm flow tasks\<x>.md
```

## RAILS (switch = repository property)

```text
.env: PIPELINE_CLI = claude   -> rail #1: Ollama Cloud (deepseek/glm, $-billing)
.env: PIPELINE_CLI = copilot  -> rail #2: Copilot enterprise (premium billing)
model tables: agents-pipeline.yaml (rail #1) · agents-pipeline.copilot.yaml (rail #2)
```

## Laws shipped (non-negotiable)

- agents never commit/push/merge; 3 human Y-gates; push/PR/merge by humans only
- verdict law v2: PASS/FAIL own line <=12; artifact gates; SCOPE law
- identity law: repo-local user.name/email set BEFORE committer (enterprise rails hijack authorship)
- artifact mkdir law: output dirs pre-created before hop spawn
- budget law: NO default cap — `PIPELINE_BUDGET_USD` env sets it when wanted; every hop prints its cost line; reported $ is an engine estimate (rail #1 uses the CLI rate table) — compare circles with it, reconcile with the provider dashboard
- decisions: `docs/adr/` (superseded-only) + `docs/context/glossary.md` — contracts reference, never re-explain
- secrets: env only; .env never committed; .mcp.json carries ${PLACEHOLDERS} only
- sandbox hygiene: work/ and .pipeline/ local-only; worktree removed after merge

## Live viewer (TUI V1)

```text
node scripts/tui.mjs        # in a second terminal, while a circle runs
node scripts/tui.mjs --once # one plain frame, exit
```

## Files

scripts/ (incl. tui.mjs) · agents/ (5 roles, researcher offboard) · boards tables · docs/adr/ · docs/context/glossary.md · docs/ guides · INSTALL.mjs · .env.sample
