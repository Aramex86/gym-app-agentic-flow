/* entities/session-log — pure selector tests (node env, no I/O). The sample
   derivations (3 PRs, period window, summaries) are the test spec from the
   task plan §5.5/§7; the UI relies exactly on these pins. */

import { describe, expect, it } from "vitest";
import {
  REVIEW_PERIOD_DAYS,
  estimateOneRepMax,
  selectInsightSessionSummaries,
  selectReviewPeriod,
  selectSessionLogRows,
  selectSessionsNewestFirst,
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
