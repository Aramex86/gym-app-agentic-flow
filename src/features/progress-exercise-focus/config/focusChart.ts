/* features/progress-exercise-focus/config/focusChart — pure presentation
   mapping for the combined focus chart. Layer reason: feature config holds
   scenario mapping with NO JSX and NO data access (FSAA); the UI component
   stays rendering-only while selectors from @entities/session-log supply
   the data. ISO week labels are UTC arithmetic on purpose (no Intl /
   locale dependency — plan §3 A5 / §10 risk 3). */

import type { ComboChartPoint } from "@shared/ui";
import type { ExerciseFocus, WeeklyE1rmPoint } from "@entities/session-log";

/** Milliseconds of one UTC day (also one week step = 7 * DAY_MS). */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * ISO-8601 week number of a UTC date (Monday-based, week 1 contains Jan 4).
 * Deterministic UTC arithmetic: the ISO week's Thursday decides the year,
 * so year boundaries never wrap a label silently (plan §10 risk 3).
 * @param dateMs UTC epoch ms of a midnight.
 * @returns The 1-based week number.
 */
function isoWeekNumber(dateMs: number): number {
  const dayOfWeek = (new Date(dateMs).getUTCDay() + 6) % 7; // Mon=0..Sun=6
  // Thursday of this date's ISO week fixes the week and its year.
  const thursdayMs = dateMs + (3 - dayOfWeek) * DAY_MS;
  const year = new Date(thursdayMs).getUTCFullYear();
  // Jan 4 is always inside ISO week 1; its week1 Monday is Jan4 - weekday.
  const jan4Ms = Date.UTC(year, 0, 4);
  const jan4DayOfWeek = (new Date(jan4Ms).getUTCDay() + 6) % 7;
  const week1MondayMs = jan4Ms - jan4DayOfWeek * DAY_MS;
  return Math.floor((thursdayMs - week1MondayMs) / (7 * DAY_MS)) + 1;
}

/**
 * ISO-8601 week label of a UTC date → "WK44".
 * @param isoDate "YYYY-MM-DD" (treated as UTC midnight).
 * @returns e.g. "WK42" (2026-10-16 → WK42, pinned by focusChart.test.ts).
 */
export function isoWeekLabel(isoDate: string): string {
  const ms = Date.parse(`${isoDate}T00:00:00.000Z`);
  return `WK${isoWeekNumber(ms)}`;
}

/**
 * Builds the combo chart rows: the base anchor first (bar null — the
 * anchor week has no in-window volume), then one row per POPULATED data
 * week, pairing e1RM points with volume bands by weekStart (never by blind
 * index). No synthetic row for an unpopulated week (plan A4).
 * @param focus The derived focus series (from selectExerciseFocus).
 * @returns Rows in display order; anchor label collision with the first
 *   data label is dropped defensively so a tick can never appear twice.
 */
export function buildComboRows(focus: ExerciseFocus): ComboChartPoint[] {
  const rows: ComboChartPoint[] = [];

  if (focus.baseAnchor) {
    rows.push({
      label: isoWeekLabel(focus.baseAnchor.weekStart),
      // WHY barValue null: the anchor is a pre-window session — there is no
      // weekly volume band to pair (plan Step 2 / A4).
      barValue: null,
      lineValue: focus.baseAnchor.valueKg,
    });
  }

  const volumeByWeekStart = new Map(
    focus.volumeBands.map((band) => [band.weekStart, band] as const),
  );
  for (const point of focus.e1rmPoints) {
    const band = volumeByWeekStart.get(point.weekStart);
    rows.push({
      label: isoWeekLabel(point.weekStart),
      // WHY mean tonnage: per-sample min/max/mean collapse to one number —
      // the band mean is the honest representative (legend "Sets × Load").
      barValue: band ? band.meanVolumeKg : null,
      lineValue: point.valueKg,
    });
  }

  // Defensive (plan Step 3): 7-day-apart week starts can never share an
  // ISO label, but if they ever do, keep the data row and drop the anchor.
  if (
    rows.length > 1 &&
    rows[0]!.lineValue !== null &&
    rows[1]!.label === rows[0]!.label
  ) {
    rows.shift();
  }
  return rows;
}

/** One aria-label row: anchor → "WK42 base anchor 95 kg 1RM", data week →
    "WK44 116.7 kg 1RM, 2500 kg volume" (value parts only when present). */
function ariaRow(label: string, anchor: boolean, lineValue: number | null, barValue: number | null): string {
  const line = lineValue !== null ? `${lineValue} kg 1RM` : null;
  const bar = barValue !== null ? `${barValue} kg volume` : null;
  const prefix = anchor ? `${label} base anchor` : label;
  // WHY the comma: the plan pins "… 1RM, 2500 kg volume" for a week with
  // both series — "; " stays only BETWEEN rows.
  const tail = [line, bar].filter((part): part is string => part !== null).join(", ");
  return tail ? `${prefix} ${tail}` : prefix;
}

/**
 * Table-equivalent accessible name; lists EVERY rendered value (anchor +
 * weeks) in the exact format pinned by focusChart.test.ts.
 * @param focus The derived focus series.
 * @returns e.g. "Back Squat 1RM trajectory and weekly volume: WK42 base
 *   anchor 95 kg 1RM; WK44 116.7 kg 1RM, 2500 kg volume."
 */
export function comboAriaLabel(focus: ExerciseFocus): string {
  const rows = buildComboRows(focus);
  if (rows.length === 0) {
    return `${focus.exerciseName} 1RM trajectory and weekly volume: no tracked weeks.`;
  }
  const parts = rows.map((row, index) =>
    ariaRow(row.label, Boolean(focus.baseAnchor) && index === 0, row.lineValue, row.barValue),
  );
  return `${focus.exerciseName} 1RM trajectory and weekly volume: ${parts.join("; ")}.`;
}

/**
 * Max e1RM over the anchor + data points.
 * @param focus The derived focus series.
 * @returns The peak point (anchor eligible), or null with no points.
 */
export function peakE1rm(focus: ExerciseFocus): WeeklyE1rmPoint | null {
  const candidates = [
    ...(focus.baseAnchor ? [focus.baseAnchor] : []),
    ...focus.e1rmPoints,
  ];
  if (candidates.length === 0) return null;
  return candidates.reduce((best, candidate) =>
    candidate.valueKg > best.valueKg ? candidate : best,
  );
}

/**
 * Last data-week point — the latest tracked e1RM (never the anchor).
 * @param focus The derived focus series.
 * @returns The newest point, or null (defensive: focus has no points).
 */
export function latestE1rm(focus: ExerciseFocus): WeeklyE1rmPoint | null {
  return focus.e1rmPoints.at(-1) ?? null;
}

/**
 * Percent change of the latest e1RM vs the base (anchor ?? first data
 * point).
 * @param focus The derived focus series.
 * @returns The percentage, or null with no data point to compare.
 * @remarks REAL delta only (plan A2): no projection, no extrapolation.
 */
export function e1rmDeltaPercent(focus: ExerciseFocus): number | null {
  const latest = latestE1rm(focus);
  if (!latest) return null;
  const base = focus.baseAnchor ?? focus.e1rmPoints[0];
  if (!base || base === latest) return null;
  return ((latest.valueKg - base.valueKg) / base.valueKg) * 100;
}

/**
 * "+5.0%" / "0.0%" / "-2.0%" — one decimal, explicit sign (zero unsigned,
 * exactly as the plan pins it).
 * @param percent Percent change (e1rmDeltaPercent output).
 */
export function formatDelta(percent: number): string {
  const magnitude = Math.abs(percent).toFixed(1);
  if (magnitude === "0.0") return "0.0%";
  const sign = percent >= 0 ? "+" : "-";
  return `${sign}${magnitude}%`;
}
