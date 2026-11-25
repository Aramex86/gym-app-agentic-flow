/* entities/session-log — deterministic static fixture. Layer reason: the
   entity owns the data source (AGENTS.md data rule); the app renders the
   log and PR badges from this sample while the Logger feature is still a
   placeholder. Dates are fixed Nov 2026 so tests are clock-independent.
   Expected derivations are pinned in slice.test.ts: 3 PRs, period
   2026-10-23..2026-11-19. */

import type { SessionLogEntry } from "./types";

/**
 * Static sample of completed sessions, ascending by date.
 * `exerciseId` values are the stable kebab ids of the plan exercise family.
 */
export const SESSION_LOG_SAMPLE: readonly SessionLogEntry[] = [
  {
    id: "s-2026-11-02-upper",
    date: "2026-11-02",
    split: "Upper",
    durationMin: 62,
    sets: [
      { exerciseId: "barbell-bench-press", exerciseName: "Bench Press", weightKg: 80, reps: 8, sets: 4 },
      { exerciseId: "incline-dumbbell-press", exerciseName: "Incline DB Press", weightKg: 30, reps: 10, sets: 3 },
      { exerciseId: "cable-row", exerciseName: "Cable Row", weightKg: 70, reps: 10, sets: 3 },
    ],
  },
  {
    id: "s-2026-11-05-lower",
    date: "2026-11-05",
    split: "Lower",
    durationMin: 70,
    sets: [
      { exerciseId: "back-squat", exerciseName: "Back Squat", weightKg: 100, reps: 5, sets: 5 },
      { exerciseId: "romanian-deadlift", exerciseName: "Romanian Deadlift", weightKg: 90, reps: 8, sets: 3 },
    ],
  },
  {
    id: "s-2026-11-09-upper",
    date: "2026-11-09",
    split: "Upper",
    durationMin: 65,
    sets: [
      { exerciseId: "barbell-bench-press", exerciseName: "Bench Press", weightKg: 82.5, reps: 8, sets: 4 },
      { exerciseId: "incline-dumbbell-press", exerciseName: "Incline DB Press", weightKg: 30, reps: 10, sets: 3 },
      { exerciseId: "cable-row", exerciseName: "Cable Row", weightKg: 70, reps: 10, sets: 3 },
    ],
  },
  {
    id: "s-2026-11-12-lower",
    date: "2026-11-12",
    split: "Lower",
    durationMin: 68,
    sets: [
      { exerciseId: "back-squat", exerciseName: "Back Squat", weightKg: 100, reps: 5, sets: 5 },
      { exerciseId: "romanian-deadlift", exerciseName: "Romanian Deadlift", weightKg: 90, reps: 8, sets: 3 },
    ],
  },
  {
    id: "s-2026-11-16-upper",
    date: "2026-11-16",
    split: "Upper",
    durationMin: 60,
    sets: [
      { exerciseId: "barbell-bench-press", exerciseName: "Bench Press", weightKg: 80, reps: 10, sets: 4 },
      { exerciseId: "incline-dumbbell-press", exerciseName: "Incline DB Press", weightKg: 30, reps: 10, sets: 3 },
      { exerciseId: "cable-row", exerciseName: "Cable Row", weightKg: 70, reps: 10, sets: 3 },
    ],
  },
  {
    id: "s-2026-11-19-lower",
    date: "2026-11-19",
    split: "Lower",
    durationMin: 72,
    sets: [
      { exerciseId: "back-squat", exerciseName: "Back Squat", weightKg: 105, reps: 5, sets: 5 },
      { exerciseId: "romanian-deadlift", exerciseName: "Romanian Deadlift", weightKg: 90, reps: 8, sets: 3 },
    ],
  },
];
