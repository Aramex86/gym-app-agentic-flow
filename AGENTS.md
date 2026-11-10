# AGENTS.md — FSAA machine contract (fsaa-vite)

## Who you are

You are a coding agent working on an FSAA Vite 7 + react-router app. You follow this contract.
Every rule below carries a check marker and is verified by CI. If CI is red,
fix the code OR the rule — never bypass the check.

## Commands

<!--check: cmd-pnpm-install -->  `pnpm install` — install dependencies
<!--check: cmd-pnpm-dev -->      `pnpm dev`
<!--check: cmd-pnpm-lint -->     `pnpm lint` — ESLint 9, zero errors allowed
<!--check: cmd-pnpm-typecheck --> `pnpm typecheck` — tsc, zero errors
<!--check: cmd-pnpm-build -->    `pnpm build` — tsc -b && vite build, must pass

Procedures for agents: agents/add-module.md, agents/add-pattern.md, agents/run-stack.md - plus agents/where-ui-goes.md (navigation for external agents)

## Package manager

<!--check: script-policy -->

Dependency lifecycle scripts do not run by default (pnpm 10+).
Only explicitly allowlisted packages may run installs/builds:
`pnpm.onlyBuiltDependencies` in package.json (seed: esbuild).

<!--check: single-lockfile -->

This repo uses pnpm ONLY. pnpm-lock.yaml is the single lockfile.
A second lockfile (package-lock.json, yarn.lock) in the repo = CI red.

## Layers and where UI goes

<!--check: ui-location -->

Layers (imports flow only downward, enforced by eslint.config.mjs):

- `src/app/` — bootstrap ONLY: main.tsx + globals.css. No features, no routes logic.
- `src/pages/<Name>Page.tsx` — route components: compose feature exports, stay thin
- `src/pages/router.tsx` — the routing table
- `src/features/<feature>/` — scenarios: index.ts (public API), ui/ (feature components), config/ (columns)
- `src/entities/` — cross-feature data models
- `src/shared/` — ui primitives (src/shared/ui: atoms/, molecules/), config, libs
  New scenario UI goes to src/features/<feature>/ui/, never to pages or app.

## Import boundaries

<!--check: boundary-imports -->

Enforced by eslint.config.mjs: no upward imports, features never import features, no cycles. Verified on every PR by lint + drift-check scan.

## Data

<!--check: no-ui-fetch -->

src/features/**/ui/**, src/shared/ui/** and src/pages/** must NOT call fetch/axios directly. Data access belongs to feature logic (index.ts / entity API).

## Files

<!--check: file-paths -->

- src/pages/router.tsx — routing table
- src/app/main.tsx — bootstrap
- eslint.config.mjs — boundaries (do not relax)

## Git & PR

<!--check: pr-flow -->

Never commit to main. Branches feat/<topic>, fix/<topic>. PR needs green lint+typecheck+drift-check.

## Do NOT touch

package-lock.json / pnpm-lock.yaml by hand, index.html, vite.config.ts, eslint.config.mjs without explicit task.
