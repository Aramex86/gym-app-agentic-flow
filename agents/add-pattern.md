# Procedure: add-pattern — document a cross-scenario pattern

1. Name the pattern in one line (e.g. "change-flag invalidation").
2. Create `docs/patterns/` if it does not exist:
   - `docs/patterns/README.md` is the registry — one line per pattern:
     `- [<name>](./<pattern-name>.md) — <problem it solves, one line>`
   - write `docs/patterns/<pattern-name>.md`:
     - what problem it solves (1 paragraph)
     - the minimal example (≤20 lines, taken from this repo, not invented)
     - when NOT to use it (1 paragraph)
3. Register the pattern in `docs/patterns/README.md` — the registry is the
   discoverable link. The code that uses the pattern carries a plain pointer
   comment: `// pattern: <name> — see docs/patterns/<pattern-name>.md`
4. Code using the pattern must already exist in this repo — patterns are
   extracted, not predicted.

Verify: `pnpm lint` + `pnpm typecheck` + `pnpm test` green (a docs-only change
is still CI-eligible — the drift-check runs on every PR).

Land: one commit `docs/pattern-<name>`, open a PR.