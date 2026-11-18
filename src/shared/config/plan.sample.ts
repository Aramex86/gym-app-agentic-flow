/* shared/config — static sample plan, mirrors docs/contracts/plan-schema.md §6.
   4 weeks x 2 day-splits (Upper/Lower) x 5 exercises = 40 exercises.
   Data only: no colors, no hex, no design values (ADR-0001 D5 not involved). */
import type { PlanExercise, TrainingPlan } from './plan.schema';

const PLAN_ID = 'sample-4w-upper-lower';
const DISCLAIMER =
  'This plan is for informational purposes only and is not medical advice. Consult a qualified professional before starting any training program.';

const FOCUS = ['Base Volume', 'Build', 'Peak', 'Deload'] as const;

type WeekCells = readonly [sets: number, reps: number, rpe: number, restSec: number][];

/** [name, per-week [sets, reps, rpe, restSec] for weeks 1..4] */
const UPPER_EXERCISES: readonly (readonly [name: string, cells: WeekCells])[] = [
  ['Barbell Bench Press', [[4, 8, 7, 120], [4, 8, 8, 120], [5, 6, 8, 150], [3, 8, 6, 90]]],
  ['Weighted Pull-up', [[4, 6, 7, 120], [4, 6, 8, 120], [5, 5, 8, 150], [3, 6, 6, 90]]],
  ['Incline Dumbbell Press', [[3, 10, 7, 90], [3, 10, 8, 90], [4, 8, 8, 90], [2, 10, 6, 60]]],
  ['Seated Dumbbell Shoulder Press', [[3, 12, 7, 60], [3, 12, 8, 60], [4, 10, 8, 75], [2, 12, 6, 60]]],
  ['Cable Triceps Pushdown', [[3, 15, 7, 45], [3, 15, 8, 45], [4, 12, 8, 60], [2, 15, 6, 45]]],
];

const LOWER_EXERCISES: readonly (readonly [name: string, cells: WeekCells])[] = [
  ['Back Squat', [[5, 5, 7, 180], [5, 5, 8, 180], [6, 4, 8, 210], [4, 5, 6, 120]]],
  ['Romanian Deadlift', [[3, 8, 7, 120], [3, 8, 8, 120], [4, 8, 8, 120], [2, 8, 6, 90]]],
  ['Bulgarian Split Squat', [[3, 10, 7, 90], [3, 10, 8, 90], [4, 8, 8, 90], [2, 10, 6, 60]]],
  ['Leg Press', [[3, 12, 7, 90], [3, 12, 8, 90], [4, 12, 8, 90], [2, 12, 6, 60]]],
  ['Standing Calf Raise', [[4, 15, 7, 45], [4, 15, 8, 45], [5, 12, 8, 60], [3, 15, 6, 45]]],
];

const SPLITS: readonly { day: number; split: string; list: typeof UPPER_EXERCISES }[] = [
  { day: 1, split: 'Upper', list: UPPER_EXERCISES },
  { day: 2, split: 'Lower', list: LOWER_EXERCISES },
];

function slug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

function buildExercise(
  splitSlug: string,
  name: string,
  week: number,
  [sets, reps, rpe, restSec]: readonly [number, number, number, number],
): PlanExercise {
  return { id: `${splitSlug}-${slug(name)}-w${week}`, name, sets, reps, rpe, restSec };
}

export const SAMPLE_PLAN: TrainingPlan = {
  schemaVersion: '0.1',
  planId: PLAN_ID,
  title: 'Sample Hypertrophy Block — 4 Weeks',
  goal: 'Strength & hypertrophy',
  level: 'intermediate',
  disclaimer: DISCLAIMER,
  weeks: FOCUS.map((focus, weekIndex) => {
    const week = weekIndex + 1;
    return {
      week,
      focus,
      days: SPLITS.map(({ day, split, list }) => ({
        day,
        split,
        exercises: list.map(([name, cells]) => buildExercise(split.toLowerCase(), name, week, cells[weekIndex])),
      })),
    };
  }),
};
