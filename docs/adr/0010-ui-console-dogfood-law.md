# 0010 — UI Console v1 is built BY the factory (dogfood law)

- **Status:** accepted (драфт для Y мастера)
- **Date:** 2026-11-26 (план на день)
- **Deciders:** Veaceslav (устно 25.11 вечером) · Igor (запись на борд)

## What

UI Console v1 (ADR-0009) строится **фабрикой для фабрики**: полный круг
`researcher → planner → developer → tester → committer` в песочнице,
не руками мастера. Фабрика сама должна доказать, что умеет строить
интерфейс на своих же законах.

## Flow (how the design enters the circle)

1. **Stitch → дизайн-источник.** Мастер закидывает идею в Stitch; нарисованные
   фреймы экспортируются PNG в `tasks/<name>/design/*.png` (закон 2.5b DESIGN
   SKINS: designer role = read-only Stitch consult).
2. **Task-карточка** ссылается на этот каталог: planner читает PNG + ADR-0009 +
   этот ADR; acceptance-критерии = ADR-0009 (§Decision) + ADR-0010.
3. **Круг по белому списку:** developer может Read/Edit/Write в `scripts/ui.mjs`
   + вшитый html; `node scripts/ui.mjs` для прогона = DENY (запускать UI
   разрешает только мастер на гейте diff) — мутации git по-прежнему глобально
   запрещены (ADR-0002).

## Stage plan (matches UI Console plan 25.11, 3 commits)

1. **Observe** (read-only): сервер + SSE-лента trace + отчёты + state.
   Verdict-критерий: лента показывает живые хопы активного круга.
2. **Control**: stdin-мост гейтов (Approve/Deny кнопки).
   Verdict-критерий: гейт живого круга нажимается из UI.
3. **Config**: env-overrides + persist через Y.
   Verdict-критерий: конфиг-панель меняет значение, дифф yaml показан мастеру.

## Laws honored

- zero-dep (ADR-0002 spirit): `scripts/ui.mjs` — node http, вшитый html,
  ни npm-зависимости, ни react.
- Human gates: каждый stage-commit = PR, мастер мержит.
- Review is standing practice: каждый PR → adversarial-раунд ДО мержа.
- ST: один behavioral экспонат на stage (SSE tail, gate-bridge, config-persist).

## Acceptance

UI Console v1 = ADR-0009 полностью: observe+control+config, всё через
`localhost:1921`, и это доказано ТРЕМЯ вердиктами фабрики (PASSverified),
не руками мастера.
