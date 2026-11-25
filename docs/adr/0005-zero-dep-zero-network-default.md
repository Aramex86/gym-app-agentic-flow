# 0011 — Charting library (supersedes ADR-0005 "no chart package")

- **Status:** accepted
- **Date:** 2026-11-25
- **Deciders:** Veaceslav

## What

Charts are rendered with **recharts** (added to package.json). The zero-dep
hand-rolled SVG law (ADR-0005) is superseded for chart components only —
everything else keeps the zero-dep rule.

## Why

Real product scope needs real charting (multi-series, interactions, future
analytics screens); hand-rolled SVG does not scale and designer references
(Stitch) assume a real charting system.

## Migration

- `ui-libs: recharts` is recorded in docs/factory-profile.md (passport):
  planner/developer MUST use it for visualizations; hand-rolled charts are
  not allowed for chart components.
- Existing atoms (TrajectoryChart, RangeBandChart) migrate to recharts in a
  dedicated task with the Stitch design reference in tasks/<name>/design/.
- Tokens law (ADR-0001 D5) still holds: chart colors ONLY via var(--…).
