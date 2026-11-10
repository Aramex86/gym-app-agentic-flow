# Procedure: add-module — add a new feature slice the FSAA way

Given: a scenario `<name>` (e.g. `invoices-overview`).

## 1. Create the slice — three nodes

Create `src/features/<name>/` with exactly three nodes:

- `index.ts` — the ONLY public API of the slice; everything is exported from here
- `ui/` — scenario components. No business logic, no `fetch`/`axios` here, ever
- `config/` — columns / options of the scenario (plain data, testable)

Also create `__tests__/` in the same commit with real test files for the logic
you added. An empty tests folder must never be committed.

## 2. Put logic where it belongs — entities

- Data access and ALL business logic live in `src/entities/`, never in features.
  A feature consumes entity exports; it never contains api/model/types of its own.
- An entity is `src/entities/<noun>/`: `index.ts` (public API), `types.ts`,
  `api.ts` (data access), `slice.ts` (state / business logic) — flat files
  in the entity folder, plus `__tests__/`. ALL business logic lives here;
  features never contain api/model/types of their own. No nested `model/`.
- Shared UI needs go to `src/shared/ui/` (see the Graduation pattern).

## 3. Register the page

- `src/pages/<Name>Page.tsx` — thin: default export composes the `@features/<name>` exports.
- Add the route to `src/pages/router.tsx` (`<Route path="/<name>" element={<Name>Page />} />`).
- Do not put feature code into `src/app/` — bootstrap only.

## 4. Do NOT import another feature

Cross-feature needs? Graduate down: data → `src/entities/`, UI → `src/shared/ui/`.

## Verify

- `node scripts/check-agents-md.mjs` — drift-check green
- `pnpm lint` + `pnpm typecheck` + `pnpm test` — green

## Land

One commit `feat/<name>-slice`, open a PR (no direct pushes to main).