# 0003 — Grilling happens OUTSIDE the machine; provenance protocol

- **Status:** accepted
- **Date:** 2026-11-23
- **Deciders:** Veaceslav (grill 20.11, narrowed mid-session 2.9; provenance tags adopted 23.11 after process review leg 3)

## Context

The most valuable decisions (scope, laws, priorities) were being made in
dialogue but recorded with bare "user ок" stamps — the agent's prediction
of the owner's judgment, laundered into the owner's name. The dual process
review (leg 3) named this the Y-proxy attribution problem.

## Decision

1. **Grilling stays OUTSIDE the machine.** Burst questions, scope choices,
   and settled decisions are a human↔Igor phase; the factory consumes only
   the RESULT (task cards with SETTLED blocks, ADRs). No ask_user machinery
   inside hops.
2. **Provenance tags on every decision record** (board, changelog, handoff,
   ADR Deciders line):
   - `SKAZAL:` — the human said it, verbatim quote + pointer (thread, date).
   - `PREDLOZHIL:` — Igor's proposal, explicitly awaiting Y/N.
   - `SDELAL:` — Igor acted on delegated authority; reversible; reported
     after the fact.
   Bare "user ok" stamps are retired. Retroactive tagging applies to the
   23.11 queue rebuild: tagged `PREDLOZHIL→SKAZAL` (human approved the
   direction, Igor set the specific order).
3. **Delegation cuts reading, never deciding:** a card moves on the human's
   actual answer or recorded silence — the proxy pre-answers only to
   shorten the human's reading, and the answer text is quotable.

## Consequences

- Day-close ends with a «ЖДЁТ ТЕБЯ» list (decisions awaiting the human)
  or the day is not closed.
- Headless delegated runs file their pre-answers as `SDELAL` with the
  tradeoff stated, and the human reviews them at day-close.

## References

- docs/design/2026-11-23-factory-process-review.md §2; ADR-0001 (2.9)
