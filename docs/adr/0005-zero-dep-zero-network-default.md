# 0005 — Zero-dep / zero-network default

- **Status:** accepted
- **Date:** 2026-11-23
- **Deciders:** settled principle (17.11 "our own tools"; TUI pure-ANSI law; Graphify zero-network spike; traces never leave the house); frozen as ADR by the 23.11 process review

## Context

The same restraint was re-argued in ~6 places (2.5 traces never leave the
house, 2.7 zero-network spike, TUI zero-npm-deps, kit engine plain Node).

## Decision

Factory kit artifacts (engine, roles, viewer, docs pipeline) are ZERO npm
dependencies and ZERO network by default. Data the machines produce (traces,
reports, passports, lessons) never leave the owner's machine; deviation from
zero-dep/zero-network requires an ADR naming the exception.

## Consequences

- New subsystem proposals are screened by this law before scheduling.
- Third-party CLIs (researcher rails, future security scanners) are
  passport-declared tools, not kit dependencies.

## References

- Roadmap 2.5/2.6/2.7; claude-design/artifact laws; leg 3 §3.5
