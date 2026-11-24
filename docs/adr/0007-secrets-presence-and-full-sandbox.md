# 0007 — Secrets presence & full-sandbox law

- **Status:** accepted
- **Date:** 2026-11-23
- **Deciders:** settled by the Numbers smoke (23.11) finding №3 and dual review (leg 1 R5, leg 2 §1.4.2)

## Context

The sandbox inherits a partial copy: `.mcp.json`, passport, task doc — but
not `.env`. A rail-#1 hop in a worktree went to the default dead rail
silently; missing secrets surface as confusing provider 401s instead of
honest stops. Also proven: the tester/developer ran fine only after `.env`
was copied by hand.

## Decision

1. The sandbox receives a COMPLETE environment: `.env` is copied into the
   worktree at circle start (gitignored both sides), like `.mcp.json`.
2. **Secrets-presence law:** before a rail-#1 hop spawns, the engine verifies
   the secrets its rail requires exist (e.g. `OLLAMA_API_KEY`); a missing
   secret is an honest stop "missing secret", never a 401 mystery.
   **Copilot-rail exception (master, 24.11):** rail #2 auth = the CLI login
   state from the company plan (`copilot login` on the user's PC); the
   pipeline never asks rail #2 for a key — missing-secret stops are
   rail-#1 only.
3. Secrets are verified present, never printed; log env-var NAMES only
   (the `(sk|ntn)` argv-mask regex is retired as security theater — the
   token travels in env, which is never logged).

## Consequences

- "Sandbox" naming stays scoped: it is a git-layer wall (worktree) — a
  process-level container for enterprise mode is a separate future
  subsystem, NOT part of this law.
- Provider auth mystery = broken engine contract; treat as a bug.

## References

- Numbers smoke 23.11; leg 1 R5; leg 2 §1.4
