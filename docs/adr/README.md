# Architecture Decision Records — factory kit

Decision law (2.9, user 20.11): decisions live in FILES, not in chat.
Settled by the human OUTSIDE the machine (grill session with Igor) —
the factory only CONSUMES them and the committer files them.

## Laws

1. ADR lives in `docs/adr/000N-<slug>.md`, numbered in order.
2. An ADR is NEVER edited after acceptance. A changed decision =
   a NEW ADR that supersedes the old one (link both ways in the
   "Superseded" line). History is sacred — no stealth rewrites.
3. Task cards and plans must CITE the ADRs they rely on
   (`ADR-000N`), not re-explain the decision.
4. When a task touches a domain covered by an ADR, the ADR is the
   authority: the planner plans WITHIN it, never против него.
   Conflicting with an ADR = propose a superseding ADR to the human.
5. Committer, after a PASSed circle: any `SETTLED:` lines of the task
   card + the human's inline decisions → filed as a new ADR (next
   number) in the same commit, by the committer, after the Y.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| 0001 | Adopt the ADR process + glossary artifacts | accepted |
| 0002 | Rail & model resolution law (smoke-before-fanout) | accepted |
| 0003 | Grilling outside the machine + provenance protocol | accepted |
| 0004 | Budget & money honesty (estimate, cap=circuit-breaker) | accepted |
| 0005 | Zero-dep / zero-network default | accepted |
| 0006 | Board honesty & day-close protocol | accepted |
| 0007 | Secrets presence & full-sandbox law | accepted |
| 0008 | Model resolution law (supersedes 0002 #2) | accepted |
