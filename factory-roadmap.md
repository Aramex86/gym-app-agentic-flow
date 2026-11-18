# Factory Roadmap — phases & work items

> The structured board so nothing is forgotten (user rule, 16.11).
> Narrative history lives in factory-changelog-*.md; this file is the board.
> Legend: ✅ done · 🔧 in flight · ⏳ queued · ❄ parked

## PHASE 1 — skeleton (✅ CLOSED)
- ✅ run-agent.mjs: CLI transport, role contracts frontmatter, worktree
- ✅ AGENTS.md dispatcher + agents/*.md (planner/developer/tester/committer)
- ✅ trace.mjs black box (JSONL spine)
- ✅ flow v1: 3 Y-gates + fix loop; eval v1 golden exam

## PHASE 2 — exam & honesty (✅ CLOSED)
- ✅ machine gates (artifact exists) + verdict law v1 (word regex)
- ✅ fix loop bounded (max 3) · .pipeline-stop kill-switch (exit 130)
- ✅ golden-toggle-chip golden task · answer-key scoreboard
- ✅ laws: SCOPE (tracked files only) · plan-contract (no dev-commits) ·
  secrets env-only · agents never push/merge
- ✅ escalation ladder H1/H2/H3 · honest stop = architecture

## PHASE 3 — senses, board, costs, docs (✅ CLOSED 17.11 — closed via Copilot provider, last item)
- ✅ trace v3 · token/cost telemetry (2 paths)
- ✅ pnpm commands (flow/flow:fix/eval/trace/agent/report)
- ✅ HTML report · auto-report after circle (zero tokens)
- ✅ committer in-console (battle ×4)
- ✅ flow-kit (engine + skeletons + INSTALL.mjs)
- ✅ planner tournament → deepseek-v4.1-flash
- ✅ MCP transport: Stitch read ×6 · Notion read ×8 · sandbox .mcp.json copy
- ✅ Notion door v2 (FIFO/by-id · Description→tasks · stdout contract)
- ✅ board descriptions 20/20 (GOAL/SCOPE/BEHAVIOR)
- ✅ docs layer (factory-guide · day changelogs · eval-guide)
- ⏳ tails: Stitch advisory PATCH (waiting ok) · board DONE hygiene ·
  kimi-k3.1 A/B leg + golden-toggle-chip PASS row · door --next in battle ·
  Copilot provider (model list) · doc commits (changelog 16.11 + arch v3 map
  + factory-guide renumber + AGENTS/README lines) · flow-kit e2e INSTALL
  (candidate: JobCopilot Python port)

## PHASE 4 — self-service (🔧 OPEN, priority order)
1. ⏳ self-tests #1 — engine examines itself (<60s):
   verdict window · door stdout contract · .mcp.json→sandbox ·
   tester Write right · plan no dev-commits · artifact mtime ·
   docs/plans copy-to-main law
2. ⏳ doctor agent (report-only) + door-factory (presets: notion → openproject/github)
   └ MEMORY SCOPE (user idea 17.11): lessons are per-project by default (docs/factory-lessons.md in repo); GLOBAL lessons live in flow-kit (engine/factory-lessons-global.md) — created/merged ONLY on user command (pnpm flow:lesson --global); doctor reads project first, then global every closed bug becomes (a) a lessons entry (symptom→cause→recipe) in docs/factory-lessons.md, (b) a self-test exhibit; doctor matches new symptoms against lessons first — no model training, files are the memory
2.5 ⏳ DESIGN SKINS (no Figma access by design): designer exports frames as PNG from the Figma UI -> tasks/<name>/design/*.png -> task card advises 'read design/*.png before styling' -> hop Read()s the image (vision already works) · flow copies the design/ folder into the sandbox with the task doc (law fix)
3. ⏳ unified Y-gate (plan+diff+tests+commit one surface) · remote TG Y-gate
4. ⏳ batch mode (pnpm flow:batch)
5. ⏳ RESUME flag (plan exists → skip planner)
6. ⏳ sandbox autosync with develop · artifact copy-to-main (law, closes today's loss)
7. ⏳ eval:run-all in kit
8. ✅ Copilot provider — CLOSED 17.11: PIPELINE_CLI=copilot rail #2 live; first combat hop tester/truth-disclaimer PASS 168s on claude-sonnet-5.5 (premium billing, usage-JSON telemetry); engine bugfixes ST-1..ST-4 in experiment-state

## PARKED (❄ not scheduled)
- designer role (read-only Stitch consult; user parked)
- parallel reviewers · Playwright e2e hop · durable sessions
- Graphify private knowledge layer (zero-network spike required)

# Daily board hygiene (law)
- Igor appends done/queued here at every day close; changelog carries the how.
- Anything remembered mid-week belongs here BEFORE it is forgotten.
