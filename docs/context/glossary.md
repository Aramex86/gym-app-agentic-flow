# Factory glossary (single source of terminology)

Law (ADR-0001, 2.9): AGENTS.md and role contracts REFERENCE this file,
never re-explain terms. If a term is missing here — file the ADR-style
correction, do not invent a local synonym.

## Machine layer

- **circle** — one full pass planner → developer → tester → committer on one task
- **hop** — one role invocation inside a circle (model call + tools)
- **run (rid)** — one flow attempt; directory `.pipeline/runs/<rid>/` with the trace
- **rail** — the transport: rail #1 = Claude Code CLI (Ollama Cloud models), rail #2 = Copilot CLI (premium billing)
- **gate** — machine or human checkpoint in the flow; Y-gate = the human's Y/N
- **verdict** — PASS/FAIL parsed from a role's report; only machine-visible, own-line
- **honest stop** — the engine stops with a reason instead of guessing or faking
- **kill-switch** — `.pipeline-stop` file: any hop exits 130 gracefully

## Memory & honesty layer

- **black box** — trace: append-only JSONL events per run; the machine layer leaves git
- **lessons** — closed bug → `docs/factory-lessons.md` entry; per-project by default, global only on user command (2.5)
- **ADR** — `docs/adr/000N-<slug>.md`, settled decision; superseded-only, never edited (2.9)
- **glossary** — this file; referenced by contracts, never re-explained

## Board & door layer

- **door** — script that moves humans' cards into machine queue (Notion door v2, FIFO); agents never write to the board
- **card** — a task in GOAL/SCOPE/BEHAVIOR form; `SETTLED:` lines = decisions to be filed as ADRs
- **map-first** — planner reads the repo map + ADR index + this glossary first; deep walk only on demand (2.7, 2.9)

## Money layer

- **premium** — Copilot premium-request unit (rail #2 currency); counted, never converted to $
- **budget law** — the cap is env-chosen (`PIPELINE_BUDGET_USD`); UNSET = **unlimited** — no default number, the cap is a choice (ADR-0004); when set, month-to-date from the ledger acts as a circuit breaker before hops; every hop prints its cost line; reported $ is an engine ESTIMATE (rail #1 uses the CLI rate table) — compare circles with it, reconcile with the provider dashboard
