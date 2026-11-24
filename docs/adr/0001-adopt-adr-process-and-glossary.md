# 0001 — Adopt the ADR process + glossary artifacts

- **Status:** accepted
- **Date:** 2026-11-20
- **Deciders:** Veaceslav (grill session with Igor, outside the machine)

## Context

The factory had no persistent memory of settled decisions: they lived in
chat, changelogs and the roadmap. Task cards reached the planner with
implicit assumptions; the same domain terms were re-explained in every
contract. Pocock pipeline comparison (2.9) exposed the pattern: ADRs +
a glossary.

## Decision

Adopt two artifacts, both machine-consumed:

1. **ADRs** in `docs/adr/000N-<slug>.md` (index: `docs/adr/README.md`).
   Grilling stays OUTSIDE the machine (human + Igor). The factory
   receives only the RESULT: settled decisions as ADRs. An ADR is
   only ever superseded, never edited post-acceptance.
2. **Glossary** in `docs/context/glossary.md`. AGENTS.md and role
   contracts reference it instead of re-explaining terminology.

The planner reads the ADR index and the glossary FIRST, before planning
(map-first, sibling of 2.7). The committer files newly settled decisions
as ADRs after the human Y (phase 4 item 2.9).

## Consequences

- Chat memory is no longer load-bearing; decisions survive profile
  switches, new repos and cold starts.
- The human has one more small duty: grill → ask Igor to file the ADR.
- Conflicting with an accepted ADR requires proposing a superseding
  one — no silent drift.

## References

- Roadmap: phase-4 item 2.9; 2.7 map-first; 2.5 lessons (related, different layer)
- Pocock pipeline draft, 20.11
