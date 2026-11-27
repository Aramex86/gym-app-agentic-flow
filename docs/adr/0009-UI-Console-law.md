# 0009 — Factory Console UI law (ui.mjs)

- **Status:** accepted
- **Date:** 2026-11-25
- **Deciders:** Veaceslav (grill-fight 25.11: пять решений, пять вопросов)

## What

`pnpm ui` поднимает **standalone local server** (`scripts/ui.mjs`, zero-dep, как весь движок — ни npm-зависимостей, ни react) на **http://localhost:1921**. Независим от Hermes и любого агента: это твой приборный щит к фабрике.

## Where it lives (master's correction, 25.11)

**Сервер — ВНУТРИ фабрики, не рядом с проектом.** ui.mjs — часть factory-kit
(скрипты движка); INSTALL фабрики в ЛЮБОЙ проект привозит консоль с ним:
`pnpm install` фабрики → в проекте появляется `pnpm ui` → localhost:1921
показывает ИМЕННО этот проект (его trace, его отчёты, его паспорт). Один код
сервера, ноль копий на проект — как и все скрипты движка.

## Decision (grill-законы)

1. **Одно окно, две функции:** конфигурация перед стартом + real-time эфир
   (активный хоп/роль с таймером и last-line, гейты, трата, трейс-лента) —
   данные из `.pipeline/*/trace.jsonl` (SSE, tail-репликация) и леджера.
2. **Гейты неприкосновенны.** UI рисует кнопки **Approve / Deny** — ответ на
   вопрос круга (UI становится stdin живого flow-процесса). Никаких «прогнать
   гейты». Параллельных кругов нет: `flow.lock`, один активный за раз.
3. **Конфиг:** выбор в дропдаунах (рельс claude|copilot, модель на роль,
   max-turns, timeout, budget cap, задача = `notion:<ID>` с борда или
   таск-файл) действует **на этот запуск**; кнопка **Set as preferred**
   сохраняет правкой ТЕХ ЖЕ единственных файлов (yaml-таблица моделей,
   `.env`-кап) — с before/after диффом и Y. Пресеты миров **solo/**
   **enterprise** (MODE LAW, 20.11) показывают конфиг выбранного мира.
4. **Команды из UI:** start circle (task/Notion ID) · Approve/Deny · `--fix`,
   `--cleanup`, `doctor`, `adlc`, `self-tests`, **report**, **budget setup**.
5. **Git — вручную:** push и merge человеческими руками. Окно подтверждения
   коммиттера (proposal → Confirm) — да; сам факт push за пределами UI.
6. **Стены UI:** read-only для `.pipeline` и отчётов; писать только конфиг по
   п.3 с подтверждением. Никаких изменений законов, контрактов, гейтов.

## Consequences

- TUI V1 остаётся (терминал живёт параллельно); Console — его надмножество.
- Порт 1921 — за фабрикой (`pnpm ui`).
- Данные ленты — те же trace.jsonl, что и у всех инструментов: один источник правды.

## References

- scripts/ui.mjs (to be wired); MODE LAW (board 20.11); ADR-0004 (budget); ADR-0008 (models)
