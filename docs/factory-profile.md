---
schema: 1
ecosystem: node
package_manager: pnpm
install: pnpm install --frozen-lockfile --prefer-offline
lint: pnpm lint
typecheck: pnpm typecheck
test: pnpm test
build: pnpm build
lockfile: pnpm-lock.yaml
commit_rules: conventional
structure: fsaa-layers
unknown: []
---

# Project passport
## Evidence
- `package.json`: `packageManager` = `pnpm@10.34.9`; `scripts` = `{ lint: "eslint .", typecheck: "tsc --noEmit", test: "vitest run", build: "tsc -b && vite build" }`
- `pnpm-lock.yaml` exists at the repo root; no root `package-lock.json` or `yarn.lock`
- `scripts/ecosystems.js` node detector maps a root `pnpm-lock.yaml` to `package_manager: pnpm`; the pnpm template uses `pnpm install --frozen-lockfile --prefer-offline`; the run template maps `lint`/`typecheck`/`test`/`build` to `pnpm <script>`
- `.git/logs/HEAD`: commit messages use conventional prefixes (`feat(init)`, `feat(design)`, `docs:`, `feat(config)`, `feat(pipeline)`, etc.)
- `src/app/main.tsx`: bootstrap only
- `src/pages/router.tsx`: react-router routing table
- Glob of `src/features/**/index.ts` found feature slices (`orders-overview`, `projects-overview`, `training-history-search`, `plan-disclaimer`, `plan-recompose`, `app-shell`, `onboarding`)
- Glob of `src/entities/**/*` found entity modules (`order`, `project`, `profile`, `composer`, `training-plan`)
- Glob of `src/shared/ui/**/*` found shared UI primitives (`atoms/`, `molecules/`)
- `eslint.config.mjs`: enforces FSAA downward layer boundaries across `src/app`, `src/pages`, `src/features`, `src/entities`, `src/shared`
- Researcher note: `node scripts/ecosystems.js` could not be executed because the Bash tool required approval; the values above were verified by reading the detector source, `package.json`, and `pnpm-lock.yaml` directly.

## Unknown (human fills)
- (none)
