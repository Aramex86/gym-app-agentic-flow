---
name: fsaa-where-ui-goes
description: > Where UI goes in an FSAA app. Use when creating screens,
  components, routes or data access - load before writing any UI code.
---

# Where UI goes - agent navigation for FSAA apps

## You are here

You are a coding agent on an app built from an FSAA template. The contract is
`AGENTS.md` (CI-enforced, every rule has a check marker). Step-by-step
procedures live in `agents/`. This file NAVIGATES and does not duplicate:
when a procedure is needed, open the referenced `agents/*.md` file.

## The map

- `src/pages/` - routes only: `src/pages/<Name>Page.tsx` registered in `src/pages/router.tsx`; `src/app/` is bootstrap only. No business logic.
- `src/features/<feature>/` - scenarios: `index.ts` (public API), `ui/` (components),
  `config/` (columns / options, plain data)
- `src/entities/<noun>/` - cross-feature data + ALL business logic: `index.ts`,
  `types.ts`, `api.ts`, `slice.ts` - flat in the entity folder
- `src/shared/ui/` - domain-free primitives (used by 2+ slices -> graduate here)

Imports flow downward only, enforced by `eslint.config.mjs`.

## Where UI goes

- New screen -> `src/features/<name>/ui/`. Then register the route:
  - `src/pages/<Name>Page.tsx` - thin, composes `@features/<name>`; register `<Route>` in `src/pages/router.tsx`
- Never: UI in route files beyond thin composition, business logic inside `ui/`,
  `fetch`/`axios` inside `src/features/**/ui/**` or `src/shared/ui/**`.
- Needs data? It lives in `src/entities/` (entity api / slice) - not in the component.

## Boundaries (3 hard rules)

1. No upward imports: entities never import `@features/*`.
2. Features never import features - graduate shared needs down (data -> entities, UI -> shared).
3. Raw `fetch`/`axios` is not allowed in UI layers (AGENTS.md -> "Data").

Violation = CI red. Fix the code or the rule - never bypass the check.

## Before you write (3 questions)

1. Which feature owns this screen?
2. Where does the data live (which entity / api)?
3. Where do the tests go? (`__tests__/` in the same commit - never empty)

Any answer missing -> open `agents/add-module.md` first.

## Wrong -> right

```tsx
// WRONG - data fetching mixed into the route file
// src/pages/SettingsPage.tsx
export default function Page() {
  const orders = await fetch('/api/orders');
  return <OrdersTable orders={orders} />;
}

// RIGHT - thin route composes the feature
// src/pages/SettingsPage.tsx
export const metadata = { title: 'Settings' };

// (feature slice: src/features/settings/ = index.ts + ui/ + config/)
export default function Page() {
  return <SettingsForm />;
}
```

Full slice canon -> `agents/add-module.md`. Pattern registry -> `docs/patterns/README.md`.

## Verify (last step, never skip)

- `pnpm lint` + `pnpm typecheck` + `pnpm test` - all green
- `node scripts/check-agents-md.mjs` - drift-check green
