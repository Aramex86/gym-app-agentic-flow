---
# GOLDEN TASK (eval exam): a small, self-contained task for the pipeline.
# Frontmatter = the answer key. The eval runner parses ONLY this block.
meta:
  name: golden-ab-deepseek
  source: real circle #5 (compact mode toggle) - proven one-shot PASS
  task_file_hint: copy of tasks/2026-11-11-compact-toggle.md
expected:
  files_exist:
    - src/shared/ui/atoms/ToggleChip.tsx
    - src/shared/ui/__tests__/ToggleChip.test.tsx
  gates: [lint, typecheck, test]
  verdict: PASS
  budget:
    fix_rounds: 2      # <= 2 fix loops allowed
    time_s: 900        # <= 15 min wall clock
  forbidden_paths:
    - agents-pipeline.yaml   # scope violations fail the eval even if PASS
    - package.json
    - pnpm-lock.yaml
---

Implement a compact-mode toggle for the history table.

Add atom ToggleChip (props {on, onToggle, label}: token-styled chip,
aria-pressed). ProgressPage adds useState compact + chip near the title.
HistoryTable gets compact?: boolean: hide rest + action columns, join
"sets x reps @ RPE" into one mono cell, reduce row height. Toggle must be
instant (no reload). Tests: state toggle changes column count 6 -> 4.
Tokens only. Tests in same commit.
