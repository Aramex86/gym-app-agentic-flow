---
schema: 1
ecosystem: node
package_manager: pnpm
install: pnpm install --frozen-lockfile --prefer-offline
lint: pnpm lint
typecheck: pnpm typecheck
test: pnpm test
test-targeted: pnpm vitest run $FILES
build: pnpm build
lockfile: pnpm-lock.yaml
commit_rules: conventional
structure: fsaa-layers
ui-libs: recharts
unknown: []
---

# Project passport

## Evidence

- `scripts/ecosystems.js`: node detector - matcher is a root `package.json`; lockfile map is `pnpm-lock.yaml -> pnpm`; the pnpm template install is `pnpm install --frozen-lockfile --prefer-offline`; `COMMAND_KEYS = [lint, typecheck, test, build]` are emitted as `pnpm <script>` only when the script exists.
- `package.json`: `packageManager` = `pnpm@10.34.9`; scripts `lint: "eslint ."`, `typecheck: "tsc --noEmit"`, `test: "vitest run"`, `build: "tsc -b && vite build"`; dependencies include `recharts: ^3.11.1`; devDependencies include `vitest: ^3.0.0`.
- Glob `{pnpm-lock.yaml,package-lock.json,yarn.lock}` at repo root: only `pnpm-lock.yaml` exists. The single `yarn.lock` hit is `node_modules/.pnpm/uri-js@4.4.1/node_modules/uri-js/yarn.lock` (vendor artifact inside node_modules, not a repo lockfile) -> `package_manager: pnpm`, `lockfile: pnpm-lock.yaml`.
- `test-targeted`: `test` resolves to `vitest run` and the runner `vitest` is a real devDependency, so the file-scoped form of the same runner is `pnpm vitest run $FILES` (targeted-test template for pnpm + vitest). No root `vitest.config.*` exists; vitest runs on defaults (vite.config.ts has no `test` block).
- `.github/workflows/ci.yml`: runs `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test` on push/PR.
- Session git log: recent commits use conventional prefixes (`feat(charts):`, `docs(passport):`, `sync(factory):`). Glob `{.husky/**,.huskyrc*,commitlint.config.*,.commitlintrc*,.gitmessage,lefthook.yml}` found nothing -> `commit_rules: conventional`.
- Layer tree: `src/app/main.tsx` + `src/app/globals.css` (bootstrap only); `src/pages/` route components + `src/pages/router.tsx`; `src/features/*/index.ts` (10 slices incl. `progress-history`, `progress-insight`, `progress-exercise-focus`); `src/entities/*/index.ts` (`order`, `project`, `composer`, `profile`, `training-plan`, `session-log`); `src/shared/ui/{atoms,molecules}` + `src/shared/config` -> `structure: fsaa-layers`.
- `docs/adr/0005-zero-dep-zero-network-default.md`: despite the filename it contains **ADR-0011 — Charting library** (accepted 2026-11-25, supersedes ADR-0005 for charts). Charts are rendered with recharts; hand-rolled charts are not allowed for chart components; `ui-libs: recharts` must be recorded in this passport; chart colors ONLY via `var(--...)` (tokens law ADR-0001 D5).
- `src/shared/ui/tokens.css`: design tokens declared on `:root`; header states "Do not hardcode colors anywhere else".
- `src/shared/ui/atoms/TrajectoryChart.tsx` and `src/shared/ui/atoms/RangeBandChart.tsx`: still hand-rolled inline SVG (their comments cite the now-superseded ADR-0005). Grep for `recharts` under `src/` found no imports yet -> recharts adoption is declared/policy-level; migration of these two atoms is pending under ADR-0011.
- `scripts/profile.mjs` (`getProfile`) parses flat `key: value` frontmatter but keeps only keys present in its `DEFAULTS`, and its key regex is `[A-Za-z_][\w]*` (no hyphens). Consequence: `test-targeted` and `ui-libs` are recorded here per the laws that require them, but the current flow reader (`scripts/flow.mjs:715` -> `getProfile`, then `targetedGate`) does not see them yet - reader support for these two keys is a separate change.
- Researcher note: `node scripts/ecosystems.js` could not be executed - the Bash tool required approval twice in this session. Each detector fact was therefore verified by hand: the detector source `scripts/ecosystems.js`, `package.json`, the root lockfile glob, `src/pages/*` + `src/pages/router.tsx`, the layer tree, and `docs/adr/0005-zero-dep-zero-network-default.md` (which contains ADR-0011).

## UI libraries (ui-libs)

- **Charts: recharts** (`recharts: ^3.11.1` in `package.json` dependencies; mandated by ADR-0011, which supersedes ADR-0005 for chart components only).
- Chart components MUST use recharts - hand-rolled chart components are not allowed.
- Chart colors MUST come from design tokens: `var(--...)` from `src/shared/ui/tokens.css` only - no hardcoded hex/rgb/`rgba()` values in chart code.
- Migration status: `TrajectoryChart` and `RangeBandChart` are still hand-rolled SVG; moving them onto recharts is a dedicated task per ADR-0011 (design reference lives in `tasks/<name>/design/`).

## Unknown (human fills)

- (none)
