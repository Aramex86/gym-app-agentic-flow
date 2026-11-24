# 0006 — Board honesty & day-close protocol

- **Status:** accepted
- **Date:** 2026-11-23
- **Deciders:** DONE hygiene law 18.11; extended by the 23.11 process review (leg 3)

## Context

Board DONE-hygiene ("machine gates PASS ≠ done") lived in a board footer,
absent from the glossary; day-closes were agent-written and agent-verified
with no external check; day-close must also surface what waits for the human.

## Decision

1. A circle is DONE only when its card reached Done — machine gates PASS is
   necessary, not sufficient; the human (or door) moves cards, never agents.
2. Day-close requires: (a) cards left in In Progress listed, (b) provenance
   tags on the day's decisions (ADR-0003), (c) a «ЖДЁТ ТЕБЯ» list — the
   decisions awaiting the human. A close without (c) is not a close.
3. HANDOFF.md is the single canonical NOW-file: updated at EVERY day-close,
   carrying the now-block (current work, «ЖДЁТ ТЕБЯ», next action, priority
   order). Board + changelog + journal are history; a restarted thread reads
   HANDOFF first and is DONE unless the files it names exist (path check, stop
   and ask).
4. Changelog files carry date-RANGES in their names; multi-day folds are
   declared, not discovered.

## Consequences

- The owner's day-close duty shrinks to reading the «ЖДЁТ ТЕБЯ» list.
- Stale HANDOFF = the process's own honest-stop violation.

## References

- docs/design/2026-11-23-factory-process-review.md §1, §5; board footer law 18.11
