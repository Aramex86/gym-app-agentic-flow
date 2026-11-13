/* entities/training-plan — pure filtering logic. Immutable projection:
   original week/day/exercise objects are never mutated; the original
   array reference is returned for empty queries. Matches exercise NAMES
   only — split/focus/week numbers are deliberately not searchable. */

import type { PlanDay, PlanWeek } from "./types";

export function filterPlanWeeksByExerciseName(
  weeks: PlanWeek[],
  query: string,
): PlanWeek[] {
  const normalized = query.trim().toLowerCase();

  /* Empty (or whitespace-only) query: complete, unfiltered view.
     Returning the original reference keeps the fast path allocation-free. */
  if (normalized.length === 0) {
    return weeks;
  }

  return weeks
    .map((week) => {
      const days = week.days
        .map((day): PlanDay | null => {
          const exercises = day.exercises.filter((exercise) =>
            exercise.name.toLowerCase().includes(normalized),
          );
          /* Omit days with no matching exercises. */
          return exercises.length > 0 ? { ...day, exercises } : null;
        })
        .filter((day): day is PlanDay => day !== null);

      /* Omit weeks left with no remaining days. */
      return days.length > 0 ? { ...week, days } : null;
    })
    .filter((week): week is PlanWeek => week !== null);
}
