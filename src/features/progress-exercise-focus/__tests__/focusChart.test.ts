/* features/progress-exercise-focus — pure config mapping tests (node env,
   no DOM, no I/O). These pins ARE the chart contract between the entity
   selectors and the ComboChart atom (plan §7.6 step 3): ISO week labels,
   row pairing with the base anchor first, the exact aria-label strings,
   peak/latest/delta helpers. Selectors' outputs are pinned by
   entities/session-log slice.test.ts — these tests consume that contract. */

import { describe, expect, it } from "vitest";
import {
  buildComboRows,
  comboAriaLabel,
  e1rmDeltaPercent,
  formatDelta,
  isoWeekLabel,
  latestE1rm,
  peakE1rm,
} from "../config/focusChart";
import { selectExerciseFocus } from "@entities/session-log";
import { SESSION_LOG_SAMPLE } from "@entities/session-log";
import type { ExerciseFocus, SessionLogEntry } from "@entities/session-log";

/* Sample fixtures as pinned by the entity tests: window
   2026-10-23..2026-11-19, buckets starting 2026-10-30 / 11-06 / 11-13. */
const SQUAT = selectExerciseFocus(SESSION_LOG_SAMPLE, "back-squat")!;
const BENCH = selectExerciseFocus(SESSION_LOG_SAMPLE, "barbell-bench-press")!;

/* 4-week bench window (as in the card tests): to = 2026-11-25, buckets
   starting 2026-10-29 → WK44/45/46/47. */
const FOUR_BUCKET_FIXTURE: SessionLogEntry[] = [
  { id: "s-2026-11-04-upper", date: "2026-11-04", split: "Upper", durationMin: 60,
    sets: [{ exerciseId: "barbell-bench-press", exerciseName: "Bench Press", weightKg: 80, reps: 8, sets: 4 }] },
  { id: "s-2026-11-11-upper", date: "2026-11-11", split: "Upper", durationMin: 60,
    sets: [{ exerciseId: "barbell-bench-press", exerciseName: "Bench Press", weightKg: 82.5, reps: 8, sets: 4 }] },
  { id: "s-2026-11-18-upper", date: "2026-11-18", split: "Upper", durationMin: 60,
    sets: [{ exerciseId: "barbell-bench-press", exerciseName: "Bench Press", weightKg: 85, reps: 8, sets: 4 }] },
  { id: "s-2026-11-25-upper", date: "2026-11-25", split: "Upper", durationMin: 60,
    sets: [{ exerciseId: "barbell-bench-press", exerciseName: "Bench Press", weightKg: 90, reps: 8, sets: 4 }] },
];
const FOUR_WEEKS = selectExerciseFocus(FOUR_BUCKET_FIXTURE, "barbell-bench-press")!;

/* Same fixture plus a real pre-window anchor session (2026-10-26 sits in
   the 7 days before from = 2026-10-29; Epley 75×8 = 95.0 kg). */
const ANCHOR_FIXTURE: SessionLogEntry[] = [
  ...FOUR_BUCKET_FIXTURE,
  { id: "s-2026-10-26-upper", date: "2026-10-26", split: "Upper", durationMin: 58,
    sets: [{ exerciseId: "barbell-bench-press", exerciseName: "Bench Press", weightKg: 75, reps: 8, sets: 1 }] },
];
const ANCHORED = selectExerciseFocus(ANCHOR_FIXTURE, "barbell-bench-press")!;

describe("features/progress-exercise-focus isoWeekLabel (plan pins)", () => {
  it("maps ISO dates to real ISO-8601 weeks, UTC arithmetic, no Intl", () => {
    expect(isoWeekLabel("2026-10-16")).toBe("WK42");
    expect(isoWeekLabel("2026-10-22")).toBe("WK43");
    expect(isoWeekLabel("2026-10-23")).toBe("WK43");
    expect(isoWeekLabel("2026-10-29")).toBe("WK44");
    expect(isoWeekLabel("2026-10-30")).toBe("WK44");
    expect(isoWeekLabel("2026-11-06")).toBe("WK45");
    expect(isoWeekLabel("2026-11-13")).toBe("WK46");
    expect(isoWeekLabel("2026-11-19")).toBe("WK47");
  });

  it("survives the year boundary without a silent wrap", () => {
    // 2026-12-28 (Monday) → WK53 of 2026; 2027-01-01 (Friday) is in the
    // SAME ISO week (WK53) — week 1 of 2027 starts Monday 2027-01-04.
    expect(isoWeekLabel("2026-12-28")).toBe("WK53");
    expect(isoWeekLabel("2027-01-01")).toBe("WK53");
    expect(isoWeekLabel("2027-01-04")).toBe("WK1");
  });
});

describe("features/progress-exercise-focus buildComboRows (plan Step 3)", () => {
  it("sample squat: one row per populated week, mean volume as the bar", () => {
    expect(buildComboRows(SQUAT)).toEqual([
      { label: "WK44", barValue: 2500, lineValue: 116.7 },
      { label: "WK45", barValue: 2500, lineValue: 116.7 },
      { label: "WK46", barValue: 2625, lineValue: 122.5 },
    ]);
  });

  it("anchor first with bar null, then data weeks (real session anchor)", () => {
    expect(buildComboRows(ANCHORED)).toEqual([
      { label: "WK43", barValue: null, lineValue: 95 },
      { label: "WK44", barValue: 2560, lineValue: 101.3 },
      { label: "WK45", barValue: 2640, lineValue: 104.5 },
      { label: "WK46", barValue: 2720, lineValue: 107.7 },
      { label: "WK47", barValue: 2880, lineValue: 114 },
    ]);
  });

  it("no anchor → no leading null-bar row (sample bench, no synthetic tick)", () => {
    expect(buildComboRows(BENCH).map((row) => row.label)).toEqual(["WK44", "WK45", "WK46"]);
    expect(buildComboRows(BENCH).every((row) => row.barValue !== null)).toBe(true);
  });

  it("full 4-week window → 4 rows WK44..WK47, no gap row", () => {
    expect(buildComboRows(FOUR_WEEKS).map((row) => row.label)).toEqual([
      "WK44", "WK45", "WK46", "WK47",
    ]);
  });
});

describe("features/progress-exercise-focus comboAriaLabel (exact pinned format)", () => {
  it("no anchor: '<Exercise> 1RM trajectory and weekly volume: WK…'", () => {
    expect(comboAriaLabel(SQUAT)).toBe(
      "Back Squat 1RM trajectory and weekly volume: " +
        "WK44 116.7 kg 1RM, 2500 kg volume; " +
        "WK45 116.7 kg 1RM, 2500 kg volume; " +
        "WK46 122.5 kg 1RM, 2625 kg volume.",
    );
  });

  it("with anchor: 'WK43 base anchor 95 kg 1RM; WK44 …'", () => {
    expect(comboAriaLabel(ANCHORED).startsWith(
      "Bench Press 1RM trajectory and weekly volume: WK43 base anchor 95 kg 1RM; WK44",
    )).toBe(true);
  });
});

describe("features/progress-exercise-focus peak / latest / delta (plan pins)", () => {
  it("peakE1rm: squat sample 122.5, bench sample 106.7", () => {
    expect(peakE1rm(SQUAT)?.valueKg).toBe(122.5);
    expect(peakE1rm(BENCH)?.valueKg).toBe(106.7);
  });

  it("peakE1rm considers the anchor and returns null without points", () => {
    expect(peakE1rm(ANCHORED)?.valueKg).toBe(114);
    expect(
      peakE1rm({ ...BENCH, e1rmPoints: [], volumeBands: [], baseAnchor: undefined }),
    ).toBeNull();
  });

  it("latestE1rm: the last data-week point, never the anchor", () => {
    expect(latestE1rm(SQUAT)?.valueKg).toBe(122.5);
    expect(latestE1rm(ANCHORED)?.weekStart).toBe("2026-11-19");
  });

  it("e1rmDeltaPercent: squat 4.97…, bench +5.3 via formatDelta", () => {
    // (122.5 − 116.7) / 116.7 × 100.
    expect(e1rmDeltaPercent(SQUAT)).toBeCloseTo(4.97, 2);
    expect(formatDelta(e1rmDeltaPercent(BENCH)!)).toBe("+5.3%");
  });

  it("full 4-week fixture → +12.5%; anchor shifts the base", () => {
    expect(formatDelta(e1rmDeltaPercent(FOUR_WEEKS)!)).toBe("+12.5%");
    // Base = anchor 95 kg → (114 − 95) / 95 = +20.0%.
    expect(formatDelta(e1rmDeltaPercent(ANCHORED)!)).toBe("+20.0%");
  });

  it("a single point with no anchor has no delta (base === latest)", () => {
    const single: ExerciseFocus = {
      ...SQUAT,
      e1rmPoints: [SQUAT.e1rmPoints[0]!],
      volumeBands: [SQUAT.volumeBands[0]!],
    };
    expect(e1rmDeltaPercent(single)).toBeNull();
  });
});

describe("features/progress-exercise-focus formatDelta (plan pins)", () => {
  it("one decimal, explicit sign", () => {
    expect(formatDelta(4.971722)).toBe("+5.0%");
    expect(formatDelta(0)).toBe("0.0%");
    expect(formatDelta(-2.04)).toBe("-2.0%");
    expect(formatDelta(12.537)).toBe("+12.5%");
  });
});
