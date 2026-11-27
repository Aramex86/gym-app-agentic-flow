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

- CLI PREFLIGHT LAW (queued 25.11, master approved "v merch"):
  a) flow.mjs start: check rail CLIs before planner hop
     (claude --version / copilot --version) — missing CLI = honest one-line
     stop BEFORE any $ is spent:
       "rail <name> needs <npm-package> -> npm i -g <npm-package>"
  b) run-agent.mjs spawn guard: ENOENT from CLI -> same MISSING CLI line,
     never a cryptic ENOENT from the depths;
  c) silent auto-install = DENIED (zero-network default, master approves
     env mutations); optional PIPELINE_AUTO_INSTALL_CLIS='1' is a separate
     later decision, not part of this law;
  d) ST: no-CLI start stops clean with the install line (27/27 extended).
- PROJECT CONTRACT LAW (queued 25.11, master-approved):
  1. FSAA defaults NEVER enter a non-FSAA project (Numbers lesson: conflicts
     from injecting FSAA layer checks into a repo that never declared FSAA).
  2. Passport carries `contract: fsaa | custom | none`:
     fsaa -> layer/check-marker laws live; custom -> only the repo AGENTS.md
     rules; none -> universal gates only (lint/typecheck/test/build from the
     real package.json) — zero architecture assumptions.
  3. AGENTS.md of the repo is read by the RESEARCHER only, into the passport
     (machine-parseable: check-id -> one line -> exact quote). Other agents
     see laws through the passport. No AGENTS.md -> passport honestly says
     "no project contract".
  4. AGENTS MIRROR: tester report ends with a compliance table
     (rule -> our file:line -> ok/violation) in terminal/trace/UIConsole —
     the human sees divergence at the gate, not mid-verification.
  5. AGENTS.md SEED (an OFFER, never an insert): repo without AGENTS.md ->
     researcher offers the human a draft built from repo FACT
     (stack from package.json, layers as they exist, commands, do-not-touch
     list), written as AGENTS.md.draft; human edits and commits personally.
     Silent insertion is denied.
- PR-REVIEW GATE (queued 25.11, master picture "review PR rows"):
  every PR (kit or client repo) gets an automatic adversarial review hop on
  its diff (diff via GitHub REST); reviewer model != builder model;
  report = P1 blockers / P2 wishes, P1 blocks the merge until fixed;
  the human still merges — the machine only adds eyes.
  Impl: flow --review <repo> <pr-number> -> review hop -> report to chat/file;
  ST: P1 in report = merge denied by check.
- INSTALL-GITIGNORE LAW (master 26.11): INSTALL.mjs writes a MANAGED block
  into the project .gitignore automatically:
  .factory/ .factory-local/ .pipeline/ work/ .env
  idempotent (no duplicates), adopt-not-stomp (never delete user lines;
  conflicts reported to the human with a Y gate). All factory files stay
  out of git status after install. Part of 1.3 INSTALL-GUARD.
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
  ST-20; live-circle criterion on next circle. V2/V3 PARKED 25.11 (user:
  concentre on UI Console — the views live there; pure ANSI still holds for V1).
- 5 sandbox autosync — copy-to-main ✅ built (ST-7).

- 2.6b ✅ SANDBOX-EXCLUDE LAW — CLOSED 27.11 (ST-33, 32/32):
       scripts/sandbox-exclude.mjs (zero-dep, honest fail-line), drift-check
       marker `sandbox-exclude` in AGENTS.md, passport keys `test-exclude`,
       `test-targeted`, `ui-libs` now readable (hyphen regex fixed — the
       Numbers research gap). Researcher contract writes test-exclude:
       work/**. `--cleanup` after merge remains the human step.

### ⏳ QUEUE (priority top→bottom)
- 2. ✅ DOCTOR AGENT — CLOSED 25.11 (PR #7/#12, ST-26, CI exit contract):
  read-only diagnosis from traces (hop failures, N-gates, cost-blind, outliers,
  stale sandboxes, drift pointer) + auto-diag (doctor at 1st circle/day).
  DOOR-FACTORY presets → still ⏳ (see 2. door sub-items below).
  └ MODE LAW (20.11): ADR/grill = one-shot-dev mode; enterprise = BA upstream
    (HLD/ADR/стори → готовые таски), factory от таска; door preset enterprise =
    consuming BA tickets.  └ 2.10 MODE SWITCH — EXCLUDED (user 20.11):
    пер-картное поведение уже вытекает из 2.9; тумблер = овер-инженерия.
  └ AGENT ROLE №6 offboard (20.11): SCOPE = сама ФАБРИКА (упавшие хопы/гейты/
    honest-stops, дрейф движка, аномалии $/времени); read-only, ONE artifact
    diagnosis-report.md, ремонт только через обычный круг; ~2-3ч + ST-экспонат
  └ lessons: per-project docs/factory-lessons.md; global only on user command;
    every closed bug → lesson + self-test exhibit
- 2.5 ✅ AUTO-ADLC — CLOSED 25.11 (PR #10/#12, ST-27): trace → issues loop
  (clusters by real event shapes, regressions, closed classes → auto-exhibit
  candidates), knowledge-gap writer wired (run-agent + contracts) + surfaced
  FIRST; hospital automation: adlc auto-runs after every 5th circle
  (PIPELINE_AUTO_DIAG=0 opt-out).
  └ knowledge gaps still pending first real production data (gaps in fights)
    (`knowledge_gap` {role, what}); doctor/ADLC читают первыми.
- 2.6 CONTEXT HYGIENE ✅ DONE 27.11 (ST-40/ST-41, 39/39): honest scope — the
  engine cannot see CLI-internal tool results, so the gate applies to what it
  DOES control: engine-fed in-file/ctx >20K tokens -> head+tail+path, full
  body in run artifacts. `window_usage` trace event counts input+cache_read
  against PIPELINE_CONTEXT_WINDOW (default 200k), warns at >=90%. Honest
  chars/4 token proxy; no model calls, zero deps.
  └ TARGETED TESTER HOP — DONE 27.11 (ST-34, 33/33): flow computes the
    changed-file gate before the tester hop and passes PIPELINE_TEST_CMD;
    tester runs only mapped tests (full suite = nightly). Tool wall allows
    pnpm/npx vitest. Requires passport `test-targeted` (now readable — #30).
- 2.8 TOOL AUDIT JOURNAL ✅ DONE 27.11 (ST-38, 36/36):
  `scripts/tool-journal.mjs` — pure `auditTools(rows)`, CLI transcript adapter,
  appendJournal -> tools.jsonl per run; run-agent wires it post-hop. Real
  transcript check: 25 allowed / 3 error / 28 rows. Secrets redacted in logs.
- CLOSED-CLASS HOP FAILURE ✅ DONE 27.11 (ST-37, 35/35): doctor downgrades
  a failed hop to INFO when a LATER run of the same circle (resume- prefix
  stripped) has a green hop_end of that role or a PASS verdict. Pure seam
  `classifyHopFailure(failure, runs)`; real doctor + literal test runs are
  the two adapters. Open failures stay ERROR (--fail-on-error still honest).
- 2.5b DESIGN SKINS: designer exports Figma frames PNG → tasks/<name>/design/*.png
- 1.3 INSTALL-GUARD (remainder; .env→sandbox part DONE in ADR-0007): INSTALL.mjs
  stdin-death bug (readableEnded-first + argv --name) + adopt-not-stomp law
  (inventory → conflict report → Y per conflict; foreign AGENTS.md/agents/
  untouched; factory into .factory/; passport DEFAULT on INSTALL). JobCopilot
  port = the live proving ground.
- 3 GATES (unified Y-gate · remote TG Y-gate · batch mode) — after UI Console
  (the gate buttons live in ui.mjs; TUI v2/v3 parked 25.11).
- 4 ✅ RESUME CHECKPOINTS — CLOSED 25.11 (combat-proven same day, $0.59 vs $3.15
  ×2 redo): sandbox + paid plan preserved on any mid-circle death;
  `flow --resume <name> [developer|tester|verdict]` skips planner;
  TTY spinner law (curtain banned on every machine) + provider-spam filter +
  --cleanup/--resume argv hardening in the same batch (PRs #14/#15/#16/#17).
- 6 eval:run-all ✅ DONE 27.11 (ST-36, 34/34): `node scripts/eval-all.mjs`
  runs self-tests + doctor + adlc + eval (eval honest-skips with no golden
  file), ONE verdict, injected runner adapter (real spawnSync + CLI module),
  skip != fail. `skins cycle into circles` still ⏳.
- strict re-test offer: first python circle PASSed statically (tester had no
  pytest permission then); next circle on 946c56b flow runs pytest LIVE.

## PHASE 5 — ui + memory (seeded 25.11, master: ONLY these two —
  everything else stays in phase 4)
- 5.1 UI CONSOLE v1 (ADR-0009, plan 25.11): scripts/ui.mjs — zero-dep server,
  localhost:1921, one inlined html; SSE trace tail, reports, state (lock,
  verdict, month-to-date), gate buttons (stdin-bridge), whitelisted commands,
  config-UI (persist via Y). 3 commits: observe → control → config.
  (design 2026-11-25-ui-console-plan.md)
- 5.3 GRAPHIFY (master 27.11: MOVED from PHASE 4 item 2.7): КАРТА ПРОЕКТА —
  visual graph (modules/imports/dependency direction → HTML navigator); seed =
  map.mjs text map (zero tokens); zero-network. Planner: map FIRST, walk on
  demand. No ST-35 was committed — rewrite under Matt codebase-design/tdd
  when Phase 5 reaches this item.
- 5.2 TRACE DB (master 25.11): node:sqlite trace.db beside trace.jsonl — jsonl
  stays append-only truth (rebuildable), db = derived index; doctor/ADLC move
  to SQL (cluster = GROUP BY); --view/--prune (retention 90d/law)/--export;
  annotate allowed, rewrite never. ~2-3h + ST.
  (2.6b CLOSED / 2.6 / 2.8 / 1.3 / 3 GATES stay ⏳ in PHASE 4; GRAPHIFY moved to PHASE 5 by master 27.11)

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
