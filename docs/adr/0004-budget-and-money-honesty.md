# 0004 — Budget & money honesty law

- **Status:** accepted
- **Date:** 2026-11-23
- **Deciders:** settled across 17.11/19.11/20.11 amendments; frozen as ADR by the 23.11 process review

## Context

The budget law mutated three times ($100 → kimi fallback → estimate
honesty) and each amendment was a re-decision. The TUI displays a cap that
enforces nothing (review R4/M2). Cost anomalies (minimax ×1951) were caught
after the fact.

## Decision

1. **Reported $ is an engine ESTIMATE**: rail #1 uses the claude-CLI rate
   table; real billing lives at the provider. Compare circles with it;
   reconcile against provider dashboards before calling it spend.
2. **Rail #2 currency is premium requests** — counted, never converted to $.
3. **Cap**: unset by default; `PIPELINE_BUDGET_USD` (env) sets it. When set,
   it is a CIRCUIT BREAKER, not a label: month-to-date spend from the trace
   vs cap → hard honest stop before new hops (queue item 4).
4. Every hop prints its cost line (tokens + source); cost missing from a
   provider path is printed as `n/a`, never synthesized.

## Consequences

- Amendments to this law mutate THIS ADR's amendment log or supersede it —
  never re-litigated in three files.

## References

- Roadmap BUDGET LAW + TELEMETRY HONESTY; leg 1 R4 / leg 2 M2
