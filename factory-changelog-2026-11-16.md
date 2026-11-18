# Factory changelog — 2026-11-16 (Phase 3 CLOSED)

## The circle that read the board
- Full circle from Notion: pnpm flow notion:<id> — door v2 resolved the
  App shell card (Description = GOAL/SCOPE/BEHAVIOR law), flips In Progress
  idempotently, prints the stdout contract.
- Planner granted 8 notion READ tools (board law: agents never write the
  board; door + human own it). Planner chose not to spend them (task file
  was complete) — grants proven, spend optional.
- Developer hop $2.20: composer healthcheck entity, NavTab/StatusIndicator/
  EmptyState, AppChrome/BottomNav, /logger /onboarding; board Description
  behavior ("offline -> CTA disabled") implemented verbatim. Honesty kept:
  5 git denials incl. a commit-writer subagent.

## Engine fixes of the day
- notion-door v2: Description-read, FIFO --next, dry, idempotent status,
  stdout contract "door resolved: tasks/<file>" (was: undefined crash).
- flow.mjs door joint: parses both bare tasks/ and prefixed marker lines.
- verdict law v2: own-line PASS/FAIL within first 12 lines + legacy 5-line
  fallback (false FAIL: PASS sat on line 7 past the 5-line window).
- .mcp.json now tracked (placeholders only) + sandbox copy confirmed in
  combat ("mcp config copied into sandbox").

## Stitch round-trip (design law learned)
- User spotted divergence by eye; probe pulled the real Stitch screen spec
  (fixed glass 64px header, 6px teal dot + glow, label-caps UPPERCASE,
  3-slot nav + raised center FAB, bolt icon; colors stay our token roles).
- Fix hop added exactly two tokens: --surface-glass, --accent-glow-teal.
- Re-test PASS; user vitrine check: "like in Stitch".

## Numbers
- Tests: 143 -> 212 (30 files). Circle spend: planner $2.94 + dev $2.20.
- Voice channel (Igor): EN on request; edge TTS flaked 2x today (retries).

## Phase-4 backlog (updated)
- self-tests #1 (exhibits from today: verdict window, door contract,
  artifact mtime, plan-no-dev-commits), doctor + door-factory, unified
  Y-gate, batch mode, RESUME, sandbox autosync, eval:run-all, Copilot.

## Open after today
- push + PR + merge of feat/app-shell-... (human), sandbox removal after
  merge, Stitch advisory line into board descriptions (awaiting OK).

## Evening close-out (same day)
- Everything pushed to develop by the human (direct merge, no PR ceremony).
- Sandbox work\app-shell-... removed (node-kill + worktree remove --force).
- Board hygiene: 20/20 cards carry GOAL/SCOPE/BEHAVIOR descriptions.
- Verdict-law v2 (own-line PASS/FAIL, 12-line window) proven by flow:fix
  "PASS already" on the real report.
- Phase 3 CLOSED with battle proofs: board-as-source (notion door v2),
  MCP x3 (search probe, stitch style consult, sandbox config copy),
  board-description-behavior implemented verbatim, honest git denials.
