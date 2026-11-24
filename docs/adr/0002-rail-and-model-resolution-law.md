# 0002 — Rail & model resolution law (smoke-before-fanout)

- **Status:** accepted
- **Date:** 2026-11-23
- **Deciders:** settled by incident history (minimax ×1951 burn, 12.11 random-resolution); promoted to ADR by the 23.11 process review

## Context

Model resolution was re-derived per task and scattered across three files.
Two incidents (minimax-m3.1-flash ×1951 calls burning real money; random
model resolution after a VS Code project switch) share one root: fan-out
without a resolved-model check.

## Decision

1. `PIPELINE_CLI` has no silent default that mutates git: `claude` and
   `copilot` are the documented rails; the undocumented `opencode` rail is
   removed from the factory default (queue item 3) — a rail without a tool
   wall does not exist.
2. Model resolution: ~~RUN_MODEL → yaml table → role contract~~ —
   **SUPERSEDED by ADR-0008** (frontmatter-first on rail #1 per rail).
3. **Smoke before fan-out:** before any multi-hop work on an unfamiliar
   CLI/model/endpoint, one cheap probe hop (`MODEL_OK` smoke) must return
   the expected token. Failures end in an honest stop — never a fan-out.

## Consequences

- Every future rail addition must implement: model resolution, tool wall,
  billing unit, MCP trust — or it does not ship.
- The smoke law is an engine guard candidate (queue), not prose.

## References

- HANDOFF "ЖЕЛЕЗНО" bullet; dual review 23.11 leg 2 §1.1
