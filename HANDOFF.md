# Factory HANDOFF — single canonical NOW-file (law: ADR-0006)

> A restarted thread reads THIS file first and is DONE unless the paths it
> names exist (if missing — STOP and ask, do not guess). Everything else
> (roadmap, changelogs, journal) is history; the "now" lives here.
> Language law: key behavioral laws are mirrored in EN (this header).

## NOW (updated every day-close; last: 24.11)

- **Current work:** 23.11-24.11: 4-leg review closed → trust-core batches
  1+2 shipped: machine-verified verdict law (3b81de7), budget ledger +
  circuit breaker (0d29dab), opencode de-defaulted (wall lives on the
  chosen rail), `--fix` now guarded, flow loads `.env` (cap from .env
  works), glossary/README budget drift reconciled; batch 2: opencode rail
  DELETED (config error), ADR-0008 (model resolution, supersedes 0002 #2),
  ADR-0007 enacted (.env→sandbox, missing-secret stop, mask retired),
  eval.mjs R2 fixed, no-silent-catch in telemetry + trace events
  (N-gates/circle_end/dedupe). 23/23 self-tests.
- **ЖДЁТ ТЕБЯ (decisions awaiting the human):**
  1. ADR on foreign repos whose .gitignore ignores docs/adr/ — commit went
     in WITHOUT the ADR file (PREDLOZHIL: keep ADR local; awaiting SKAZAL).
  2. Batch 2 (PREDLOZHIL): realize ADR-0007 (.env → sandbox copy,
     missing-secret honest stop, retire (sk|ntn) mask) + eval.mjs R2 +
     trace events (N-gates, circle_end, dedupe) — awaiting «делаем?».
  3. Re-review №2: 2 of 3 bypasses closed (trace_base — fixed in batch 1.5,
     flow + eval); re-review №3 (24.11, round3.md) closed the batch
     + batch 2 executed the same day: opencode rail deleted, ADR-0008,
     ADR-0007 enacted, R2 eval, tracing events.
- **Priority order (frozen 23.11):** verdict law → 1a behavioral tests →
  1.3 install-guard extended (passport default · .env → sandbox · wall on
  chosen rail · opencode default dies) → cost circuit-breaker → doctor →
  2.5 (no clustering) → 2.6-2.8 → 3. THEN: TUI V2/V3, heartbeat/license
  (at 3+ seats). Full texts: docs/design/2026-11-23-factory-*.

## KEY LAWS (EN mirror of the load-bearing ones)

- Protocol: idea → plan → «делаем?» question → ок → code. NEVER jump into
  code; never mutate the human's machine without explicit ок (lesson 18.11).
- Agents never commit/push/merge; commits only via the tool after a human Y;
  merges human-only. Sandbox per circle (git worktree); artifacts gitignored;
  the git wall is the rollback line: no-merge = discarded.
- Grilling happens OUTSIDE the machine (ADR-0003); provenance tags mandatory.
- Secrets: env only; the sandbox gets a complete env or the hop stops with
  "missing secret" (ADR-0007). Smoke hop before any fan-out (ADR-0002).
- Budget: reported $ is an ESTIMATE; cap via PIPELINE_BUDGET_USD is a
  circuit breaker, unset by default (ADR-0004).
- Zero deps / zero network by default (ADR-0005). Traces never leave the house.

## Суть машины (одной строкой)

Клико-фабрика: задача → planner (спека в docs/plans/X-plan.md) → Y-gate юзера → developer в worktree (feat/X) → tester (docs/plans/X-report.md) → committer → PR; все роли = CLI-хопы через run-agent.mjs; законы: SCOPE (только tracked), plan-contract, secrets env-only, agents НЕ push/merge.

## Path map (canonical; if any path does not resolve — STOP and ask)

- Kit (canonical): /opt/data/notes/factory-kit/ (= /opt/hermes-agent-server/data/notes/factory-kit, same volume symlink — never double-edit).
- Master board: notes/gym-app/factory-roadmap.md
- Journal: notes/gym-app/factory-changelog-*.md (date-RANGES in filenames)
- Smoke artifacts: notes/gym-app/numbers-smoke/
- User protocol (RU, source of truth): «идея → план → вопрос "делаем?" → ок → код. Меняющие действия на машине юзера — только после явного ок. Caveman-стиль выключается "normal mode"; базовый русский чат, артефакты EN.»

## Rails quick-reference (full: docs/MODELS-AND-ENV.md)

- Rail #1 (claude CLI + Ollama Cloud): env only (settings.json does not
  work); smoke `claude -p "Reply exactly with MODEL_OK" --model <id>` before
  any fan-out (ADR-0002). ЖЕЛЕЗНО: 12.11 minimax ×1951 = fan-out без smoke.
- Rail #2 (Copilot CLI): VS Code table beats frontmatter; argv-only spawn,
  32k guard; billing = premium requests.

## Landmines (top-of-file, not parenthetical)

- Never fan out without the smoke hop; background node can outlive a
  project switch — kill node, touch .pipeline-stop.
- PowerShell 5.1 UTF-8/BOM quirks → the toolchain stays plain Node.
- A foreign AGENTS.md can bind hops with ITS first-step laws (Numbers,
  23.11): task cards in foreign repos must carry the SETTLED env-law block.
