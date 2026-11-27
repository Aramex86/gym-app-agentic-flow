/* features/progress-exercise-focus/config/focusCopy — plain copy strings
   and one pure hint builder for the exercise-focus scenario. Layer reason:
   feature config holds scenario copy with NO JSX and NO data access
   (FSAA); keeping it separate lets the UI component stay rendering-only. */

/**
 * User-facing copy of the exercise-focus block.
 * @remarks Strings only — the UI adds no unlisted copy of its own.
 */
export const FOCUS_COPY = {
  heading: "Exercise focus",
  selectorLegend: "Exercise",
  emptyTitle: "No tracked sets yet",
  emptyDescription: "Log a session or compose a plan to start tracking this lift.",
  composerCta: "Open AI composer",
  // Static display copy (plan A6): no entity field, no domain claim.
  t1Badge: "T1 Compound",
  t1BadgeTitle: "T1 compound lift",
  latestE1rmLabel: "Latest e1RM",
  deltaTitle: "Change since the base week",
  legendLine: "1RM Trajectory",
  legendBar: "Volume (Sets × Load)",
  peakPrefix: "Peak",
  stripTitle: "Latest Velocity & RPE Profile",
  stripMeanLabel: "Mean",
  // Honest empty state (plan A3): no per-set velocity/RPE source exists yet.
  stripEmpty: "Per-set velocity and RPE are not captured in the session log yet.",
} as const;

/**
 * Hint shown when fewer than the full window of weeks is populated.
 * @param trackedWeeks Populated weekly buckets (1..weekCount).
 * @param weekCount Window length in weekly buckets.
 * @param exerciseName The focused exercise's display name.
 * @returns e.g. "3 of 4 weeks tracked — keep logging Back Squat to
 *   complete the trajectory."
 * @remarks Pure text builder — call it only when trackedWeeks < weekCount.
 */
export function incompleteHint(
  trackedWeeks: number,
  weekCount: number,
  exerciseName: string,
): string {
  return `${trackedWeeks} of ${weekCount} weeks tracked — keep logging ${exerciseName} to complete the trajectory.`;
}
