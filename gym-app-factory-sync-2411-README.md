# ФАБРИКА → gym-app: локальное обновление (24.11)

Файл: gym-app-factory-sync-2411.zip (42 файла, собран с HEAD 3d599d9).

## Куда что класть (из твоего локального C:\WorkDev\agenticflow\gym-app)

| в зипе | куда | что это |
|---|---|---|
| `scripts/` | `gym-app/scripts/` (замена) | движок: flow, run-agent, tui, self-tests, budget, env, trace, eval, report, map, install |
| `agents/` | `gym-app/agents/` (замена) | контракты ролей (researcher…committer) |
| `agents-pipeline.yaml`, `agents-pipeline.copilot.yaml` | корень gym-app (замена) | таблицы моделей по ролям |
| `AGENTS.md` | корень (замена) | dispatch-закон (только если у тебя нет СВОИХ правок в нём — если есть, скажи мне, перелью вручную) |
| `.mcp.json` | корень (замена) | ОДИН mcp-конфиг (mcp/ папка выпилена) |
| `docs/MODELS-AND-ENV.md`, `docs/adr/`, `docs/context/glossary.md` | `gym-app/docs/…` (замена) | законы + env-таблица (STITCH_KEY/NOTION_KEY теперь описаны в §3a) |
| `README-INSTALL.md`, `README-agent-pipeline.md` | корень (замена) | инструкции |
| `factory-roadmap.md`, `HANDOFF.md` | корень (замена) | борд (посортирован) + NOW-файл |

**НЕ трогай и не перезаписывай: `.env`, локальные трейсы `.pipeline/`, свои документы.** `.env` у тебя уже есть — там же добавь при желании `PIPELINE_BUDGET_USD` (не задан = безлимит).

## Проверка после копирования (PowerShell, в gym-app)

```powershell
node scripts\self-tests.mjs     # ждём: green: 23/23
node scripts\tui.mjs --once     # бар честности
```

## Что нового с твоего прошлого пулла (коротко)

- ревью×4 закрыто; вердикт теперь проверяем машиной (кроме слов тестера)
- копилот-рельс: лицензия компании, ключа не просит; облачный рельс — без ключа честный стоп
- бюджет: кап только из .env, иначе безлимит; с капом — жёсткий стоп с выпиской
- opencode выпилен; один mcp-конфиг в корне
- в трейсе полноценно пишутся решения гейтов, круг-конец, вердикт (без дублей)
