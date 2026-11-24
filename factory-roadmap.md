# Factory Roadmap — phases & work items

> The structured board so nothing is forgotten. Narrative history lives in factory-changelog-*.md.
> CANON BOARD lives with the project (notes/gym-app/factory-roadmap.md); this kit copy mirrors it.
> Legend: ✅ done · 🔧 in flight · ⏳ queued · ⏳P pending-law (self-test red until built) · ❄ parked

## PHASE 1 — skeleton (✅ CLOSED)
- ✅ run-agent.mjs · AGENTS.md dispatcher · role contracts · trace black box · flow v1 · eval v1

## PHASE 2 — exam & honesty (✅ CLOSED)
- ✅ machine gates · verdict law · fix loop · golden task · SCOPE/plan-contract/secrets laws · escalation ladder

## PHASE 3 — senses, board, costs, docs (✅ CLOSED 17.11)
- ✅ trace v3 · telemetry · pnpm commands · HTML/auto report · committer in-console · flow-kit
- ✅ planner tournament · MCP transport (Stitch read · Notion read · sandbox copy)
- ✅ Notion door v2 · board descriptions · docs layer
- ✅ Copilot provider: rail #2 live, first full circle boarded-to-push (18 premium, opus 15x)
- ✅ tails CLOSED 18.11: Stitch advisory PATCH · DONE hygiene · door --next opener · f2e INSTALL dry-run (kit bugs fixed: .gitignore .env hole, idempotent append)

## PHASE 4 — self-service (🔧 OPEN; queue sorted 24.11 after review rounds 1-4)

### ✅ CLOSED in phase 4
- 1. self-tests #1 — 19.11: 19 exhibits, CRLF-immune (ff9271a), win all-green;
  now 23/23 (ST-20 TUI · ST-22 verdict-verification · ST-23 budget).
- 1.5 RESEARCHER v1 — 19.11, LIVE x2: ecosystems.js (node+python: uv/poetry/pip),
  read-only ONE artifact, PROFILE GATE, passport rides sandbox (946c56b).
- 1.2 PM-PROFILE CARD — 19.11, live both worlds (pnpm + uv), ST-17/ST-19.
- TRUST CORE — 24.11 (review rounds 1-4, deepseek-v4-pro:cloud; 3 fix batches
  3b81de7→3ffe7a1): machine-verified verdict law (engine re-runs passport gates
  incl. build, stderr visible; FAIL circles recorded) · behavioral ST-6/22/23 ·
  ADR-0007 LIVE (.env→sandbox, missing-secret stop rail#1, copilot = company
  login) · budget ledger + circuit breaker (cap via .env, guard before --fix) ·
  opencode rail DELETED (ADR-0002) · ADR-0008 model resolution ·
  no-silent-catch in telemetry · trace: N-gates/dedupe/circle_end · MCP
  de-duplicated 24.11 (one .mcp.json at root; env table in MODELS-AND-ENV 3a).
  **REVIEW = STANDING PRACTICE: major engine change → adversarial review by
  another model BEFORE push (rounds live in docs/design/).**
- 2.9 POCOCK ADOPTION — 20.11 (ST-21): docs/adr/ (template · README+law ·
  ADR-0001) · glossary · planner READ FIRST (glossary → ADR index → repo map) ·
  committer files SETTLED → ADR after Y.
- 3/TUI V1 — 20.11 + WINDOWS 21.11: honest bar, ledger, JSON wall→fact line,
  ST-20; live-circle criterion on next circle. V2 4-pane (~3-4h) · V3
  TG-mirror (~2h); pure ANSI (zero-npm-deps law).
- 5 sandbox autosync — copy-to-main ✅ built (ST-7).

### ⏳ QUEUE (priority top→bottom)
- NEXT · 2 DOCTOR AGENT (report-only) + DOOR-FACTORY (presets: notion →
  openproject/github)
  └ MODE LAW (20.11): ADR/grill = one-shot-dev mode; enterprise = BA upstream
    (HLD/ADR/стори → готовые таски), factory от таска; door preset enterprise =
    consuming BA tickets.  └ 2.10 MODE SWITCH — EXCLUDED (user 20.11):
    пер-картное поведение уже вытекает из 2.9; тумблер = овер-инженерия.
  └ AGENT ROLE №6 offboard (20.11): SCOPE = сама ФАБРИКА (упавшие хопы/гейты/
    honest-stops, дрейф движка, аномалии $/времени); read-only, ONE artifact
    diagnosis-report.md, ремонт только через обычный круг; ~2-3ч + ST-экспонат
  └ lessons: per-project docs/factory-lessons.md; global only on user command;
    every closed bug → lesson + self-test exhibit
- 2.5 AUTO-ADLC loop (LangSmith pattern, ported LOCALLY): trace → issues
  clustering, regression watch, closed bug auto-экспонат + scoreboard row
  └ KNOWLEDGE GAP FLAG (21.11): хопы флагают пробелы знания в trace
    (`knowledge_gap` {role, what}); doctor/ADLC читают первыми.
- 2.6 CONTEXT HYGIENE — MINIMAL (LangChain pattern, idea 20.11): offload gate
  (>20K tok tool result → head+tail+path) + window telemetry; engine-side.
- 2.7 GRAPHIFY (moved from parking, user 20.11): КАРТА ПРОЕКТА — visual graph
  (modules/imports/dependency direction → HTML navigator); seed = map.mjs text
  map (zero tokens); zero-network. planner: map FIRST, walk on demand (2.6).
- 2.8 TOOL AUDIT JOURNAL (LangSmith Gateway pattern): tool_use хопа →
  tools.jsonl в ране (парс транскрипта пост-хопом, ноль deps; журнал
  denied/allowed).
- 2.5b DESIGN SKINS: designer exports Figma frames PNG → tasks/<name>/design/*.png
- 1.3 INSTALL-GUARD (remainder; .env→sandbox part DONE in ADR-0007): INSTALL.mjs
  stdin-death bug (readableEnded-first + argv --name) + adopt-not-stomp law
  (inventory → conflict report → Y per conflict; foreign AGENTS.md/agents/
  untouched; factory into .factory/; passport DEFAULT on INSTALL). JobCopilot
  port = the live proving ground.
- 3 GATES (unified Y-gate · remote TG Y-gate · batch mode) — after TUI V2/V3.
- 4 RESUME flag · 6 eval:run-all in kit · skins cycle into circles.
- strict re-test offer: first python circle PASSed statically (tester had no
  pytest permission then); next circle on 946c56b flow runs pytest LIVE.

## BUDGET LAW (hard)
- cap = what master sets via PIPELINE_BUDGET_USD (in .env); unset = unlimited — ADR-0004 (no default number; the $100 line below is historical example)
- rail #1 circle ≈ $3-7 · rail #2: sonnet circle ≈ 4 premium, opus circle = 18 premium
- plans via sonnet/deepseek by default; opus only for complex plans (≤2-3/mo)
- ✅ FALLBACK PLANNER PROVEN 19.11: deepseek dies on weekly credits →
  planner = kimi-k2.7-code (golden PASS 274s, 0 fixes, $0.41 plan leg;
  kimi-k3.1-pro rejected: $2/$10 per 1M too expensive)
- ✅ FULL CIRCLE on kimi-k2.7-code (all roles) = PASS 274s · $1.14 —
  cheapest proven circle; benchmark «rail #1 circle ≈ $3-7» → kimi ≈ $1.1

## PARKED (❄)
- PLAN-SCORE in eval (parked by user 19.11): mechanical answer-key
  grade of the plan -> scoreboard column; A/B k3.1-pro EXCLUDED by
  user 20.11 (fallback kimi-k2.7-code proven)
- PLANNER ROUTER — tiered planner routing (user idea 19.11, from GPT-6.2
  Astra/Sol two-model-router pattern): L0 routine → deepseek rail #1 ·
  L1 default → sonnet (4 premium) · L2 complex → opus (18 premium, ≤2-3/mo);
  tier field on task card (human sets, researcher may propose read-only
  later); agents-pipeline.yaml 3 planner profiles + flow.mjs reads tier;
  default L0 backward-compat; ~2-4h when scheduled
- CLI independence (user idea 18.11): 3-path spike card (opencode rail /
  own minimal runner / hybrid); own runner honest but harness-risk on
  flash models; revisit if Anthropic/VS Code dependency actually bites
- designer role (read-only Stitch consult) · parallel reviewers ·
  Playwright e2e hop · durable sessions
- Graphify → moved to PHASE 4 as 2.7 (user 20.11, zero-network spike)
- identity law enforcement (⏳P ST-8): committer must run with repo-local
  user.name/email — documented in README-INSTALL, engine guard pending
