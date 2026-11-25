/* entities/session-log — pure selectors (no I/O). Layer reason: business
   logic belongs to entities (AGENTS.md); both the history-log feature (PR
   badges from e1RM) and the insight feature (period + summaries) consume
   these, computed client-side so a badge renders with 0 network requests.
   Terminology per docs/context/glossary.md and ADR-0001. */

import type {
  ExerciseFocus,
  InsightSessionSummary,
  LoggedSet,
  PersonalRecord,
  ReviewPeriod,
  SessionLogEntry,
  SessionLogRow,
  TrackedExercise,
  WeeklyE1rmPoint,
  WeeklyVolumeBand,
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

/** Weekly bucket count of the exercise-focus window (task plan §5.2). */
export const FOCUS_WEEKS = 4;
/** Whole-window length in days; feeds selectReviewPeriod (FOCUS_WEEKS * 7). */
export const FOCUS_WINDOW_DAYS = FOCUS_WEEKS * 7;

/** Round to 1 decimal (same rounding as estimateOneRepMax, kept local so
    both selectors share one helper without exposing it publicly). */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** ISO YYYY-MM-DD from a UTC epoch ms (UTC keeps windows clock-independent). */
function isoDate(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

/** Entries inside `period.from..period.to` (inclusive), ascending — the same
    lexicographic window filter as selectInsightSessionSummaries. */
function windowedEntries(
  entries: readonly SessionLogEntry[],
  period: ReviewPeriod,
): SessionLogEntry[] {
  return [...entries]
    .sort(byDateAsc)
    .filter(
      (entry) =>
        entry.date.localeCompare(period.from) >= 0 &&
        entry.date.localeCompare(period.to) <= 0,
    );
}

/** Weekly bucket index of a date inside the window, or null when the date
    falls outside the `weeks` buckets (guards finite + in-range, plan §5.2
    step 3). WHY offset from period.from, not calendar weeks: A1 pins the
    four 7-day buckets of the review window, so the newest partial week
    never changes shape. */
function bucketIndexOf(date: string, fromMs: number, weeks: number): number | null {
  const offsetMs = Date.parse(`${date}T00:00:00.000Z`) - fromMs;
  const index = Math.floor(offsetMs / (7 * 24 * 60 * 60 * 1000));
  return Number.isFinite(index) && index >= 0 && index < weeks ? index : null;
}

/** Per-exercise aggregate for one weekly bucket. */
interface WeeklyBucket {
  bestE1rm: number;
  sessionVolumes: number[];
  exerciseName: string;
}

/**
 * Exercises logged inside the focus window, sorted for the selector chips.
 * Names come from the FIRST sighting in the ascending (date, id) walk;
 * exercises that appear only outside the window are excluded.
 * @param entries Raw log entries, any order.
 * @param weeks Window length in weekly buckets; default {@link FOCUS_WEEKS}.
 * @returns Options sorted by exerciseName then exerciseId; empty when no
 *   window exists (empty log).
 */
export function selectTrackedExercises(
  entries: readonly SessionLogEntry[],
  weeks: number = FOCUS_WEEKS,
): TrackedExercise[] {
  const period = selectReviewPeriod(entries, weeks * 7);
  if (!period) return [];
  const firstSighting = new Map<string, string>();
  for (const entry of windowedEntries(entries, period)) {
    for (const set of entry.sets) {
      if (!firstSighting.has(set.exerciseId)) {
        firstSighting.set(set.exerciseId, set.exerciseName);
      }
    }
  }
  return [...firstSighting.entries()]
    .map(([exerciseId, exerciseName]) => ({ exerciseId, exerciseName }))
    .sort(
      (a, b) =>
        a.exerciseName.localeCompare(b.exerciseName) ||
        a.exerciseId.localeCompare(b.exerciseId),
    );
}

/**
 * Derives the exercise-focus series for one exercise: weekly best-Epley
 * e1RM points and weekly per-session tonnage (volume) bands over the
 * 4-week window. Pure, order-independent; the input is never mutated.
 *
 * Only POPULATED buckets produce points/bands — no synthetic, interpolated
 * or filled-forward weeks (task plan §1), so the charts show exactly what
 * was logged. Sessions outside the window and sessions without the
 * exercise are ignored; `null` when no populated bucket remains (unknown
 * exercise / empty log).
 *
 * @param entries Raw log entries, any order.
 * @param exerciseId The exercise to focus (plan-exercise id family).
 * @param weeks Window length in weekly buckets; default {@link FOCUS_WEEKS}.
 * @returns The focus series, or null for an unusable input.
 */
export function selectExerciseFocus(
  entries: readonly SessionLogEntry[],
  exerciseId: string,
  weeks: number = FOCUS_WEEKS,
): ExerciseFocus | null {
  const period = selectReviewPeriod(entries, weeks * 7);
  if (!period) return null;
  const fromMs = Date.parse(`${period.from}T00:00:00.000Z`);

  const buckets = new Map<number, WeeklyBucket>();
  for (const entry of windowedEntries(entries, period)) {
    const index = bucketIndexOf(entry.date, fromMs, weeks);
    if (index === null) continue;
    const sets = entry.sets.filter((set) => set.exerciseId === exerciseId);
    if (sets.length === 0) continue;

    let best = Number.NEGATIVE_INFINITY;
    let tonnage = 0;
    for (const set of sets) {
      best = Math.max(best, estimateOneRepMax(set.weightKg, set.reps));
      // Per-session tonnage (plan A2): Σ(weightKg × reps × sets).
      tonnage += set.weightKg * set.reps * set.sets;
    }
    const bucket = buckets.get(index) ?? {
      bestE1rm: Number.NEGATIVE_INFINITY,
      sessionVolumes: [],
      exerciseName: sets[0]!.exerciseName,
    };
    buckets.set(index, {
      bestE1rm: Math.max(bucket.bestE1rm, best),
      sessionVolumes: [...bucket.sessionVolumes, round1(tonnage)],
      exerciseName: bucket.exerciseName,
    });
  }

  if (buckets.size === 0) return null;

  const e1rmPoints: WeeklyE1rmPoint[] = [];
  const volumeBands: WeeklyVolumeBand[] = [];
  // Ascending bucket index — the first one's name IS the first windowed
  // sighting, so it matches selectTrackedExercises labels.
  const firstIndex = [...buckets.keys()].sort((a, b) => a - b)[0]!;
  const exerciseName = buckets.get(firstIndex)!.exerciseName;
  for (const index of [...buckets.keys()].sort((a, b) => a - b)) {
    const bucket = buckets.get(index)!;
    const weekStart = isoDate(fromMs + index * 7 * 24 * 60 * 60 * 1000);
    const sessionVolumes = bucket.sessionVolumes;
    e1rmPoints.push({
      weekStart,
      valueKg: round1(bucket.bestE1rm),
      sessionCount: sessionVolumes.length,
    });
    const total = sessionVolumes.reduce((sum, volume) => sum + volume, 0);
    volumeBands.push({
      weekStart,
      minVolumeKg: round1(Math.min(...sessionVolumes)),
      maxVolumeKg: round1(Math.max(...sessionVolumes)),
      meanVolumeKg: round1(total / sessionVolumes.length),
      sessionCount: sessionVolumes.length,
    });
  }

  return {
    exerciseId,
    exerciseName,
    weekCount: weeks,
    e1rmPoints,
    volumeBands,
  };
}
