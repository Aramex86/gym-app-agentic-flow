# Factory Changelog — 2026-11-15 (re-compose circle day)

One chronicle per day of engine work: what ran, what broke, what was fixed,
which laws changed. Commands are copy-ready (PowerShell, repo root).

## 1. The circle: re-compose prompt box (re-plan request)

Task: `tasks/my-plan-re-compose-prompt-box-re-plan-request.md`
(door-normalized from card `414066c7-...`; Description filled with
GOAL / SCOPE / BEHAVIOR / ACCEPTANCE).

```powershell
pnpm flow tasks\my-plan-re-compose-prompt-box-re-plan-request.md
```

Result: PASS — 19 files / 136 tests, lint + typecheck + build 0 errors,
feature on FSAA layers (atom PromptInput, feature plan-recompose,
entity training-plan/api POST `/api/plan`, page wiring ProgressPage).
Commit (human gate): `00374fb feat(plan-recompose): prompt box re-plan request (tests in same commit)`.

Live review without touching the main tree (sandbox IS the branch checkout):

```powershell
cd work\my-plan-re-compose-prompt-box-re-plan-request
pnpm dev            # vite on localhost:5173 - Progress page shows the box
# send -> POST /api/plan fails while gym-gate is not running - you see
# the REAL pending ("Re-composing plan…") and error ("Could not re-compose
# the plan. Please try again.") states
ctrl+C
cd ..\..
git push -u origin feat/my-plan-re-compose-prompt-box-re-plan-request
gh pr create --base develop --head feat/my-plan-re-compose-prompt-box-re-plan-request
# after merge:
git worktree remove work\my-plan-re-compose-prompt-box-re-plan-request --force
git branch -d feat/my-plan-re-compose-prompt-box-re-plan-request
```

## 2. Breaks found by the circle, and the fixes

### 2.1 Tester could not write its report (contract, not model)
`agents\tester.md` had lost `Write` in the `tools:` line (contract restore
dropped it). Symptom: hop completes, report only in console message,
`machine gate: expected artifact missing` (run-agent exit 2), and a manual
set-content stub "passes" an existence-only gate.
Fix: `tools: Write,Read,Bash(pnpm lint:*),Bash(pnpm typecheck:*),Bash(pnpm test:*),Bash(pnpm build:*),Bash(node scripts:*),Bash(git status:*),Bash(git diff:*),Bash(git log:*),Bash(git show:*)`
Lesson: rights are contracts; a role that must WRITE an artifact needs Write
in tools. ESLint does not see contracts. -> self-test #2 in phase 4.

### 2.2 Artifact gate accepted a stale stub (existence-only check)
A manually seeded FAIL report made the loop treat an old file as the current
artifact. Fix (phase 4, planned): gate must require artifact mtime newer than
hop start, not just existence. -> self-test #1.

### 2.3 PASS verdict hidden under a markdown heading (verdict parser drift)
`flow.mjs` verdict() read only line 0; the real report begins
`# Report - ...` then `PASS` -> "still FAIL" in fix loop while the disk
report was PASS. The SAME fix existed in eval.mjs since yesterday (word
search in first 5 lines) - the law was not propagated. Fix:

```js
const verdict = (file) => {
  const head = readFileSync(file, 'utf8').split('\n').slice(0, 5).join('\n');
  return (head.match(/\b(PASS|FAIL)\b/i)?.[1] || 'FAIL').toUpperCase();
};
```
Unit-checked on 3 report shapes. Lesson: verdict logic must live in ONE
module shared by flow + eval. -> self-test #3.

### 2.4 Contract conflict: plan told the developer to commit
Tester FAIL (item 14, tests in same commit): plan step 6 said "developer
commits", but the developer contract NEVERs git commit. The commit is a
human-gate action (committer step tool). Resolution: human commit in the
sandbox, fix-loop recognized the resolution and re-tested only.
Law added to plan templates: commit steps never live in developer plans.

```powershell
cd work\<name>
git add src/
git commit -m "feat(<name>): <what> (tests in same commit)"
cd ..\..
```

### 2.5 MCP silently missing in sandboxed hops (engine, fixed this morning)
run-agent resolves `.mcp.json` from its own root; in sandbox mode that root
is the worktree, and `.mcp.json` is untracked -> never copied -> hops ran
without MCP with no error. Fix: flow copies `.mcp.json` into the sandbox
next to the task file; console shows `mcp config copied into sandbox`.
NOT yet exercised live (next clean rerun).

### 2.6 Telegram paste hazards (workflow, two incidents)
Long paths wrapped into auto-links inside pasted PS lines -> broken `$rep`
assignments. Rule: build long paths with `Join-Path`, never inline strings;
send long commands as files, not chat text.

## 3. Engine/general checkup (before the run)

ESLint over 25 kit scripts (no-undef + 9 code rules), after fixes: ALL CLEAN.

- `flow.mjs`: `rmSync` missing from `node:fs` import (silent ReferenceError
  inside catch - stub removal never ran). Fixed.
- `eval.mjs`: `yamlObj` never existed - the cost block was dead; now sums
  REAL `cost_usd` from `hop_usage` events (scoreboard cost becomes live).
- static scan produced 273 false positives; AST-linter produced 3 truths.
  Lesson: regex-based code "checkers" are noise -> the eslint pass stays
  the pre-run step.

Helper: `eslint-checkup.mjs` (scratch) - before every run session.

## 4. Kill-switch usage (re-tested live)

```powershell
New-Item .pipeline-stop -ItemType File    # current hop dies exit 130
Remove-Item .pipeline-stop                # always remove after use
```

## 5. Self-test backlog (fed by today's incidents)

1. artifact-gate mtime check (2.2)
2. contract test: roles that produce artifacts carry Write (2.1)
3. single shared verdict module for flow + eval (2.3)
4. contract test: plan files contain no "developer commit" steps (2.4)
5. sandbox MCP presence test: hop sees stitch tools when .mcp.json exists (2.5)
6. drift-check for DOCS structure (duplicate section numbers incident)

## 6. Costs observed (trace telemetry)

planner deepseek $1.14 (55 msgs) / developer glm ~$0.70 / tester glm ~$0.73
per hop; a wasted loop round costs ~$0.06-0.73 depending on where it burns.
Loop rounds are not free - the 3-round cap is a budget, not a suggestion.
