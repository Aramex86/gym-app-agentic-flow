/* entities/session-log — pure selector tests (node env, no I/O). The sample
   derivations (3 PRs, period window, summaries) are the test spec from the
   task plan §5.5/§7; the UI relies exactly on these pins. */

import { describe, expect, it } from "vitest";
import {
  FOCUS_WEEKS,
  REVIEW_PERIOD_DAYS,
  estimateOneRepMax,
  selectExerciseFocus,
  selectInsightSessionSummaries,
  selectReviewPeriod,
  selectSessionLogRows,
  selectSessionsNewestFirst,
  selectTrackedExercises,
} from "../index";
import { SESSION_LOG_SAMPLE } from "../sample";

describe("entities/session-log estimateOneRepMax", () => {
  it("uses Epley rounded to 1 decimal", () => {
    expect(estimateOneRepMax(100, 5)).toBe(116.7);
    expect(estimateOneRepMax(80, 8)).toBe(101.3);
    expect(estimateOneRepMax(82.5, 8)).toBe(104.5);
    expect(estimateOneRepMax(80, 10)).toBe(106.7);
    expect(estimateOneRepMax(105, 5)).toBe(122.5);
  });
});

describe("entities/session-log selectSessionLogRows", () => {
  it("first sighting of an exercise records the baseline without a record", () => {
    const [first] = selectSessionLogRows([
      { id: "s1", date: "2026-11-02", split: "Upper", durationMin: 60,
        sets: [{ exerciseId: "barbell-bench-press", exerciseName: "Bench Press", weightKg: 80, reps: 8, sets: 4 }] },
    ]);
    expect(first).toBeTruthy();
    expect(first!.records).toEqual([]);
  });

  it("a strictly higher e1RM beats the previous best (bench 82.5x8 over 80x8)", () => {
    const rows = selectSessionLogRows(SESSION_LOG_SAMPLE.slice(0, 3));
    const third = rows[2]!;
    expect(third.records.length).toBe(1);
    expect(third.records[0]).toMatchObject({
      kind: "estimated-1rm",
      exerciseId: "barbell-bench-press",
      valueKg: 104.5,
      previousKg: 101.3,
    });
  });

  it("equal or lower e1RM yields no record (strict '>')", () => {
    const rows = selectSessionLogRows(SESSION_LOG_SAMPLE.slice(0, 4));
    // Session 2 and 4 are identical lower sessions: no second squat/RDL PR.
    expect(rows[1]!.records).toEqual([]);
    expect(rows[3]!.records).toEqual([]);
  });

  it("uses the best set per exercise and is input-order independent", () => {
    const multi = [
      { id: "s1", date: "2026-11-02", split: "Upper", durationMin: 60,
        sets: [
          { exerciseId: "bench", exerciseName: "Bench", weightKg: 80, reps: 8, sets: 1 },
          { exerciseId: "bench", exerciseName: "Bench", weightKg: 70, reps: 8, sets: 1 },
        ] },
      { id: "s2", date: "2026-11-05", split: "Upper", durationMin: 60,
        sets: [
          { exerciseId: "bench", exerciseName: "Bench", weightKg: 75, reps: 8, sets: 1 },
          { exerciseId: "bench", exerciseName: "Bench", weightKg: 82.5, reps: 8, sets: 1 },
        ] },
    ];
    const rows = selectSessionLogRows(multi);
    const shuffled = selectSessionLogRows([...multi].reverse());
    expect(rows[1]!.records[0]).toMatchObject({ valueKg: 104.5, previousKg: 101.3 });
    expect(shuffled[1]!.records).toEqual(rows[1]!.records);
  });

  it("a PR record follows the session's own set order", () => {
    const rows = selectSessionLogRows(SESSION_LOG_SAMPLE);
    const last = rows[5]!;
    // WHY: the newest lower session lists squat first; its record must be
    // records[0] with the e1RM values the sample pin promises.
    expect(last.records).toHaveLength(1);
    expect(last.records[0]).toEqual(
      expect.objectContaining({ exerciseId: "back-squat", valueKg: 122.5, previousKg: 116.7 }),
    );
  });
});

describe("entities/session-log sample derivations (task §5.5/§7 pins)", () => {
  const rows = selectSessionLogRows(SESSION_LOG_SAMPLE);

  it("yields exactly 3 PRs across 6 sessions (sessions 3/5/6 carry them)", () => {
    const prCounts = rows.map((row) => row.records.length);
    expect(prCounts).toEqual([0, 0, 1, 0, 1, 1]);
    expect(prCounts.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("newest-first ordering starts at the 2026-11-19 session", () => {
    const newestFirst = selectSessionsNewestFirst(rows);
    expect(newestFirst.map((row) => row.id)[0]).toBe("s-2026-11-19-lower");
    expect(newestFirst.map((row) => row.date)).toEqual([
      "2026-11-19", "2026-11-16", "2026-11-12", "2026-11-09", "2026-11-05", "2026-11-02",
    ]);
  });
});

describe("entities/session-log selectReviewPeriod", () => {
  it("windows the last 28 days ending at the newest session date", () => {
    const period = selectReviewPeriod(SESSION_LOG_SAMPLE);
    expect(period).toEqual({
      id: "last-4-weeks",
      from: "2026-10-23",
      to: "2026-11-19",
      label: "Last 4 weeks",
    });
    expect(REVIEW_PERIOD_DAYS).toBe(28);
  });

  it("returns null for an empty log", () => {
    expect(selectReviewPeriod([])).toBeNull();
  });
});

describe("entities/session-log selectInsightSessionSummaries", () => {
  it("summarizes all six sample sessions with their PR counts", () => {
    const period = selectReviewPeriod(SESSION_LOG_SAMPLE)!;
    const summaries = selectInsightSessionSummaries(selectSessionLogRows(SESSION_LOG_SAMPLE), period);
    expect(summaries).toEqual([
      { id: "s-2026-11-02-upper", date: "2026-11-02", split: "Upper", prCount: 0 },
      { id: "s-2026-11-05-lower", date: "2026-11-05", split: "Lower", prCount: 0 },
      { id: "s-2026-11-09-upper", date: "2026-11-09", split: "Upper", prCount: 1 },
      { id: "s-2026-11-12-lower", date: "2026-11-12", split: "Lower", prCount: 0 },
      { id: "s-2026-11-16-upper", date: "2026-11-16", split: "Upper", prCount: 1 },
      { id: "s-2026-11-19-lower", date: "2026-11-19", split: "Lower", prCount: 1 },
    ]);
  });

  it("excludes sessions outside the window", () => {
    const period = { id: "p", from: "2026-11-10", to: "2026-11-16", label: "Test" };
    const summaries = selectInsightSessionSummaries(selectSessionLogRows(SESSION_LOG_SAMPLE), period);
    expect(summaries.map((summary) => summary.id)).toEqual([
      "s-2026-11-12-lower", "s-2026-11-16-upper",
    ]);
  });
});

/* Exercise-focus selectors (task plan §5.2/§9.1): the four 7-day buckets of
   the 2026-10-23..2026-11-19 window start 10-23, 10-30, 11-06, 11-13. The
   pins below ARE the chart contract the feature renders. */
describe("entities/session-log selectTrackedExercises", () => {
  it("returns the five windowed exercises sorted by name then id", () => {
    expect(selectTrackedExercises(SESSION_LOG_SAMPLE)).toEqual([
      { exerciseId: "back-squat", exerciseName: "Back Squat" },
      { exerciseId: "barbell-bench-press", exerciseName: "Bench Press" },
      { exerciseId: "cable-row", exerciseName: "Cable Row" },
      { exerciseId: "incline-dumbbell-press", exerciseName: "Incline DB Press" },
      { exerciseId: "romanian-deadlift", exerciseName: "Romanian Deadlift" },
    ]);
  });

  it("excludes exercises that appear only outside the window", () => {
    const withExternal = [
      ...SESSION_LOG_SAMPLE,
      {
        id: "s-2026-09-01-legacy",
        date: "2026-09-01",
        split: "Upper",
        durationMin: 60,
        sets: [
          { exerciseId: "legacy-lift", exerciseName: "Legacy Lift", weightKg: 50, reps: 10, sets: 3 },
        ],
      },
    ];
    const ids = selectTrackedExercises(withExternal).map((exercise) => exercise.exerciseId);
    expect(ids).not.toContain("legacy-lift");
  });

  it("returns [] for an empty log", () => {
    expect(selectTrackedExercises([])).toEqual([]);
  });
});

describe("entities/session-log selectExerciseFocus — sample pins", () => {
  it("FOCUS_WEEKS is 4 (window 28 days)", () => {
    expect(FOCUS_WEEKS).toBe(4);
  });

  it("bench: 3 populated buckets — e1RM 101.3/104.5/106.7, tonnage 2560/2640/3200", () => {
    const focus = selectExerciseFocus(SESSION_LOG_SAMPLE, "barbell-bench-press");
    expect(focus).not.toBeNull();
    expect(focus!.exerciseId).toBe("barbell-bench-press");
    expect(focus!.exerciseName).toBe("Bench Press");
    expect(focus!.weekCount).toBe(FOCUS_WEEKS);
    expect(focus!.e1rmPoints).toEqual([
      { weekStart: "2026-10-30", valueKg: 101.3, sessionCount: 1 },
      { weekStart: "2026-11-06", valueKg: 104.5, sessionCount: 1 },
      { weekStart: "2026-11-13", valueKg: 106.7, sessionCount: 1 },
    ]);
    expect(focus!.volumeBands).toEqual([
      { weekStart: "2026-10-30", minVolumeKg: 2560, maxVolumeKg: 2560, meanVolumeKg: 2560, sessionCount: 1 },
      { weekStart: "2026-11-06", minVolumeKg: 2640, maxVolumeKg: 2640, meanVolumeKg: 2640, sessionCount: 1 },
      { weekStart: "2026-11-13", minVolumeKg: 3200, maxVolumeKg: 3200, meanVolumeKg: 3200, sessionCount: 1 },
    ]);
  });

  it("squat: 3 populated buckets — e1RM 116.7/116.7/122.5, tonnage 2500/2500/2625", () => {
    const focus = selectExerciseFocus(SESSION_LOG_SAMPLE, "back-squat");
    expect(focus).not.toBeNull();
    expect(focus!.e1rmPoints).toEqual([
      { weekStart: "2026-10-30", valueKg: 116.7, sessionCount: 1 },
      { weekStart: "2026-11-06", valueKg: 116.7, sessionCount: 1 },
      { weekStart: "2026-11-13", valueKg: 122.5, sessionCount: 1 },
    ]);
    expect(focus!.volumeBands).toEqual([
      { weekStart: "2026-10-30", minVolumeKg: 2500, maxVolumeKg: 2500, meanVolumeKg: 2500, sessionCount: 1 },
      { weekStart: "2026-11-06", minVolumeKg: 2500, maxVolumeKg: 2500, meanVolumeKg: 2500, sessionCount: 1 },
      { weekStart: "2026-11-13", minVolumeKg: 2625, maxVolumeKg: 2625, meanVolumeKg: 2625, sessionCount: 1 },
    ]);
  });

  it("exercises that appear only outside the window yield null", () => {
    const onlyExternal = [
      {
        id: "s-2026-09-01-legacy",
        date: "2026-09-01",
        split: "Upper",
        durationMin: 60,
        sets: [
          { exerciseId: "legacy-lift", exerciseName: "Legacy Lift", weightKg: 50, reps: 10, sets: 3 },
        ],
      },
      ...SESSION_LOG_SAMPLE,
    ];
    // legacy-lift sessions are all older than the newest session, so the
    // window (2026-10-23..2026-11-19) never contains it.
    expect(selectExerciseFocus(onlyExternal, "legacy-lift")).toBeNull();
  });

  it("unknown exercise id → null; empty log → null", () => {
    expect(selectExerciseFocus(SESSION_LOG_SAMPLE, "no-such-exercise")).toBeNull();
    expect(selectExerciseFocus([], "barbell-bench-press")).toBeNull();
  });

  it("sessions older than the 4-week window are ignored (no 4th point)", () => {
    const withOld = [
      ...SESSION_LOG_SAMPLE,
      {
        id: "s-2026-10-01-upper",
        date: "2026-10-01",
        split: "Upper",
        durationMin: 60,
        sets: [
          { exerciseId: "barbell-bench-press", exerciseName: "Bench Press", weightKg: 70, reps: 10, sets: 3 },
        ],
      },
    ];
    // The 2026-10-01 bench session sits before period.from (2026-10-23):
    // bench still shows exactly its 3 in-window points, no synthesized 4th.
    const focus = selectExerciseFocus(withOld, "barbell-bench-press");
    expect(focus!.e1rmPoints.map((point) => point.weekStart)).toEqual([
      "2026-10-30", "2026-11-06", "2026-11-13",
    ]);
  });

  it("multi-session bucket: dispersion without inventing empty buckets", () => {
    // Two bench sessions inside ONE weekly bucket (80×8×4 = 2560 kg and
    // 70×10×3 = 2100 kg; best e1RM 101.3): one bucket, sessionCount 2.
    const multiSession = [
      {
        id: "s-2026-11-02-upper",
        date: "2026-11-02",
        split: "Upper",
        durationMin: 62,
        sets: [
          { exerciseId: "barbell-bench-press", exerciseName: "Bench Press", weightKg: 80, reps: 8, sets: 4 },
        ],
      },
      {
        id: "s-2026-11-04-upper",
        date: "2026-11-04",
        split: "Upper",
        durationMin: 55,
        sets: [
          { exerciseId: "barbell-bench-press", exerciseName: "Bench Press", weightKg: 70, reps: 10, sets: 3 },
        ],
      },
    ];
    // WHY: window ends at the newest session (2026-11-04), so buckets start
    // 2026-10-29; both sessions fall in bucket index 3 (from +21 days).
    const focus = selectExerciseFocus(multiSession, "barbell-bench-press");
    expect(focus!.e1rmPoints).toEqual([
      { weekStart: "2026-10-29", valueKg: 101.3, sessionCount: 2 },
    ]);
    expect(focus!.volumeBands).toEqual([
      { weekStart: "2026-10-29", minVolumeKg: 2100, maxVolumeKg: 2560, meanVolumeKg: 2330, sessionCount: 2 },
    ]);
  });

  it("is input-order independent (reversed input → deep-equal result)", () => {
    expect(selectExerciseFocus([...SESSION_LOG_SAMPLE].reverse(), "barbell-bench-press"))
      .toEqual(selectExerciseFocus(SESSION_LOG_SAMPLE, "barbell-bench-press"));
    expect(selectTrackedExercises([...SESSION_LOG_SAMPLE].reverse()))
      .toEqual(selectTrackedExercises(SESSION_LOG_SAMPLE));
  });
});
