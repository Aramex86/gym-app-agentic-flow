# FSAA for plain React (Vite + react-router)

**Same methodology, same three rules, same ESLint boundaries — for teams NOT on Next.js.**

This is the official FSAA starter for **plain React SPAs**. On Next.js? Use the sibling template: [github.com/Aramex86/fsaa-react](https://github.com/Aramex86/fsaa-react).

- Vite 7 + React 19 + TypeScript + react-router 7
- FSAA layers in `src/` **identical** to the Next.js template
- The **only** difference between the two templates is the pages layer:

| | Next.js template ([fsaa-react](https://github.com/Aramex86/fsaa-react)) | This template (fsaa-vite) |
|---|---|---|
| Pages layer | **App Router itself** (`app/**/page.tsx`, thin routes) | **`src/pages/`** + react-router (thin compositions) |
| app layer | `src/app` conventions + root layout | `src/app/main.tsx` (providers, router wiring) |
| features / entities / shared | identical | identical |
| ESLint boundaries | identical rules | identical rules |

> Methodology & decision rules: [github.com/Aramex86/fsaa](https://github.com/Aramex86/fsaa) · Live docs: [aramex86.github.io/fsaa](https://aramex86.github.io/fsaa/)

## Quick start

```bash
npm install
npm run dev       # http://localhost:5173 — Projects/Orders example inside
npm run lint      # layer boundaries enforced here
npm run typecheck
```

## Structure

```
src/
  app/main.tsx            # app layer: providers + router (no business logic)
  pages/                  # FSAA pages layer: thin route compositions
    router.tsx
    ProjectsPage.tsx      # import -> render
    OrdersPage.tsx
  features/
    projects-overview/    # ui/ + config/ + index.ts — owns business columns
    orders-overview/      # same molecules, zero coupling between features
  entities/
    project/  order/      # business models + data access (mocked)
  shared/ui/
    atoms/TableCell.tsx
    molecules/table/DataTable.tsx   # generic: columns, data, isLoading
```

The table stays generic in `shared`; business-specific columns live in features. Try to import `@features/projects-overview` from another feature — **lint stops you**:

```
FSAA: features do not import each other — move code via @entities (data)
or @shared (UI), or graduate it.
```

## The three decision rules (identical in both templates)

1. **Graduation pattern** — feature-local UI lives flat in `features/<name>/ui/`; a component graduates to `shared/ui` only after a second independent feature needs it, the boundary test passes, and the promotion PR moves the import in the same changeset.
2. **Boundary test for shared** — *can you describe the component without users/orders/projects?* Yes → `shared`. No → feature.
3. **Organisms are eliminated** — a large composition **is** a feature; `shared/ui` holds atoms and molecules only.

## Which template do I need?

- **Next.js** (SSR/RSC, file-based routes): use [fsaa-react `main`](https://github.com/Aramex86/fsaa-react)
- **Vite** (SPA, no server runtime): this branch
- Both: MIT, no lock-in — the layers move with you.

## License

MIT © Veaceslav Bezusco