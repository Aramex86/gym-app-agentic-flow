## 0.2.0 — 2026-10-21
## [29.10.2026] — drift-check v4.6: единый источник истины (eslint-plugin-fsaa)

- `eslint-plugin-fsaa@0.1.1` в devDeps; `fsaa/recommended` вшит в eslint.config.mjs → `pnpm lint` гоняет те же правила, что и drift-check.
- `scripts/check-agents-md.mjs` **v4.6**: код-проверки (no-ui-fetch, boundary-imports, ui-location-содержимое) делегированы правилам плагина внутри drift-check; скрипт остался точкой входа контракта (маркеры AGENTS.md, двухсторонняя привязка, команды, lockfile, script-policy, file-paths). Внутренние grep-сканы удалены — одна реализация правил (npm-пакет), ноль дрейфа между lint и CI-drift.
- `@typescript-eslint/parser` стал явным devDep (раньше приходил транзитивно).
- Верификация: clean (test/typecheck/lint/drift green), негатив 5/5 инжекций ловится через плагин, инжекции откатны.

### Added

- `AGENTS.md` machine contract: pnpm command contracts + single-lockfile rule, FSAA layer placement rules (pages/router variant), import boundaries, PR-flow rule — every rule carries a `<!--check: id-->` marker verified by CI
- `scripts/check-agents-md.mjs` (v4.2-vite) — drift-check: two-way binding, real import-boundary scan, UI fetch-free scan, colored per-rule report
- CI workflow `agents-md-drift-check`: runs the drift-check on every PR and push
