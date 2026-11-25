/* entities/session-log — pure selectors (no I/O). Layer reason: business
   logic belongs to entities (AGENTS.md); both the history-log feature (PR
   badges from e1RM) and the insight feature (period + summaries) consume
   these, computed client-side so a badge renders with 0 network requests.
   Terminology per docs/context/glossary.md and ADR-0001. */

import type {
  InsightSessionSummary,
  LoggedSet,
  PersonalRecord,
  ReviewPeriod,
  SessionLogEntry,
  SessionLogRow,
} from "./types";

/** Length of the (single, fixed) review period in days. See A5 of the task
    plan: days=28 gives id "last-4-weeks", label "Last 4 weeks". */
export const REVIEW_PERIOD_DAYS = 28;

/**
 * Epley estimated 1RM, rounded to 1 decimal.
 * @param weightKg Weight of the set in kilograms (> 0).
 * @param reps Reps of the set (>= 1).
 * @returns e1RM in kilograms with exactly one decimal.
 */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

/** ascending date order, ties broken by id (deterministic walk order). */
function byDateAsc(a: SessionLogEntry, b: SessionLogEntry): number {
  return a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date);
}

/** Best e1RM of one exercise inside a single session (per-set comparison). */
function bestE1rm(sets: readonly LoggedSet[], exerciseId: string): number {
  let best = Number.NEGATIVE_INFINITY;
  for (const set of sets) {
    if (set.exerciseId !== exerciseId) continue;
    best = Math.max(best, estimateOneRepMax(set.weightKg, set.reps));
  }
  return best;
}

/**
 * Derives PR-bearing rows from raw entries.
 *
 * Walks sessions ascending (A3): the first-ever result for an exercise
 * records the baseline WITHOUT a badge (A2); only a STRICTLY higher rounded
 * e1RM comparison produces a PersonalRecord — equal values are not
 * PRs. Multiple sessions may safely be re-derived: input is never mutated
 * and the walk order is total (date, then id), so shuffled input yields the
 * same rows (order-independence pinned by slice.test.ts).
 *
 * @param entries Raw logged sessions, any order.
 * @returns Rows in ascending order, each with its (possibly empty) records.
 */
export function selectSessionLogRows(
  entries: readonly SessionLogEntry[],
): SessionLogRow[] {
  const ascending = [...entries].sort(byDateAsc);
  const bestByExercise = new Map<string, number>();
  const rows: SessionLogRow[] = [];

  for (const entry of ascending) {
    const exerciseIds = [...new Set(entry.sets.map((set) => set.exerciseId))];
    const records: PersonalRecord[] = [];
    for (const exerciseId of exerciseIds) {
      const previousKg = bestByExercise.get(exerciseId);
      const valueKg = bestE1rm(entry.sets, exerciseId);
      // WHY: strictly greater AFTER rounding — equal bests are not PRs (A2).
      if (previousKg !== undefined && valueKg > previousKg) {
        records.push({
          kind: "estimated-1rm",
          exerciseId,
          exerciseName: entry.sets.find((set) => set.exerciseId === exerciseId)!.exerciseName,
          valueKg,
          previousKg,
        });
      }
      bestByExercise.set(exerciseId, Math.max(previousKg ?? Number.NEGATIVE_INFINITY, valueKg));
    }
    // Records keep the session's own set order for stable rendering.
    const ordered = entry.sets
      .map((set) => records.find((record) => record.exerciseId === set.exerciseId))
      .filter((record): record is PersonalRecord => record !== undefined);
    rows.push({ ...entry, records: ordered });
  }

  return rows;
}

/**
 * @param rows Derived rows (input order irrelevant).
 * @returns A copy sorted newest-first (date desc, then id desc).
 */
export function selectSessionsNewestFirst(
  rows: readonly SessionLogRow[],
): SessionLogRow[] {
  return [...rows].sort(
    (a, b) =>
      a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date),
  );
}

/**
 * The review period window: the last `days` UTC days ending at the newest
 * session date — NOT Date.now(), so tests are clock-independent (A5).
 * @param entries Raw log entries.
 * @param days Period length in days; default {@link REVIEW_PERIOD_DAYS}.
 * @returns The period, or null when the log is empty.
 */
export function selectReviewPeriod(
  entries: readonly SessionLogEntry[],
  days: number = REVIEW_PERIOD_DAYS,
): ReviewPeriod | null {
  const ascending = [...entries].sort(byDateAsc);
  const to = ascending.at(-1)?.date;
  if (!to) return null;
  const toMs = Date.parse(`${to}T00:00:00.000Z`);
  const fromMs = toMs - (days - 1) * 24 * 60 * 60 * 1000;
  const from = new Date(fromMs).toISOString().slice(0, 10);
  const weeks = Math.round(days / 7);
  return {
    // WHY: id is weeks-based, not `last-${days}-days` — A5/contract doc pin
    // id "last-4-weeks" for days=28 (docs/contracts/progress-insight.md §6).
    id: `last-${weeks}-weeks`,
    from,
    to,
    label: `Last ${weeks} weeks`,
  };
}

/**
 * Compact summaries for the gate request: sessions inside
 * `period.from..period.to` (inclusive), ascending, each with its PR count.
 * @param rows Derived rows.
 * @param period The period to summarize.
 */
export function selectInsightSessionSummaries(
  rows: readonly SessionLogRow[],
  period: ReviewPeriod,
): InsightSessionSummary[] {
  return rows
    .filter(
      (row) =>
        row.date.localeCompare(period.from) >= 0 &&
        row.date.localeCompare(period.to) <= 0,
    )
    .sort(byDateAsc)
    .map((row) => ({ id: row.id, date: row.date, split: row.split, prCount: row.records.length }));
}
